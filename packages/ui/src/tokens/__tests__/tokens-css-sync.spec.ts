import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { colors } from '../colors.js';
import { spacing } from '../spacing.js';
import { radius } from '../radius.js';
import { shadows } from '../shadows.js';
import { breakpoints } from '../breakpoints.js';
import { fontFamily, fontSize } from '../typography.js';

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

  describe('shadows scale', () => {
    Object.entries(shadows).forEach(([key, value]) => {
      // Key `shadow` maps to CSS var `--shadow` (no suffix); all others map to `--shadow-<key>`
      const cssVarName = key === 'shadow' ? 'shadow' : `shadow-${key}`;
      it(`shadows.${key} → --${cssVarName}`, () => {
        expect(readCssVar(cssVarName)).toBe(value);
      });
    });
  });

  describe('breakpoints scale', () => {
    Object.entries(breakpoints).forEach(([key, value]) => {
      it(`breakpoint-${key}`, () => {
        expect(readCssVar(`breakpoint-${key}`)).toBe(value);
      });
    });
  });

  describe('typography — font size scale', () => {
    Object.entries(fontSize).forEach(([key, value]) => {
      it(`text-${key}`, () => {
        expect(readCssVar(`text-${key}`)).toBe(value);
      });
    });
  });

  describe('typography — font families (CSS var references next/font variables)', () => {
    it('--font-display references var(--font-fraunces, ...)', () => {
      const val = readCssVar('font-display');
      expect(val).toMatch(/var\(--font-fraunces/);
      expect(val).toMatch(/Fraunces/);
    });
    it('--font-body references var(--font-inter, ...)', () => {
      const val = readCssVar('font-body');
      expect(val).toMatch(/var\(--font-inter/);
    });
    it('--font-mono references var(--font-jetbrains-mono, ...)', () => {
      const val = readCssVar('font-mono');
      expect(val).toMatch(/var\(--font-jetbrains-mono/);
    });
    it('fontFamily.display matches Fraunces family string', () => {
      expect(fontFamily.display).toContain('Fraunces');
    });
  });
});
