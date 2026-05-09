/* tukio.one — Shared building blocks
   Logo, icons (lucide-style outlined 1.5px), nav, placeholders, badges.
   Components are exposed on window so other artboard files can use them. */

// ── Icon (Lucide-style, stroke 1.5) ──────────────────────────────────────
function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.5, style }) {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

const ICONS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  star: (
    <>
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9Z" />
    </>
  ),
  heart: (
    <>
      <path d="M20.8 6.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 6.6c0 5.4 8.8 11 8.8 11s8.8-5.6 8.8-11Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  bolt: (
    <>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </>
  ),
  message: (
    <>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.5l-5 1 1-4.5A8.5 8.5 0 1 1 21 11.5Z" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </>
  ),
  arrowL: (
    <>
      <path d="M19 12H5M11 5l-7 7 7 7" />
    </>
  ),
  check: (
    <>
      <path d="m4 12 5 5L20 6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  minus: (
    <>
      <path d="M5 12h14" />
    </>
  ),
  x: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  caret: (
    <>
      <path d="m6 9 6 6 6-6" />
    </>
  ),
  filter: (
    <>
      <path d="M3 5h18l-7 9v6l-4-2v-4L3 5Z" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  map: (
    <>
      <path d="m3 7 6-3 6 3 6-3v13l-6 3-6-3-6 3Z" />
      <path d="M9 4v13M15 7v13" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M5 11l7-7 7 7" />
      <path d="M4 20h16" />
    </>
  ),
  truck: (
    <>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  euro: (
    <>
      <path d="M18 7a7 7 0 1 0 0 10" />
      <path d="M3 10h11M3 14h11" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  tent: (
    <>
      <path d="M3 20 12 4l9 16" />
      <path d="M9 20v-5h6v5" />
      <path d="M3 20h18" />
    </>
  ),
  chair: (
    <>
      <path d="M6 4h12v8H6z" />
      <path d="M5 12h14M7 12v8M17 12v8" />
    </>
  ),
  flame: (
    <>
      <path d="M12 3c2 4 6 5 6 10a6 6 0 1 1-12 0c0-3 2-4 3-7 0 2 1 3 3 3 0-3 0-5 0-6Z" />
    </>
  ),
  bookmark: (
    <>
      <path d="M6 3h12v18l-6-4-6 4Z" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
    </>
  ),
  package: (
    <>
      <path d="m3 7 9-4 9 4-9 4-9-4Z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3H6v18h12V7z" />
      <path d="M14 3v4h4" />
    </>
  ),
  euroBig: (
    <>
      <path d="M18 7a7 7 0 1 0 0 10" strokeWidth="2" />
      <path d="M3 10h11M3 14h11" strokeWidth="2" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  repeat: (
    <>
      <path d="M17 2l4 4-4 4" />
      <path d="M21 6H8a5 5 0 0 0-5 5" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M3 18h13a5 5 0 0 0 5-5" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  tag: (
    <>
      <path d="M20 12 12 20a2 2 0 0 1-3 0l-7-7V4h9l9 8Z" />
      <circle cx="7" cy="7" r="1.5" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14v18l-3-2-3 2-3-2-3 2-2-2V3Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
};

// ── Logo: tukio.one ──────────────────────────────────────────────────────
// Wordmark in Fraunces, lowercase, with a small "arch" mark — references
// "point de rendez-vous / pliage tente" without being literal.
function Logo({ size = 28, mono = false, showDomain = true, color }) {
  const c = color || 'var(--charcoal-800)';
  const accent = mono ? c : 'var(--brand-500)';
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, color: c, lineHeight: 1 }}
    >
      <svg
        width={size * 0.85}
        height={size * 0.85}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ alignSelf: 'center' }}
      >
        {/* Arch / tent peak */}
        <path
          d="M3 20 C 6 8, 18 8, 21 20"
          stroke={accent}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="12" cy="6" r="1.6" fill={accent} />
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: size,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          fontStyle: 'normal',
        }}
      >
        tukio<span style={{ color: accent, fontWeight: 500 }}>.</span>
        {showDomain && (
          <span style={{ fontWeight: 400, color: mono ? c : 'var(--charcoal-500)' }}>one</span>
        )}
      </span>
    </span>
  );
}

