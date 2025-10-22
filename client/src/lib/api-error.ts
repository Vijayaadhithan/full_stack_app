export type ParsedApiError = {
  message: string;
  status?: number;
  raw: string;
};

const DEFAULT_ERROR_MESSAGE = "An unexpected error occurred.";

function tryParseJsonMessage(body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.message === "string") {
      return parsed.message;
    }
  } catch {
    // Ignore JSON parse failures and fall back to the raw body.
  }
  return body;
}

export function parseApiError(error: unknown): ParsedApiError {
  if (!(error instanceof Error)) {
    return {
      message: DEFAULT_ERROR_MESSAGE,
      status: undefined,
      raw: String(error),
    };
  }

  const raw = error.message ?? DEFAULT_ERROR_MESSAGE;
  const statusMatch = raw.match(/^(\d{3}):\s*([\s\S]*)$/);

  if (!statusMatch) {
    return {
      message: raw || DEFAULT_ERROR_MESSAGE,
      status: undefined,
      raw,
    };
  }

  const [, statusString, body = ""] = statusMatch;
  const status = Number.parseInt(statusString, 10);
  const parsedMessage = tryParseJsonMessage(body.trim());

  return {
    message: parsedMessage.trim() || DEFAULT_ERROR_MESSAGE,
    status: Number.isNaN(status) ? undefined : status,
    raw,
  };
}

const VERIFICATION_KEYWORDS = [
  "profile verification required",
  "shop must complete profile verification",
];

export function getVerificationError(
  error: unknown,
): ParsedApiError | null {
  const parsed = parseApiError(error);
  if (parsed.status !== 403) {
    return null;
  }

  const lowerMessage = parsed.message.toLowerCase();
  const matches = VERIFICATION_KEYWORDS.some((keyword) =>
    lowerMessage.includes(keyword),
  );

  return matches ? parsed : null;
}
