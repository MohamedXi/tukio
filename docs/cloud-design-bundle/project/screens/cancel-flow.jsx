/* Cancellation flow — /account/bookings/{id}/cancel
   Three states shown stacked in one artboard:
   1. Récap impact + raison + commentaire
   2. Modale destructive de confirmation (overlayed visuel)
   3. Page de succès post-annulation
   On illustre le cas "à 21j de l'événement" → 50 % refund (palier moyen, pas trivial). */

function CancelFlowScreen() {
  const [reason, setReason] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [showModal, setShowModal] = React.useState(false);
  const [step, setStep] = React.useState('form'); // form | success

  if (step === 'success') return <CancelSuccessScreen onBack={() => setStep('form')} />;

  return (
    <div
      className="tk-root"
      style={{
        width: '100%',
        minHeight: '100%',
        background: 'var(--cream-50)',
        position: 'relative',
      }}
    >
      <TopNav variant="customer" compactSearch={true} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 40px 0' }}>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
          }}
          style={{
            fontSize: 13,
            color: 'var(--charcoal-500)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="arrowL" size={14} /> Retour à la réservation
        </a>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 40px 80px' }}>
        <Kicker color="var(--charcoal-500)">Annulation · #TUK-2026-00038</Kicker>
        <h1
          style={{
            fontSize: 36,
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: 'var(--charcoal-800)',
            marginTop: 8,
            marginBottom: 8,
            lineHeight: 1.1,
          }}
        >
          Annuler votre réservation ?
        </h1>
        <p
          style={{ fontSize: 15, color: 'var(--charcoal-500)', lineHeight: 1.55, marginBottom: 28 }}
        >
          Avant de confirmer, voici l'impact financier d'une annulation aujourd'hui. Vous pouvez
          aussi{' '}
          <a
            href="#"
            style={{ color: 'var(--brand-700)', fontWeight: 500, textDecoration: 'none' }}
          >
            écrire à Camille
          </a>{' '}
          pour modifier les conditions.
        </p>

        {/* Récap booking */}
        <div
          className="tk-card"
          style={{
            padding: 16,
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            marginBottom: 20,
            background: 'var(--cream-50)',
          }}
        >
          <Placeholder
            label="chaises tiffany"
            style={{ width: 64, height: 64, borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              Pack 80 chaises Tiffany dorées
            </div>
            <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
              Mobilier des Mariées · Sam. 22 juin 2026 (J-21)
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--charcoal-400)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Total
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: 'var(--charcoal-800)',
              }}
            >
              240,00 €
            </div>
          </div>
        </div>

        {/* Impact card */}
        <div
          className="tk-card"
          style={{
            padding: 0,
            overflow: 'hidden',
            marginBottom: 28,
            border: '1px solid var(--warning-200, #F0D8B8)',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              background: 'var(--warning-50)',
              borderBottom: '1px solid var(--warning-200, #F0D8B8)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Icon name="bolt" size={16} color="var(--warning-700)" strokeWidth={2} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning-700)', margin: 0 }}>
              Impact de l'annulation
            </h2>
          </div>
          <div style={{ padding: 24 }}>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}
            >
              <ImpactKV label="Date d'annulation" value="Aujourd'hui" sub="22 mai 2026" />
              <ImpactKV label="Date événement" value="22 juin 2026" sub="dans 21 jours" />
            </div>
            <div style={{ height: 1, background: 'var(--cream-200)', marginBottom: 20 }} />

            {/* Refund calculation visual */}
            <div style={{ marginBottom: 16 }}>
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
                Politique d'annulation appliquée
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 0,
                  position: 'relative',
                  padding: '8px 0',
                }}
              >
                <RefundTier label="> 30 j" pct="100 %" active={false} />
                <RefundTier label="15-30 j" pct="50 %" active={true} />
                <RefundTier label="7-15 j" pct="25 %" active={false} />
                <RefundTier label="< 7 j" pct="0 %" active={false} />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--charcoal-500)',
                  marginTop: 10,
                  lineHeight: 1.55,
                }}
              >
                Vous êtes à{' '}
                <strong style={{ color: 'var(--charcoal-800)', fontWeight: 600 }}>J-21</strong>,
                dans le palier{' '}
                <strong style={{ color: 'var(--brand-700)', fontWeight: 600 }}>
                  15 à 30 jours avant
                </strong>
                .
              </div>
            </div>

            {/* Money breakdown */}
            <div
              style={{
                background: 'var(--cream-100)',
                borderRadius: 'var(--radius-sm)',
                padding: 18,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                <span style={{ color: 'var(--charcoal-600)' }}>Montant versé (acompte)</span>
                <span
                  style={{
                    color: 'var(--charcoal-800)',
                    fontWeight: 500,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  72,00 €
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                <span style={{ color: 'var(--charcoal-600)' }}>Solde non débité</span>
                <span
                  style={{
                    color: 'var(--charcoal-500)',
                    fontWeight: 500,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  168,00 € · annulé
                </span>
              </div>
              <div style={{ height: 1, background: 'var(--cream-200)', margin: '8px 0 12px' }} />
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>
                    Vous serez remboursé·e de
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--charcoal-500)', marginTop: 2 }}>
                    50 % de l'acompte · délai 5 à 10 jours ouvrés
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: 'var(--success-700)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  36,00 €
                </div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  background: 'var(--cream-50)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  color: 'var(--charcoal-600)',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <Icon name="x" size={13} color="var(--charcoal-500)" />
                <span>
                  Vous perdrez{' '}
                  <strong
                    style={{
                      color: 'var(--charcoal-800)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    36,00 €
                  </strong>{' '}
                  en annulant maintenant. Attendre 9 jours = aucun remboursement.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Reason */}
        <Field2 label="Raison de l'annulation" optional>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              border: '1px solid var(--cream-300)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--cream-50)',
              color: reason ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
              appearance: 'none',
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%23615C56' fill='none' stroke-width='1.5'/></svg>\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 14px center',
              paddingRight: 36,
            }}
          >
            <option value="">Choisir une raison</option>
            <option value="event_cancelled">Mon événement est annulé</option>
            <option value="other_pro">Je change de prestataire</option>
            <option value="error">Erreur lors de la réservation</option>
            <option value="no_response">Le pro ne répond pas</option>
            <option value="other">Autre</option>
          </select>
        </Field2>

        {/* Comment */}
        <Field2
          label="Commentaire pour le pro"
          optional
          sub="Camille recevra ce message. Restez courtois·e — c'est un humain."
        >
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex. : événement reporté à l'année prochaine, on garde votre profil en favori…"
            rows={4}
            style={{
              width: '100%',
              padding: '12px 14px',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              border: '1px solid var(--cream-300)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--cream-50)',
              color: 'var(--charcoal-800)',
              resize: 'vertical',
              lineHeight: 1.5,
            }}
          />
        </Field2>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
            marginTop: 32,
            paddingTop: 24,
            borderTop: '1px solid var(--cream-200)',
          }}
        >
          <button className="tk-btn tk-btn-secondary">
            <Icon name="arrowL" size={14} /> Conserver ma réservation
          </button>
          <button
            className="tk-btn"
            onClick={() => setShowModal(true)}
            style={{
              background: 'var(--danger-600, #B53A2B)',
              color: 'var(--cream-50)',
              border: '1px solid var(--danger-700, #8E2C20)',
              fontWeight: 600,
            }}
          >
            Confirmer l'annulation
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <CancelModal
          amount="36,00 €"
          onClose={() => setShowModal(false)}
          onConfirm={() => {
            setShowModal(false);
            setStep('success');
          }}
        />
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────
function CancelModal({ amount, onClose, onConfirm }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(34, 30, 26, 0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 40,
      }}
    >
      <div
        className="tk-card"
        style={{
          padding: 0,
          maxWidth: 440,
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ padding: '28px 28px 8px' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(181, 58, 43, 0.1)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Icon name="x" size={20} color="var(--danger-700, #8E2C20)" strokeWidth={2.5} />
          </div>
          <h2
            style={{
              fontSize: 22,
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              color: 'var(--charcoal-800)',
              marginBottom: 10,
              lineHeight: 1.2,
            }}
          >
            Confirmer l'annulation ?
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'var(--charcoal-500)',
              lineHeight: 1.55,
              marginBottom: 16,
            }}
          >
            Cette action est{' '}
            <strong style={{ color: 'var(--charcoal-700)', fontWeight: 600 }}>définitive</strong>.
            Camille sera notifiée et la réservation libérera son créneau.
          </p>
          <div
            style={{
              background: 'var(--cream-100)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px 16px',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--charcoal-600)' }}>Remboursement</span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--success-700)',
                }}
              >
                {amount}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--charcoal-500)' }}>
              Crédité sur Visa ••4242 · 5 à 10 jours ouvrés
            </div>
          </div>
        </div>
        <div
          style={{ padding: '16px 24px 24px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}
        >
          <button onClick={onClose} className="tk-btn tk-btn-tertiary">
            Retour
          </button>
          <button
            onClick={onConfirm}
            className="tk-btn"
            style={{
              background: 'var(--danger-600, #B53A2B)',
              color: 'var(--cream-50)',
              border: '1px solid var(--danger-700, #8E2C20)',
              fontWeight: 600,
            }}
          >
            Confirmer l'annulation
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Success page ─────────────────────────────────
function CancelSuccessScreen({ onBack }) {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <TopNav variant="customer" compactSearch={true} />

      <div
        style={{ maxWidth: 600, margin: '0 auto', padding: '80px 40px 64px', textAlign: 'center' }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--cream-100)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            border: '1px solid var(--cream-200)',
          }}
        >
          <Icon name="check" size={24} color="var(--charcoal-600)" strokeWidth={2} />
        </div>

        <Kicker color="var(--charcoal-500)">Réservation annulée · #TUK-2026-00038</Kicker>
        <h1
          style={{
            fontSize: 36,
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: 'var(--charcoal-800)',
            marginTop: 12,
            marginBottom: 16,
            lineHeight: 1.1,
          }}
        >
          Votre réservation est annulée.
        </h1>
        <p
          style={{
            fontSize: 15,
            color: 'var(--charcoal-500)',
            lineHeight: 1.55,
            marginBottom: 32,
            maxWidth: 480,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Camille a été notifiée et son créneau du 22 juin est à nouveau libre. Un email
          récapitulatif vous a été envoyé.
        </p>

        {/* Refund detail */}
        <div className="tk-card" style={{ padding: 20, textAlign: 'left', marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--charcoal-500)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontFamily: 'var(--font-mono)',
              marginBottom: 14,
            }}
          >
            Remboursement programmé
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--charcoal-700)' }}>Montant</span>
            <span
              style={{
                fontSize: 24,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: 'var(--success-700)',
              }}
            >
              36,00 €
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            <span style={{ color: 'var(--charcoal-500)' }}>Vers</span>
            <span style={{ color: 'var(--charcoal-700)', fontWeight: 500 }}>Visa ••4242</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--charcoal-500)' }}>Délai</span>
            <span style={{ color: 'var(--charcoal-700)', fontWeight: 500 }}>
              5 à 10 jours ouvrés
            </span>
          </div>
        </div>

        {/* Email confirm */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'var(--cream-100)',
            borderRadius: 999,
            fontSize: 13,
            color: 'var(--charcoal-600)',
            marginBottom: 32,
          }}
        >
          <Icon name="message" size={13} color="var(--charcoal-500)" />
          Confirmation envoyée à{' '}
          <strong style={{ color: 'var(--charcoal-800)', fontWeight: 600 }}>
            marion.d@example.fr
          </strong>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onBack} className="tk-btn tk-btn-tertiary">
            <Icon name="arrowL" size={14} /> Retour à mes réservations
          </button>
          <button className="tk-btn tk-btn-primary">
            <Icon name="search" size={14} /> Découvrir d'autres pros
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────
function ImpactKV({ label, value, sub }) {
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
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--charcoal-800)', lineHeight: 1.3 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function RefundTier({ label, pct, active }) {
  return (
    <div
      style={{
        padding: '10px 8px',
        textAlign: 'center',
        background: active ? 'var(--brand-50)' : 'transparent',
        borderRadius: 'var(--radius-sm)',
        border: active ? '1px solid var(--brand-200, var(--brand-100))' : '1px solid transparent',
        position: 'relative',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: active ? 'var(--brand-700)' : 'var(--charcoal-500)',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
          fontWeight: active ? 600 : 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: active ? 'var(--brand-700)' : 'var(--charcoal-700)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {pct}
      </div>
      {active && (
        <div
          style={{
            position: 'absolute',
            bottom: -8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid var(--brand-200, var(--brand-100))',
          }}
        />
      )}
    </div>
  );
}

function Field2({ label, optional, sub, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--charcoal-800)',
          display: 'block',
          marginBottom: 6,
        }}
      >
        {label}
        {optional && (
          <span style={{ fontWeight: 400, color: 'var(--charcoal-400)', marginLeft: 6 }}>
            · optionnel
          </span>
        )}
      </label>
      {sub && (
        <div
          style={{ fontSize: 12, color: 'var(--charcoal-500)', marginBottom: 8, lineHeight: 1.5 }}
        >
          {sub}
        </div>
      )}
      {children}
    </div>
  );
}