// ── Stars rating display ─────────────────────────────────────────────────
function Stars({ value = 4.8, count, size = 14, showCount = true }) {
  return (
    <span className="tk-stars" style={{ fontSize: size }}>
      <Icon name="star" size={size} color="var(--brand-500)" strokeWidth={2} />
      <span style={{ color: 'var(--charcoal-700)' }}>{value.toFixed(1)}</span>
      {showCount && count != null && (
        <span style={{ color: 'var(--charcoal-400)', fontWeight: 400 }}>· {count} avis</span>
      )}
    </span>
  );
}

// ── Striped placeholder image with optional label ────────────────────────
function Placeholder({ label = 'photo événement réel', height, aspect, style, children }) {
  const s = {
    width: '100%',
    ...(aspect ? { aspectRatio: aspect } : {}),
    ...(height ? { height } : {}),
    ...style,
  };
  return (
    <div className="tk-ph" style={s}>
      {children || <span className="tk-ph-label">{label}</span>}
    </div>
  );
}

// ── Avatar (initials with warm bg) ───────────────────────────────────────
function Avatar({ name = 'JD', size = 36, tone = 'cream' }) {
  const palette = {
    cream: ['var(--cream-200)', 'var(--charcoal-700)'],
    brand: ['var(--brand-100)', 'var(--brand-700)'],
    info: ['var(--info-50)', 'var(--info-700)'],
    success: ['var(--success-50)', 'var(--success-700)'],
  }[tone] || ['var(--cream-200)', 'var(--charcoal-700)'];
  const initials = name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: palette[0],
        color: palette[1],
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: size * 0.36,
        letterSpacing: '0.02em',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// ── Top navigation (client, public) ──────────────────────────────────────
function TopNav({ variant = 'public', compactSearch = true, transparent = false }) {
  const linkStyle = {
    fontSize: 14,
    color: 'var(--charcoal-600)',
    fontWeight: 500,
    padding: '8px 12px',
  };
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        padding: '16px 40px',
        borderBottom: transparent ? '1px solid transparent' : '1px solid var(--cream-200)',
        background: transparent ? 'transparent' : 'var(--cream-50)',
      }}
    >
      <Logo size={22} />
      {compactSearch && (
        <div
          style={{
            flex: 1,
            maxWidth: 480,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px 8px 16px',
            background: 'var(--cream-50)',
            border: '1px solid var(--cream-300)',
            borderRadius: 999,
            boxShadow: 'var(--shadow-sm)',
            marginLeft: 24,
          }}
        >
          <Icon name="search" size={16} color="var(--charcoal-500)" />
          <span style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
            Tentes &amp; chapiteaux
          </span>
          <span style={{ width: 1, height: 18, background: 'var(--cream-300)' }} />
          <span style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>Nantes</span>
          <span style={{ width: 1, height: 18, background: 'var(--cream-300)' }} />
          <span style={{ fontSize: 13, color: 'var(--charcoal-500)', flex: 1 }}>15 juin 2026</span>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--brand-500)',
              color: 'var(--cream-50)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="search" size={14} color="currentColor" strokeWidth={2} />
          </span>
        </div>
      )}
      <div style={{ flex: compactSearch ? 0 : 1 }} />
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <a style={linkStyle}>Catégories</a>
        <a style={linkStyle}>Devenir pro</a>
        {variant === 'public' ? (
          <>
            <a style={linkStyle}>Connexion</a>
            <button className="tk-btn tk-btn-secondary tk-btn-sm">S'inscrire</button>
          </>
        ) : (
          <>
            <button className="tk-btn tk-btn-ghost tk-btn-sm" style={{ width: 36, padding: 0 }}>
              <Icon name="bell" size={18} />
            </button>
            <Avatar name="Camille R" size={32} tone="brand" />
          </>
        )}
      </nav>
    </header>
  );
}

// ── Section caption (small mono kicker) ──────────────────────────────────
function Kicker({ children, color = 'var(--brand-700)' }) {
  return (
    <span className="tk-mono" style={{ color }}>
      {children}
    </span>
  );
}

