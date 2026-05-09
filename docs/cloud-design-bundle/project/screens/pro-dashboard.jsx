/* Pro dashboard — sidebar nav + KPIs + bookings to handle + agenda */

function ProDashboardScreen() {
  return (
    <div
      className="tk-root"
      style={{
        width: '100%',
        minHeight: '100%',
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
        background: 'var(--cream-100)',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          background: 'var(--charcoal-700)',
          color: 'var(--cream-200)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ padding: '8px 12px 24px' }}>
          <Logo size={20} color="var(--cream-50)" mono />
        </div>
        <NavItem icon="grid" label="Tableau de bord" active />
        <NavItem icon="package" label="Mes services" badge="6" />
        <NavItem icon="calendar" label="Réservations" badge="3" hot />
        <NavItem icon="message" label="Messages" badge="2" />
        <NavItem icon="star" label="Avis" />
        <NavItem icon="euro" label="Revenus" />
        <NavItem icon="building" label="Profil pro" />
        <div style={{ flex: 1 }} />
        <NavItem icon="settings" label="Paramètres" />
        <div
          style={{
            padding: 12,
            marginTop: 16,
            background: 'rgba(245, 241, 234, 0.06)',
            borderRadius: 'var(--radius)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name="Antoine M" size={32} tone="brand" />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--cream-50)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Atelier Tente Loire
              </div>
              <div style={{ fontSize: 11, color: 'var(--brand-300)' }}>Plan Business</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ padding: '32px 40px 64px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 32,
          }}
        >
          <div>
            <span className="tk-mono" style={{ color: 'var(--charcoal-500)' }}>
              Vendredi 1 mai 2026
            </span>
            <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 6 }}>Bonjour, Antoine</h1>
            <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 4 }}>
              3 nouvelles demandes à traiter avant 18 h.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="tk-btn tk-btn-secondary">
              <Icon name="upload" size={16} /> Exporter
            </button>
            <button className="tk-btn tk-btn-primary">
              <Icon name="plus" size={16} strokeWidth={2} /> Nouveau service
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 32,
          }}
        >
          <Kpi
            label="Revenus du mois"
            value="4 280 €"
            delta="+18 %"
            trend="up"
            sub="vs avril 2025"
          />
          <Kpi label="Réservations" value="12" delta="+3" trend="up" sub="ce mois-ci" />
          <Kpi
            label="Taux d'acceptation"
            value="92 %"
            delta="−2 pts"
            trend="down"
            sub="objectif 95 %"
          />
          <Kpi
            label="Note moyenne"
            value="4,9 / 5"
            delta="47 avis"
            trend="flat"
            sub="dont 3 cette semaine"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
          {/* Pending bookings */}
          <section className="tk-card" style={{ padding: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 'var(--text-xl)' }}>Demandes à traiter</h2>
              <span className="tk-badge tk-badge-warning">
                <Icon name="clock" size={12} /> 3 en attente
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <BookingRow
                client="Camille Renaud"
                service="Chapiteau bambou 8×12 m"
                date="13 → 15 juin"
                amount="1 205 €"
                expires="dans 14 h"
                hot
              />
              <BookingRow
                client="Léa & Romain Dubreuil"
                service="Tente stretch 100p"
                date="22 → 24 août"
                amount="1 720 €"
                expires="dans 1 j 6 h"
              />
              <BookingRow
                client="Mairie de Vertou"
                service="Pack pagodes 5×5 m"
                tag="B2B"
                date="3 sept."
                amount="690 €"
                expires="dans 1 j 22 h"
              />
            </div>
            <button className="tk-btn tk-btn-tertiary tk-btn-sm" style={{ marginTop: 16 }}>
              Voir toutes les réservations <Icon name="arrow" size={14} />
            </button>
          </section>

          {/* Agenda */}
          <section className="tk-card" style={{ padding: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 'var(--text-xl)' }}>Mai</h2>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="tk-btn tk-btn-ghost tk-btn-sm" style={{ width: 28, padding: 0 }}>
                  <Icon name="arrowL" size={14} />
                </button>
                <button className="tk-btn tk-btn-ghost tk-btn-sm" style={{ width: 28, padding: 0 }}>
                  <Icon name="arrow" size={14} />
                </button>
              </div>
            </div>
            <MiniCalendar />
            <div
              style={{
                display: 'flex',
                gap: 16,
                marginTop: 16,
                fontSize: 12,
                color: 'var(--charcoal-500)',
              }}
            >
              <Legend dot="var(--brand-500)" label="Confirmé" />
              <Legend dot="var(--warning-500)" label="En attente" />
              <Legend dot="var(--cream-300)" label="Bloqué" />
            </div>
          </section>
        </div>

        {/* Activity */}
        <section className="tk-card" style={{ padding: 24, marginTop: 24 }}>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 16 }}>Activité récente</h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Activity
              icon="euro"
              tone="success"
              title="Reversement reçu : 1 462 €"
              detail="Mariage S. Dupuis · Vannes · J+1"
              time="il y a 2 h"
            />
            <Activity
              icon="star"
              tone="brand"
              title="Nouvel avis 5★ de Mathieu P."
              detail="« Parfait pour notre mariage à Vertou. »"
              time="il y a 6 h"
            />
            <Activity
              icon="message"
              tone="info"
              title="Camille Renaud a envoyé un message"
              detail="« Bonjour, le terrain est en pente légère, est-ce que… »"
              time="il y a 14 h"
            />
            <Activity
              icon="check"
              tone="success"
              title="Réservation confirmée"
              detail="Tente garden 6×9 m · L. Bonneau · 22 mai"
              time="hier"
              last
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, badge, hot }) {
  return (
    <a
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 'var(--radius)',
        background: active ? 'rgba(245, 241, 234, 0.08)' : 'transparent',
        color: active ? 'var(--cream-50)' : 'var(--cream-200)',
        fontSize: 14,
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
      }}
    >
      <Icon name={icon} size={18} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span
          style={{
            padding: '1px 6px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            background: hot ? 'var(--brand-500)' : 'rgba(245, 241, 234, 0.12)',
            color: hot ? 'var(--cream-50)' : 'var(--cream-200)',
          }}
        >
          {badge}
        </span>
      )}
    </a>
  );
}

