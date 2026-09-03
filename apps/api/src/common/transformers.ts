import { Transform } from 'class-transformer';

/**
 * Shared input normalisers.
 *
 * class-transformer types the incoming value as `any`, which the type-checked
 * lint rules reject. Narrowing it once here keeps every DTO strict.
 */
export const TrimString = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** The database enforces lowercase emails, so normalise before it has to. */
export const NormaliseEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
