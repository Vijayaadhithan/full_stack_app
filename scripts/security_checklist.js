#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const outDir = path.join(rootDir, "output", "security");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonOut = path.join(outDir, `security-matrix-${timestamp}.json`);
const mdOut = path.join(outDir, `security-matrix-${timestamp}.md`);

/**
 * @typedef {"PASS"|"FAIL"|"GAP"} Status
 * @typedef {{id:string, title:string, severity:"HIGH"|"MEDIUM"|"LOW", status:Status, evidence:string, remediation?:string}} CheckResult
 */

/**
 * @param {string} relativePath
 */
function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

/**
 * @param {string} relativePath
 */
function fileExists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

/**
 * @param {CheckResult[]} checks
 * @param {Omit<CheckResult, "status"> & { pass?: boolean, gap?: boolean }} input
 */
function addCheck(checks, input) {
  const status = input.gap ? "GAP" : input.pass ? "PASS" : "FAIL";
  checks.push({
    id: input.id,
    title: input.title,
    severity: input.severity,
    status,
    evidence: input.evidence,
    remediation: input.remediation,
  });
}

const checks = [];

const routesTs = readFile("server/routes.ts");
const authTs = readFile("server/auth.ts");
const firebaseAdminTs = readFile("server/services/firebase-admin.ts");
const storageTs = readFile("server/storage.ts");
const indexTs = readFile("server/index.ts");
const pgStorageTs = readFile("server/pg-storage.ts");

const allowMockScoped =
  /process\.env\.NODE_ENV === "test"/.test(firebaseAdminTs) &&
  /process\.env\.ALLOW_MOCK_FIREBASE_TOKENS === "true"/.test(firebaseAdminTs);
const legacyDevBypass = /NODE_ENV !== "production"\s*&&\s*idToken\.startsWith\("mock-token-"\)/.test(firebaseAdminTs);
addCheck(checks, {
  id: "SEC-001",
  title: "Mock Firebase tokens are not globally allowed in non-production",
  severity: "HIGH",
  pass: allowMockScoped && !legacyDevBypass,
  evidence: allowMockScoped && !legacyDevBypass
    ? "Mock token path is gated to test env or explicit ALLOW_MOCK_FIREBASE_TOKENS=true."
    : "Mock token policy is broader than intended or legacy development bypass still exists.",
  remediation: "Restrict mock token acceptance to NODE_ENV=test and explicit opt-in flags only.",
});

