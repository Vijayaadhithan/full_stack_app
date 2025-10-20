import { z } from "zod";

export type FormattedZodError = {
  message: string;
  errors: Record<string, string[]>;
};

/**
 * Normalize a Zod error into a consistent response structure that
 * avoids leaking implementation details while remaining easy to
 * consume on the frontend.
 */
export function formatValidationError(error: z.ZodError): FormattedZodError {
  const fieldErrors = error.flatten().fieldErrors;
  const formatted: Record<string, string[]> = {};
  for (const [field, issues] of Object.entries(fieldErrors)) {
    if (!issues || issues.length === 0) continue;
    formatted[field] = issues;
  }

  return {
    message: "Invalid input",
    errors: formatted,
  };
}
