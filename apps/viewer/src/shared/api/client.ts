import axios from 'axios';
import { z } from 'zod';

const BASE = import.meta.env.VITE_API_BASE_URL as string;
const TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? '10000');

const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
  timeout: TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

function safeStringify(data: unknown) {
  try {
    if (typeof data === 'string') return data;
    return JSON.stringify(data);
  } catch {
    return '';
  }
}

export async function getJson<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  try {
    const res = await api.get(path, { signal });
    return schema.parse(res.data);
  } catch (err) {
    // axios 에러인 경우
    if (axios.isAxiosError(err)) {
      // react-query cancel/abort 케이스는 그대로 throw
      if (err.code === 'ERR_CANCELED') throw err;

      const status = err.response?.status;
      const statusText = err.response?.statusText ?? '';
      const body = safeStringify(err.response?.data);

      const msg = status
        ? `HTTP ${status} ${statusText}: ${body}`
        : `NETWORK_ERROR: ${err.message}`;

      throw new Error(msg);
    }

    // 일반 Error 인 경우
    if (err instanceof Error) {
      throw err;
    }

    // 그 외(이론상 거의 없음)
    throw new Error('UNKNOWN_ERROR');
  }
}
