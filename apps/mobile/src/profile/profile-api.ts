import { authenticatedRequest } from '../api/authenticated-request';
import type { UserProfile } from '../auth/auth-types';

export interface UpdateProfileInput {
  name?: string;
  focusDurationSec?: number;
  shortBreakSec?: number;
  longBreakSec?: number;
  cyclesUntilLongBreak?: number;
}

export function fetchProfile(): Promise<UserProfile> {
  return authenticatedRequest<UserProfile>('/me');
}

export function updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
  return authenticatedRequest<UserProfile>('/me', { method: 'PATCH', body: input });
}
