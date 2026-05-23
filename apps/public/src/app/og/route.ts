import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Bare `/og` is a fallback for any caller that omits the slug. Redirects to
// the default coming-soon variant so social previews still render something.
export function GET(): Response {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tukio.one';
  return NextResponse.redirect(new URL('/og/coming-soon', baseUrl), 308);
}
