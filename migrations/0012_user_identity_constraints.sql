CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
  ON users (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
  ON users (phone)
  WHERE phone <> '';
