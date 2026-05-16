/**
 * SIRET (Système d'Identification du Répertoire des ÉTablissements) is the
 * 14-digit French establishment identifier (9-digit SIREN + 5-digit NIC).
 *
 * Format validation : exactly 14 digits.
 * Checksum validation : standard Luhn (mod 10) algorithm — starting from the
 * right and walking left, every second digit is doubled; if doubling produces
 * a two-digit number, sum its digits (equivalent to subtracting 9). The total
 * is valid when it is a multiple of 10.
 *
 * Reference: https://fr.wikipedia.org/wiki/Formule_de_Luhn
 * Cross-checked against the official INSEE search engine
 * (https://annuaire-entreprises.data.gouv.fr/) for the 5 fixture SIRETs in
 * `siret.spec.ts`.
 *
 * Used by both frontend (sign-up wizard live validation, Story 1.3d) and
 * backend (Zod schema in `register-pro.dto.ts`, domain `Siret` value object
 * in `apps/identity-svc/`). Keep this function pure (no I/O, no globals).
 */
export function siretLuhnCheck(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const digit = parseInt(siret.charAt(i), 10);
    // Positions from the right are 1..14. Doubling applies to even positions
    // from the right (i.e. positions 2, 4, 6, …, 14). From the left (0-indexed),
    // those are positions where (14 - i) is even.
    if ((14 - i) % 2 === 0) {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += digit;
    }
  }

  return sum % 10 === 0;
}
