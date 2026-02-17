import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig
} from 'axios';
import { message } from 'ant-design-vue';
import type { ApiResponse } from '@/types';

const TOKEN_KEY = 'mcp_token';

const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// ── Request 拦截器：自动附加 Bearer Token ───────
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response 拦截器：统一业务错误处理 ───────────
http.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { data } = response;

    // 业务层非 0 code 视为错误
    if (data.code !== 0) {
      message.error(data.message || '请求失败');
      return Promise.reject(new Error(data.message || '请求失败'));
    }

    return data as any;
  },
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      message.warning('登录已过期，请重新登录');
      // 可在此触发路由跳转到登录页
    } else if (status === 403) {
      message.error('无权限访问');
    } else if (status && status >= 500) {
      message.error('服务器异常，请稍后重试');
    } else {
      message.error(error.message || '网络请求失败');
    }

    return Promise.reject(error);
  }
);

export default http;
