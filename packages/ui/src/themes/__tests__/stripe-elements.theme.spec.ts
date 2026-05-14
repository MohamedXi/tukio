import { describe, it, expect } from 'vitest';
import { stripeElementsTheme } from '../stripe-elements.theme';

describe('Stripe Elements theme', () => {
  it('uses the flat preset', () => {
    expect(stripeElementsTheme.theme).toBe('flat');
  });

  it('binds Tukio design-token colors to the canonical Stripe variables', () => {
    expect(stripeElementsTheme.variables).toMatchObject({
      colorPrimary: expect.stringMatching(/^#[0-9a-f]{3,8}$/i),
      colorBackground: expect.stringMatching(/^#[0-9a-f]{3,8}$/i),
      colorText: expect.stringMatching(/^#[0-9a-f]{3,8}$/i),
      colorDanger: expect.stringMatching(/^#[0-9a-f]{3,8}$/i),
      colorTextPlaceholder: expect.stringMatching(/^#[0-9a-f]{3,8}$/i),
      fontFamily: expect.any(String),
      spacingUnit: '4px',
      borderRadius: expect.any(String),
    });
  });

  it('declares Input + Input:focus rules with brand-coloured focus ring', () => {
    expect(stripeElementsTheme.rules).toBeDefined();
    expect(stripeElementsTheme.rules!['.Input']).toBeDefined();
    expect(stripeElementsTheme.rules!['.Input:focus']).toMatchObject({
      borderColor: expect.stringMatching(/^#[0-9a-f]{3,8}$/i),
      boxShadow: expect.stringContaining('0 0 0 2px'),
    });
  });
});
