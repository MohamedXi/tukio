/* MVP · Pro onboarding wizard — steps 1, 2, 4, 5 + pending validation
   Step 3 is in pro-onboarding.jsx (already exists).
   Shared OnbShell + OnbStep indicator. */

function OnbShell({
  step,
  children,
  title,
  kicker,
  primary = 'Continuer',
  secondary = 'Précédent',
  showSecondary = true,
}) {
  const labels = ['Identité', 'Activité', 'Documents', 'Paiement', 'Récap'];
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
          Brouillon · sauvegardé il y a 1 min
        </span>
        <button className="tk-btn tk-btn-ghost tk-btn-sm">Continuer plus tard</button>
      </header>
      <div style={{ padding: '32px 40px 16px', borderBottom: '1px solid var(--cream-200)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginBottom: 16 }}>
            Étape {step + 1} sur 5 · Devenir pro sur tukio
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
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
      </div>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 40px 64px' }}>
        <Kicker>
          Étape {step + 1} — {labels[step]}
        </Kicker>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 8 }}>{title}</h1>
        {kicker && (
          <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 6 }}>{kicker}</p>
        )}
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {children}
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
          {showSecondary ? (
            <button className="tk-btn tk-btn-secondary">
              <Icon name="arrowL" size={16} /> {secondary}
            </button>
          ) : (
            <span />
          )}
          <button className="tk-btn tk-btn-primary">
            {primary} <Icon name="arrow" size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

