// List of sensitive fields that should be stripped from user objects
// to prevent leaking secrets to clients, logs, or API responses
const SENSITIVE_FIELDS = ["password", "pin"] as const;

type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

/**
 * Removes sensitive fields (password, pin, and other secrets) from user objects.
 * This prevents stored secrets from leaking to clients, logs, or external systems.
 */
export function sanitizeUser<T extends object>(
  user: T | null | undefined,
): Omit<T, SensitiveField> | null {
  if (!user) {
    return null;
  }

  // Check if any sensitive fields exist on the user object
  const hasSensitiveFields = SENSITIVE_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(user, field),
  );

  if (!hasSensitiveFields) {
    return user as Omit<T, SensitiveField>;
  }

  // Create a copy without sensitive fields
  const sanitized = { ...user } as Record<string, unknown>;
  for (const field of SENSITIVE_FIELDS) {
    delete sanitized[field];
  }

  return sanitized as Omit<T, SensitiveField>;
}

export function sanitizeUserList<T extends object>(
  users: readonly T[],
): Array<Omit<T, SensitiveField>> {
  return users
    .map((user) => sanitizeUser(user))
    .filter((user): user is Omit<T, SensitiveField> => Boolean(user));
}