window.CancelFlowScreen = CancelFlowScreen;
window.CancelFlowFormScreen = function () {
  return <CancelFormView />;
};
window.CancelFlowModalScreen = function () {
  return <CancelFormView withModal />;
};
window.CancelFlowSuccessScreen = function () {
  return <CancelSuccessScreen onBack={() => {}} />;
};

// Static stateless variant for the canvas (no internal state, so all 3 states are showable)
function CancelFormView({ withModal }) {
  return (
    <div
      className="tk-root"
      style={{
        width: '100%',
        minHeight: '100%',
        background: 'var(--cream-50)',
        position: 'relative',
      }}
    >
      <TopNav variant="customer" compactSearch={true} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 40px 0' }}>
        <a
          href="#"
          style={{
            fontSize: 13,
            color: 'var(--charcoal-500)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="arrowL" size={14} /> Retour à la réservation
        </a>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 40px 80px' }}>
        <Kicker color="var(--charcoal-500)">Annulation · #TUK-2026-00038</Kicker>
        <h1
          style={{
            fontSize: 36,
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: 'var(--charcoal-800)',
            marginTop: 8,
            marginBottom: 8,
            lineHeight: 1.1,
          }}
        >
          Annuler votre réservation ?
        </h1>
        <p
          style={{ fontSize: 15, color: 'var(--charcoal-500)', lineHeight: 1.55, marginBottom: 28 }}
        >
          Avant de confirmer, voici l'impact financier d'une annulation aujourd'hui. Vous pouvez
          aussi{' '}
          <a
            href="#"
            style={{ color: 'var(--brand-700)', fontWeight: 500, textDecoration: 'none' }}
          >
            écrire à Camille
          </a>{' '}
          pour modifier les conditions.
        </p>

        <div
          className="tk-card"
          style={{
            padding: 16,
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            marginBottom: 20,
            background: 'var(--cream-50)',
          }}
        >
          <Placeholder
            label="chaises tiffany"
            style={{ width: 64, height: 64, borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              Pack 80 chaises Tiffany dorées
            </div>
            <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
              Mobilier des Mariées · Sam. 22 juin 2026 (J-21)
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--charcoal-400)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Total
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: 'var(--charcoal-800)',
              }}
            >
              240,00 €
            </div>
          </div>
        </div>

        <div
          className="tk-card"
          style={{
            padding: 0,
            overflow: 'hidden',
            marginBottom: 28,
            border: '1px solid var(--warning-200, #F0D8B8)',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              background: 'var(--warning-50)',
              borderBottom: '1px solid var(--warning-200, #F0D8B8)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Icon name="bolt" size={16} color="var(--warning-700)" strokeWidth={2} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning-700)', margin: 0 }}>
              Impact de l'annulation
            </h2>
          </div>
          <div style={{ padding: 24 }}>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}
            >
              <ImpactKV label="Date d'annulation" value="Aujourd'hui" sub="22 mai 2026" />
              <ImpactKV label="Date événement" value="22 juin 2026" sub="dans 21 jours" />
            </div>
            <div style={{ height: 1, background: 'var(--cream-200)', marginBottom: 20 }} />

            <div style={{ marginBottom: 16 }}>
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
                Politique d'annulation appliquée
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                  padding: '8px 0',
                }}
              >
                <RefundTier label="> 30 j" pct="100 %" active={false} />
                <RefundTier label="15-30 j" pct="50 %" active={true} />
                <RefundTier label="7-15 j" pct="25 %" active={false} />
                <RefundTier label="< 7 j" pct="0 %" active={false} />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--charcoal-500)',
                  marginTop: 16,
                  lineHeight: 1.55,
                }}
              >
                Vous êtes à{' '}
                <strong style={{ color: 'var(--charcoal-800)', fontWeight: 600 }}>J-21</strong>,
                dans le palier{' '}
                <strong style={{ color: 'var(--brand-700)', fontWeight: 600 }}>
                  15 à 30 jours avant
                </strong>
                .
              </div>
            </div>

            <div
              style={{
                background: 'var(--cream-100)',
                borderRadius: 'var(--radius-sm)',
                padding: 18,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                <span style={{ color: 'var(--charcoal-600)' }}>Montant versé (acompte)</span>
                <span
                  style={{
                    color: 'var(--charcoal-800)',
                    fontWeight: 500,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  72,00 €
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                <span style={{ color: 'var(--charcoal-600)' }}>Solde non débité</span>
                <span
                  style={{
                    color: 'var(--charcoal-500)',
                    fontWeight: 500,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  168,00 € · annulé
                </span>
              </div>
              <div style={{ height: 1, background: 'var(--cream-200)', margin: '8px 0 12px' }} />
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>
                    Vous serez remboursé·e de
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--charcoal-500)', marginTop: 2 }}>
                    50 % de l'acompte · délai 5 à 10 jours ouvrés
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: 'var(--success-700)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  36,00 €
                </div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  background: 'var(--cream-50)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  color: 'var(--charcoal-600)',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <Icon name="x" size={13} color="var(--charcoal-500)" />
                <span>
                  Vous perdrez{' '}
                  <strong
                    style={{
                      color: 'var(--charcoal-800)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    36,00 €
                  </strong>{' '}
                  en annulant maintenant. Attendre 9 jours = aucun remboursement.
                </span>
              </div>
            </div>
          </div>
        </div>

        <Field2 label="Raison de l'annulation" optional>
          <select
            defaultValue="other_pro"
            style={{
              width: '100%',
              padding: '12px 14px',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              border: '1px solid var(--cream-300)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--cream-50)',
              color: 'var(--charcoal-800)',
              appearance: 'none',
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%23615C56' fill='none' stroke-width='1.5'/></svg>\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 14px center',
              paddingRight: 36,
            }}
          >
            <option value="event_cancelled">Mon événement est annulé</option>
            <option value="other_pro">Je change de prestataire</option>
            <option value="error">Erreur lors de la réservation</option>
            <option value="no_response">Le pro ne répond pas</option>
            <option value="other">Autre</option>
          </select>
        </Field2>

        <Field2
          label="Commentaire pour le pro"
          optional
          sub="Camille recevra ce message. Restez courtois·e — c'est un humain."
        >
          <textarea
            defaultValue="Bonjour Camille, on a finalement choisi de partir sur un autre prestataire pour des raisons logistiques. Merci pour votre temps et bonne continuation."
            rows={4}
            style={{
              width: '100%',
              padding: '12px 14px',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              border: '1px solid var(--cream-300)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--cream-50)',
              color: 'var(--charcoal-800)',
              resize: 'vertical',
              lineHeight: 1.5,
            }}
          />
        </Field2>

        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
            marginTop: 32,
            paddingTop: 24,
            borderTop: '1px solid var(--cream-200)',
          }}
        >
          <button className="tk-btn tk-btn-secondary">
            <Icon name="arrowL" size={14} /> Conserver ma réservation
          </button>
          <button
            className="tk-btn"
            style={{
              background: 'var(--danger-600, #B53A2B)',
              color: 'var(--cream-50)',
              border: '1px solid var(--danger-700, #8E2C20)',
              fontWeight: 600,
            }}
          >
            Confirmer l'annulation
          </button>
        </div>
      </div>

      {withModal && <CancelModal amount="36,00 €" onClose={() => {}} onConfirm={() => {}} />}
    </div>
  );
}
