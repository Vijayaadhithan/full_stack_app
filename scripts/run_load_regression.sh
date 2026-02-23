#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULTS_DIR="${ROOT_DIR}/benchmark-results/regression"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

SCENARIO="${1:-${SCENARIO:-tier_100}}"
BASE_URL="${BASE_URL:-http://localhost:5000}"
P95_TARGET_MS="${P95_TARGET_MS:-1500}"
P99_TARGET_MS="${P99_TARGET_MS:-2500}"
MAX_FAILED_RATE_PERCENT="${MAX_FAILED_RATE_PERCENT:-5}"
MAX_MEMORY_MB="${MAX_MEMORY_MB:-0}"
KEEP_RAW_K6_OUTPUT="${KEEP_RAW_K6_OUTPUT:-false}"

mkdir -p "${RESULTS_DIR}"

if command -v k6 >/dev/null 2>&1; then
  K6_CMD=(k6)
else
  K6_CMD=(npx k6)
fi

RAW_FILE="${RESULTS_DIR}/k6_raw_${SCENARIO}_${TIMESTAMP}.json"
SUMMARY_FILE="${RESULTS_DIR}/summary_${SCENARIO}_${TIMESTAMP}.json"
ASSERTIONS_JSON="${RESULTS_DIR}/assertions_${SCENARIO}_${TIMESTAMP}.json"
ASSERTIONS_MD="${RESULTS_DIR}/assertions_${SCENARIO}_${TIMESTAMP}.md"

echo "Running load regression benchmark"
echo "  Scenario: ${SCENARIO}"
echo "  Base URL: ${BASE_URL}"
echo "  Targets: p95<=${P95_TARGET_MS}ms, p99<=${P99_TARGET_MS}ms, fail-rate<=${MAX_FAILED_RATE_PERCENT}%"
if [[ "${MAX_MEMORY_MB}" != "0" ]]; then
  echo "  Memory target: <=${MAX_MEMORY_MB}MB"
fi

pushd "${ROOT_DIR}" >/dev/null

existing_summary_files="$(ls -1 benchmark_${SCENARIO}_*.json 2>/dev/null || true)"

k6_exit_code=0
set +e
DISABLE_RATE_LIMITERS=true "${K6_CMD[@]}" run \
  --quiet \
  --log-output=none \
  --env "SCENARIO=${SCENARIO}" \
  --env "BASE_URL=${BASE_URL}" \
  --out "json=${RAW_FILE}" \
  "load-test-benchmark.js"
k6_exit_code=$?
set -e

if [[ ${k6_exit_code} -ne 0 ]]; then
  echo "k6 exited with status ${k6_exit_code}. Continuing to collect summary/assertions."
fi

latest_summary="$(ls -1t benchmark_${SCENARIO}_*.json 2>/dev/null | head -n 1 || true)"
if [[ -z "${latest_summary}" ]]; then
  echo "Load test completed but no benchmark summary file was produced."
  echo "Expected file pattern: benchmark_${SCENARIO}_*.json"
  exit 2
fi

cp "${latest_summary}" "${SUMMARY_FILE}"

# Keep workspace tidy by removing only the new root-level summary artifact.
if [[ "${existing_summary_files}" != *"${latest_summary}"* ]]; then
  rm -f "${latest_summary}"
fi

assertions_exit_code=0
set +e
node - "${SUMMARY_FILE}" "${ASSERTIONS_JSON}" "${ASSERTIONS_MD}" \
  "${P95_TARGET_MS}" "${P99_TARGET_MS}" "${MAX_FAILED_RATE_PERCENT}" "${MAX_MEMORY_MB}" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [
  ,
  ,
  summaryPath,
  assertionsJsonPath,
  assertionsMdPath,
  p95TargetRaw,
  p99TargetRaw,
  failRateTargetRaw,
  memoryTargetRaw,
] = process.argv;

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const p95Target = toNumber(p95TargetRaw);
const p99Target = toNumber(p99TargetRaw);
const failRateTarget = toNumber(failRateTargetRaw);
const memoryTarget = toNumber(memoryTargetRaw);

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const p95 = toNumber(summary?.latency?.p95);
const p99 = toNumber(summary?.latency?.p99);
const failedRatePercent = toNumber(summary?.requests?.failed);
const memoryMb = toNumber(summary?.customMetrics?.serverMemoryMB);
const cpuPercent = toNumber(summary?.customMetrics?.serverCpuPercent);

