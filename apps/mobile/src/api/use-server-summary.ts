import { useEffect, useState } from 'react';

import { getApiBaseUrl } from '../config/api-config';
import { useHealth } from './health';

/**
 * Which backend this build is talking to, and whether it answers.
 *
 * Shown on sign-in and in the profile because the address is configuration a
 * user can change: without it, "wrong password" and "pointed at a machine that
 * is not running" look identical from the outside.
 */
export function useServerSummary() {
  const health = useHealth();
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    void getApiBaseUrl().then(setBaseUrl);
  }, []);

  return {
    address: hostAndPort(baseUrl),
    online: health.isSuccess,
    checking: health.isPending,
  };
}

/**
 * `http://192.168.15.151:3000/api/v1` as `192.168.15.151:3000`.
 *
 * The scheme and the API path are the same on every install; the host is the
 * only part that answers "which machine am I talking to", and it is the only
 * part that fits on one line beside a status dot.
 */
export function hostAndPort(baseUrl: string): string {
  if (!baseUrl) return '—';

  try {
    const url = new URL(baseUrl);

    return url.port ? `${url.hostname}:${url.port}` : url.hostname;
  } catch {
    return baseUrl;
  }
}
