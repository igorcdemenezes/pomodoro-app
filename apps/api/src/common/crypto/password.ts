import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import type { ScryptOptions } from 'node:crypto';

// promisify() drops the options overload, so the callback is wrapped by hand.
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/**
 * Password hashing on top of `node:crypto` scrypt.
 *
 * scrypt is a memory-hard KDF recommended by OWASP and ships with Node, so the
 * project avoids a native build step (argon2, bcrypt) that would have to
 * compile on every machine and CI runner evaluating this repository.
 *
 * Parameters follow the OWASP minimum for scrypt: N=2^16, r=8, p=1.
 */
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const COST = 2 ** 16;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

/** Encoded as `scrypt$N$r$p$salt$hash`, so parameters can change without a migration. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(plain.normalize('NFKC'), salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: 256 * 1024 * 1024,
  });

  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(plain: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, cost, blockSize, parallelization, salt, expected] = parts;
  const expectedBuffer = Buffer.from(expected, 'base64url');

  const derived = await scrypt(
    plain.normalize('NFKC'),
    Buffer.from(salt, 'base64url'),
    expectedBuffer.length,
    {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelization),
      maxmem: 256 * 1024 * 1024,
    },
  );

  // Constant-time comparison: a length check alone would leak through timing.
  return derived.length === expectedBuffer.length && timingSafeEqual(derived, expectedBuffer);
}
