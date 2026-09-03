export interface UserProfile {
  id: string;
  email: string;
  name: string;
  focusDurationSec: number;
  shortBreakSec: number;
  longBreakSec: number;
  cyclesUntilLongBreak: number;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
}
