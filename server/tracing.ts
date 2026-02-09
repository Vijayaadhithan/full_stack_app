import crypto from "node:crypto";

const ID_MAX_LENGTH = 128;
const SAFE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const TRACEPARENT_PATTERN =
  /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;

type HeaderValue = string | string[] | undefined;
type HeaderMap = Record<string, HeaderValue>;

export type ResolvedTraceContext = {
  requestId: string;
  correlationId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: string;
  traceparent: string;
};

function firstHeaderValue(value: HeaderValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function normalizeCorrelationId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > ID_MAX_LENGTH) return undefined;
  if (!SAFE_ID_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function isAllZeros(value: string): boolean {
  return /^0+$/.test(value);
}

function isHex(value: string, length: number): boolean {
  return new RegExp(`^[0-9a-f]{${length}}$`, "i").test(value);
}

export function generateTraceId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function generateSpanId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function buildTraceparent(
  traceId: string,
  spanId: string,
  traceFlags = "01",
): string {
  return `00-${traceId}-${spanId}-${traceFlags}`;
}

function parseTraceparent(
  traceparentHeader: string | undefined,
): { traceId: string; spanId: string; traceFlags: string } | null {
  if (!traceparentHeader) return null;
  const trimmed = traceparentHeader.trim();
  const match = TRACEPARENT_PATTERN.exec(trimmed);
  if (!match) return null;

  const version = match[1].toLowerCase();
  const traceId = match[2].toLowerCase();
  const spanId = match[3].toLowerCase();
  const traceFlags = match[4].toLowerCase();

  if (version === "ff" || isAllZeros(traceId) || isAllZeros(spanId)) {
    return null;
  }

  return { traceId, spanId, traceFlags };
}

export function resolveTraceContextFromHeaders(
  headers: HeaderMap,
  fallbackRequestId = crypto.randomUUID(),
): ResolvedTraceContext {
  const requestId =
    normalizeCorrelationId(firstHeaderValue(headers["x-request-id"])) ??
    normalizeCorrelationId(firstHeaderValue(headers["x-correlation-id"])) ??
    fallbackRequestId;
  const correlationId =
    normalizeCorrelationId(firstHeaderValue(headers["x-correlation-id"])) ??
    requestId;

  const parsedTraceparent = parseTraceparent(
    firstHeaderValue(headers.traceparent),
  );
  const traceId = parsedTraceparent?.traceId ?? generateTraceId();
  const parentSpanId = parsedTraceparent?.spanId;
  const traceFlags = parsedTraceparent?.traceFlags ?? "01";
  const spanId = generateSpanId();

  return {
    requestId,
    correlationId,
    traceId,
    spanId,
    parentSpanId,
    traceFlags,
    traceparent: buildTraceparent(traceId, spanId, traceFlags),
  };
}

export function resolveTraceContextFromSeed(seed: {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  parentSpanId?: string;
  traceFlags?: string;
}): ResolvedTraceContext {
  const requestId = normalizeCorrelationId(seed.requestId) ?? crypto.randomUUID();
  const correlationId = normalizeCorrelationId(seed.correlationId) ?? requestId;
  const traceId =
    typeof seed.traceId === "string" &&
    isHex(seed.traceId, 32) &&
    !isAllZeros(seed.traceId)
      ? seed.traceId.toLowerCase()
      : generateTraceId();
  const parentSpanId =
    typeof seed.parentSpanId === "string" &&
    isHex(seed.parentSpanId, 16) &&
    !isAllZeros(seed.parentSpanId)
      ? seed.parentSpanId.toLowerCase()
      : undefined;
  const traceFlags =
    typeof seed.traceFlags === "string" && isHex(seed.traceFlags, 2)
      ? seed.traceFlags.toLowerCase()
      : "01";
  const spanId = generateSpanId();

  return {
    requestId,
    correlationId,
    traceId,
    spanId,
    parentSpanId,
    traceFlags,
    traceparent: buildTraceparent(traceId, spanId, traceFlags),
  };
}
