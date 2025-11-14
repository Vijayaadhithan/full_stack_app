import { AsyncLocalStorage } from "node:async_hooks";
import type { LogContext } from "@shared/logging";

export type RequestMetadata = {
  requestId?: string;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
  userId?: string | number;
  userRole?: string;
  adminId?: string;
  sessionId?: string;
  tenantId?: string | number;
  [key: string]: unknown;
};

export type RequestContextStore = {
  request: RequestMetadata;
  log: LogContext;
};

type InitialContext = Partial<RequestContextStore>;

const contextStorage = new AsyncLocalStorage<RequestContextStore>();

function mergeContext(initial: InitialContext): RequestContextStore {
  const parent = contextStorage.getStore();
  const baseRequest = parent ? { ...parent.request } : {};
  const baseLog = parent ? { ...parent.log } : {};

  return {
    request: {
      ...baseRequest,
      ...(initial.request ?? {}),
    },
    log: {
      ...baseLog,
      ...(initial.log ?? {}),
    },
  };
}

export function runWithRequestContext<T>(
  callback: () => T,
  initial: InitialContext = {},
): T {
  const store = mergeContext(initial);
  return contextStorage.run(store, callback);
}

export function getRequestContextStore(): RequestContextStore | undefined {
  return contextStorage.getStore();
}

export function getRequestMetadata(): RequestMetadata | undefined {
  return contextStorage.getStore()?.request;
}

export function updateRequestContext(patch: Partial<RequestMetadata>): void {
  const store = contextStorage.getStore();
  if (!store) return;
  Object.assign(store.request, patch);
}

export function updateLogContext(patch: Partial<LogContext>): void {
  const store = contextStorage.getStore();
  if (!store) return;
  Object.assign(store.log, patch);
}
