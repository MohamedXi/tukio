import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export function GET(): Response {
  const sellerBaseUrl = process.env.NEXT_PUBLIC_SELLER_BASE_URL ?? 'https://seller.tukio.one';
  return NextResponse.redirect(new URL('/og/seller-coming-soon', sellerBaseUrl), 308);
}
