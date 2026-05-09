/* Mobile screens — confirmation + mes réservations (iOS) */

function MobileConfirmationScreen() {
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
      {/* Hero confirmation */}
      <div
        style={{
          background: 'linear-gradient(180deg, var(--brand-50), var(--cream-50))',
          padding: '32px 24px 28px',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <button
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            background: 'none',
            border: 'none',
            padding: 4,
          }}
        >
          <Icon name="x" size={20} color="var(--charcoal-500)" />
        </button>

        {/* Big check */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'var(--brand-600)',
            margin: '0 auto 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(217,119,87,0.3)',
          }}
        >
          <Icon name="check" size={36} color="var(--cream-50)" strokeWidth={2.5} />
        </div>

        <Kicker>Demande envoyée</Kicker>
        <h1
          style={{
            fontSize: 26,
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            color: 'var(--charcoal-800)',
            letterSpacing: '-0.02em',
            marginTop: 8,
            lineHeight: 1.15,
          }}
        >
          Atelier Tente Loire
          <br />
          <em style={{ fontStyle: 'italic', color: 'var(--brand-600)', fontWeight: 400 }}>
            vous répond sous 24 h
          </em>
        </h1>
        <div
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: 'var(--charcoal-500)',
            marginTop: 12,
          }}
        >
          #TUK-2026-00042
        </div>
      </div>

      {/* Scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 100px' }}>
        {/* Récap card */}
        <div
          className="tk-card"
          style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              background: 'linear-gradient(135deg, #C7B89A, #8C7A5C)',
              borderRadius: 8,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              Chapiteau bambou 8×12 m
            </div>
            <div style={{ fontSize: 11, color: 'var(--charcoal-500)', marginTop: 2 }}>
              Sam. 14 sept. 2026 · livraison 9 h
            </div>
            <div style={{ fontSize: 11, color: 'var(--charcoal-500)' }}>Vertou (44)</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--charcoal-800)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              926 €
            </div>
            <div style={{ fontSize: 10, color: 'var(--charcoal-500)' }}>autorisé</div>
          </div>
        </div>

        {/* Timeline */}
        <h3
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--charcoal-500)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 14,
          }}
        >
          Et maintenant ?
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <MobStep
            n={1}
            state="done"
            title="Demande envoyée"
            time="à l'instant"
            sub="Le pro a reçu votre demande par email + push."
          />
          <MobStep
            n={2}
            state="active"
            title="Le pro confirme"
            time="sous 24 h"
            sub="Si pas de réponse, votre carte est libérée et vous êtes prévenu·e."
            ping
          />
          <MobStep
            n={3}
            state="upcoming"
            title="Débit"
            time="à confirmation"
            sub="Une fois la prestation acceptée."
          />
          <MobStep
            n={4}
            state="upcoming"
            title="Rappel J-3"
            time="le 11 sept."
            sub="Coordonnées équipe + horaires précis."
            last
          />
        </div>

        {/* Carte autorisation */}
        <div
          style={{
            marginTop: 20,
            padding: 14,
            background: 'var(--cream-100)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <Icon
            name="shield"
            size={16}
            color="var(--brand-600)"
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              Carte autorisée — non débitée
            </div>
            <div
              style={{ fontSize: 11, color: 'var(--charcoal-600)', marginTop: 4, lineHeight: 1.5 }}
            >
              Visa ••4242 — autorisation de 926 € valide 7 j. Le débit n'a lieu qu'après
              acceptation.
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <QuickAction
            icon="message"
            label="Envoyer un message au pro"
            sub="L'équipe répond en 2 h en moyenne"
          />
          <QuickAction
            icon="calendar"
            label="Ajouter à mon calendrier"
            sub="Apple · Google · Outlook"
          />
          <QuickAction icon="doc" label="Télécharger le récapitulatif" sub="PDF — 1 page" />
        </div>
      </div>

      {/* Sticky CTA */}
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
          gap: 8,
        }}
      >
        <button className="tk-btn tk-btn-tertiary" style={{ flex: 1, justifyContent: 'center' }}>
          Mes réservations
        </button>
        <button className="tk-btn tk-btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
          Voir le détail
        </button>
      </div>
    </div>
  );
}