// ── Pill (filter chip) ───────────────────────────────────────────────────
function Pill({ children, active, icon }) {
  return (
    <button
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 500,
        background: active ? 'var(--charcoal-700)' : 'var(--cream-50)',
        color: active ? 'var(--cream-50)' : 'var(--charcoal-600)',
        border: `1px solid ${active ? 'var(--charcoal-700)' : 'var(--cream-300)'}`,
        whiteSpace: 'nowrap',
      }}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}

// ── Version badge (MVP / V1 / V2 / V3) ────────────────────────────────
// Used on every artboard label so the canvas reads as a version timeline.
const VERSION_TONES = {
  MVP: { bg: '#1F1D18', fg: '#FAF7F2', note: 'Prouver la transaction' },
  V1: { bg: '#C2410C', fg: '#FAF7F2', note: 'Marketplace complète' },
  V2: { bg: '#4D7C5E', fg: '#FAF7F2', note: 'Croissance & rétention' },
  V3: { bg: '#1E5F7E', fg: '#FAF7F2', note: 'Scale & expansion' },
};
function VersionBadge({ v = 'MVP', size = 'sm' }) {
  const tone = VERSION_TONES[v] || VERSION_TONES.MVP;
  const px =
    size === 'lg' ? { fontSize: 11, padding: '3px 8px' } : { fontSize: 9.5, padding: '2px 6px' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: tone.bg,
        color: tone.fg,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        letterSpacing: '0.08em',
        borderRadius: 3,
        ...px,
      }}
    >
      {v}
    </span>
  );
}

// VBoard — DCArtboard wrapper that prefixes the label with a version badge
// and (optionally) hides itself based on the active version filter.
function VBoard({ v = 'MVP', id, label, width, height, children, filter, ...rest }) {
  if (filter && !filter.includes(v)) return null;
  const labelEl = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <VersionBadge v={v} />
      <span>{label}</span>
    </span>
  );
  return (
    <DCArtboard id={id} label={labelEl} width={width} height={height} {...rest}>
      {children}
    </DCArtboard>
  );
}

