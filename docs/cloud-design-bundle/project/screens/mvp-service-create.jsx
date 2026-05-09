/* MVP · Service creation wizard — steps 1, 3, 5
   Step 2 is in seller-service-create.jsx, step 4 is in seller-service-pricing... wait,
   those screens are pricing/details. We add step 1 (catégorie), step 3 (photos), step 5 (preview). */

function SvcShell({ step, title, kicker, children }) {
  const labels = ['Catégorie', 'Détails', 'Photos & médias', 'Tarif & dispo', 'Aperçu'];
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo size={22} />
          <span style={{ fontSize: 13, color: 'var(--charcoal-400)' }}>
            · Création de fiche service
          </span>
        </div>
        <span style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
          Brouillon · sauvegardé il y a 30 s
        </span>
      </header>
      <div style={{ padding: '32px 40px 16px', borderBottom: '1px solid var(--cream-200)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', gap: 6 }}>
          {labels.map((l, i) => (
            <div key={l} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background:
                    i < step
                      ? 'var(--success-500)'
                      : i === step
                        ? 'var(--brand-500)'
                        : 'var(--cream-200)',
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: i === step ? 600 : 500,
                  color:
                    i < step
                      ? 'var(--success-700)'
                      : i === step
                        ? 'var(--brand-700)'
                        : 'var(--charcoal-400)',
                }}
              >
                {i + 1}. {l}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '40px 40px 64px' }}>
        <Kicker>
          Étape {step + 1} — {labels[step]}
        </Kicker>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 8 }}>{title}</h1>
        {kicker && (
          <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 6 }}>{kicker}</p>
        )}
        <div style={{ marginTop: 32 }}>{children}</div>
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
          <button className="tk-btn tk-btn-primary">
            Continuer <Icon name="arrow" size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 1 — Catégorie ──
function SvcCreateStep1Screen() {
  const cats = [
    {
      icon: 'tent',
      label: 'Tentes & chapiteaux',
      desc: 'Bambou, stretch, garden, pagode',
      count: 4,
      selected: true,
    },
    {
      icon: 'chair',
      label: 'Mobilier événementiel',
      desc: 'Tables, chaises, lounge, bar',
      count: 6,
    },
  ];
  const subs = [
    { label: 'Chapiteau bambou', selected: true },
    { label: 'Tente stretch' },
    { label: 'Tente garden' },
    { label: 'Pagode' },
  ];
  return (
    <SvcShell
      step={0}
      title="Quelle catégorie correspond à votre service ?"
      kicker="Pilote MVP : 2 catégories ouvertes en Pays de la Loire — tentes & mobilier."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {cats.map((c) => (
          <button
            key={c.label}
            style={{
              padding: 24,
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              background: c.selected ? 'var(--brand-50)' : 'var(--cream-50)',
              border: `1px solid ${c.selected ? 'var(--brand-500)' : 'var(--cream-300)'}`,
              borderRadius: 'var(--radius-md)',
            }}
          >
            <span
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: c.selected ? 'var(--brand-500)' : 'var(--cream-100)',
                color: c.selected ? 'var(--cream-50)' : 'var(--charcoal-600)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={c.icon} size={24} />
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--charcoal-800)' }}>
                {c.label}
              </div>
              <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
                {c.desc}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--charcoal-400)', marginTop: 'auto' }}>
              {c.count} sous-catégories
            </div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 32 }}>
        <label className="tk-label">Sous-catégorie *</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {subs.map((s) => (
            <Pill key={s.label} active={s.selected}>
              {s.label}
            </Pill>
          ))}
        </div>
      </div>
      <div
        style={{
          marginTop: 32,
          padding: 16,
          background: 'var(--info-50)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          gap: 12,
        }}
      >
        <Icon name="sparkle" size={18} color="var(--info-700)" />
        <div style={{ fontSize: 13, color: 'var(--info-700)', lineHeight: 1.55 }}>
          La taxonomie tukio est figée et gérée par les admins (décision C-02). Les nouvelles
          catégories arriveront en V1 selon la demande pro.
        </div>
      </div>
    </SvcShell>
  );
}

