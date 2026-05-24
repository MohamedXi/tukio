import Link from 'next/link';
import { Logo } from '@tukio/ui/patterns/Logo';

interface LinkedLogoProps {
  locale: string;
  size?: number;
}

/**
 * Logo wrapped in a `next/link` pointing at the locale root. In pre-launch
 * mode the middleware rewrites `/[locale]` to the coming-soon waitlist page,
 * so this is also the path back to the signup form from any institutional page.
 */
export function LinkedLogo({ locale, size = 22 }: LinkedLogoProps) {
  return (
    <Link href={`/${locale}`} className="inline-flex" aria-label="tukio.one">
      <Logo size={size} />
    </Link>
  );
}
