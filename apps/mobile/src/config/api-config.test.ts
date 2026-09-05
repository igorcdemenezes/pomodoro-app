import { devServerDefault, isValidBaseUrl, normaliseBaseUrl } from './api-config';

describe('API base URL', () => {
  describe('normalising', () => {
    it('adds a scheme when one is missing', () => {
      expect(normaliseBaseUrl('192.168.0.10:3000/api/v1')).toBe('http://192.168.0.10:3000/api/v1');
    });

    it('keeps an explicit https scheme', () => {
      expect(normaliseBaseUrl('https://api.example.com/api/v1')).toBe(
        'https://api.example.com/api/v1',
      );
    });

    it('strips trailing slashes, which would double up in every path', () => {
      expect(normaliseBaseUrl('http://localhost:3000/api/v1///')).toBe(
        'http://localhost:3000/api/v1',
      );
    });

    it('treats a host:port as a host, not as a scheme', () => {
      expect(normaliseBaseUrl('localhost:3000/api/v1')).toBe('http://localhost:3000/api/v1');
    });

    it('leaves a real scheme alone rather than nesting one inside another', () => {
      expect(normaliseBaseUrl('ftp://example.com')).toBe('ftp://example.com');
    });

    it('trims surrounding whitespace typed on a phone keyboard', () => {
      expect(normaliseBaseUrl('  http://localhost:3000/api/v1  ')).toBe(
        'http://localhost:3000/api/v1',
      );
    });
  });

  describe('deriving the address from the dev server', () => {
    // The phone reached Metro over the local network, so it already holds the
    // host the API is on. Deriving it is what stops someone having to retype an
    // address every time DHCP hands out a new one.
    it('keeps the API port and path, replacing only the host', () => {
      expect(devServerDefault('192.168.15.126:8081')).toBe('http://192.168.15.126:3000/api/v1');
    });

    it('handles a host given without the dev server port', () => {
      expect(devServerDefault('192.168.0.10')).toBe('http://192.168.0.10:3000/api/v1');
    });

    it('gives up when there is no dev server to learn from', () => {
      // A release build: no Metro, so the address baked into the build stands.
      expect(devServerDefault(undefined)).toBeNull();
      expect(devServerDefault('')).toBeNull();
    });
  });

  describe('validating', () => {
    it('accepts an address with or without a scheme', () => {
      expect(isValidBaseUrl('http://10.0.2.2:3000/api/v1')).toBe(true);
      expect(isValidBaseUrl('10.0.2.2:3000/api/v1')).toBe(true);
      expect(isValidBaseUrl('localhost:3000/api/v1')).toBe(true);
      expect(isValidBaseUrl('https://api.example.com')).toBe(true);
    });

    it('rejects an empty or nonsense value', () => {
      expect(isValidBaseUrl('')).toBe(false);
      expect(isValidBaseUrl('   ')).toBe(false);
    });

    it('rejects a non-http scheme', () => {
      expect(isValidBaseUrl('ftp://example.com')).toBe(false);
      expect(isValidBaseUrl('javascript:alert(1)')).toBe(false);
    });
  });
});
