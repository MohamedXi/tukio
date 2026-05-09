/* Checkout — récap + adresse + paiement Stripe */

function CheckoutScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
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
        <Logo size={22} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            fontSize: 13,
            color: 'var(--charcoal-500)',
          }}
        >
          <Step n="1" label="Détails" done />
          <span style={{ width: 32, height: 1, background: 'var(--cream-300)' }} />
          <Step n="2" label="Paiement" active />
          <span style={{ width: 32, height: 1, background: 'var(--cream-300)' }} />
          <Step n="3" label="Confirmation" />
        </div>
        <span
          style={{
            fontSize: 13,
            color: 'var(--charcoal-500)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="shield" size={14} color="var(--success-500)" /> Paiement sécurisé Stripe
        </span>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: 56,
          padding: '40px 80px 64px',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>Finalisez votre réservation</h1>
          <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 6 }}>
            Vous ne serez débité qu'à l'acceptation par le pro, sous 48 h.
          </p>

          <Block title="1. Coordonnées" badge="Vérifié">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Inp label="Prénom" value="Camille" />
              <Inp label="Nom" value="Renaud" />
              <Inp label="Email" value="camille.renaud@example.fr" full />
              <Inp label="Téléphone" value="+33 6 12 34 56 78" full />
            </div>
          </Block>

          <Block title="2. Adresse de livraison">
            <Inp label="Adresse" value="14 rue des Vignes" full />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 1fr',
                gap: 16,
                marginTop: 12,
              }}
            >
              <Inp label="Code postal" value="44120" />
              <Inp label="Ville" value="Vertou" />
              <Inp label="Pays" value="France" />
            </div>
            <textarea
              className="tk-input"
              placeholder="Indications (parking, accès, contact sur place…)"
              style={{ height: 80, padding: 12, marginTop: 16, resize: 'none' }}
              defaultValue="Accès par le portail de droite. Vincent (+33 6 99 88 77 66) sera sur place dès 8 h."
            />
          </Block>

          <Block title="3. Paiement">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <PayMethod
                selected
                name="Carte bancaire"
                detail="Visa, Mastercard, Amex"
                icons={['VISA', 'MC', 'AMEX']}
              />
              <PayMethod name="Virement SEPA" detail="Délai 1-2 jours ouvrés" />
              <PayMethod name="Apple Pay" detail="Sur Safari uniquement" disabled />
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 20,
                background: 'var(--cream-50)',
                border: '1px solid var(--cream-300)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <Inp label="Numéro de carte" value="4242 4242 4242 4242" full />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 16,
                  marginTop: 12,
                }}
              >
                <Inp label="Expiration" value="06 / 28" />
                <Inp label="CVC" value="•••" />
                <Inp label="Code postal" value="44120" />
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginTop: 16,
                fontSize: 13,
                color: 'var(--charcoal-600)',
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: 'var(--brand-500)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                <Icon name="check" size={12} color="var(--cream-50)" strokeWidth={2.5} />
              </span>
              J'accepte les{' '}
              <a style={{ color: 'var(--brand-700)', textDecoration: 'underline' }}>
                conditions de réservation
              </a>{' '}
              et la{' '}
              <a style={{ color: 'var(--brand-700)', textDecoration: 'underline' }}>
                politique d'annulation
              </a>{' '}
              du pro.
            </label>
          </Block>

          <button
            className="tk-btn tk-btn-primary tk-btn-lg"
            style={{ width: '100%', marginTop: 8 }}
          >
            Confirmer la réservation · 1 205 €
          </button>
          <p
            style={{
              fontSize: 12,
              color: 'var(--charcoal-400)',
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            Aucune somme ne sera débitée tant que le pro n'a pas accepté votre demande.
          </p>
        </div>

        {/* Right: order summary */}
        <aside>
          <div className="tk-card" style={{ padding: 20, position: 'sticky', top: 24 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 16,
              }}
            >
              Votre réservation
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <Placeholder
                label=""
                style={{ width: 80, height: 80, flexShrink: 0, borderRadius: 'var(--radius)' }}
              />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Chapiteau bambou 8×12 m</div>
                <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
                  Atelier Tente Loire
                </div>
                <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 4 }}>
                  13 → 15 juin 2026
                </div>
              </div>
            </div>

            <hr className="tk-hr" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0' }}>
              <Sline label="Forfait week-end" value="890 €" />
              <Sline label="Plancher bois clair" value="280 €" />
              <Sline label="Livraison (8 km)" value="incluse" muted />
            </div>
            <hr className="tk-hr" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0' }}>
              <Sline label="Sous-total" value="1 170 €" />
              <Sline label="Frais de service tukio (3 %)" value="35 €" muted />
            </div>
            <hr className="tk-hr" />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '16px 0 0',
                alignItems: 'baseline',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  fontWeight: 500,
                  color: 'var(--charcoal-800)',
                }}
              >
                1 205 €
              </span>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: 'var(--info-50)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                gap: 10,
              }}
            >
              <Icon name="shield" size={18} color="var(--info-500)" />
              <div style={{ fontSize: 12, color: 'var(--info-700)', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: 2 }}>Paiement protégé</strong>
                Tukio.one conserve votre paiement et ne le reverse au pro qu'après l'événement.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Step({ n, label, active, done }) {
  const color = active ? 'var(--brand-500)' : done ? 'var(--success-500)' : 'var(--charcoal-400)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        color,
        fontWeight: active ? 600 : 500,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: active
            ? 'var(--brand-500)'
            : done
              ? 'var(--success-500)'
              : 'var(--cream-200)',
          color: active || done ? 'var(--cream-50)' : 'var(--charcoal-500)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {done ? <Icon name="check" size={12} color="currentColor" strokeWidth={2.5} /> : n}
      </span>
      {label}
    </span>
  );
}

function Block({ title, children, badge }) {
  return (
    <section className="tk-card" style={{ padding: 24, marginTop: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 500 }}>{title}</h2>
        {badge && (
          <span className="tk-badge tk-badge-success">
            <Icon name="check" size={12} /> {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Inp({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? 'span 2' : undefined }}>
      <label className="tk-label">{label}</label>
      <input className="tk-input" defaultValue={value} />
    </div>
  );
}

function PayMethod({ name, detail, selected, disabled, icons }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        background: selected ? 'var(--brand-50)' : 'var(--cream-50)',
        border: `1px solid ${selected ? 'var(--brand-500)' : 'var(--cream-300)'}`,
        borderRadius: 'var(--radius)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `1.5px solid ${selected ? 'var(--brand-500)' : 'var(--cream-300)'}`,
          background: 'var(--cream-50)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && (
          <span
            style={{ width: 8, height: 8, background: 'var(--brand-500)', borderRadius: '50%' }}
          />
        )}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-700)' }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)' }}>{detail}</div>
      </div>
      {icons && (
        <div style={{ display: 'flex', gap: 4 }}>
          {icons.map((i) => (
            <span
              key={i}
              style={{
                padding: '3px 6px',
                border: '1px solid var(--cream-300)',
                borderRadius: 3,
                fontSize: 9,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--charcoal-500)',
                letterSpacing: '0.04em',
              }}
            >
              {i}
            </span>
          ))}
        </div>
      )}
    </label>
  );
}

function Sline({ label, value, muted }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 14,
        color: muted ? 'var(--charcoal-500)' : 'var(--charcoal-700)',
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

window.CheckoutScreen = CheckoutScreen;
