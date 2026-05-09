import { colors } from '@tukio/ui/tokens/colors';

// Smoke test: verifies that @tukio/ui/tokens/colors subpath resolves correctly.
// Actual Stripe Elements wiring lands in Story 4.5.
export const _colorSmokeCheck = colors.brand[500] satisfies string;
