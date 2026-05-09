import type { Currency } from './Currency.js';

export interface Money {
  amount: number;
  currency: Currency;
}
