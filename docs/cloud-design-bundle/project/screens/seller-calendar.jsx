/* /seller/calendar — vue calendrier mensuelle + panneau jour
   et /seller/services — liste des services avec stats */

// ── Local helpers ─────────────────────────────────────────────
function CalSection({ title, icon, children }) {
  return (
    <div className="tk-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {icon && <Icon name={icon} size={14} color="var(--charcoal-600)" />}
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--charcoal-800)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function CalProTopNav({ active = 'calendar' }) {
  const linkStyle = (a) => ({
    fontSize: 13,
    fontWeight: a === active ? 600 : 500,
    color: a === active ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
    padding: '8px 4px',
    borderBottom: a === active ? '2px solid var(--brand-500)' : '2px solid transparent',
    textDecoration: 'none',
    cursor: 'pointer',
  });
  return (
    <header style={{ borderBottom: '1px solid var(--cream-200)', background: 'var(--cream-50)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '14px 40px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Logo size={20} showDomain={false} />
          <span
            style={{
              fontSize: 11,
              padding: '2px 7px',
              background: 'var(--charcoal-800)',
              color: 'var(--cream-50)',
              borderRadius: 3,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Pro
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <Avatar name="Camille R" size={32} tone="brand" />
      </div>
      <div style={{ display: 'flex', gap: 28, padding: '0 40px' }}>
        <a style={linkStyle('dashboard')}>Vue d'ensemble</a>
        <a style={linkStyle('bookings')}>Réservations</a>
        <a style={linkStyle('calendar')}>Calendrier</a>
        <a style={linkStyle('services')}>Mes services</a>
        <a style={linkStyle('messages')}>Messages</a>
        <a style={linkStyle('payouts')}>Paiements</a>
        <a style={linkStyle('settings')}>Paramètres</a>
      </div>
    </header>
  );
}

// ────────────────────────────────────────────────────────────────
// 1. /seller/calendar
// ────────────────────────────────────────────────────────────────
function SellerCalendarScreen() {
  // Days for June 2026 (Mon=1)
  const days = [];
  // June 1 2026 is Monday
  for (let d = 1; d <= 30; d++) days.push(d);
  // 5 weeks display

  const events = {
    1: { type: 'booked', label: 'Pierre M.', multi: 3 },
    2: { type: 'booked', continuation: true },
    3: { type: 'booked', continuation: true, last: true },
    8: { type: 'blocked', label: 'Vacances', multi: 3 },
    9: { type: 'blocked', continuation: true },
    10: { type: 'blocked', continuation: true, last: true },
    15: { type: 'pending', label: 'Marie D. · ⏳', multi: 3 },
    16: { type: 'pending', continuation: true },
    17: { type: 'pending', continuation: true, last: true },
    22: { type: 'booked', label: 'J. Lefèvre', multi: 2 },
    23: { type: 'booked', continuation: true, last: true },
    27: { type: 'partial', label: '1 / 2 dispo' },
    28: { type: 'partial', label: '1 / 2 dispo' },
  };

  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <CalProTopNav active="calendar" />

      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '32px 40px 64px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <div>
            <Kicker color="var(--charcoal-500)">Espace pro · Mobilier des Mariées</Kicker>
            <h1
              style={{
                fontSize: 32,
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                letterSpacing: '-0.02em',
                color: 'var(--charcoal-800)',
                marginTop: 6,
                lineHeight: 1.1,
              }}
            >
              Calendrier
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="tk-btn tk-btn-tertiary tk-btn-sm">
              <Icon name="settings" size={14} /> Règles récurrentes
            </button>
            <button className="tk-btn tk-btn-primary tk-btn-sm">
              <Icon name="plus" size={14} strokeWidth={2.5} /> Bloquer une période
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              defaultValue="all"
              style={{
                padding: '8px 32px 8px 12px',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                border: '1px solid var(--cream-300)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--cream-50)',
                color: 'var(--charcoal-700)',
                appearance: 'none',
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%23615C56' fill='none' stroke-width='1.5'/></svg>\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                cursor: 'pointer',
                minWidth: 220,
              }}
            >
              <option value="all">Tous mes services (8)</option>
              <option>Chapiteau bambou 8 × 12 m</option>
              <option>Chaises Tiffany dorées</option>
            </select>

            <div
              style={{
                display: 'inline-flex',
                border: '1px solid var(--cream-300)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              <CalViewBtn label="Mois" active />
              <CalViewBtn label="Semaine" />
              <CalViewBtn label="Jour" />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="tk-btn tk-btn-ghost tk-btn-sm" style={{ width: 32, padding: 0 }}>
              <Icon name="arrowL" size={14} />
            </button>
            <span
              style={{
                fontSize: 18,
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                color: 'var(--charcoal-800)',
                padding: '0 16px',
                minWidth: 160,
                textAlign: 'center',
                letterSpacing: '-0.01em',
              }}
            >
              Juin 2026
            </span>
            <button className="tk-btn tk-btn-ghost tk-btn-sm" style={{ width: 32, padding: 0 }}>
              <Icon name="arrow" size={14} />
            </button>
            <button className="tk-btn tk-btn-tertiary tk-btn-sm" style={{ marginLeft: 8 }}>
              Aujourd'hui
            </button>
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            gap: 18,
            marginBottom: 16,
            padding: '10px 16px',
            background: 'var(--cream-100)',
            borderRadius: 'var(--radius-sm)',
            flexWrap: 'wrap',
          }}
        >
          <LegendDot color="var(--success-500)" label="Disponible" />
          <LegendDot color="var(--warning-500)" label="Partiel" />
          <LegendDot color="var(--brand-500)" label="Réservé" />
          <LegendDot color="var(--warning-600)" label="En attente acceptation" />
          <LegendDot color="var(--charcoal-500)" label="Bloqué" />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {/* Calendar grid */}
          <div className="tk-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Day headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                borderBottom: '1px solid var(--cream-200)',
                background: 'var(--cream-100)',
              }}
            >
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                <div
                  key={d}
                  style={{
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--charcoal-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {days.map((d) => {
                const ev = events[d];
                const isSelected = d === 15;
                return <DayCell key={d} day={d} event={ev} selected={isSelected} />;
              })}
              {/* trailing empty cells to make 5 full weeks */}
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={`pad-${i}`}
                  style={{
                    minHeight: 110,
                    borderTop: '1px solid var(--cream-200)',
                    borderRight: i < 4 ? '1px solid var(--cream-200)' : 'none',
                    background: 'var(--cream-100)',
                    opacity: 0.4,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Day detail panel */}
          <div
            style={{
              position: 'sticky',
              top: 32,
              alignSelf: 'start',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <CalSection title="Vendredi 15 juin 2026" icon="calendar">
              <div style={{ marginBottom: 14 }}>
                <span
                  className="tk-badge"
                  style={{
                    background: 'var(--warning-50)',
                    color: 'var(--warning-700)',
                    border: '1px solid var(--warning-200)',
                  }}
                >
                  <Icon name="clock" size={11} color="var(--warning-700)" /> En attente
                  d'acceptation
                </span>
              </div>

              <div
                className="tk-card"
                style={{ padding: 14, background: 'var(--cream-100)', marginBottom: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Avatar name="Marie D" size={28} tone="brand" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)' }}>
                    Marie D.
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--charcoal-700)', marginBottom: 4 }}>
                  Chapiteau bambou 8 × 12 m
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--charcoal-500)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  15 → 17 juin · 3 jours
                </div>
                <button
                  className="tk-btn tk-btn-secondary tk-btn-sm"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                >
                  Voir la demande →
                </button>
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 6,
                }}
              >
                Stock disponible ce jour
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--charcoal-700)',
                  marginBottom: 4,
                }}
              >
                <span>Chapiteau bambou</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>1 / 2</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--charcoal-700)',
                  marginBottom: 14,
                }}
              >
                <span>Chaises Tiffany dorées</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>120 / 120</span>
              </div>

              <button
                className="tk-btn tk-btn-tertiary tk-btn-sm"
                style={{ width: '100%', justifyContent: 'center', color: 'var(--charcoal-700)' }}
              >
                <Icon name="x" size={12} /> Bloquer ce jour
              </button>
            </CalSection>

            <CalSection title="Vue rapide du mois" icon="bolt">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <KPI label="Réservations confirmées" value="5" />
                <KPI label="En attente" value="1" warn />
                <KPI label="Jours bloqués" value="3" />
                <KPI label="Taux d'occupation" value="42 %" />
                <KPI label="CA prévisionnel" value="3 240 €" highlight />
              </div>
            </CalSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalViewBtn({ label, active }) {
  return (
    <button
      style={{
        padding: '7px 14px',
        fontSize: 13,
        fontWeight: 500,
        color: active ? 'var(--cream-50)' : 'var(--charcoal-600)',
        background: active ? 'var(--charcoal-800)' : 'var(--cream-50)',
        border: 'none',
        cursor: 'pointer',
        borderRight: '1px solid var(--cream-300)',
      }}
    >
      {label}
    </button>
  );
}