// ── SiteHeader / ProTopBar — light shells reused by V1/V2/V3 screens ──
// These intentionally mirror the MVP top bar grammar (logo + nav + auth).
function SiteHeader({ active = 'search' }) {
  const link = (k, label) => (
    <a
      key={k}
      style={{
        fontSize: 13,
        color: active === k ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
        fontWeight: active === k ? 600 : 500,
        textDecoration: 'none',
        borderBottom: active === k ? '2px solid var(--brand-500)' : '2px solid transparent',
        paddingBottom: 4,
      }}
    >
      {label}
    </a>
  );
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 40px',
        borderBottom: '1px solid var(--cream-200)',
        background: 'var(--cream-50)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <Logo size={22} />
        <nav style={{ display: 'flex', gap: 24 }}>
          {link('search', 'Découvrir')}
          {link('inspiration', 'Inspirations')}
          {link('pros', 'Devenir prestataire')}
          {link('help', 'Aide')}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button className="tk-btn tk-btn-tertiary tk-btn-sm">Connexion</button>
        <button className="tk-btn tk-btn-primary tk-btn-sm">Créer un compte</button>
      </div>
    </header>
  );
}
// ── ClientSubNav — sub-navigation under SiteHeader for the client account zone
function ClientSubNav({ active = 'bookings' }) {
  const items = [
    { k: 'bookings', label: 'Mes réservations' },
    { k: 'messages', label: 'Messages' },
    { k: 'favorites', label: 'Favoris' },
    { k: 'reviews', label: 'Mes avis' },
    { k: 'settings', label: 'Paramètres' },
  ];
  return (
    <div style={{ borderBottom: '1px solid var(--cream-200)', background: 'var(--cream-50)' }}>
      <div
        style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px', display: 'flex', gap: 28 }}
      >
        {items.map((it) => (
          <a
            key={it.k}
            style={{
              fontSize: 13,
              padding: '14px 0',
              color: active === it.k ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
              fontWeight: active === it.k ? 600 : 500,
              textDecoration: 'none',
              borderBottom:
                active === it.k ? '2px solid var(--brand-500)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {it.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── ProSidebar — floating left sidebar for the pro/seller workspace ──
// Margins around (top/left/bottom), rounded corners, charcoal background.
const PRO_NAV = [
  { k: 'dashboard', label: "Vue d'ensemble", icon: 'home' },
  { k: 'bookings', label: 'Demandes', icon: 'calendar', badge: 3 },
  { k: 'calendar', label: 'Calendrier', icon: 'calendar' },
  { k: 'services', label: 'Services', icon: 'tag' },
  { k: 'messages', label: 'Messages', icon: 'message', badge: 2 },
  { k: 'reviews', label: 'Avis', icon: 'star' },
  { k: 'stats', label: 'Statistiques', icon: 'chart' },
  { k: 'billing', label: 'Facturation', icon: 'receipt' },
];
function ProSidebar({
  active = 'dashboard',
  user = { name: 'Léa B.', brand: 'Atelier Tente Loire' },
}) {
  return (
    <aside
      style={{
        position: 'sticky',
        top: 16,
        alignSelf: 'flex-start',
        width: 248,
        height: 'calc(100vh - 32px)',
        margin: '16px 0 16px 16px',
        background: '#1F1D18',
        color: 'var(--cream-100)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 24px -12px rgba(31,29,24,0.35)',
        flexShrink: 0,
      }}
    >
      {/* Brand + PRO badge */}
      <div
        style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid rgba(250,247,242,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'var(--brand-500)',
            color: 'var(--cream-50)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          t
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--cream-50)',
              letterSpacing: '-0.01em',
            }}
          >
            tukio
          </div>
        </div>
        <span
          style={{
            fontSize: 9.5,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.08em',
            padding: '3px 7px',
            background: 'rgba(250,247,242,0.12)',
            color: 'var(--cream-100)',
            borderRadius: 3,
          }}
        >
          PRO
        </span>
      </div>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
        }}
      >
        {PRO_NAV.map((item) => {
          const on = active === item.k;
          return (
            <a
              key={item.k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: on ? 600 : 500,
                color: on ? 'var(--cream-50)' : 'rgba(250,247,242,0.65)',
                background: on ? 'rgba(250,247,242,0.08)' : 'transparent',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <Icon name={item.icon} size={16} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    background: 'var(--brand-500)',
                    color: 'var(--cream-50)',
                    borderRadius: 999,
                    padding: '1px 6px',
                    minWidth: 16,
                    textAlign: 'center',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* User block */}
      <div
        style={{
          padding: '14px 16px',
          borderTop: '1px solid rgba(250,247,242,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Avatar name={user.name} size={32} tone="brand" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--cream-50)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(250,247,242,0.55)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user.brand}
          </div>
        </div>
        <Icon name="more" size={16} />
      </div>
    </aside>
  );
}

// ── ProTopBar — kept as legacy alias mapping to the new sidebar shell.
// (If a screen still calls <ProTopBar />, render nothing — sidebar is now in
// the surrounding ProShell.) Maintains backward compat without errors.
function ProTopBar() {
  return null;
}

// ── ProShell — sidebar + content wrapper. Use <ProShell active="bookings">…</ProShell>
// to compose any pro screen with the floating sidebar in one shot.
function ProShell({ active, user, children, contentBg = 'var(--cream-50)' }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: contentBg }}>
      <ProSidebar active={active} user={user} />
      <div style={{ flex: 1, minWidth: 0, padding: '16px 16px 16px 24px' }}>{children}</div>
    </div>
  );
}

// ── ProPageHeader — contextual header inside the content zone (replaces ProTopBar)
function ProPageHeader({ title, subtitle, breadcrumb, actions }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        padding: '8px 8px 24px',
        borderBottom: '1px solid var(--cream-200)',
        marginBottom: 24,
      }}
    >
      <div>
        {breadcrumb && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--charcoal-500)',
              marginBottom: 8,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
            }}
          >
            {breadcrumb}
          </div>
        )}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: 'var(--charcoal-800)',
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 13.5,
              color: 'var(--charcoal-500)',
              margin: '6px 0 0',
              maxWidth: 640,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10 }}>{actions}</div>}
    </div>
  );
}

Object.assign(window, {
  Icon,
  Logo,
  Stars,
  Placeholder,
  Avatar,
  TopNav,
  SiteHeader,
  ClientSubNav,
  ProTopBar,
  ProSidebar,
  ProShell,
  ProPageHeader,
  Kicker,
  Pill,
  VersionBadge,
  VBoard,
  VERSION_TONES,
});
