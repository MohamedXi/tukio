/* Booking confirmation — /cart/confirmation/{order_id}
   "Votre demande a bien été envoyée" — pending_pro_acceptance state.
   Sober : check sobre, no confetti. */

function ConfirmationScreen() {
  return (
    <div className="tk-root" style={{ width: '100%', minHeight: '100%' }}>
      <TopNav variant="public" compactSearch={true} />

      {/* ── Hero confirm ─────────────────────────────────────── */}
      <section style={{ padding: '64px 40px 48px', textAlign: 'center' }}>
        {/* Sober check */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--success-50)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 28,
            border: '1px solid rgba(77, 124, 94, 0.2)',
          }}
        >
          <Icon name="check" size={28} color="var(--success-700)" strokeWidth={2.5} />
        </div>

        <Kicker color="var(--success-700)">Demande envoyée · Réservation #TUK-2026-00042</Kicker>
        <h1
          style={{
            fontSize: 'var(--text-5xl)',
            lineHeight: 1.05,
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            marginTop: 16,
            marginBottom: 16,
            color: 'var(--charcoal-800)',
            maxWidth: 720,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Votre demande est{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--brand-600)', fontWeight: 400 }}>
            en route.
          </em>
        </h1>
        <p
          style={{
            fontSize: 17,
            color: 'var(--charcoal-500)',
            lineHeight: 1.55,
            maxWidth: 580,
            margin: '0 auto',
          }}
        >
          <strong style={{ color: 'var(--charcoal-700)', fontWeight: 600 }}>
            Camille, d'Atelier Tente Loire
          </strong>
          , vient de recevoir votre demande. Elle a 36 h pour confirmer.
        </p>

        {/* Email + countdown row */}
        <div
          style={{
            display: 'inline-flex',
            gap: 24,
            marginTop: 28,
            padding: '12px 20px',
            background: 'var(--cream-100)',
            borderRadius: 999,
            alignItems: 'center',
            fontSize: 13,
            color: 'var(--charcoal-600)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="message" size={14} color="var(--charcoal-500)" />
            Confirmation envoyée à{' '}
            <strong style={{ color: 'var(--charcoal-800)' }}>marion.d@example.fr</strong>
          </span>
          <span style={{ width: 1, height: 16, background: 'var(--cream-300)' }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="clock" size={14} color="var(--brand-500)" />
            Réponse pro sous{' '}
            <strong style={{ color: 'var(--charcoal-800)', fontFamily: 'var(--font-mono)' }}>
              35 h 47 min
            </strong>
          </span>
        </div>
      </section>

      {/* ── Steps timeline ─────────────────────────────────── */}
      <section style={{ padding: '32px 40px 56px' }}>
        <h2
          style={{
            fontSize: 'var(--text-xl)',
            textAlign: 'center',
            marginBottom: 32,
            color: 'var(--charcoal-700)',
            fontWeight: 500,
          }}
        >
          La suite — étape par étape
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 0,
            position: 'relative',
            maxWidth: 960,
            margin: '0 auto',
          }}
        >
          {/* connecting line */}
          <div
            style={{
              position: 'absolute',
              top: 24,
              left: '16.66%',
              right: '16.66%',
              height: 1,
              background: 'var(--cream-300)',
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 24,
              left: '16.66%',
              width: '16.66%',
              height: 1,
              background: 'var(--success-500)',
              zIndex: 1,
            }}
          />

          <Step
            n="1"
            state="active"
            title="Le pro reçoit votre demande"
            desc="Camille a été notifiée. Elle a 36 h pour confirmer ou refuser."
          />
          <Step
            n="2"
            state="pending"
            title="Confirmation sous 36 h"
            desc="Vous recevrez un email dès que Camille accepte. Le pré-débit n'est pas encaissé tant qu'elle n'a pas répondu."
          />
          <Step
            n="3"
            state="pending"
            title="Préparation de l'événement"
            desc="Camille reprend contact 7 jours avant pour le détail logistique. Solde débité 7 j avant."
          />
        </div>
      </section>

      {/* ── Recap card ─────────────────────────────────────── */}
      <section style={{ padding: '0 40px 64px' }}>
        <div
          className="tk-card"
          style={{ padding: 0, overflow: 'hidden', maxWidth: 880, margin: '0 auto' }}
        >
          {/* Header strip */}
          <div
            style={{
              padding: '20px 28px',
              background: 'var(--cream-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--cream-200)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Récapitulatif
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--charcoal-800)',
                  marginTop: 2,
                }}
              >
                Réservation #TUK-2026-00042
              </div>
            </div>
            <span className="tk-badge tk-badge-warning">
              <Icon name="clock" size={11} /> En attente de confirmation
            </span>
          </div>

          {/* Service block */}
          <div
            style={{
              padding: 24,
              display: 'flex',
              gap: 20,
              borderBottom: '1px solid var(--cream-200)',
            }}
          >
            <Placeholder
              label=""
              style={{ width: 120, height: 120, flexShrink: 0, borderRadius: 'var(--radius-md)' }}
            />
            <div style={{ flex: 1 }}>
              <Kicker>Atelier Tente Loire · Saint-Herblain</Kicker>
              <h3 style={{ fontSize: 20, marginTop: 6, marginBottom: 10 }}>
                Chapiteau bambou 8×12 m
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <KV label="Date" value="Sam. 14 sept. 2026" />
                <KV label="Adresse" value="14 rue des Pommiers, Vertou" />
                <KV label="Livraison" value="9 h 00 · démontage J+1" />
              </div>
            </div>
          </div>

          {/* Money block */}
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 12,
                }}
              >
                Détail
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <Row label="Chapiteau · 1 journée" value="890 €" />
                <Row label="Livraison & montage" value="incluse" sub />
                <Row label="Frais de service" value="36 €" sub />
                <div style={{ height: 1, background: 'var(--cream-200)', margin: '6px 0' }} />
                <Row label="Total réservation" value="926 €" bold />
              </div>
            </div>
            <div style={{ borderLeft: '1px solid var(--cream-200)', paddingLeft: 32 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 12,
                }}
              >
                Paiement
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                  fontSize: 14,
                }}
              >
                <span style={{ color: 'var(--charcoal-600)' }}>Acompte autorisé aujourd'hui</span>
                <span
                  style={{
                    fontWeight: 600,
                    color: 'var(--charcoal-800)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  278 €
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                  fontSize: 14,
                }}
              >
                <span style={{ color: 'var(--charcoal-600)' }}>Solde débité 7 j avant</span>
                <span
                  style={{
                    fontWeight: 500,
                    color: 'var(--charcoal-500)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  648 €
                </span>
              </div>
              <div
                style={{
                  padding: 12,
                  background: 'var(--info-50)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  color: 'var(--info-700)',
                  lineHeight: 1.55,
                  display: 'flex',
                  gap: 8,
                }}
              >
                <Icon
                  name="shield"
                  size={14}
                  color="var(--info-700)"
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <span>
                  Pas de débit immédiat. Le pré-débit n'est encaissé qu'à la confirmation de
                  Camille.
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              padding: '20px 24px',
              background: 'var(--cream-50)',
              borderTop: '1px solid var(--cream-200)',
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
            }}
          >
            <button className="tk-btn tk-btn-tertiary tk-btn-sm">
              <Icon name="doc" size={14} /> Télécharger le récapitulatif
            </button>
            <button className="tk-btn tk-btn-secondary">
              <Icon name="message" size={14} /> Écrire à Camille
            </button>
            <button className="tk-btn tk-btn-primary">
              Voir ma réservation <Icon name="arrow" size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ── FAQ + suggestions ───────────────────────────────── */}
      <section style={{ padding: '64px 40px', background: 'var(--cream-100)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          {/* FAQ */}
          <div>
            <Kicker>Questions fréquentes</Kicker>
            <h2 style={{ fontSize: 'var(--text-2xl)', marginTop: 6, marginBottom: 24 }}>
              Pendant l'attente
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <FaqRow q="Que se passe-t-il si Camille ne répond pas en 36 h ?" />
              <FaqRow q="Puis-je modifier l'adresse ou la date ?" />
              <FaqRow q="Quand suis-je débité·e exactement ?" />
              <FaqRow q="Comment annuler ma demande ?" />
              <FaqRow q="Y a-t-il un dépôt de garantie ?" />
            </div>
          </div>

          {/* Suggestions */}
          <div>
            <Kicker>Pour aller plus loin</Kicker>
            <h2 style={{ fontSize: 'var(--text-2xl)', marginTop: 6, marginBottom: 24 }}>
              Vous aurez peut-être aussi besoin
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Sugg
                title="Pack 60 chaises Tiffany"
                sub="Mobilier des Mariées · 12 km"
                price="3 €/u"
                plabel="chaises tiffany"
              />
              <Sugg
                title="Plancher bois 80 m²"
                sub="Atelier Tente Loire · même pro"
                price="14 €/m²"
                plabel="plancher bois"
              />
              <Sugg
                title="Traiteur · cocktail 80p"
                sub="Les Tablées de Vertou · 4 km"
                price="dès 28 €/p"
                plabel="traiteur cocktail"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────
function Step({ n, state, title, desc }) {
  const isActive = state === 'active';
  const isDone = state === 'done';
  const dotBg = isDone ? 'var(--success-500)' : isActive ? 'var(--cream-50)' : 'var(--cream-50)';
  const dotBorder = isDone
    ? 'var(--success-500)'
    : isActive
      ? 'var(--brand-500)'
      : 'var(--cream-300)';
  const dotShadow = isActive ? '0 0 0 6px rgba(194, 65, 12, 0.12)' : 'none';
  const numColor = isDone
    ? 'var(--cream-50)'
    : isActive
      ? 'var(--brand-600)'
      : 'var(--charcoal-400)';

  return (
    <div style={{ position: 'relative', zIndex: 2, padding: '0 16px', textAlign: 'center' }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: dotBg,
          border: `2px solid ${dotBorder}`,
          boxShadow: dotShadow,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          fontSize: 14,
          color: numColor,
          marginBottom: 16,
        }}
      >
        {isDone ? <Icon name="check" size={18} color="var(--cream-50)" strokeWidth={2.5} /> : n}
      </div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: isActive ? 'var(--charcoal-800)' : 'var(--charcoal-600)',
          marginBottom: 8,
          fontFamily: 'var(--font-body)',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 13,
          color: 'var(--charcoal-500)',
          lineHeight: 1.55,
          margin: 0,
          maxWidth: 240,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {desc}
      </p>
    </div>
  );
}

function Row({ label, value, bold, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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
          color: sub ? 'var(--charcoal-500)' : 'var(--charcoal-800)',
          fontWeight: bold ? 600 : 500,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--charcoal-400)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-mono)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal-700)', lineHeight: 1.4 }}>
        {value}
      </div>
    </div>
  );
}

function FaqRow({ q }) {
  return (
    <div
      style={{
        padding: '16px 0',
        borderBottom: '1px solid var(--cream-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--charcoal-700)' }}>{q}</span>
      <Icon name="plus" size={16} color="var(--charcoal-400)" />
    </div>
  );
}

function Sugg({ title, sub, price, plabel }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: 12,
        background: 'var(--cream-50)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--cream-200)',
        alignItems: 'center',
      }}
    >
      <Placeholder
        label={plabel}
        style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 'var(--radius-sm)' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>{sub}</div>
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--charcoal-800)',
          fontFamily: 'var(--font-display)',
          letterSpacing: '-0.01em',
        }}
      >
        {price}
      </div>
    </div>
  );
}

window.ConfirmationScreen = ConfirmationScreen;
