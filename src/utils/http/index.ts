import Axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type CustomParamsSerializer,
  type InternalAxiosRequestConfig
} from "axios";
import type {
  PureHttpError,
  RequestMethods,
  PureHttpResponse,
  PureHttpRequestConfig
} from "./types.d";
import { stringify } from "qs";
import { formatToken, getToken } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";

const authPaths = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout"
];

const defaultConfig: AxiosRequestConfig = {
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  timeout: 10000,
  withCredentials: true,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  },
  paramsSerializer: {
    serialize: stringify as unknown as CustomParamsSerializer
  }
};

class PureHttp {
  private static refreshPromise: Promise<string> | undefined;
  private static initConfig: PureHttpRequestConfig = {};
  private static axiosInstance: AxiosInstance = Axios.create(defaultConfig);

  constructor() {
    this.httpInterceptorsRequest();
    this.httpInterceptorsResponse();
  }

  private static isAuthPath(url?: string) {
    return authPaths.some(path => url?.endsWith(path));
  }

  private static async refreshAccessToken() {
    if (!PureHttp.refreshPromise) {
      PureHttp.refreshPromise = useUserStoreHook()
        .handRefreshToken()
        .then(token => token.accessToken)
        .finally(() => {
          PureHttp.refreshPromise = undefined;
        });
    }
    return PureHttp.refreshPromise;
  }

  private async authorize(config: InternalAxiosRequestConfig) {
    const current = getToken();
    let accessToken = current?.accessToken;
    if (!current || current.expires <= Date.now()) {
      accessToken = await PureHttp.refreshAccessToken();
    }
    config.headers.set("Authorization", formatToken(accessToken));
    return config;
  }

  private httpInterceptorsRequest(): void {
    PureHttp.axiosInstance.interceptors.request.use(
      async config => {
        const request = config as PureHttpRequestConfig;
        if (typeof request.beforeRequestCallback === "function") {
          request.beforeRequestCallback(request);
          return config;
        }
        if (PureHttp.initConfig.beforeRequestCallback) {
          PureHttp.initConfig.beforeRequestCallback(request);
          return config;
        }
        return PureHttp.isAuthPath(config.url)
          ? config
          : this.authorize(config);
      },
      error => Promise.reject(error)
    );
  }

  private httpInterceptorsResponse(): void {
    const instance = PureHttp.axiosInstance;
    instance.interceptors.response.use(
      (response: PureHttpResponse) => {
        const config = response.config;
        if (typeof config.beforeResponseCallback === "function") {
          config.beforeResponseCallback(response);
          return response.data;
        }
        if (PureHttp.initConfig.beforeResponseCallback) {
          PureHttp.initConfig.beforeResponseCallback(response);
          return response.data;
        }
        return response.data;
      },
      async (error: PureHttpError) => {
        error.isCancelRequest = Axios.isCancel(error);
        const config = error.config as PureHttpRequestConfig | undefined;
        if (
          error.response?.status === 401 &&
          config &&
          !config.__retriedAfterRefresh &&
          !PureHttp.isAuthPath(config.url)
        ) {
          config.__retriedAfterRefresh = true;
          try {
            const token = await PureHttp.refreshAccessToken();
            config.headers ??= {};
            config.headers.Authorization = formatToken(token);
            return instance.request(config);
          } catch {
            useUserStoreHook().clearSession();
          }
        }
        return Promise.reject(error);
      }
    );
  }

  public request<T>(
    method: RequestMethods,
    url: string,
    param?: AxiosRequestConfig,
    axiosConfig?: PureHttpRequestConfig
  ): Promise<T> {
    return PureHttp.axiosInstance.request({
      method,
      url,
      ...param,
      ...axiosConfig
    }) as Promise<T>;
  }

  public post<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("post", url, params, config);
  }

  public get<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("get", url, params, config);
  }
}

export const http = new PureHttp();