function LegendDot({ color, label }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--charcoal-600)',
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

function DayCell({ day, event, selected }) {
  const isWeekStart = (day - 1) % 7 === 0;

  let bg = 'var(--cream-50)';
  let bandColor = null;
  let textColor = 'var(--charcoal-700)';

  if (event && !event.continuation) {
    if (event.type === 'booked') bandColor = 'var(--brand-500)';
    if (event.type === 'pending') bandColor = 'var(--warning-500)';
    if (event.type === 'blocked') bandColor = 'var(--charcoal-500)';
    if (event.type === 'partial') bandColor = 'var(--warning-400)';
  }

  return (
    <div
      style={{
        minHeight: 110,
        padding: 8,
        borderTop: '1px solid var(--cream-200)',
        borderRight: day % 7 !== 0 ? '1px solid var(--cream-200)' : 'none',
        background: selected ? 'var(--brand-50)' : bg,
        position: 'relative',
        cursor: 'pointer',
        outline: selected ? '2px solid var(--brand-500)' : 'none',
        outlineOffset: -2,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: selected ? 700 : 500,
            color: selected ? 'var(--brand-700)' : textColor,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {day}
        </span>
        {!event && (
          <span
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success-500)' }}
          />
        )}
      </div>

      {event && !event.continuation && (
        <div
          style={{
            marginLeft: -8,
            marginRight: event.multi ? -1 : -8,
            padding: '4px 8px',
            background:
              event.type === 'booked'
                ? 'var(--brand-500)'
                : event.type === 'pending'
                  ? 'var(--warning-500)'
                  : event.type === 'blocked'
                    ? 'var(--charcoal-700)'
                    : 'var(--warning-100)',
            color: event.type === 'partial' ? 'var(--warning-700)' : 'var(--cream-50)',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: event.multi ? '0 0 0 0' : '0 0 0 0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {event.label}
        </div>
      )}

      {event && event.continuation && (
        <div
          style={{
            marginLeft: -1,
            marginRight: event.last ? -8 : -1,
            marginTop: 8,
            height: 22,
            background:
              event.type === 'booked'
                ? 'var(--brand-500)'
                : event.type === 'pending'
                  ? 'var(--warning-500)'
                  : 'var(--charcoal-700)',
            opacity: 0.85,
          }}
        />
      )}
    </div>
  );
}

function KPI({ label, value, warn, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
      <span style={{ color: 'var(--charcoal-600)' }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: warn
            ? 'var(--warning-700)'
            : highlight
              ? 'var(--success-700)'
              : 'var(--charcoal-800)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 2. /seller/services — liste des services
// ────────────────────────────────────────────────────────────────
function SellerServicesScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <CalProTopNav active="services" />

      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '32px 40px 64px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 28,
          }}
        >
          <div>
            <Kicker color="var(--charcoal-500)">Espace pro · Mobilier des Mariées</Kicker>
            <h1
              style={{
                fontSize: 32,
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                letterSpacing: '-0.02em',
                color: 'var(--charcoal-800)',
                marginTop: 6,
                lineHeight: 1.1,
              }}
            >
              Mes services
            </h1>
          </div>
          <button className="tk-btn tk-btn-primary">
            <Icon name="plus" size={14} strokeWidth={2.5} /> Nouveau service
          </button>
        </div>

        {/* Filters bar */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 20,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <ServiceTab label="Tous" count={8} active />
          <ServiceTab label="Publiés" count={6} />
          <ServiceTab label="Brouillons" count={1} />
          <ServiceTab label="Archivés" count={1} />
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <Icon
              name="search"
              size={14}
              color="var(--charcoal-500)"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              placeholder="Rechercher…"
              style={{
                width: 260,
                padding: '8px 12px 8px 34px',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                border: '1px solid var(--cream-300)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--cream-50)',
                color: 'var(--charcoal-800)',
              }}
            />
          </div>
        </div>

        {/* Services grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <SellerServiceCard
            status="published"
            title="Chapiteau bambou 8 × 12 m"
            sub="Toile crème · LED en option"
            price="dès 1 200 € / 3 jours"
            stock="2 disponibles"
            views={234}
            requests={8}
            bookings={5}
            rating="4,9"
            ratingCount={24}
            featured
            gradient="linear-gradient(135deg, #d4a574, #8a6a4a)"
            icon="tent"
          />
          <SellerServiceCard
            status="published"
            title="Chaises Tiffany dorées"
            sub="Lot de 10 — empilables"
            price="12 € / unité / jour"
            stock="120 disponibles"
            views={412}
            requests={14}
            bookings={11}
            rating="4,8"
            ratingCount={47}
            gradient="linear-gradient(135deg, #c89a8a, #6a4a3a)"
            icon="chair"
          />
          <SellerServiceCard
            status="published"
            title="Pack lounge — 30 personnes"
            sub="Canapés + tables basses + tapis"
            price="650 € / week-end"
            stock="3 disponibles"
            views={156}
            requests={5}
            bookings={3}
            rating="5,0"
            ratingCount={9}
            gradient="linear-gradient(135deg, #b89a7a, #7a5a4a)"
            icon="package"
          />
          <SellerServiceCard
            status="published"
            title="Tables rondes 180 cm"
            sub="Pour 8-10 personnes"
            price="35 € / unité / jour"
            stock="20 disponibles"
            views={189}
            requests={6}
            bookings={4}
            rating="4,7"
            ratingCount={18}
            gradient="linear-gradient(135deg, #d8b89a, #8a6a4a)"
            icon="package"
          />
          <SellerServiceCard
            status="draft"
            title="Vaisselle vintage — service complet"
            sub="Brouillon · 4 photos manquantes"
            price="—"
            stock="Stock non défini"
            views={0}
            requests={0}
            bookings={0}
            gradient="linear-gradient(135deg, #cccccc, #999999)"
            icon="package"
          />
          <SellerServiceCard
            status="archived"
            title="Plancher modulaire 60 m²"
            sub="Archivé en mars 2026"
            price="dès 800 €"
            stock="Plus disponible"
            views={67}
            requests={2}
            bookings={1}
            rating="4,5"
            ratingCount={2}
            gradient="linear-gradient(135deg, #b0a59a, #6a5a4a)"
            icon="package"
            muted
          />
        </div>

        {/* CTA new service */}
        <div
          style={{
            marginTop: 16,
            padding: '32px 24px',
            border: '1.5px dashed var(--cream-300)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--cream-50)',
            textAlign: 'center',
          }}
        >
          <div
            style={{ fontSize: 14, color: 'var(--charcoal-700)', fontWeight: 600, marginBottom: 4 }}
          >
            Une nouvelle prestation à proposer&nbsp;?
          </div>
          <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginBottom: 14 }}>
            Le wizard prend 8 min en moyenne, avec sauvegarde auto à chaque étape.
          </div>
          <button className="tk-btn tk-btn-primary tk-btn-sm">
            <Icon name="plus" size={14} strokeWidth={2.5} /> Créer un nouveau service
          </button>
        </div>
      </div>
    </div>
  );
}

function ServiceTab({ label, count, active }) {
  return (
    <button
      style={{
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
        background: active ? 'var(--cream-200)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 11,
          color: active ? 'var(--charcoal-600)' : 'var(--charcoal-400)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function SellerServiceCard({
  status,
  title,
  sub,
  price,
  stock,
  views,
  requests,
  bookings,
  rating,
  ratingCount,
  featured,
  gradient,
  icon,
  muted,
}) {
  const statusBadge = {
    published: {
      label: 'Publié',
      color: 'var(--success-700)',
      bg: 'var(--success-50)',
      border: 'var(--success-200)',
    },
    draft: {
      label: 'Brouillon',
      color: 'var(--warning-700)',
      bg: 'var(--warning-50)',
      border: 'var(--warning-200)',
    },
    archived: {
      label: 'Archivé',
      color: 'var(--charcoal-600)',
      bg: 'var(--cream-100)',
      border: 'var(--cream-300)',
    },
  }[status];

  return (
    <div
      className="tk-card"
      style={{ padding: 0, overflow: 'hidden', display: 'flex', opacity: muted ? 0.65 : 1 }}
    >
      <div
        style={{
          width: 180,
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <Icon name={icon} size={48} color="rgba(255,255,255,0.85)" />
        {featured && (
          <span
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              fontSize: 10,
              padding: '3px 8px',
              background: 'rgba(0,0,0,0.55)',
              color: 'var(--cream-50)',
              borderRadius: 999,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              backdropFilter: 'blur(4px)',
            }}
          >
            <Icon name="sparkle" size={10} color="var(--cream-50)" /> Mis en avant
          </span>
        )}
      </div>
      <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <span
            className="tk-badge"
            style={{
              fontSize: 10,
              background: statusBadge.bg,
              color: statusBadge.color,
              border: `1px solid ${statusBadge.border}`,
            }}
          >
            {statusBadge.label}
          </span>
          <button
            className="tk-btn tk-btn-ghost tk-btn-sm"
            style={{ width: 28, height: 28, padding: 0 }}
          >
            <span style={{ fontSize: 18, color: 'var(--charcoal-500)', lineHeight: 1 }}>···</span>
          </button>
        </div>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--charcoal-800)',
            marginBottom: 3,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h3>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginBottom: 12 }}>{sub}</div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px 16px',
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          <span style={{ color: 'var(--charcoal-500)' }}>Prix</span>
          <span
            style={{
              color: 'var(--charcoal-800)',
              fontWeight: 600,
              textAlign: 'right',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {price}
          </span>
          <span style={{ color: 'var(--charcoal-500)' }}>Stock</span>
          <span style={{ color: 'var(--charcoal-800)', fontWeight: 500, textAlign: 'right' }}>
            {stock}
          </span>
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 12,
            borderTop: '1px solid var(--cream-200)',
          }}
        >
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--charcoal-500)' }}>
            <SellerStatPill icon="user" v={views} label="vues" />
            <SellerStatPill icon="message" v={requests} label="demandes" />
            <SellerStatPill icon="check" v={bookings} label="résa" />
          </div>
          {rating ? (
            <span
              style={{
                fontSize: 12,
                color: 'var(--charcoal-700)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon name="star" size={12} color="var(--brand-500)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{rating}</span>
              <span style={{ color: 'var(--charcoal-500)' }}>({ratingCount})</span>
            </span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--charcoal-400)' }}>Pas encore d'avis</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SellerStatPill({ icon, v, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={11} color="var(--charcoal-400)" />
      <span
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--charcoal-700)', fontWeight: 600 }}
      >
        {v}
      </span>
      <span>{label}</span>
    </span>
  );
}

window.SellerCalendarScreen = SellerCalendarScreen;
window.SellerServicesScreen = SellerServicesScreen;
