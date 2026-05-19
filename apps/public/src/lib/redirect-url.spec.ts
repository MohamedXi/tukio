import { describe, expect, it } from 'vitest';
import { sanitizeNextUrl } from './redirect-url.js';

const ALLOWED = ['tukio.one'];

describe('sanitizeNextUrl', () => {
  it('returns null for null input', () => {
    expect(sanitizeNextUrl(null, ALLOWED)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(sanitizeNextUrl('', ALLOWED)).toBeNull();
  });

  it('allows apex domain https', () => {
    expect(sanitizeNextUrl('https://tukio.one/fr/account', ALLOWED)).toBe(
      'https://tukio.one/fr/account',
    );
  });

  it('allows subdomain https', () => {
    expect(sanitizeNextUrl('https://seller.tukio.one/fr/seller/dashboard', ALLOWED)).toBe(
      'https://seller.tukio.one/fr/seller/dashboard',
    );
  });

  it('blocks http scheme', () => {
    expect(sanitizeNextUrl('http://tukio.one/fr/account', ALLOWED)).toBeNull();
  });

  it('blocks javascript: scheme', () => {
    expect(sanitizeNextUrl('javascript:alert(1)', ALLOWED)).toBeNull();
  });

  it('blocks data: URI', () => {
    expect(sanitizeNextUrl('data:text/html,<script>evil</script>', ALLOWED)).toBeNull();
  });

  it('blocks external domain', () => {
    expect(sanitizeNextUrl('https://evil.com/steal', ALLOWED)).toBeNull();
  });

  it('blocks relative path', () => {
    expect(sanitizeNextUrl('/fr/account', ALLOWED)).toBeNull();
  });

  it('blocks domain that ends with tukio.one but is not a subdomain', () => {
    expect(sanitizeNextUrl('https://eviltukio.one/hack', ALLOWED)).toBeNull();
  });

  it('blocks empty hostname', () => {
    expect(sanitizeNextUrl('https:///path', ALLOWED)).toBeNull();
  });

  it('returns null for malformed URL', () => {
    expect(sanitizeNextUrl('not-a-url', ALLOWED)).toBeNull();
  });
});
