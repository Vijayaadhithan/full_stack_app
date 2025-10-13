export function sanitizeUser<T extends object>(
  user: T | null | undefined,
): Omit<T, "password"> | null {
  if (!user) {
    return null;
  }
  const userWithPassword = user as T & { password?: unknown };
  if (Object.prototype.hasOwnProperty.call(userWithPassword, "password")) {
    const { password: _password, ...rest } = userWithPassword;
    return rest as Omit<T, "password">;
  }
  return user as Omit<T, "password">;
}

export function sanitizeUserList<T extends object>(
  users: readonly T[],
): Array<Omit<T, "password">> {
  return users
    .map((user) => sanitizeUser(user))
    .filter((user): user is Omit<T, "password"> => Boolean(user));
}
