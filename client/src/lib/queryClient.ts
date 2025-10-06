import { QueryClient, QueryFunction } from "@tanstack/react-query";

const resolveApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return "http://localhost:5000";
};

export const API_BASE_URL = resolveApiBase();

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);
let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/csrf-token`, {
    credentials: "include",
  });
  await throwIfResNotOk(res);
  const payload = (await res.json()) as { csrfToken?: string };
  if (!payload.csrfToken) {
    throw new Error("Failed to load CSRF token");
  }
  return payload.csrfToken;
}

export async function getCsrfToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    csrfToken = null;
  }

  if (csrfToken) {
    return csrfToken;
  }

  if (!csrfPromise) {
    csrfPromise = fetchCsrfToken().then((token) => {
      csrfToken = token;
      return token;
    });
    csrfPromise.finally(() => {
      csrfPromise = null;
    });
  }

  return csrfPromise;
}

async function performApiRequest(
  method: string,
  url: string,
  data: unknown | undefined,
  attempt = 0,
): Promise<Response> {
  const upperMethod = method.toUpperCase();
  const isFormData = data instanceof FormData;
  const headers: Record<string, string> = {};

  if (data && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (!CSRF_SAFE_METHODS.has(upperMethod)) {
    headers["x-csrf-token"] = await getCsrfToken(attempt > 0);
  }

  const res = await fetch(`${API_BASE_URL}${url}`, {
    method: upperMethod,
    headers,
    body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
    credentials: "include",
  });

  if (!CSRF_SAFE_METHODS.has(upperMethod) && res.status === 403 && attempt === 0) {
    return performApiRequest(method, url, data, attempt + 1);
  }

  await throwIfResNotOk(res);
  return res;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  return performApiRequest(method, url, data);
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build the URL by joining the first parameter with the second parameter if it exists
    let url = queryKey[0] as string;
    if (queryKey.length > 1 && queryKey[1] !== undefined) {
      url = `${url}/${queryKey[1]}`;
    }

    const res = await fetch(`${API_BASE_URL}${url}`, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
