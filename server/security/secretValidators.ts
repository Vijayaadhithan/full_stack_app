import logger from "../logger";

type SecretStrengthOptions = {
  minLength: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumber?: boolean;
  requireSymbol?: boolean;
  disallowedPatterns?: RegExp[];
  environment?: string;
};

function buildIssues(
  value: string,
  {
    minLength,
    requireUppercase = false,
    requireLowercase = false,
    requireNumber = false,
    requireSymbol = false,
    disallowedPatterns = [],
  }: SecretStrengthOptions,
): string[] {
  const issues: string[] = [];

  if (value.length < minLength) {
    issues.push(`must be at least ${minLength} characters long`);
  }
  if (requireUppercase && !/[A-Z]/.test(value)) {
    issues.push("must include an uppercase letter");
  }
  if (requireLowercase && !/[a-z]/.test(value)) {
    issues.push("must include a lowercase letter");
  }
  if (requireNumber && !/[0-9]/.test(value)) {
    issues.push("must include a number");
  }
  if (requireSymbol && !/[^\w\s]/.test(value)) {
    issues.push("must include a symbol");
  }
  for (const pattern of disallowedPatterns) {
    if (pattern.test(value)) {
      issues.push("uses a disallowed or easily guessed value");
      break;
    }
  }

  return issues;
}

export function sanitizeAndValidateSecret(
  name: string,
  rawValue: string | undefined | null,
  options: SecretStrengthOptions,
): string {
  if (!rawValue || rawValue.trim().length === 0) {
    const message = `${name} must be configured`;
    logger.error(message);
    throw new Error(message);
  }

  const trimmed = rawValue.trim();
  const environment = options.environment ?? process.env.NODE_ENV ?? "development";

  const issues = buildIssues(trimmed, options);
  if (issues.length > 0) {
    const details = issues.join(", ");
    const message = `${name} is too weak: ${details}`;
    if (environment === "production") {
      logger.error(message);
      throw new Error(message);
    }
    logger.warn(message);
  }

  return trimmed;
}
