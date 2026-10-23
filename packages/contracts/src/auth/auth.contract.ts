/** Public contract for the auth-service. Framework-agnostic; consumable by the front. */

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/** Unit weights are shown and typed in; the API always stores and returns kilograms. */
export type WeightUnit = 'kg' | 'lb';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  weightUnit: WeightUnit;
  createdAt: string;
}

/** `PATCH /auth/me`: only the given fields change. */
export interface UpdateProfileRequest {
  displayName?: string;
  weightUnit?: WeightUnit;
}

export interface AuthResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

/** Payload encoded inside the access token and forwarded by the gateway. */
export interface JwtAccessPayload {
  sub: string;
  email: string;
}