function OnbField({ label, required, hint, children }) {
  return (
    <div>
      <label className="tk-label" style={{ marginBottom: 8 }}>
        {label} {required && <span style={{ color: 'var(--brand-500)' }}>*</span>}
      </label>
      {children}
      {hint && (
        <div className="tk-helper" style={{ marginTop: 6 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ── Step 1 — Identité ──
function ProOnbStep1Screen() {
  return (
    <OnbShell
      step={0}
      title="Qui êtes-vous ?"
      kicker="Vos informations personnelles. Tukio les conserve confidentiellement."
      showSecondary={false}
      secondary="Annuler"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <OnbField label="Prénom" required>
          <input className="tk-input" defaultValue="Léa" />
        </OnbField>
        <OnbField label="Nom" required>
          <input className="tk-input" defaultValue="Martineau" />
        </OnbField>
      </div>
      <OnbField
        label="Email professionnel"
        required
        hint="Sera utilisé pour les notifications de réservation"
      >
        <input className="tk-input" defaultValue="lea@ateliertenteloire.fr" />
      </OnbField>
      <OnbField
        label="Téléphone"
        required
        hint="Visible des clients après acceptation d'une réservation uniquement"
      >
        <input className="tk-input" defaultValue="+33 6 24 56 78 90" />
      </OnbField>
      <OnbField label="Date de naissance" required>
        <input className="tk-input" defaultValue="14 / 09 / 1989" />
      </OnbField>
      <div
        style={{
          padding: 16,
          background: 'var(--brand-50)',
          border: '1px solid var(--brand-100)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          gap: 12,
        }}
      >
        <Icon name="shield" size={20} color="var(--brand-700)" />
        <div style={{ fontSize: 13, color: 'var(--brand-700)', lineHeight: 1.55 }}>
          Vos données personnelles sont protégées et conformes au RGPD. Elles ne seront jamais
          partagées sans votre consentement explicite.
        </div>
      </div>
    </OnbShell>
  );
}

// ── Step 2 — Activité ──
function ProOnbStep2Screen() {
  return (
    <OnbShell
      step={1}
      title="Parlez-nous de votre activité"
      kicker="Ces informations sont publiques sur votre vitrine pro."
    >
      <OnbField label="Nom commercial" required hint="Le nom qui apparaîtra sur votre vitrine">
        <input className="tk-input" defaultValue="Atelier Tente Loire" />
      </OnbField>
      <OnbField label="SIRET" required hint="14 chiffres — utilisé pour la facturation">
        <input className="tk-input" defaultValue="852 478 901 00018" />
      </OnbField>
      <OnbField label="Forme juridique" required>
        <select className="tk-input">
          <option>SAS / SASU</option>
          <option>EURL / SARL</option>
          <option>Micro-entreprise</option>
          <option>Auto-entrepreneur</option>
          <option>Association loi 1901</option>
        </select>
      </OnbField>
      <OnbField label="Statut TVA" required>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <RadioCard label="Assujetti" desc="Vos prix sont en HT, TVA 20 % ajoutée" selected />
          <RadioCard label="Non assujetti" desc="Franchise en base — TVA non applicable" />
        </div>
      </OnbField>
      <OnbField
        label="Catégories d'activité"
        required
        hint="2 maximum au MVP — vous pourrez en ajouter plus tard"
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            'Tentes & chapiteaux',
            'Mobilier événementiel',
            'Décoration',
            'Lumière & son',
            'Traiteur',
            'Animation',
          ].map((c, i) => (
            <Pill key={c} active={i < 2}>
              {c}
            </Pill>
          ))}
        </div>
      </OnbField>
      <OnbField label="Zone d'intervention" required hint="Où livrez-vous ?">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            background: 'var(--cream-100)',
            borderRadius: 'var(--radius)',
          }}
        >
          <Icon name="pin" size={18} color="var(--brand-500)" />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Saint-Herblain</span>
          <span style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>· rayon 80 km</span>
          <span
            style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--brand-700)', fontWeight: 500 }}
          >
            Modifier
          </span>
        </div>
      </OnbField>
    </OnbShell>
  );
}

// ── Step 4 — Compte de paiement Stripe ──
function ProOnbStep4Screen() {
  return (
    <OnbShell
      step={3}
      title="Recevez vos paiements en toute sécurité"
      kicker="Tukio utilise Stripe Connect — leader européen du paiement marketplace."
    >
      <div
        style={{
          padding: 24,
          background: 'var(--cream-50)',
          border: '1px solid var(--cream-200)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: '#635BFF',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 24,
              fontFamily: 'var(--font-display)',
            }}
          >
            S
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              Configurer mon compte Stripe Connect
            </div>
            <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
              5-10 min · KYC géré directement par Stripe
            </div>
          </div>
        </div>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {[
            "Pièce d'identité (CNI ou passeport)",
            'RIB de votre compte professionnel',
            "Adresse de l'entreprise",
            'KBIS récent (- 3 mois) si SAS / SARL',
          ].map((t) => (
            <li
              key={t}
              style={{ display: 'flex', gap: 10, fontSize: 14, color: 'var(--charcoal-700)' }}
            >
              <Icon name="check" size={16} color="var(--success-700)" strokeWidth={2.5} /> {t}
            </li>
          ))}
        </ul>
        <button
          className="tk-btn tk-btn-primary tk-btn-lg"
          style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}
        >
          Lancer la configuration Stripe <Icon name="arrow" size={16} strokeWidth={2} />
        </button>
      </div>
      <div
        style={{
          padding: 16,
          background: 'var(--info-50)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          gap: 12,
        }}
      >
        <Icon name="shield" size={20} color="var(--info-700)" />
        <div style={{ fontSize: 13, color: 'var(--info-700)', lineHeight: 1.55 }}>
          <strong>Pourquoi Stripe ?</strong> Vos coordonnées bancaires ne transitent jamais par
          Tukio. Stripe gère les fonds, la conformité PSD2 et vous reverse vos gains à J+1 après
          l'événement.
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--charcoal-500)', textAlign: 'center' }}>
        Délai habituel de validation Stripe : <strong>24 à 72 h ouvrées</strong>
      </div>
    </OnbShell>
  );
}

// ── Step 5 — Récap ──
function ProOnbStep5Screen() {
  const items = [
    { label: 'Identité', value: 'Léa Martineau · lea@ateliertenteloire.fr', icon: 'user' },
    {
      label: 'Activité',
      value: 'Atelier Tente Loire · SAS · SIRET 852 478 901 00018',
      icon: 'building',
    },
    { label: 'Catégories', value: 'Tentes & chapiteaux + Mobilier événementiel', icon: 'tent' },
    { label: 'Documents', value: 'CNI + KBIS + RIB · uploadés', icon: 'doc' },
    { label: 'Stripe Connect', value: 'Compte créé · validation Stripe en cours', icon: 'card' },
  ];
  return (
    <OnbShell
      step={4}
      title="Tout est prêt."
      kicker="Vérifiez votre dossier avant soumission. Un admin Tukio le validera sous 24 h."
      primary="Soumettre mon dossier"
    >
      <div className="tk-card" style={{ padding: 8 }}>
        {items.map((it, i) => (
          <div
            key={it.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '16px 20px',
              borderTop: i ? '1px solid var(--cream-200)' : 'none',
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--brand-50)',
                color: 'var(--brand-700)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={it.icon} size={18} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--charcoal-500)' }}>{it.label}</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--charcoal-800)',
                  marginTop: 2,
                }}
              >
                {it.value}
              </div>
            </div>
            <button style={{ fontSize: 12, color: 'var(--brand-700)', fontWeight: 500 }}>
              Modifier
            </button>
          </div>
        ))}
      </div>
      <label
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          fontSize: 13,
          color: 'var(--charcoal-600)',
          lineHeight: 1.55,
          padding: 16,
          background: 'var(--cream-100)',
          borderRadius: 'var(--radius)',
        }}
      >
        <input type="checkbox" defaultChecked style={{ marginTop: 3 }} />
        <span>
          Je certifie l'exactitude des informations fournies. Je m'engage à respecter la{' '}
          <a style={{ color: 'var(--brand-700)', fontWeight: 500 }}>charte des pros tukio</a>,
          notamment l'obligation de réponse sous 24 h et la non-désintermédiation des clients.
        </span>
      </label>
    </OnbShell>
  );
}

