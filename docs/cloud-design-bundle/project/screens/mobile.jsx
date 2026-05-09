/* Mobile screens — iOS frame: home + service detail */

function MobileHomeScreen() {
  return (
    <div
      className="tk-root"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--cream-50)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Logo size={18} showDomain={true} />
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--cream-100)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="user" size={16} />
        </span>
      </div>

      {/* Hero */}
      <div style={{ padding: '8px 20px 16px' }}>
        <h1
          style={{
            fontSize: 28,
            lineHeight: 1.1,
            color: 'var(--charcoal-800)',
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
          }}
        >
          Vos événements,{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--brand-600)', fontWeight: 400 }}>
            réservés
          </em>
          .
        </h1>
        <p style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 8, lineHeight: 1.5 }}>
          Pros locaux vérifiés · paiement sécurisé · sans appel.
        </p>
      </div>

      {/* Search button */}
      <div style={{ padding: '0 20px 16px' }}>
        <button
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            background: 'var(--cream-50)',
            border: '1px solid var(--cream-300)',
            borderRadius: 999,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Icon name="search" size={16} color="var(--brand-500)" />
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-700)' }}>
              Cherchez un service
            </div>
            <div style={{ fontSize: 11, color: 'var(--charcoal-400)' }}>Quoi · Où · Quand</div>
          </div>
        </button>
      </div>

      {/* Categories scroll */}
      <div style={{ padding: '0 0 16px' }}>
        <div style={{ display: 'flex', gap: 10, padding: '0 20px', overflowX: 'auto' }}>
          {[
            { i: 'tent', l: 'Tentes', a: true },
            { i: 'chair', l: 'Mobilier' },
            { i: 'flame', l: 'Traiteur' },
            { i: 'sparkle', l: 'Décoration' },
          ].map((c) => (
            <button
              key={c.l}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                background: c.a ? 'var(--charcoal-700)' : 'var(--cream-50)',
                color: c.a ? 'var(--cream-50)' : 'var(--charcoal-600)',
                border: `1px solid ${c.a ? 'var(--charcoal-700)' : 'var(--cream-300)'}`,
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon name={c.i} size={14} /> {c.l}
            </button>
          ))}
        </div>
      </div>

      {/* Section header */}
      <div
        style={{
          padding: '8px 20px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <div>
          <Kicker>Près de Nantes</Kicker>
          <h2 style={{ fontSize: 20, marginTop: 4 }}>À partir de 890 €</h2>
        </div>
        <span style={{ fontSize: 12, color: 'var(--brand-700)', fontWeight: 500 }}>Voir tout</span>
      </div>

      {/* Service cards scroll */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 90px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <MCard
          title="Chapiteau bambou 8×12 m"
          pro="Atelier Tente Loire · 8 km"
          rating={4.9}
          price="890 €"
          badge="Top pro"
          plabel="chapiteau bambou"
        />
        <MCard
          title="Pack 60 chaises Tiffany"
          pro="Mobilier des Mariées · 12 km"
          rating={4.8}
          price="3 € / unité"
          plabel="chaises alignées"
        />
        <MCard
          title="Tente stretch 100p"
          pro="Évèn'Loire · 92 km"
          rating={4.7}
          price="1 450 €"
          badge="Réponse rapide"
          plabel="tente stretch nuit"
        />
      </div>

      {/* Bottom nav */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--cream-50)',
          borderTop: '1px solid var(--cream-200)',
          padding: '10px 20px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 4,
        }}
      >
        <Tab icon="home" label="Accueil" active />
        <Tab icon="search" label="Recherche" />
        <Tab icon="bookmark" label="Favoris" />
        <Tab icon="user" label="Compte" />
      </div>
    </div>
  );
}

function MCard({ title, pro, rating, price, badge, plabel }) {
  return (
    <div
      className="tk-card"
      style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-md)' }}
    >
      <div style={{ position: 'relative' }}>
        <Placeholder label={plabel} style={{ height: 160, borderRadius: 0, border: 'none' }} />
        {badge && (
          <span
            className="tk-badge tk-badge-brand"
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              background: 'var(--cream-50)',
              border: '1px solid var(--cream-200)',
            }}
          >
            {badge}
          </span>
        )}
        <button
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'var(--cream-50)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="heart" size={14} />
        </button>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>{title}</div>
          <Stars value={rating} size={11} showCount={false} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>{pro}</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--charcoal-700)', marginTop: 6 }}>
          {price}
        </div>
      </div>
    </div>
  );
}

function Tab({ icon, label, active }) {
  const c = active ? 'var(--brand-600)' : 'var(--charcoal-400)';
  return (
    <button
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: c }}
    >
      <Icon name={icon} size={20} color="currentColor" strokeWidth={active ? 2 : 1.5} />
      <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
    </button>
  );
}

window.MobileHomeScreen = MobileHomeScreen;
