export interface User {
  _id: string; name: string; email: string; role: 'user' | 'admin'; interests: string[];
}
export interface Note { _id: string; owner: string; title: string; content: string }
export interface Post { _id: string; author: string; title: string; content: string }
export interface Pagination { page: number; limit: number; total: number; pages: number }
export interface Collection<T> { data: T[]; pagination: Pagination }
export interface Interest { interest: string; totalUsers: number; users: User[]; memberPagination: Pagination }
export interface Session { token: string; user: User }
export type Api = <T>(path: string, options?: RequestInit) => Promise<T>;

const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function createApi(token?: string): Api {
  return async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers);
    if (options.body) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    if (response.status === 204) return undefined as T;
    const data = await response.json();
    if (!response.ok) {
      const details = data.details?.map((item: { path: string; message: string }) => `${item.path}: ${item.message}`).join('; ');
      throw new ApiError(details || data.error || 'Request failed', response.status);
    }
    return data as T;
  };
}
