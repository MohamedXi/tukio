/* Booking detail (customer view) — /account/bookings/{id}
   Layout : header + 2 colonnes (main détails / sidebar actions sticky).
   Status: confirmed (cas le plus riche : tous les blocs visibles). */

function BookingDetailScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <TopNav variant="customer" compactSearch={true} />

      {/* Breadcrumb */}
      <div style={{ padding: '20px 40px 0', maxWidth: 1280, margin: '0 auto' }}>
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
          <Icon name="arrowL" size={14} /> Retour à mes réservations
        </a>
      </div>

      {/* Header band */}
      <section style={{ padding: '16px 40px 32px', maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <span className="tk-badge tk-badge-success">
                <Icon name="check" size={11} /> Confirmée
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--charcoal-400)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                #TUK-2026-00038 · créée le 28 avril 2026
              </span>
            </div>
            <h1
              style={{
                fontSize: 40,
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                letterSpacing: '-0.02em',
                color: 'var(--charcoal-800)',
                marginBottom: 8,
                lineHeight: 1.1,
              }}
            >
              Pack 80 chaises Tiffany dorées
            </h1>
            <div style={{ fontSize: 15, color: 'var(--charcoal-500)' }}>
              <strong style={{ color: 'var(--charcoal-700)', fontWeight: 600 }}>
                Mobilier des Mariées
              </strong>{' '}
              · Nantes (44) · Pour le{' '}
              <strong style={{ color: 'var(--charcoal-700)', fontWeight: 600 }}>
                22 juin 2026
              </strong>{' '}
              (dans 3 semaines)
            </div>
          </div>
        </div>
      </section>

      {/* Layout 2 cols */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 40px 64px',
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 32,
          alignItems: 'start',
        }}
      >
        {/* ── Main column ─────────────────────────────── */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Timeline */}
          <Section title="Suivi de la demande" icon="clock">
            <BookingTimeline
              events={[
                {
                  date: '28 avr. 14:32',
                  title: 'Demande envoyée',
                  desc: 'Acompte autorisé sur carte ••4242',
                  state: 'done',
                },
                {
                  date: '28 avr. 16:08',
                  title: 'Confirmée par Camille',
                  desc: 'Acompte de 72 € débité',
                  state: 'done',
                },
                {
                  date: '15 juin',
                  title: 'Préparation',
                  desc: 'Camille reprend contact 7 j avant pour la logistique',
                  state: 'current',
                },
                {
                  date: '22 juin',
                  title: 'Événement réalisé',
                  desc: 'Solde de 168 € débité 7 j avant',
                  state: 'pending',
                },
              ]}
            />
          </Section>

          {/* Pro mini-card */}
          <Section title="Votre prestataire" icon="user">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Placeholder
                label=""
                style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: 'var(--charcoal-800)',
                    marginBottom: 4,
                  }}
                >
                  Mobilier des Mariées
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    fontSize: 13,
                    color: 'var(--charcoal-500)',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="star" size={12} color="var(--brand-500)" strokeWidth={2} />
                    <strong style={{ color: 'var(--charcoal-800)', fontWeight: 600 }}>4.7</strong>
                    <span style={{ color: 'var(--charcoal-400)' }}>(89 avis)</span>
                  </span>
                  <span
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: '50%',
                      background: 'var(--cream-300)',
                    }}
                  />
                  <span>Saint-Sébastien-sur-Loire</span>
                  <span
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: '50%',
                      background: 'var(--cream-300)',
                    }}
                  />
                  <span>Réponse en moyenne &lt; 2 h</span>
                </div>
              </div>
              <button className="tk-btn tk-btn-tertiary tk-btn-sm">
                Voir le profil <Icon name="arrow" size={13} />
              </button>
            </div>
          </Section>

          {/* Détails */}
          <Section title="Détails de la réservation" icon="doc">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <Field
                label="Dates"
                value="Sam. 22 juin 2026"
                sub="Livraison 9 h · reprise dim. 23 juin 10 h"
              />
              <Field
                label="Quantité"
                value="80 chaises Tiffany dorées"
                sub="+ housses ivoire incluses"
              />
              <Field
                label="Lieu de livraison"
                value="14 rue des Pommiers"
                sub="44120 Vertou · Accès cour, semi possible"
              />
              <Field label="Contact sur place" value="Marion D." sub="06 12 34 56 78" />
            </div>
            <div
              style={{
                marginTop: 20,
                padding: 14,
                background: 'var(--cream-100)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                color: 'var(--charcoal-600)',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: 'var(--charcoal-800)', fontWeight: 600 }}>
                Note pour le pro :
              </strong>{' '}
              "Mariage en plein air — terrain en pelouse, prévoir cales si besoin. Cocktail 18 h,
              dîner sous chapiteau dès 20 h."
            </div>
          </Section>

          {/* Détail paiement */}
          <Section title="Détail du paiement" icon="card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
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
                <PayRow label="80 chaises Tiffany" value="160 €" />
                <PayRow label="Housses ivoire" value="40 €" />
                <PayRow label="Livraison & reprise" value="incluse" sub />
                <PayRow label="Frais de service Tukio" value="40 €" sub />
                <Divider />
                <PayRow label="Total" value="240 €" bold />
                <div style={{ fontSize: 11, color: 'var(--charcoal-400)', marginTop: 4 }}>
                  TVA incluse · auto-facture envoyée
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
                <PayRow label="Acompte (30 %)" value="72 €" status="done" />
                <PayRow label="Solde — débit le 15 juin" value="168 €" status="scheduled" />
                <Divider />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'var(--cream-100)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 22,
                      background: 'linear-gradient(135deg, #1a1f71 0%, #f7b600 100%)',
                      borderRadius: 3,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: 'var(--charcoal-700)' }}>Visa ••4242 — exp. 12/27</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Politique d'annulation */}
          <Section title="Politique d'annulation" icon="shield">
            <div
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                background: 'var(--success-50)',
                borderRadius: 'var(--radius-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: 'var(--success-700)',
              }}
            >
              <Icon name="check" size={14} color="var(--success-700)" strokeWidth={2} />
              Annulation aujourd'hui (J-21) →{' '}
              <strong style={{ fontWeight: 600 }}>remboursement 50 %</strong> (120 €)
            </div>
            <CancelTier label="> 30 jours avant" pct="100 %" current={false} />
            <CancelTier label="15 à 30 jours avant" pct="50 %" current={true} />
            <CancelTier label="7 à 15 jours avant" pct="25 %" current={false} />
            <CancelTier label="< 7 jours avant" pct="0 %" current={false} />
          </Section>

          {/* Historique */}
          <Section title="Historique" icon="clock" collapsible>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--charcoal-600)',
                lineHeight: 1.9,
              }}
            >
              <LogRow d="28/04 14:32" t="Demande envoyée à Mobilier des Mariées" />
              <LogRow d="28/04 14:32" t="Email de confirmation envoyé à marion.d@example.fr" />
              <LogRow d="28/04 14:33" t="Pro notifié (email + SMS)" />
              <LogRow d="28/04 16:08" t="Pro a accepté la demande" />
              <LogRow d="28/04 16:08" t="Acompte de 72,00 € débité (Visa ••4242)" />
              <LogRow d="29/04 09:14" t="Message de Camille reçu" />
              <LogRow d="15/06 09:00" t="Solde de 168,00 € débité (programmé)" pending />
            </div>
          </Section>
        </main>

        {/* ── Sticky sidebar : actions ─────────────────── */}
        <aside
          style={{
            position: 'sticky',
            top: 88,
            alignSelf: 'start',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div className="tk-card" style={{ padding: 20 }}>
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
              Actions disponibles
            </div>

            <button
              className="tk-btn tk-btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
            >
              <Icon name="message" size={14} /> Écrire à Camille
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--brand-100)',
                  marginLeft: 4,
                }}
              >
                (1)
              </span>
            </button>
            <button
              className="tk-btn tk-btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
            >
              <Icon name="calendar" size={14} /> Demander une modification
            </button>
            <button
              className="tk-btn tk-btn-tertiary tk-btn-sm"
              style={{
                width: '100%',
                justifyContent: 'center',
                color: 'var(--danger-700, #B53A2B)',
              }}
            >
              Annuler la réservation
            </button>

            <div style={{ height: 1, background: 'var(--cream-200)', margin: '16px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SmallLink icon="doc" label="Télécharger le récapitulatif (PDF)" />
              <SmallLink icon="doc" label="Télécharger la facture acompte" />
              <SmallLink icon="pin" label="Itinéraire vers le lieu" />
              <SmallLink icon="bookmark" label="Ajouter aux favoris" />
            </div>
          </div>

          {/* Mini summary */}
          <div
            className="tk-card"
            style={{
              padding: 18,
              background: 'var(--cream-100)',
              border: '1px solid var(--cream-200)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-mono)',
                marginBottom: 10,
              }}
            >
              Récap rapide
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              <span style={{ color: 'var(--charcoal-600)' }}>Total</span>
              <span
                style={{
                  fontWeight: 600,
                  color: 'var(--charcoal-800)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                240,00 €
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              <span style={{ color: 'var(--charcoal-600)' }}>Déjà débité</span>
              <span
                style={{
                  fontWeight: 500,
                  color: 'var(--success-700)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                72,00 €
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--charcoal-600)' }}>Reste à débiter</span>
              <span
                style={{
                  fontWeight: 500,
                  color: 'var(--charcoal-700)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                168,00 €
              </span>
            </div>
          </div>

          <div
            style={{
              padding: 14,
              fontSize: 12,
              color: 'var(--charcoal-500)',
              lineHeight: 1.55,
              textAlign: 'center',
            }}
          >
            Un souci ?{' '}
            <a
              href="#"
              style={{ color: 'var(--brand-700)', textDecoration: 'none', fontWeight: 500 }}
            >
              Contactez le support Tukio
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────

function Section({ title, icon, children, collapsible }) {
  return (
    <div className="tk-card" style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--charcoal-800)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            margin: 0,
          }}
        >
          {icon && <Icon name={icon} size={16} color="var(--charcoal-500)" />}
          {title}
        </h2>
        {collapsible && <Icon name="caret" size={16} color="var(--charcoal-400)" />}
      </div>
      {children}
    </div>
  );
}

function BookingTimeline({ events }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 0 }}>
      {events.map((e, i) => {
        const last = i === events.length - 1;
        const isDone = e.state === 'done';
        const isCurrent = e.state === 'current';
        return (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 24px 1fr',
              gap: 12,
              paddingBottom: last ? 0 : 20,
              position: 'relative',
            }}
          >
            {/* date */}
            <div
              style={{
                fontSize: 12,
                color: 'var(--charcoal-500)',
                fontFamily: 'var(--font-mono)',
                paddingTop: 2,
                textAlign: 'right',
              }}
            >
              {e.date}
            </div>
            {/* dot + line */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <span
                style={{
                  width: isCurrent ? 12 : 10,
                  height: isCurrent ? 12 : 10,
                  borderRadius: '50%',
                  background: isDone
                    ? 'var(--success-500)'
                    : isCurrent
                      ? 'var(--cream-50)'
                      : 'var(--cream-50)',
                  border: `2px solid ${isDone ? 'var(--success-500)' : isCurrent ? 'var(--brand-500)' : 'var(--cream-300)'}`,
                  boxShadow: isCurrent ? '0 0 0 4px rgba(194, 65, 12, 0.12)' : 'none',
                  marginTop: 4,
                  zIndex: 1,
                }}
              />
              {!last && (
                <span
                  style={{
                    position: 'absolute',
                    top: 14,
                    bottom: -20,
                    left: '50%',
                    width: 1,
                    background: isDone ? 'var(--success-500)' : 'var(--cream-300)',
                    transform: 'translateX(-50%)',
                  }}
                />
              )}
            </div>
            {/* content */}
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: isDone || isCurrent ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
                }}
              >
                {e.title}
              </div>
              {e.desc && (
                <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>
                  {e.desc}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, sub }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--charcoal-400)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-mono)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)', lineHeight: 1.4 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function PayRow({ label, value, sub, bold, status }) {
  const valColor =
    status === 'done' ? 'var(--success-700)' : sub ? 'var(--charcoal-500)' : 'var(--charcoal-800)';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '5px 0',
        fontSize: 13,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          color: sub ? 'var(--charcoal-500)' : 'var(--charcoal-700)',
          fontWeight: bold ? 600 : 400,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {status === 'done' && (
          <Icon name="check" size={12} color="var(--success-600)" strokeWidth={2.5} />
        )}
        {status === 'scheduled' && <Icon name="clock" size={12} color="var(--charcoal-400)" />}
        {label}
      </span>
      <span
        style={{ color: valColor, fontWeight: bold ? 600 : 500, fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--cream-200)', margin: '8px 0' }} />;
}

function CancelTier({ label, pct, current }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        background: current ? 'var(--cream-100)' : 'transparent',
        borderRadius: 'var(--radius-sm)',
        border: current ? '1px solid var(--brand-200, var(--brand-100))' : '1px solid transparent',
        marginBottom: 4,
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: current ? 'var(--charcoal-800)' : 'var(--charcoal-600)',
          fontWeight: current ? 600 : 500,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {current && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--brand-700)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
            }}
          >
            vous êtes ici
          </span>
        )}
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: current ? 'var(--brand-700)' : 'var(--charcoal-700)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {pct}
        </span>
      </div>
    </div>
  );
}

function LogRow({ d, t, pending }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '100px 1fr',
        gap: 12,
        opacity: pending ? 0.55 : 1,
      }}
    >
      <span style={{ color: 'var(--charcoal-400)' }}>{d}</span>
      <span style={{ color: 'var(--charcoal-700)', fontFamily: 'var(--font-body)' }}>
        {pending && (
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              background: 'var(--cream-200)',
              borderRadius: 999,
              marginRight: 8,
              color: 'var(--charcoal-500)',
            }}
          >
            programmé
          </span>
        )}
        {t}
      </span>
    </div>
  );
}

function SmallLink({ icon, label }) {
  return (
    <a
      href="#"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: 'var(--charcoal-600)',
        textDecoration: 'none',
      }}
    >
      <Icon name={icon} size={14} color="var(--charcoal-500)" />
      <span>{label}</span>
    </a>
  );
}

window.BookingDetailScreen = BookingDetailScreen;