// ── Pending validation screen ──
function ProOnbPendingScreen() {
  return (
    <div
      className="tk-root"
      style={{
        width: '100%',
        minHeight: '100%',
        background: 'var(--cream-50)',
        display: 'flex',
        flexDirection: 'column',
      }}
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
        <button className="tk-btn tk-btn-ghost tk-btn-sm">Se déconnecter</button>
      </header>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        }}
      >
        <div style={{ maxWidth: 640, textAlign: 'center' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'var(--warning-50)',
              color: 'var(--warning-700)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <Icon name="clock" size={40} strokeWidth={2} />
          </div>
          <Kicker color="var(--warning-700)">Dossier en revue</Kicker>
          <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 8 }}>
            Votre dossier est entre les mains d'un admin tukio.
          </h1>
          <p
            style={{ fontSize: 16, color: 'var(--charcoal-500)', marginTop: 12, lineHeight: 1.55 }}
          >
            Délai habituel :{' '}
            <strong style={{ color: 'var(--charcoal-700)' }}>moins de 24 h ouvrées</strong>. Vous
            recevrez un email dès que votre compte sera vérifié.
          </p>

          <div className="tk-card" style={{ marginTop: 32, padding: 24, textAlign: 'left' }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--charcoal-700)',
                marginBottom: 16,
              }}
            >
              Pendant ce temps, vous pouvez préparer votre vitrine :
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <PendingTask
                icon="tent"
                label="Brouillon de fiche service"
                desc="Préparez vos titres, descriptions, tarifs"
              />
              <PendingTask
                icon="upload"
                label="Photos d'événements réels"
                desc="3 minimum, 8 recommandés par fiche"
              />
              <PendingTask
                icon="settings"
                label="Politique d'annulation"
                desc="Souple, standard ou stricte — au choix"
              />
            </div>
          </div>

          <div style={{ marginTop: 24, fontSize: 13, color: 'var(--charcoal-500)' }}>
            Une question ?{' '}
            <a style={{ color: 'var(--brand-700)', fontWeight: 500 }}>support@tukio.one</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingTask({ icon, label, desc }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: 12,
        borderRadius: 'var(--radius)',
        background: 'var(--cream-50)',
        border: '1px solid var(--cream-200)',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'var(--cream-200)',
          color: 'var(--charcoal-600)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={18} />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--charcoal-800)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>{desc}</div>
      </div>
      <Icon name="arrow" size={16} color="var(--charcoal-400)" />
    </div>
  );
}

function RadioCard({ label, desc, selected }) {
  return (
    <button
      style={{
        padding: 16,
        textAlign: 'left',
        background: selected ? 'var(--brand-50)' : 'var(--cream-50)',
        border: `1px solid ${selected ? 'var(--brand-500)' : 'var(--cream-300)'}`,
        borderRadius: 'var(--radius)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: selected ? 'var(--brand-700)' : 'var(--charcoal-700)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12, color: 'var(--charcoal-500)' }}>{desc}</span>
    </button>
  );
}

window.ProOnbStep1Screen = ProOnbStep1Screen;
window.ProOnbStep2Screen = ProOnbStep2Screen;
window.ProOnbStep4Screen = ProOnbStep4Screen;
window.ProOnbStep5Screen = ProOnbStep5Screen;
window.ProOnbPendingScreen = ProOnbPendingScreen;
