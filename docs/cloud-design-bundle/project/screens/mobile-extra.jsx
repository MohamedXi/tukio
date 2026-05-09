/* Mobile screens — service detail + checkout (iOS) */

function MobileServiceScreen() {
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
      {/* Hero image with back/heart */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Placeholder
          label="chapiteau bambou — soir"
          style={{ height: 280, borderRadius: 0, border: 'none' }}
        />
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 16,
            right: 16,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <button style={btnCircle()}>
            <Icon name="arrowL" size={16} />
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnCircle()}>
              <Icon name="upload" size={16} />
            </button>
            <button style={btnCircle()}>
              <Icon name="heart" size={16} />
            </button>
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 16,
            padding: '4px 10px',
            background: 'rgba(20,19,15,0.7)',
            color: 'var(--cream-50)',
            fontSize: 11,
            fontWeight: 500,
            borderRadius: 999,
            fontFamily: 'var(--font-mono)',
          }}
        >
          1 / 12
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 100px' }}>
        <Kicker>Atelier Tente Loire · Saint-Herblain</Kicker>
        <h1 style={{ fontSize: 24, marginTop: 6, lineHeight: 1.15, color: 'var(--charcoal-800)' }}>
          Chapiteau bambou 8×12 m
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <Stars value={4.9} count={47} size={12} />
          <span style={{ fontSize: 12, color: 'var(--charcoal-400)' }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--charcoal-500)' }}>Réponse en 2 h</span>
        </div>

        {/* Pro card */}
        <div
          style={{
            marginTop: 16,
            padding: 14,
            border: '1px solid var(--cream-200)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Avatar name="Atelier Tente Loire" size={40} tone="brand" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              Atelier Tente Loire
            </div>
            <div style={{ fontSize: 11, color: 'var(--charcoal-500)' }}>Pro vérifié · 6 ans</div>
          </div>
          <span className="tk-badge tk-badge-success" style={{ fontSize: 10 }}>
            <Icon name="shield" size={10} /> Vérifié
          </span>
        </div>

        {/* Specs */}
        <h3 style={{ fontSize: 16, marginTop: 24, marginBottom: 12 }}>Spécifications</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Spec icon="package" label="96 m²" sub="capacité 80p" />
          <Spec icon="truck" label="Inclus" sub="livraison 50 km" />
          <Spec icon="clock" label="Montage 4 h" sub="par notre équipe" />
          <Spec icon="bolt" label="Électricité" sub="32A 3-phasé" />
        </div>

        {/* Description */}
        <h3 style={{ fontSize: 16, marginTop: 24, marginBottom: 8 }}>Description</h3>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--charcoal-600)', margin: 0 }}>
          Chapiteau structure bambou (poutres traitées), toile écrue 540 g/m². Idéal pour mariages,
          repas d'entreprise et réceptions privées en extérieur. Montage et démontage par notre
          équipe inclus dans le tarif. Bâche latérale et plancher bois disponibles en option.
        </p>

        {/* Reviews preview */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: 'var(--cream-100)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 12,
            }}
          >
            <h3 style={{ fontSize: 16, margin: 0 }}>4,9 · 47 avis</h3>
            <span style={{ fontSize: 12, color: 'var(--brand-700)', fontWeight: 500 }}>
              Tout voir
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Avatar name="Marion D" size={32} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)' }}>
                Marion D.
              </div>
              <div style={{ fontSize: 11, color: 'var(--charcoal-400)', marginBottom: 6 }}>
                Mariage · juin 2024
              </div>
              <p
                style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--charcoal-600)', margin: 0 }}
              >
                Équipe ponctuelle, montage propre. Le chapiteau est magnifique au coucher du soleil.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky reserve bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 20px 28px',
          background: 'var(--cream-50)',
          borderTop: '1px solid var(--cream-200)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--charcoal-800)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.01em',
            }}
          >
            890{' '}
            <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--charcoal-500)' }}>
              € / journée
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--charcoal-400)' }}>livraison incluse 50 km</div>
        </div>
        <button className="tk-btn tk-btn-primary" style={{ flex: 1, marginLeft: 'auto' }}>
          Réserver
        </button>
      </div>
    </div>
  );
}

