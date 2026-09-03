import { isValidBaseUrl, normaliseBaseUrl } from './api-config';

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
