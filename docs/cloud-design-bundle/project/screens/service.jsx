/* Service detail — gallery + sticky booking card + pro + reviews */

function ServiceScreen() {
  return (
    <div className="tk-root" style={{ width: '100%', minHeight: '100%' }}>
      <TopNav variant="public" compactSearch={true} />

      <div
        style={{
          padding: '20px 40px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: 'var(--charcoal-500)',
        }}
      >
        <span>Catégories</span>
        <Icon name="arrow" size={12} />
        <span>Tentes &amp; chapiteaux</span>
        <Icon name="arrow" size={12} />
        <span style={{ color: 'var(--charcoal-700)' }}>Chapiteau bambou 8×12 m</span>
      </div>

      <div style={{ padding: '16px 40px 8px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <span className="tk-badge tk-badge-brand">Top pro</span>
          <span className="tk-badge tk-badge-success">Réponse &lt; 4 h</span>
        </div>
        <h1 style={{ fontSize: 'var(--text-3xl)' }}>Chapiteau bambou 8×12 m — toile crème</h1>
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            marginTop: 8,
            fontSize: 13,
            color: 'var(--charcoal-500)',
          }}
        >
          <Stars value={4.9} count={47} />
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="pin" size={14} /> Saint-Herblain · 8 km de Nantes
          </span>
          <span>·</span>
          <span>
            par <strong style={{ color: 'var(--charcoal-700)' }}>Atelier Tente Loire</strong>
          </span>
        </div>
      </div>

      {/* Gallery */}
      <div
        style={{
          padding: '16px 40px 32px',
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr',
          gridTemplateRows: '240px 240px',
          gap: 8,
        }}
      >
        <Placeholder
          label="hero · chapiteau monté en jardin"
          style={{ gridRow: 'span 2', borderRadius: 'var(--radius-md)' }}
        />
        <Placeholder
          label="détail · structure bambou"
          style={{ borderRadius: 'var(--radius-md)' }}
        />
        <Placeholder
          label="intérieur · tablée 80 pers."
          style={{ borderRadius: 'var(--radius-md)' }}
        />
        <Placeholder label="ambiance · soir" style={{ borderRadius: 'var(--radius-md)' }} />
        <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <Placeholder label="" style={{ borderRadius: 'var(--radius-md)' }} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(31, 29, 24, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--cream-50)',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            +8 photos
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: 56,
          padding: '0 40px 64px',
        }}
      >
        {/* Left column */}
        <div>
          {/* Pro strip */}
          <div
            className="tk-card"
            style={{
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 32,
            }}
          >
            <Avatar name="Atelier Tente Loire" size={48} tone="brand" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Atelier Tente Loire</div>
              <div style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
                Pro vérifié depuis 2 ans · 47 avis · 124 réservations
              </div>
            </div>
            <button className="tk-btn tk-btn-secondary tk-btn-sm">
              <Icon name="message" size={14} /> Contacter
            </button>
          </div>

          <Section title="Description">
            <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--charcoal-600)' }}>
              Chapiteau bambou écoresponsable, conçu et fabriqué en Pays de la Loire. La structure
              en bambou apporte une élégance naturelle, parfaite pour un mariage en extérieur ou un
              événement corporate haut de gamme. Toile crème ignifugée, parois latérales en option.
            </p>
            <p
              style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--charcoal-600)', marginTop: 12 }}
            >
              Livraison, montage et démontage inclus dans un rayon de 30 km autour de
              Saint-Herblain. Au-delà, devis sur demande.
            </p>
          </Section>

          <Section title="Caractéristiques">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                ['Dimensions', '8 m × 12 m (96 m²)'],
                ['Capacité', '80 à 120 personnes'],
                ['Matériau', 'Bambou & toile crème ignifugée'],
                ['Hauteur', '3,40 m au faîtage'],
                ['Plancher', 'Disponible en option'],
                ['Éclairage', 'Guirlandes guinguette incluses'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--charcoal-400)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {k}
                  </span>
                  <span style={{ fontSize: 15, color: 'var(--charcoal-700)', fontWeight: 500 }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Options & suppléments">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <OptionRow label="Plancher bois clair" price="+ 280 €" />
              <OptionRow label="Parois latérales transparentes (4)" price="+ 180 €" />
              <OptionRow label="Chauffage soufflant" price="+ 95 € / jour" />
              <OptionRow label="Montage J-1 (au lieu du jour J)" price="+ 150 €" />
            </div>
          </Section>

          <Section title="Zone de livraison">
            <div
              style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--cream-200)',
              }}
            >
              <div
                style={{
                  height: 240,
                  background: 'var(--cream-100)',
                  backgroundImage: `
                  repeating-linear-gradient(0deg, transparent 0 39px, rgba(31, 29, 24, 0.06) 39px 40px),
                  repeating-linear-gradient(90deg, transparent 0 39px, rgba(31, 29, 24, 0.06) 39px 40px)
                `,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 240,
                    height: 240,
                    borderRadius: '50%',
                    border: '2px dashed var(--brand-500)',
                    background: 'rgba(194, 65, 12, 0.06)',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <Icon name="pin" size={28} color="var(--brand-500)" strokeWidth={2} />
                </div>
              </div>
              <div
                style={{
                  padding: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <span style={{ color: 'var(--charcoal-500)' }}>Livraison incluse dans 30 km</span>
                <span style={{ color: 'var(--charcoal-700)', fontWeight: 500 }}>
                  Au-delà : 1,80 €/km
                </span>
              </div>
            </div>
          </Section>

          <Section title="Politique d'annulation">
            <div
              style={{
                display: 'flex',
                gap: 12,
                padding: 16,
                background: 'var(--info-50)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(30, 95, 126, 0.15)',
              }}
            >
              <Icon name="shield" size={20} color="var(--info-500)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--info-700)' }}>
                  Annulation standard
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--charcoal-600)',
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  Remboursement à 100 % jusqu'à J-15. À 50 % entre J-14 et J-7. Aucun remboursement
                  à moins de 7 jours sauf cas de force majeure.
                </div>
              </div>
            </div>
          </Section>

          <Section title="Avis (47)">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 32,
                marginBottom: 24,
                padding: '16px 0',
                borderBottom: '1px solid var(--cream-200)',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 48,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--charcoal-800)',
                    lineHeight: 1,
                    fontWeight: 400,
                  }}
                >
                  4,9
                </div>
                <Stars value={4.9} count={47} size={14} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <div
                    key={n}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 12,
                      color: 'var(--charcoal-500)',
                    }}
                  >
                    <span style={{ width: 12 }}>{n}★</span>
                    <span
                      style={{
                        flex: 1,
                        height: 6,
                        background: 'var(--cream-200)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          height: '100%',
                          width: `${[88, 9, 2, 1, 0][5 - n]}%`,
                          background: 'var(--brand-500)',
                        }}
                      />
                    </span>
                    <span style={{ width: 28, textAlign: 'right' }}>{[42, 4, 1, 0, 0][5 - n]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <Review
                name="Sophie L."
                date="Avril 2026"
                rating={5}
                body="Chapiteau magnifique, montage impeccable la veille. Toute l'équipe d'Antoine très professionnelle, ils ont géré la pluie sans broncher. Je recommande à 100 %."
              />
              <Review
                name="Mathieu P."
                date="Mars 2026"
                rating={5}
                body="Parfait pour notre mariage à Vertou. Le bambou rend très bien en photo. Communication facile via la messagerie tukio.one."
              />
              <Review
                name="Léa & Romain"
                date="Février 2026"
                rating={4}
                body="Très belle prestation. Petit bémol sur l'horaire de démontage du dimanche soir, mais Antoine s'est adapté."
              />
              <Review
                name="Claire D."
                date="Janvier 2026"
                rating={5}
                body="Service de bout en bout. Devis clair, paiement sécurisé, le pro qui se déplace pour visiter le terrain. Du sérieux."
              />
            </div>
            <button className="tk-btn tk-btn-secondary" style={{ marginTop: 20 }}>
              Voir les 47 avis
            </button>
          </Section>
        </div>

        {/* Sticky booking card */}
        <aside>
          <div
            className="tk-card"
            style={{ padding: 24, position: 'sticky', top: 24, boxShadow: 'var(--shadow)' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 28,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  color: 'var(--charcoal-800)',
                }}
              >
                890 €
              </span>
              <span style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
                à partir de · forfait week-end
              </span>
            </div>
            <Stars value={4.9} count={47} size={13} />

            <div
              style={{
                marginTop: 20,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1,
                background: 'var(--cream-300)',
                border: '1px solid var(--cream-300)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
              }}
            >
              <Field label="Arrivée" value="Sam 13 juin" />
              <Field label="Départ" value="Lun 15 juin" />
              <div
                style={{
                  gridColumn: 'span 2',
                  background: 'var(--cream-50)',
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--charcoal-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Adresse de livraison
                </div>
                <div style={{ fontSize: 14, color: 'var(--charcoal-700)', marginTop: 2 }}>
                  14 rue des Vignes, 44120 Vertou
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Line label="Forfait week-end" value="890 €" />
              <Line label="Plancher bois clair" value="280 €" />
              <Line label="Livraison (8 km)" value="incluse" muted />
              <hr className="tk-hr" style={{ margin: '4px 0' }} />
              <Line label="Sous-total" value="1 170 €" />
              <Line label="Frais de service tukio" value="35 €" muted small />
              <hr className="tk-hr" />
              <Line label="Total" value="1 205 €" bold />
            </div>

            <button
              className="tk-btn tk-btn-primary tk-btn-lg"
              style={{ width: '100%', marginTop: 20 }}
            >
              Réserver
            </button>
            <p
              style={{
                fontSize: 12,
                color: 'var(--charcoal-400)',
                textAlign: 'center',
                marginTop: 10,
                lineHeight: 1.45,
              }}
            >
              Vous ne serez débité qu'à l'acceptation par le pro (sous 48 h).
            </p>

            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid var(--cream-200)',
              }}
            >
              <button className="tk-btn tk-btn-secondary tk-btn-sm" style={{ flex: 1 }}>
                <Icon name="message" size={14} /> Poser une question
              </button>
              <button className="tk-btn tk-btn-ghost tk-btn-sm" style={{ width: 36, padding: 0 }}>
                <Icon name="heart" size={16} />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 16, color: 'var(--charcoal-800)' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function OptionRow({ label, price }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: 'var(--cream-50)',
        border: '1px solid var(--cream-200)',
        borderRadius: 'var(--radius)',
      }}
    >
      <span
        style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid var(--cream-300)' }}
      />
      <span style={{ flex: 1, fontSize: 14, color: 'var(--charcoal-700)' }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--charcoal-700)', fontWeight: 500 }}>{price}</span>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ background: 'var(--cream-50)', padding: '10px 12px' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--charcoal-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--charcoal-700)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Line({ label, value, muted, bold, small }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: small ? 12 : 14,
        color: muted ? 'var(--charcoal-500)' : 'var(--charcoal-700)',
        fontWeight: bold ? 600 : 400,
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontFamily: bold ? 'var(--font-display)' : 'inherit',
          fontSize: bold ? 18 : 'inherit',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Review({ name, date, rating, body }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={name} size={32} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--charcoal-400)' }}>{date}</div>
        </div>
        <span style={{ marginLeft: 'auto' }}>
          <Stars value={rating} showCount={false} size={12} />
        </span>
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--charcoal-600)' }}>« {body} »</p>
    </div>
  );
}

window.ServiceScreen = ServiceScreen;
