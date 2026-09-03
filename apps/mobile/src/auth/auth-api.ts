import { request } from '../api/http-client';
import type { AuthResponse, UserProfile } from './auth-types';

export function register(input: {
  email: string;
  name: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', { method: 'POST', body: input });
}

export function login(input: {
  email: string;
  password: string;
  deviceLabel?: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', { method: 'POST', body: input });
}

export function refresh(refreshToken: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/refresh', { method: 'POST', body: { refreshToken } });
}

export function logout(refreshToken: string): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST', body: { refreshToken } });
}

export function fetchProfile(accessToken: string): Promise<UserProfile> {
  return request<UserProfile>('/me', { accessToken });
}
