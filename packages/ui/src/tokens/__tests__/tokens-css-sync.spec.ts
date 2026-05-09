import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { colors } from '../colors.js';
import { spacing } from '../spacing.js';
import { radius } from '../radius.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEME_CSS_PATH = join(__dirname, '../../styles/theme.css');

let themeCss = '';
beforeAll(() => {
  themeCss = readFileSync(THEME_CSS_PATH, 'utf8');
});

/** Extract the value of a CSS custom property from theme.css. */
function readCssVar(name: string): string | null {
  const re = new RegExp(`--${name.replace(/-/g, '\\-')}:\\s*([^;]+);`);
  const match = themeCss.match(re);
  return match?.[1]?.trim() ?? null;
}

describe('theme.css ↔ tokens TS — strict sync', () => {
  describe('colors.brand', () => {
    Object.entries(colors.brand).forEach(([shade, hex]) => {
      it(`brand-${shade} matches CSS var (--color-brand-${shade})`, () => {
        const css = readCssVar(`color-brand-${shade}`);
        expect(css?.toUpperCase()).toBe(hex.toUpperCase());
      });
    });
  });

  describe('colors.cream + charcoal', () => {
    Object.entries(colors.cream).forEach(([shade, hex]) => {
      it(`cream-${shade}`, () => {
        expect(readCssVar(`color-cream-${shade}`)?.toUpperCase()).toBe(hex.toUpperCase());
      });
    });
    Object.entries(colors.charcoal).forEach(([shade, hex]) => {
      it(`charcoal-${shade}`, () => {
        expect(readCssVar(`color-charcoal-${shade}`)?.toUpperCase()).toBe(hex.toUpperCase());
      });
    });
  });

  describe('colors.functional', () => {
    (['success', 'warning', 'error', 'danger', 'info'] as const).forEach((scale) => {
      Object.entries(colors[scale]).forEach(([shade, hex]) => {
        it(`${scale}-${shade}`, () => {
          expect(readCssVar(`color-${scale}-${shade}`)?.toUpperCase()).toBe(hex.toUpperCase());
        });
      });
    });
  });

  describe('spacing scale', () => {
    Object.entries(spacing).forEach(([key, value]) => {
      it(`spacing-${key}`, () => {
        expect(readCssVar(`spacing-${key}`)).toBe(value);
      });
    });
  });

  describe('radius scale', () => {
    (['sm', 'md', 'lg', 'xl', '2xl', 'full'] as const).forEach((key) => {
      it(`radius-${key}`, () => {
        expect(readCssVar(`radius-${key}`)).toBe(radius[key]);
      });
    });
  });
});
