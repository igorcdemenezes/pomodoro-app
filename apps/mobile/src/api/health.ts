import { useQuery } from '@tanstack/react-query';

import { request } from './http-client';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptimeSeconds: number;
  timestamp: string;
}

export const healthQueryKey = ['health'] as const;

/**
 * Probes the configured backend.
 *
 * Deliberately not cached and not retried: this is the screen someone opens to
 * find out whether the address they typed is right, and a stale answer or a
 * silent retry would hide exactly what they are trying to see.
 */
export function useHealth() {
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: () => request<HealthResponse>('/health', { timeoutMs: 8000 }),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
}
