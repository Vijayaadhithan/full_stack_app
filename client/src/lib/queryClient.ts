import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Check if data is FormData (for file uploads)
  const isFormData = data instanceof FormData;

  const res = await fetch(`${API_BASE}${url}`, {
    method,
    // Don't set Content-Type for FormData (browser will set it with boundary)
    headers: data && !isFormData ? { "Content-Type": "application/json" } : {},
    // Don't stringify FormData
    body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
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

    console.log("Making API request to:", `${API_BASE}${url}`);

    const res = await fetch(`${API_BASE}${url}`, {
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