function MobileCheckoutScreen() {
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
          padding: '10px 20px 14px',
          borderBottom: '1px solid var(--cream-200)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button style={{ background: 'none', border: 'none', padding: 4 }}>
          <Icon name="arrowL" size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--charcoal-400)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Étape 2 / 3
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal-800)' }}>
            Paiement
          </div>
        </div>
        <Icon name="shield" size={18} color="var(--success-500)" />
      </div>

      {/* Scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 110px' }}>
        {/* Récap */}
        <div
          style={{
            padding: 14,
            background: 'var(--cream-100)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Placeholder
              label=""
              style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 8, border: 'none' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)' }}>
                Chapiteau bambou 8×12 m
              </div>
              <div style={{ fontSize: 11, color: 'var(--charcoal-500)' }}>Atelier Tente Loire</div>
              <div style={{ fontSize: 11, color: 'var(--charcoal-500)', marginTop: 2 }}>
                Sam. 14 sept. · livraison 9 h
              </div>
            </div>
          </div>
        </div>

        {/* Carte */}
        <h3
          style={{
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--charcoal-500)',
            marginBottom: 12,
          }}
        >
          Carte bancaire
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="tk-label">Numéro de carte</label>
            <div style={{ position: 'relative' }}>
              <input
                className="tk-input"
                defaultValue="4242 4242 4242 4242"
                style={{ paddingRight: 70 }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--info-700)',
                  padding: '3px 8px',
                  background: 'var(--info-50)',
                  borderRadius: 4,
                }}
              >
                VISA
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="tk-label">Expiration</label>
              <input className="tk-input" defaultValue="12/27" />
            </div>
            <div>
              <label className="tk-label">CVC</label>
              <input className="tk-input" defaultValue="•••" />
            </div>
          </div>
        </div>

        {/* Acompte info */}
        <div
          style={{
            marginTop: 24,
            padding: 14,
            background: 'var(--info-50)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            gap: 12,
          }}
        >
          <Icon
            name="shield"
            size={18}
            color="var(--info-700)"
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <div>
            <div
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--info-700)', marginBottom: 4 }}
            >
              Acompte 30 % aujourd'hui
            </div>
            <div style={{ fontSize: 12, color: 'var(--charcoal-600)', lineHeight: 1.5 }}>
              Le solde sera débité 7 jours avant l'événement. Annulation gratuite jusqu'à 14 jours
              avant.
            </div>
          </div>
        </div>

        {/* Détail */}
        <h3
          style={{
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--charcoal-500)',
            marginTop: 24,
            marginBottom: 12,
          }}
        >
          Détail
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row label="Chapiteau · 1 journée" value="890 €" />
          <Row label="Livraison & montage" value="incluse" sub />
          <Row label="Frais de service" value="36 €" sub />
          <div style={{ height: 1, background: 'var(--cream-200)', margin: '6px 0' }} />
          <Row label="Total" value="926 €" bold />
          <Row label="Acompte aujourd'hui" value="278 €" brand />
        </div>
      </div>

      {/* Sticky pay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 20px 28px',
          background: 'var(--cream-50)',
          borderTop: '1px solid var(--cream-200)',
        }}
      >
        <button className="tk-btn tk-btn-primary" style={{ width: '100%', padding: '14px' }}>
          Payer 278 € · acompte 30 %
        </button>
        <div
          style={{ fontSize: 10, color: 'var(--charcoal-400)', textAlign: 'center', marginTop: 8 }}
        >
          Paiement sécurisé · Stripe
        </div>
      </div>
    </div>
  );
}

function btnCircle() {
  return {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--cream-50)',
    border: '1px solid var(--cream-200)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(20, 19, 15, 0.08)',
  };
}

function Spec({ icon, label, sub }) {
  return (
    <div
      style={{
        padding: 12,
        border: '1px solid var(--cream-200)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <Icon name={icon} size={18} color="var(--brand-600)" />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)' }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--charcoal-400)' }}>{sub}</div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, brand, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 15 : 13 }}>
      <span
        style={{
          color: sub ? 'var(--charcoal-500)' : 'var(--charcoal-700)',
          fontWeight: bold ? 600 : 400,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: brand ? 'var(--brand-600)' : sub ? 'var(--charcoal-500)' : 'var(--charcoal-800)',
          fontWeight: bold || brand ? 600 : 500,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

Object.assign(window, { MobileServiceScreen, MobileCheckoutScreen });
