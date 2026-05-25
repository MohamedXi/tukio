import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const SLUGS = {
  home: {
    fr: 'Pour les pros de l’événementiel',
    en: 'For event professionals',
  },
  'seller-coming-soon': {
    fr: 'Pour les pros de l’événementiel',
    en: 'For event professionals',
  },
} as const;

type Slug = keyof typeof SLUGS;
type Locale = 'fr' | 'en';

function isSlug(value: string): value is Slug {
  return value in SLUGS;
}

function pickLocale(raw: string | null): Locale {
  return raw === 'en' ? 'en' : 'fr';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  // Metadata references carry a `.png` suffix (e.g. /og/seller-coming-soon.png)
  // so they stay out of the middleware locale-prefix matcher (which skips
  // dotted paths). Strip the extension before matching the slug table.
  const cleanSlug = slug.replace(/\.(png|jpe?g|webp)$/i, '');
  if (!isSlug(cleanSlug)) {
    return new Response('Not Found', { status: 404 });
  }
  const locale = pickLocale(new URL(request.url).searchParams.get('locale'));
  const tagline = SLUGS[cleanSlug][locale];

  type OgFont = {
    name: string;
    data: ArrayBuffer;
    style: 'normal' | 'italic';
    weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  };
  let fonts: OgFont[] = [];
  try {
    const fontData = await fetch(new URL('/fonts/Fraunces-Regular.woff2', request.url)).then((r) =>
      r.arrayBuffer(),
    );
    fonts = [{ name: 'Fraunces', data: fontData, style: 'normal', weight: 400 }];
  } catch {
    // Render with system font rather than returning 500
  }

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '80px',
        background: '#FAF7F2',
        fontFamily: 'Fraunces',
      }}
    >
      <div
        style={{
          fontSize: 96,
          color: '#3A322B',
          lineHeight: 1.05,
          letterSpacing: '-0.025em',
          display: 'flex',
        }}
      >
        tukio<span style={{ color: '#FFA000' }}>.one</span>
      </div>
      <div
        style={{
          fontSize: 56,
          color: '#FFA000',
          fontStyle: 'italic',
          marginTop: 24,
          maxWidth: 1000,
          lineHeight: 1.15,
          display: 'flex',
        }}
      >
        {tagline}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          right: 80,
          padding: '12px 20px',
          background: '#FFE5C2',
          border: '1px solid #FFCC80',
          borderRadius: 999,
          fontSize: 18,
          color: '#C87900',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          display: 'flex',
        }}
      >
        Pour les pros · 2026
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
