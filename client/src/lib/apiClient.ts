import { Zodios } from "@zodios/core";
import { appApi } from "@shared/api-contract";
import { API_BASE_URL, CSRF_SAFE_METHODS, getCsrfToken } from "./queryClient";

export const apiClient = new Zodios(API_BASE_URL, appApi, {
  axiosConfig: {
    withCredentials: true,
  },
});

apiClient.axios.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toUpperCase();
  if (!CSRF_SAFE_METHODS.has(method)) {
    const token = await getCsrfToken();
    if (config.headers && typeof (config.headers as any).set === "function") {
      (config.headers as any).set("x-csrf-token", token);
    } else {
      const headers = (config.headers ?? {}) as Record<string, unknown>;
      headers["x-csrf-token"] = token;
      config.headers = headers as typeof config.headers;
    }
  }
  return config;
});

export type TypedApiClient = typeof apiClient;
