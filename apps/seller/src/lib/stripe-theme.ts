import { colors } from '@tukio/ui/tokens/colors';

// Smoke test: verifies that @tukio/ui/tokens/colors subpath resolves correctly.
export const _colorSmokeCheck = colors.brand[500] satisfies string;
