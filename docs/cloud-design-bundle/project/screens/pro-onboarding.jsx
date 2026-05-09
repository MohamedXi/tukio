/* Pro onboarding — wizard step "Créer une fiche service"
   step indicator + form sections + assistant tips */

function ProOnboardingScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 40px',
          borderBottom: '1px solid var(--cream-200)',
        }}
      >
        <Logo size={22} />
        <span style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
          Sauvegardé en brouillon · il y a 2 min
        </span>
        <button className="tk-btn tk-btn-ghost tk-btn-sm">Continuer plus tard</button>
      </header>

      {/* Step indicator */}
      <div style={{ padding: '32px 40px 16px', borderBottom: '1px solid var(--cream-200)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginBottom: 16 }}>
            Étape 4 sur 7 · Créer votre première fiche service
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['Profil', 'SIRET', 'RIB', 'Service', 'Photos', 'Tarifs', 'Disponibilités'].map(
              (label, i) => (
                <Step key={label} label={label} index={i} current={3} />
              ),
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 48,
          padding: '40px 40px 64px',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <div>
          <Kicker>Étape 4 — Service</Kicker>
          <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 8 }}>Décrivez votre service</h1>
          <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 6, maxWidth: 560 }}>
            Plus votre fiche est précise, plus vous attirez les bons clients. On vous guide à chaque
            étape.
          </p>

          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 28 }}>
            <Field label="Catégorie" required>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <CatTile icon="tent" label="Tentes & chapiteaux" selected />
                <CatTile icon="chair" label="Mobilier" />
                <CatTile icon="package" label="Pack complet" />
              </div>
            </Field>

            <Field label="Sous-catégorie" required>
              <select className="tk-input" style={{ height: 44 }} defaultValue="bamboo">
                <option value="bamboo">Chapiteau bambou</option>
                <option>Tente stretch</option>
                <option>Tente garden</option>
                <option>Pagode</option>
              </select>
            </Field>

            <Field
              label="Titre de l'annonce"
              required
              hint="Soyez précis — type, dimension, capacité."
            >
              <input
                className="tk-input"
                style={{ height: 44 }}
                defaultValue="Chapiteau bambou 8×12 m — toile crème"
              />
              <div
                style={{
                  marginTop: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: 'var(--charcoal-400)',
                }}
              >
                <span>Au moins 8 mots, soyez descriptif</span>
                <span>43 / 80</span>
              </div>
            </Field>

            <Field
              label="Description"
              required
              hint="Décrivez le service, ce qui est inclus, ce qui ne l'est pas."
            >
              <textarea
                className="tk-input"
                style={{ height: 120, padding: 12, resize: 'vertical' }}
                defaultValue="Chapiteau bambou écoresponsable, conçu et fabriqué en Pays de la Loire. La structure en bambou apporte une élégance naturelle, parfaite pour un mariage en extérieur ou un événement corporate haut de gamme..."
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Field label="Capacité min." hint="personnes">
                <input className="tk-input" style={{ height: 44 }} defaultValue="80" />
              </Field>
              <Field label="Capacité max." hint="personnes">
                <input className="tk-input" style={{ height: 44 }} defaultValue="120" />
              </Field>
            </div>

            <Field
              label="Tags secondaires"
              hint="3 max — aide les clients à trouver votre service."
            >
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Tag label="Mariage" selected />
                <Tag label="Corporate" selected />
                <Tag label="Écoresponsable" selected />
                <Tag label="Anniversaire" />
                <Tag label="Festival" />
                <Tag label="Cocktail" />
                <Tag label="Bambou" />
                <Tag label="Vintage" />
              </div>
            </Field>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 48,
              paddingTop: 24,
              borderTop: '1px solid var(--cream-200)',
            }}
          >
            <button className="tk-btn tk-btn-secondary">
              <Icon name="arrowL" size={16} /> Précédent
            </button>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="tk-btn tk-btn-tertiary">Sauvegarder</button>
              <button className="tk-btn tk-btn-primary">
                Continuer aux photos <Icon name="arrow" size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: assistant */}
        <aside>
          <div
            style={{
              position: 'sticky',
              top: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div
              className="tk-card"
              style={{
                padding: 20,
                background: 'var(--brand-50)',
                borderColor: 'var(--brand-100)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--brand-500)',
                    color: 'var(--cream-50)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="sparkle" size={16} color="currentColor" strokeWidth={2} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-700)' }}>
                  Conseil tukio
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--charcoal-700)', lineHeight: 1.55 }}>
                Les fiches qui mentionnent <strong>la capacité réelle</strong> et{' '}
                <strong>les matériaux</strong> reçoivent en moyenne <strong>3× plus</strong> de
                demandes de réservation.
              </p>
            </div>

            <div className="tk-card" style={{ padding: 20 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--charcoal-700)',
                  marginBottom: 12,
                }}
              >
                Aperçu de la fiche
              </div>
              <Placeholder
                aspect="4 / 3"
                label="vos photos · étape 5"
                style={{ borderRadius: 'var(--radius)' }}
              />
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>
                  Chapiteau bambou 8×12 m
                </div>
                <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>
                  Atelier Tente Loire · Saint-Herblain
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--charcoal-400)',
                    marginTop: 6,
                    fontStyle: 'italic',
                  }}
                >
                  — prix défini à l'étape 6 —
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 16,
                background: 'var(--cream-100)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                gap: 10,
              }}
            >
              <Icon name="message" size={16} color="var(--charcoal-500)" />
              <div style={{ fontSize: 12, color: 'var(--charcoal-500)', lineHeight: 1.5 }}>
                Besoin d'aide ?{' '}
                <a style={{ color: 'var(--brand-700)', fontWeight: 500 }}>
                  Discuter avec un conseiller
                </a>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Step({ label, index, current }) {
  const done = index < current;
  const active = index === current;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: done
            ? 'var(--success-500)'
            : active
              ? 'var(--brand-500)'
              : 'var(--cream-200)',
        }}
      />
      <span
        style={{
          fontSize: 12,
          fontWeight: active ? 600 : 500,
          color: done ? 'var(--success-700)' : active ? 'var(--brand-700)' : 'var(--charcoal-400)',
        }}
      >
        {index + 1}. {label}
      </span>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="tk-label" style={{ marginBottom: 8 }}>
        {label} {required && <span style={{ color: 'var(--brand-500)' }}>*</span>}
      </label>
      {children}
      {hint && typeof hint === 'string' && (
        <div className="tk-helper" style={{ marginTop: 6 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function CatTile({ icon, label, selected }) {
  return (
    <button
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
        padding: 16,
        textAlign: 'left',
        background: selected ? 'var(--brand-50)' : 'var(--cream-50)',
        border: `1px solid ${selected ? 'var(--brand-500)' : 'var(--cream-300)'}`,
        borderRadius: 'var(--radius)',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius)',
          background: selected ? 'var(--brand-500)' : 'var(--cream-100)',
          color: selected ? 'var(--cream-50)' : 'var(--charcoal-600)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={20} color="currentColor" />
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal-700)' }}>{label}</span>
    </button>
  );
}

function Tag({ label, selected }) {
  return (
    <button
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 500,
        background: selected ? 'var(--brand-500)' : 'var(--cream-50)',
        color: selected ? 'var(--cream-50)' : 'var(--charcoal-600)',
        border: `1px solid ${selected ? 'var(--brand-500)' : 'var(--cream-300)'}`,
      }}
    >
      {selected && <span style={{ marginRight: 4 }}>✓</span>}
      {label}
    </button>
  );
}

window.ProOnboardingScreen = ProOnboardingScreen;
