import { describe, it, expect } from 'vitest';
import { siretLuhnCheck } from './siret.js';

describe('siretLuhnCheck', () => {
  describe('Luhn-valid SIRETs', () => {
    // SIRET 35600000000048 (LA POSTE) is verified live against
    // https://api.insee.fr/api-sirene/3.11/siret/35600000000048 →
    // etatAdministratifUniteLegale="A". The others are Luhn-valid composites
    // (cross-checked with the algorithm and the official mod-10 rule). Luhn
    // by itself proves nothing about INSEE existence — that check is done in
    // `InseeSiretValidatorService` (Story 1.3b), not here.
    it.each([
      ['35600000000048', 'LA POSTE (live INSEE active)'],
      ['44306184100039', 'Luhn-valid composite #1'],
      ['55208262100459', 'Luhn-valid composite #2'],
      ['73282932000074', 'Luhn-valid composite #3'],
      ['54205118500024', 'Luhn-valid composite #4'],
      ['78467169500087', 'Luhn-valid composite #5'],
    ])('accepts %s — %s', (siret) => {
      expect(siretLuhnCheck(siret)).toBe(true);
    });
  });

  describe('invalid SIRETs', () => {
    it.each([
      ['12345678901234', 'sequential digits — Luhn fail'],
      ['00000000000001', 'leading zeros — Luhn fail'],
      ['35600000000049', 'one digit off from valid LA POSTE'],
      ['78467169500089', 'one digit off from valid SNCF'],
    ])('rejects %s (Luhn checksum fail) — %s', (siret) => {
      expect(siretLuhnCheck(siret)).toBe(false);
    });
  });

  describe('format guards', () => {
    it.each([
      ['1234567890123', 'only 13 digits'],
      ['123456789012345', '15 digits'],
      ['', 'empty string'],
      ['356 000 000 000 48', 'spaces present'],
      ['35600000000048\n', 'trailing whitespace'],
      ['3560000000004A', 'non-numeric character'],
      ['3560-0000-000-048', 'dashes'],
    ])('rejects "%s" — %s', (siret) => {
      expect(siretLuhnCheck(siret)).toBe(false);
    });
  });

  describe('all-zeros edge case', () => {
    // Mathematical edge case: '00000000000000' passes Luhn (sum=0, 0%10=0).
    // This is documented but the upstream Zod schema must combine the Luhn
    // check with additional business rules (e.g. INSEE active check) to reject
    // it — Luhn alone never catches structural-impossible SIRETs.
    it('accepts 00000000000000 (Luhn-valid but business-impossible)', () => {
      expect(siretLuhnCheck('00000000000000')).toBe(true);
    });
  });
});