function MobileBookingsScreen() {
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <Kicker>Marion D.</Kicker>
          <h1
            style={{
              fontSize: 24,
              marginTop: 4,
              lineHeight: 1.1,
              color: 'var(--charcoal-800)',
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            Mes réservations
          </h1>
        </div>
        <button
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--cream-100)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
          }}
        >
          <Icon name="search" size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 20px 12px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        <MobTab label="Toutes" count={5} active />
        <MobTab label="À venir" count={2} />
        <MobTab label="En attente" count={1} warn />
        <MobTab label="Passées" count={2} />
      </div>

      {/* List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 90px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* En attente — urgent */}
        <MobBookingCard
          status="pending"
          countdown="35 h"
          title="Chapiteau bambou 8×12 m"
          pro="Atelier Tente Loire"
          date="Sam. 14 sept. 2026"
          dateRel="dans 4 mois"
          location="Vertou (44)"
          total="926 €"
          gradient="linear-gradient(135deg, #C7B89A, #8C7A5C)"
        />

        {/* Confirmé */}
        <MobBookingCard
          status="upcoming"
          title="Pack 60 chaises Tiffany"
          pro="Mobilier des Mariées"
          date="Dim. 14 sept. 2026"
          dateRel="dans 4 mois"
          location="Vertou (44)"
          total="180 €"
          gradient="linear-gradient(135deg, #D4C8A8, #A89878)"
          highlight
        />

        {/* Confirmé futur lointain */}
        <MobBookingCard
          status="upcoming"
          title="Tente stretch 100p"
          pro="Évèn'Loire"
          date="Sam. 7 nov. 2026"
          dateRel="dans 6 mois"
          location="La Baule (44)"
          total="1 720 €"
          gradient="linear-gradient(135deg, #B8A688, #6E5F44)"
        />

        {/* Section passées */}
        <div
          style={{
            marginTop: 8,
            marginBottom: 4,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--charcoal-400)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Passées · à noter
        </div>

        {/* Avis à laisser */}
        <MobBookingCard
          status="review"
          title="Pack lounge 30 personnes"
          pro="Atelier Tente Loire"
          date="Sam. 22 mars 2025"
          dateRel="il y a 2 mois"
          location="Vertou (44)"
          total="640 €"
          gradient="linear-gradient(135deg, #C4B496, #7A6A4E)"
        />

        {/* Passé avec avis */}
        <MobBookingCard
          status="past"
          title="Tonnelle pliante 3×3"
          pro="Évèn'Loire"
          date="Sam. 18 janv. 2025"
          dateRel="il y a 4 mois"
          location="Saint-Nazaire"
          total="120 €"
          gradient="linear-gradient(135deg, #BFAE92, #6F614A)"
          rating={5}
        />

        {/* Empty CTA */}
        <button
          style={{
            marginTop: 8,
            padding: '16px 14px',
            background: 'var(--cream-50)',
            border: '1px dashed var(--cream-300)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--charcoal-500)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Icon name="plus" size={14} />
          Nouvelle réservation
        </button>
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
        <Tab icon="home" label="Accueil" />
        <Tab icon="search" label="Recherche" />
        <Tab icon="bookmark" label="Favoris" />
        <Tab icon="user" label="Compte" active />
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────

function MobStep({ n, state, title, time, sub, last, ping }) {
  const isDone = state === 'done';
  const isActive = state === 'active';
  const dotBg = isDone ? 'var(--brand-600)' : isActive ? 'var(--cream-50)' : 'var(--cream-100)';
  const dotBorder = isDone
    ? 'var(--brand-600)'
    : isActive
      ? 'var(--brand-500)'
      : 'var(--cream-300)';
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 12, position: 'relative' }}
    >
      {!last && (
        <div
          style={{
            position: 'absolute',
            left: 15,
            top: 32,
            bottom: -8,
            width: 2,
            background: isDone ? 'var(--brand-300)' : 'var(--cream-200)',
          }}
        />
      )}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: dotBg,
            border: `2px solid ${dotBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: isDone
              ? 'var(--cream-50)'
              : isActive
                ? 'var(--brand-700)'
                : 'var(--charcoal-400)',
          }}
        >
          {isDone ? <Icon name="check" size={14} color="var(--cream-50)" strokeWidth={2.5} /> : n}
        </div>
        {ping && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--brand-500)',
              boxShadow: '0 0 0 4px rgba(217,119,87,0.18)',
            }}
          />
        )}
      </div>
      <div style={{ paddingBottom: 18 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: isActive || isDone ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: isActive ? 'var(--brand-700)' : 'var(--charcoal-400)',
              fontWeight: isActive ? 600 : 500,
              whiteSpace: 'nowrap',
            }}
          >
            {time}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 3, lineHeight: 1.5 }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, sub }) {
  return (
    <button
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: 'var(--cream-50)',
        border: '1px solid var(--cream-200)',
        borderRadius: 'var(--radius-md)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--cream-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={16} color="var(--brand-600)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--charcoal-500)', marginTop: 2 }}>{sub}</div>
      </div>
      <Icon name="arrow" size={14} color="var(--charcoal-400)" />
    </button>
  );
}

function MobTab({ label, count, active, warn }) {
  return (
    <button
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        background: active ? 'var(--charcoal-700)' : 'var(--cream-100)',
        color: active ? 'var(--cream-50)' : 'var(--charcoal-600)',
        border: 'none',
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          padding: '1px 6px',
          background: active
            ? 'rgba(250,247,242,0.2)'
            : warn
              ? 'var(--warning-50, #FBF1DD)'
              : 'var(--cream-200)',
          color: active
            ? 'var(--cream-50)'
            : warn
              ? 'var(--warning-800, #7E5215)'
              : 'var(--charcoal-500)',
          borderRadius: 999,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function MobBookingCard({
  status,
  countdown,
  title,
  pro,
  date,
  dateRel,
  location,
  total,
  gradient,
  highlight,
  rating,
}) {
  const statusInfo = {
    pending: {
      label: 'En attente du pro',
      bg: 'var(--warning-50, #FBF1DD)',
      color: 'var(--warning-800, #7E5215)',
      dot: 'var(--warning-500, #C18527)',
    },
    upcoming: {
      label: 'Confirmé',
      bg: 'var(--success-50, #E8F4ED)',
      color: 'var(--success-700, #1E5C3D)',
      dot: 'var(--success-600, #2A7E55)',
    },
    review: {
      label: 'Avis à laisser',
      bg: 'var(--brand-50)',
      color: 'var(--brand-700)',
      dot: 'var(--brand-500)',
    },
    past: {
      label: 'Terminée',
      bg: 'var(--cream-100)',
      color: 'var(--charcoal-500)',
      dot: 'var(--charcoal-400)',
    },
  }[status];

  return (
    <article
      className="tk-card"
      style={{
        padding: 0,
        overflow: 'hidden',
        borderLeft: highlight
          ? '3px solid var(--brand-500)'
          : status === 'pending'
            ? '3px solid var(--warning-500, #C18527)'
            : undefined,
      }}
    >
      {/* Hero strip avec gradient + status */}
      <div style={{ position: 'relative', height: 80, background: gradient }}>
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: 'rgba(250,247,242,0.92)',
            borderRadius: 999,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusInfo.dot }} />
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: statusInfo.color,
            }}
          >
            {statusInfo.label}
          </span>
        </div>
        {countdown && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              padding: '4px 10px',
              background: 'rgba(20,19,15,0.7)',
              color: 'var(--cream-50)',
              borderRadius: 999,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Icon name="clock" size={11} color="var(--cream-50)" />
            {countdown}
          </div>
        )}
      </div>

      <div style={{ padding: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              {title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>{pro}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--charcoal-800)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {total}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 14,
            marginTop: 10,
            fontSize: 12,
            color: 'var(--charcoal-500)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="calendar" size={12} />
            {date}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="pin" size={12} />
            {location}
          </span>
        </div>

        {/* Status-specific footer */}
        {status === 'pending' && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              background: 'var(--warning-50, #FBF1DD)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon name="bolt" size={13} color="var(--warning-600, #B8721E)" />
            <span style={{ fontSize: 11, color: 'var(--charcoal-700)', flex: 1 }}>
              Le pro répond généralement en 2 h
            </span>
          </div>
        )}

        {status === 'review' && (
          <button
            style={{
              marginTop: 12,
              width: '100%',
              padding: '10px 14px',
              background: 'var(--brand-50)',
              border: '1px solid var(--brand-200)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--brand-700)',
              fontSize: 13,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <Icon name="star" size={13} color="var(--brand-600)" />
            Laisser un avis
          </button>
        )}

        {status === 'past' && rating && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'flex', gap: 1 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon
                  key={i}
                  name="star"
                  size={11}
                  color={i <= rating ? 'var(--brand-500)' : 'var(--cream-300)'}
                />
              ))}
            </span>
            <span style={{ fontSize: 11, color: 'var(--charcoal-500)' }}>Votre avis publié</span>
          </div>
        )}

        {status === 'upcoming' && (
          <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
            <button style={smallBtn}>
              <Icon name="message" size={12} />
              Message
            </button>
            <button style={smallBtn}>
              <Icon name="calendar" size={12} />
              Calendrier
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

const smallBtn = {
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  padding: '8px 10px',
  background: 'var(--cream-50)',
  border: '1px solid var(--cream-200)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--charcoal-700)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
};

Object.assign(window, { MobileConfirmationScreen, MobileBookingsScreen });
