import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GLOBALS_CSS = readFileSync(join(__dirname, '../globals.css'), 'utf8');

describe('packages/ui/src/styles/globals.css', () => {
  it('imports tailwindcss FIRST', () => {
    const tailwindIdx = GLOBALS_CSS.indexOf("@import 'tailwindcss'");
    const themeIdx = GLOBALS_CSS.indexOf("@import './theme.css'");
    expect(tailwindIdx).toBeGreaterThanOrEqual(0);
    expect(themeIdx).toBeGreaterThan(tailwindIdx);
  });

  it('contains the :root reset rules', () => {
    expect(GLOBALS_CSS).toMatch(/:root\s*\{[\s\S]*--font-body[\s\S]*--text-base[\s\S]*\}/);
  });

  it('declares h1-h4 with display font + text-wrap balance', () => {
    expect(GLOBALS_CSS).toMatch(
      /h1,\s*h2,\s*h3,\s*h4\s*\{[\s\S]*font-family:\s*var\(--font-display\)[\s\S]*text-wrap:\s*balance[\s\S]*\}/,
    );
  });

  it('applies text-wrap: pretty on <p>', () => {
    expect(GLOBALS_CSS).toMatch(/p\s*\{[\s\S]*text-wrap:\s*pretty[\s\S]*\}/);
  });

  it('declares ::selection with brand tint', () => {
    expect(GLOBALS_CSS).toMatch(
      /::selection\s*\{[\s\S]*background:\s*var\(--color-brand-200\)[\s\S]*\}/,
    );
  });
});

describe('packages/ui/src/styles/theme.css', () => {
  const THEME_CSS = readFileSync(join(__dirname, '../theme.css'), 'utf8');

  it('contains @theme block', () => {
    expect(THEME_CSS).toMatch(/@theme\s*\{/);
  });

  it('references next/font CSS variables with string fallbacks', () => {
    expect(THEME_CSS).toMatch(/--font-display:\s*var\(--font-fraunces,\s*'Fraunces'\)/);
    expect(THEME_CSS).toMatch(/--font-body:\s*var\(--font-inter,\s*'Inter'\)/);
    expect(THEME_CSS).toMatch(/--font-mono:\s*var\(--font-jetbrains-mono,\s*'JetBrains Mono'\)/);
  });

  it('declares the 3 keyframes outside @theme', () => {
    expect(THEME_CSS).toMatch(/@keyframes tk-typing/);
    expect(THEME_CSS).toMatch(/@keyframes tk-modal-enter/);
    expect(THEME_CSS).toMatch(/@keyframes tk-shimmer/);
  });

  it('enforces prefers-reduced-motion non-negotiable (RGAA AA)', () => {
    expect(THEME_CSS).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*animation-duration:\s*0\.01ms\s*!important/,
    );
  });
});