// ── Step 3 — Photos ──
function SvcCreateStep3Screen() {
  const tiles = [
    { primary: true, label: 'photo principale' },
    { label: 'vue de jour' },
    { label: 'intérieur' },
    { label: 'détail structure' },
    { label: 'événement réel' },
    { label: '+ ajouter' },
  ];
  return (
    <SvcShell
      step={2}
      title="Mettez en valeur votre service"
      kicker="3 photos minimum, 15 maximum. Les fiches avec 8+ photos reçoivent 2× plus de demandes."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {tiles.map((t, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <Placeholder aspect="4 / 3" label={t.label} style={{ borderRadius: 'var(--radius)' }} />
            {t.primary && (
              <span
                className="tk-badge tk-badge-brand"
                style={{ position: 'absolute', top: 8, left: 8 }}
              >
                ★ Principale
              </span>
            )}
            {!t.label.startsWith('+') && (
              <button
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--charcoal-700)',
                  color: 'var(--cream-50)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="x" size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 32,
          padding: 24,
          background: 'var(--cream-100)',
          borderRadius: 'var(--radius-md)',
          border: '2px dashed var(--cream-300)',
          textAlign: 'center',
        }}
      >
        <Icon name="upload" size={28} color="var(--charcoal-500)" />
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12 }}>Glissez vos photos ici</div>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 4 }}>
          JPG ou PNG · 2 Mo max par fichier · 5 photos restantes
        </div>
        <button className="tk-btn tk-btn-secondary tk-btn-sm" style={{ marginTop: 12 }}>
          Parcourir mes fichiers
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        <label className="tk-label">Vidéo (V1)</label>
        <input
          className="tk-input"
          placeholder="Lien YouTube ou Vimeo (optionnel)"
          disabled
          style={{ opacity: 0.5 }}
        />
        <div className="tk-helper" style={{ marginTop: 6 }}>
          Disponible en V1 · vous serez prévenu·e dès l'ouverture
        </div>
      </div>
    </SvcShell>
  );
}

// ── Step 5 — Aperçu ──
function SvcCreateStep5Screen() {
  return (
    <SvcShell
      step={4}
      title="Tout est prêt. Aperçu avant publication."
      kicker="Votre fiche sera publiée immédiatement — vous êtes vérifié·e depuis plus de 30 jours."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32 }}>
        <div className="tk-card" style={{ overflow: 'hidden' }}>
          <Placeholder aspect="16 / 9" label="aperçu fiche service" />
          <div style={{ padding: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>Chapiteau bambou 8×12 m — toile crème</h2>
              <span className="tk-badge tk-badge-brand">brouillon</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 8,
                fontSize: 13,
                color: 'var(--charcoal-500)',
              }}
            >
              <Icon name="pin" size={14} /> Saint-Herblain · 80 km
              <span>·</span>
              <Icon name="user" size={14} /> 80 à 120 personnes
            </div>
            <hr className="tk-hr" style={{ margin: '20px 0' }} />
            <p style={{ fontSize: 14, color: 'var(--charcoal-600)', lineHeight: 1.6 }}>
              Chapiteau bambou écoresponsable, fabriqué en Pays de la Loire. Structure 8×12 m, toile
              crème, montage et démontage inclus dans un rayon de 80 km autour de Saint-Herblain…
            </p>
            <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Pill active>Mariage</Pill>
              <Pill active>Corporate</Pill>
              <Pill active>Écoresponsable</Pill>
            </div>
            <hr className="tk-hr" style={{ margin: '20px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  fontWeight: 500,
                  color: 'var(--brand-700)',
                }}
              >
                1 280 €
              </span>
              <span style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
                HT · forfait week-end
              </span>
            </div>
          </div>
        </div>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="tk-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              Checklist de qualité
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CheckItem label="Titre descriptif (43 / 80 c.)" ok />
              <CheckItem label="Description &gt; 100 caractères" ok />
              <CheckItem label="5 photos · 3 minimum" ok />
              <CheckItem label="Tags secondaires (3)" ok />
              <CheckItem label="Politique d'annulation choisie" ok />
              <CheckItem label="Vidéo de présentation" warn />
            </div>
          </div>
          <div
            className="tk-card"
            style={{ padding: 20, background: 'var(--success-50)', borderColor: 'transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Icon name="check" size={18} color="var(--success-700)" strokeWidth={2.5} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--success-700)' }}>
                Auto-publication activée
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--success-700)', lineHeight: 1.5 }}>
              Vous êtes vérifié·e depuis 4 mois et n'avez aucun signalement. Votre fiche sera
              visible immédiatement.
            </div>
          </div>
          <button
            className="tk-btn tk-btn-primary tk-btn-lg"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Publier maintenant
          </button>
          <button className="tk-btn tk-btn-tertiary tk-btn-sm" style={{ width: '100%' }}>
            Sauvegarder en brouillon
          </button>
        </aside>
      </div>
    </SvcShell>
  );
}

function CheckItem({ label, ok, warn }) {
  const tone = ok
    ? { c: 'var(--success-700)', icon: 'check' }
    : warn
      ? { c: 'var(--warning-700)', icon: 'clock' }
      : { c: 'var(--charcoal-400)', icon: 'x' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tone.c }}>
      <Icon name={tone.icon} size={14} strokeWidth={2} /> {label}
    </div>
  );
}

window.SvcCreateStep1Screen = SvcCreateStep1Screen;
window.SvcCreateStep3Screen = SvcCreateStep3Screen;
window.SvcCreateStep5Screen = SvcCreateStep5Screen;
