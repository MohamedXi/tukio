import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const SLUGS = {
  home: {
    fr: 'Bientôt en France',
    en: 'Coming soon in France',
  },
  'coming-soon': {
    fr: 'Bientôt en France',
    en: 'Coming soon in France',
  },
  about: {
    fr: 'Une plateforme, un événement',
    en: 'One platform, one event',
  },
  privacy: {
    fr: 'Vos données, en clair',
    en: 'Your data, transparent',
  },
  legal: {
    fr: 'Un projet en préparation',
    en: 'A project in preparation',
  },
  contact: {
    fr: 'On vous écoute',
    en: "We're listening",
  },
  success: {
    fr: 'Bienvenue sur la liste',
    en: "You're on the list",
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
  // Metadata references carry a `.png` suffix (e.g. /og/about.png) so they stay
  // out of the middleware locale-prefix matcher (which skips dotted paths).
  // Strip the extension before matching the slug table.
  const cleanSlug = slug.replace(/\.(png|jpe?g|webp)$/i, '');
  if (!isSlug(cleanSlug)) {
    return new Response('Not Found', { status: 404 });
  }
  const locale = pickLocale(new URL(request.url).searchParams.get('locale'));
  const tagline = SLUGS[cleanSlug][locale];

  // Fraunces is fetched same-origin from /public/fonts/ — Edge runtime resolves
  // `new URL('/fonts/...', request.url)` to the absolute URL of the deployed asset.
  // Falls back to system sans-serif if the fetch fails (cold-start DNS, 404).
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
        Pays de la Loire · 2026
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
