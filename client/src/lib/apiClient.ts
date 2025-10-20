import { Zodios } from "@zodios/core";
import { appApi } from "@shared/api-contract";
import {
  API_BASE_URL,
  CSRF_SAFE_METHODS,
  getCsrfToken,
  resetCsrfTokenCache,
} from "./queryClient";

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

apiClient.axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config as (typeof error.config & {
      __csrfRetry?: boolean;
    });
    const status = error?.response?.status;
    const method = config?.method
      ? String(config.method).toUpperCase()
      : undefined;

    if (
      config &&
      status === 403 &&
      method &&
      !CSRF_SAFE_METHODS.has(method) &&
      !config.__csrfRetry
    ) {
      try {
        resetCsrfTokenCache();
        const token = await getCsrfToken(true);
        config.__csrfRetry = true;

        if (config.headers && typeof (config.headers as any).set === "function") {
          (config.headers as any).set("x-csrf-token", token);
        } else {
          const headers = (config.headers ?? {}) as Record<string, unknown>;
          headers["x-csrf-token"] = token;
          config.headers = headers as typeof config.headers;
        }

        return apiClient.axios.request(config);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export type TypedApiClient = typeof apiClient;