const csrfIgnoreMatch = routesTs.match(/createCsrfProtection\(\{[\s\S]*?ignorePaths:\s*\[([^\]]*)\]/);
const ignoredPaths =
  csrfIgnoreMatch?.[1]
    ? Array.from(csrfIgnoreMatch[1].matchAll(/"([^"]+)"/g)).map((entry) => entry[1])
    : [];
const csrfScopeTight = ignoredPaths.length === 1 && ignoredPaths[0] === "/api/performance-metrics";
addCheck(checks, {
  id: "SEC-002",
  title: "CSRF ignore paths are minimal and explicit",
  severity: "HIGH",
  pass: csrfScopeTight,
  evidence: `Detected ignorePaths: ${ignoredPaths.length ? ignoredPaths.join(", ") : "(none)"}`,
  remediation: "Keep CSRF exclusions minimal; do not exempt auth/session-changing endpoints.",
});

const markReadScoped = /markNotificationAsRead\(\s*getValidatedParam\(req,\s*"id"\),\s*req\.user!\.id/s.test(routesTs);
const deleteScoped = /deleteNotification\(\s*getValidatedParam\(req,\s*"id"\),\s*req\.user!\.id/s.test(routesTs);
const storageNotificationScoped =
  /markNotificationAsRead\(id: number, userId: number\)/.test(storageTs) &&
  /deleteNotification\(id: number, userId: number\)/.test(storageTs) &&
  /and\(eq\(notifications\.id, id\), eq\(notifications\.userId, userId\)\)/.test(pgStorageTs);
addCheck(checks, {
  id: "SEC-003",
  title: "Notification read/delete operations are user-scoped end-to-end",
  severity: "HIGH",
  pass: markReadScoped && deleteScoped && storageNotificationScoped,
  evidence:
    markReadScoped && deleteScoped && storageNotificationScoped
      ? "Routes pass req.user.id and storage enforces (notificationId,userId) filters."
      : "Missing user scoping in route or storage notification handlers.",
  remediation: "Always bind notification updates/deletes to authenticated user ID in both route and storage layers.",
});

const fcmScopedInRoutes = /deleteFcmToken\(parsed\.data\.token,\s*req\.user!\.id\)/.test(routesTs);
const fcmScopedInStorage =
  /deleteFcmToken\(token: string, userId\?: number\)/.test(storageTs) &&
  /and\(eq\(fcmTokens\.token, token\), eq\(fcmTokens\.userId, userId\)\)/.test(pgStorageTs);
addCheck(checks, {
  id: "SEC-004",
  title: "FCM token unregister is user-scoped",
  severity: "HIGH",
  pass: fcmScopedInRoutes && fcmScopedInStorage,
  evidence:
    fcmScopedInRoutes && fcmScopedInStorage
      ? "Route and storage both support token+user scoping."
      : "FCM token unregister path is not fully scoped to current user.",
  remediation: "Require authenticated user scoping when removing push tokens.",
});

const otpUsesCryptoRandom =
  /function generateOtp\(\)\s*(?::\s*string)?\s*{\s*return randomInt\(100000,\s*1000000\)\.toString\(\);/s.test(authTs);
const otpUsesMathRandom = /function generateOtp[\s\S]*Math\.random/.test(authTs);
addCheck(checks, {
  id: "SEC-005",
  title: "OTP generation uses cryptographically secure randomness",
  severity: "HIGH",
  pass: otpUsesCryptoRandom && !otpUsesMathRandom,
  evidence:
    otpUsesCryptoRandom && !otpUsesMathRandom
      ? "OTP generation uses crypto.randomInt and no Math.random fallback in generateOtp."
      : "OTP generation may still rely on Math.random in auth flow.",
  remediation: "Use crypto.randomInt for OTP/PIN generation exclusively.",
});

const sensitiveFieldsOmitted = [
  "role",
  "password",
  "pin",
  "phone",
  "isSuspended",
  "verificationStatus",
  "createdAt",
].every((field) => new RegExp(`${field}: true`).test(routesTs));
addCheck(checks, {
  id: "SEC-006",
  title: "User profile patch schema omits sensitive fields",
  severity: "HIGH",
  pass: sensitiveFieldsOmitted,
  evidence: sensitiveFieldsOmitted
    ? "PATCH /api/users/:id schema explicitly omits privileged fields."
    : "One or more sensitive fields are not omitted in profile update schema.",
  remediation: "Keep privileged fields out of self-service profile update schemas.",
});

const corsWildcardGuard =
  /Wildcard CORS origin is not permitted in production/.test(indexTs) &&
  /if \(isProduction && wildcardRequested\)/.test(indexTs);
addCheck(checks, {
  id: "SEC-007",
  title: "Production CORS wildcard is blocked",
  severity: "HIGH",
  pass: corsWildcardGuard,
  evidence: corsWildcardGuard
    ? "index.ts blocks wildcard CORS usage in production mode."
    : "Production wildcard CORS guard not detected.",
  remediation: "Reject '*' origins in production and require explicit origin allowlists.",
});

const sessionSecretValidation = /sanitizeAndValidateSecret\(\s*"SESSION_SECRET"/.test(authTs);
addCheck(checks, {
  id: "SEC-008",
  title: "Session secret is validated against strength policy",
  severity: "HIGH",
  pass: sessionSecretValidation,
  evidence: sessionSecretValidation
    ? "Auth initialization validates SESSION_SECRET using security policy."
    : "No session secret validation detected during auth initialization.",
  remediation: "Enforce minimum entropy/complexity checks for session secrets.",
});

const helmetEnabled = /app\.use\(helmet\(/.test(indexTs);
addCheck(checks, {
  id: "SEC-009",
  title: "Security headers middleware is enabled",
  severity: "MEDIUM",
  pass: helmetEnabled,
  evidence: helmetEnabled
    ? "Helmet middleware is applied in server bootstrap."
    : "Helmet middleware usage not detected in bootstrap.",
  remediation: "Enable helmet with an explicit CSP/HSTS policy for production.",
});

const bodyLoggingRemoved = !/Location Update Request Body/.test(routesTs);
addCheck(checks, {
  id: "SEC-010",
  title: "Location updates avoid logging full request payloads",
  severity: "MEDIUM",
  pass: bodyLoggingRemoved,
  evidence: bodyLoggingRemoved
    ? "Location logging uses scoped debug metadata instead of full req.body."
    : "Full request payload logging still present in location update path.",
  remediation: "Avoid logging raw request bodies containing PII.",
});

let envFile = "";
if (fileExists(".env")) {
  envFile = readFile(".env");
}
const allowMockInEnv = /(^|\n)\s*ALLOW_MOCK_FIREBASE_TOKENS\s*=\s*true\s*($|\n)/i.test(envFile);
addCheck(checks, {
  id: "SEC-011",
  title: "Environment does not force-enable mock Firebase tokens",
  severity: "HIGH",
  pass: !allowMockInEnv,
  evidence: allowMockInEnv
    ? ".env sets ALLOW_MOCK_FIREBASE_TOKENS=true."
    : ".env does not force-enable mock Firebase tokens.",
  remediation: "Keep ALLOW_MOCK_FIREBASE_TOKENS unset/false outside isolated test environments.",
});

const disableRateLimitInEnv = /(^|\n)\s*DISABLE_RATE_LIMITERS\s*=\s*true\s*($|\n)/i.test(envFile);
addCheck(checks, {
  id: "SEC-012",
  title: "Environment does not globally disable API rate limiters",
  severity: "HIGH",
  pass: !disableRateLimitInEnv,
  evidence: disableRateLimitInEnv
    ? ".env sets DISABLE_RATE_LIMITERS=true (unsafe for production)."
    : ".env does not globally disable rate limiters.",
  remediation: "Enable rate limiters in all non-test environments.",
});

addCheck(checks, {
  id: "SEC-013",
  title: "Dependency CVE scan (npm audit / SCA)",
  severity: "HIGH",
  gap: true,
  evidence: "Not executed by this script. Online package advisory scan is required.",
  remediation: "Run `npm audit --production` (or enterprise SCA) in CI with network access.",
});

addCheck(checks, {
  id: "SEC-014",
  title: "Dynamic application security test (DAST)",
  severity: "MEDIUM",
  gap: true,
  evidence: "Not executed by this script. Runtime probing (authz, CSRF, SSRF, IDOR) is still required.",
  remediation: "Run authenticated DAST against staging and track findings with risk owner + SLA.",
});

const counts = {
  pass: checks.filter((item) => item.status === "PASS").length,
  fail: checks.filter((item) => item.status === "FAIL").length,
  gap: checks.filter((item) => item.status === "GAP").length,
};

const overall = counts.fail === 0 ? "PASS" : "FAIL";
const report = {
  generatedAt: new Date().toISOString(),
  overall,
  summary: counts,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));

const markdown = [
  "# Security Checklist Matrix",
  "",
  `- Generated: \`${report.generatedAt}\``,
  `- Overall: **${overall}**`,
  `- Pass: **${counts.pass}** | Fail: **${counts.fail}** | Gap: **${counts.gap}**`,
  "",
  "| ID | Severity | Status | Check | Evidence |",
  "| --- | --- | --- | --- | --- |",
  ...checks.map(
    (item) =>
      `| ${item.id} | ${item.severity} | ${item.status} | ${item.title} | ${item.evidence.replace(/\|/g, "\\|")} |`,
  ),
  "",
  "## Remaining Gaps",
  ...checks
    .filter((item) => item.status === "GAP")
    .map((item) => `- ${item.id}: ${item.remediation || "No remediation noted."}`),
  "",
  "## Failed Checks",
  ...checks
    .filter((item) => item.status === "FAIL")
    .map((item) => `- ${item.id}: ${item.remediation || "No remediation noted."}`),
  "",
];

fs.writeFileSync(mdOut, `${markdown.join("\n")}\n`);

console.log(`Security matrix written to ${jsonOut}`);
console.log(`Security matrix written to ${mdOut}`);
console.log(`Overall: ${overall} (pass=${counts.pass}, fail=${counts.fail}, gap=${counts.gap})`);

if (process.env.SECURITY_FAIL_ON_FAIL === "true" && counts.fail > 0) {
  process.exitCode = 1;
}