function Kpi({ label, value, delta, trend, sub }) {
  const c =
    trend === 'up'
      ? 'var(--success-500)'
      : trend === 'down'
        ? 'var(--error-500)'
        : 'var(--charcoal-400)';
  return (
    <div className="tk-card" style={{ padding: 20 }}>
      <div
        style={{
          fontSize: 12,
          color: 'var(--charcoal-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
        <span
          style={{
            fontSize: 28,
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            color: 'var(--charcoal-800)',
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 13, color: c, fontWeight: 500 }}>{delta}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--charcoal-400)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function BookingRow({ client, service, date, amount, expires, tag, hot }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 16,
        padding: 16,
        background: 'var(--cream-50)',
        border: `1px solid ${hot ? 'var(--brand-200)' : 'var(--cream-200)'}`,
        borderRadius: 'var(--radius)',
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{client}</span>
          {tag && <span className="tk-badge tk-badge-info">{tag}</span>}
        </div>
        <div style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
          {service} · {date}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
          {amount}
        </div>
        <div
          style={{
            fontSize: 12,
            color: hot ? 'var(--brand-700)' : 'var(--charcoal-400)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Icon name="clock" size={12} /> Expire {expires}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="tk-btn tk-btn-secondary tk-btn-sm">Refuser</button>
        <button className="tk-btn tk-btn-primary tk-btn-sm">Accepter</button>
      </div>
    </div>
  );
}

function MiniCalendar() {
  // statuses: c=confirmed, p=pending, b=blocked, n=normal, t=today
  const dows = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const days = [
    '',
    '',
    '',
    '',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13c',
    '14c',
    '15c',
    '16',
    '17',
    '18',
    '19',
    '20p',
    '21',
    '22',
    '23b',
    '24b',
    '25',
    '26',
    '27',
    '28',
    '29',
    '30c',
    '31c',
  ];
  return (
    <div>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}
      >
        {dows.map((d, i) => (
          <div
            key={i}
            style={{
              fontSize: 11,
              color: 'var(--charcoal-400)',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          const num = parseInt(d, 10);
          const status = d.replace(/\d/g, '');
          const bg =
            status === 'c'
              ? 'var(--brand-500)'
              : status === 'p'
                ? 'var(--warning-500)'
                : status === 'b'
                  ? 'var(--cream-200)'
                  : 'transparent';
          const color =
            status === 'c' || status === 'p' ? 'var(--cream-50)' : 'var(--charcoal-700)';
          return (
            <div
              key={i}
              style={{
                aspectRatio: '1',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 500,
                background: bg,
                color,
                borderRadius: 6,
              }}
            >
              {num}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ dot, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />
      {label}
    </span>
  );
}

function Activity({ icon, tone, title, detail, time, last }) {
  const colors = {
    success: ['var(--success-50)', 'var(--success-500)'],
    brand: ['var(--brand-50)', 'var(--brand-500)'],
    info: ['var(--info-50)', 'var(--info-500)'],
  }[tone];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 14,
        padding: '14px 0',
        alignItems: 'center',
        borderBottom: last ? 'none' : '1px solid var(--cream-200)',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: colors[0],
          color: colors[1],
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={16} color="currentColor" />
      </span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--charcoal-700)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>{detail}</div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--charcoal-400)', whiteSpace: 'nowrap' }}>
        {time}
      </span>
    </div>
  );
}

window.ProDashboardScreen = ProDashboardScreen;
