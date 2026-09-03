import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the globally registered authentication guard.
 *
 * Authentication is on by default and switched off explicitly, so forgetting a
 * decorator leaves an endpoint closed rather than open.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
