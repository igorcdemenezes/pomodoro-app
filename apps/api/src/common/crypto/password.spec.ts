import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const encoded = await hashPassword('correct horse battery staple');

    await expect(verifyPassword('correct horse battery staple', encoded)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const encoded = await hashPassword('correct horse battery staple');

    await expect(verifyPassword('Correct horse battery staple', encoded)).resolves.toBe(false);
  });

  it('produces a different hash for the same password', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);

    expect(a).not.toEqual(b);
  });

  it('embeds the parameters so they can change later', async () => {
    const encoded = await hashPassword('anything');

    expect(encoded.startsWith('scrypt$65536$8$1$')).toBe(true);
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('anything', 'bcrypt$1$2$3$4$5')).resolves.toBe(false);
  });

  it('normalises unicode so the same typed password verifies', async () => {
    const encoded = await hashPassword('café');

    await expect(verifyPassword('café', encoded)).resolves.toBe(true);
  });
});
