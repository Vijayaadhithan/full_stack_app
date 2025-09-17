import logger from "../logger";

type RequestContext = {
  method: string;
  url: string;
  ip?: string;
  headers?: Record<string, string | string[]>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
};

type ErrorContext = {
  errorId: string;
  status?: number;
  request?: RequestContext;
  tags?: Record<string, string>;
  extras?: Record<string, unknown>;
};

const ERROR_PROPS_TO_SKIP = new Set(["name", "message", "stack"]);

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const base: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };

    if (error.stack) {
      base.stack = error.stack;
    }

    const ownProps = Object.getOwnPropertyNames(error);
    for (const prop of ownProps) {
      if (ERROR_PROPS_TO_SKIP.has(prop)) continue;
      // @ts-expect-error - accessing dynamic property defined on the error instance
      base[prop] = error[prop];
    }

    if ("cause" in error) {
      const cause = (error as Error & { cause?: unknown }).cause;
      if (cause) {
        base.cause = serializeError(cause);
      }
    }

    return base;
  }

  if (typeof error === "object" && error !== null) {
    return { ...error } as Record<string, unknown>;
  }

  return { message: String(error) };
}

export async function reportError(
  error: unknown,
  context: ErrorContext,
): Promise<void> {
  const serializedError = serializeError(error);

  // Placeholder for integration with external monitoring (e.g. Sentry/New Relic).
  // For now, forward the data to our structured logger so we can hook into it.
  logger.error(
    {
      errorId: context.errorId,
      status: context.status,
      error: serializedError,
      request: context.request,
      tags: context.tags,
      extras: context.extras,
    },
    "Captured error for monitoring",
  );
}

export type { ErrorContext, RequestContext };