const checks = [
  {
    id: "latency_p95",
    metric: "HTTP latency p95 (ms)",
    actual: p95,
    target: p95Target,
    pass: p95 <= p95Target,
  },
  {
    id: "latency_p99",
    metric: "HTTP latency p99 (ms)",
    actual: p99,
    target: p99Target,
    pass: p99 <= p99Target,
  },
  {
    id: "http_failed_rate",
    metric: "Failed request rate (%)",
    actual: failedRatePercent,
    target: failRateTarget,
    pass: failedRatePercent <= failRateTarget,
  },
];

if (memoryTarget > 0) {
  checks.push({
    id: "server_memory_mb",
    metric: "Server memory (MB)",
    actual: memoryMb,
    target: memoryTarget,
    pass: memoryMb <= memoryTarget,
  });
}

const failedChecks = checks.filter((check) => !check.pass);
const pass = failedChecks.length === 0;

const report = {
  generatedAt: new Date().toISOString(),
  scenario: summary?.scenario ?? "unknown",
  summaryPath: path.resolve(summaryPath),
  metrics: {
    p95,
    p99,
    failedRatePercent,
    serverMemoryMb: memoryMb,
    serverCpuPercent: cpuPercent,
  },
  targets: {
    p95Target,
    p99Target,
    failRateTarget,
    memoryTarget: memoryTarget > 0 ? memoryTarget : null,
  },
  checks,
  pass,
};

const mdLines = [
  "# Load Regression Assertions",
  "",
  `- Scenario: \`${report.scenario}\``,
  `- Summary: \`${report.summaryPath}\``,
  `- Generated: \`${report.generatedAt}\``,
  "",
  "| Check | Actual | Target | Status |",
  "| --- | ---: | ---: | --- |",
  ...checks.map((check) => {
    const status = check.pass ? "PASS" : "FAIL";
    return `| ${check.metric} | ${check.actual.toFixed(2)} | ${check.target.toFixed(2)} | ${status} |`;
  }),
  "",
  `Overall: **${pass ? "PASS" : "FAIL"}**`,
  "",
  `Observed server memory: **${memoryMb.toFixed(2)} MB**`,
  `Observed server CPU: **${cpuPercent.toFixed(2)} %**`,
];

fs.writeFileSync(assertionsJsonPath, JSON.stringify(report, null, 2));
fs.writeFileSync(assertionsMdPath, `${mdLines.join("\n")}\n`);

console.log(`Assertions report written to ${assertionsJsonPath}`);
console.log(`Assertions report written to ${assertionsMdPath}`);

if (!pass) {
  console.error("Load regression assertions failed:");
  failedChecks.forEach((check) => {
    console.error(
      `  - ${check.metric}: actual ${check.actual.toFixed(2)} exceeds target ${check.target.toFixed(2)}`,
    );
  });
  process.exit(3);
}
NODE
assertions_exit_code=$?
set -e

popd >/dev/null

if [[ "${KEEP_RAW_K6_OUTPUT,,}" != "true" ]]; then
  rm -f "${RAW_FILE}"
fi

if [[ ${assertions_exit_code} -ne 0 ]]; then
  exit ${assertions_exit_code}
fi

if [[ ${k6_exit_code} -ne 0 ]]; then
  exit ${k6_exit_code}
fi

echo "Load regression completed successfully."
if [[ "${KEEP_RAW_K6_OUTPUT,,}" == "true" ]]; then
  echo "  Raw metrics: ${RAW_FILE}"
else
  echo "  Raw metrics: discarded (set KEEP_RAW_K6_OUTPUT=true to keep)"
fi
echo "  Summary:     ${SUMMARY_FILE}"
echo "  Assertions:  ${ASSERTIONS_JSON}"
