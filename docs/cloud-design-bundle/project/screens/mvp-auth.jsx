/* MVP · Authentication screens — Keycloak hosted pages, styled Tukio.
   Inscription client, connexion, reset, vérification email.
   All 4 screens share AuthShell — a warm split layout with editorial side. */

function AuthShell({ side = 'right', children, kicker, title, subtitle, foot }) {
  const formCol = (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '48px 80px',
        background: 'var(--cream-50)',
      }}
    >
      <Logo size={24} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          maxWidth: 440,
          width: '100%',
          marginInline: 'auto',
          paddingBlock: 40,
        }}
      >
        {kicker && (
          <div style={{ marginBottom: 12 }}>
            <Kicker>{kicker}</Kicker>
          </div>
        )}
        <h1 style={{ fontSize: 'var(--text-3xl)', lineHeight: 1.1, marginBottom: 12 }}>{title}</h1>
        {subtitle && (
          <p
            style={{
              fontSize: 15,
              color: 'var(--charcoal-500)',
              marginBottom: 32,
              lineHeight: 1.55,
            }}
          >
            {subtitle}
          </p>
        )}
        {children}
      </div>
      <div style={{ fontSize: 12, color: 'var(--charcoal-400)', display: 'flex', gap: 16 }}>
        {foot || (
          <>
            <a>CGU</a>
            <a>Politique de confidentialité</a>
            <span style={{ marginLeft: 'auto' }}>© tukio.one · 2026</span>
          </>
        )}
      </div>
    </div>
  );

  const editorialCol = (
    <div
      style={{
        flex: 1,
        position: 'relative',
        background: 'var(--brand-700)',
        color: 'var(--cream-50)',
        padding: '64px 64px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Placeholder
        label="event hero · loire-atlantique"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, var(--brand-800), var(--brand-600))',
          border: 'none',
          borderRadius: 0,
          opacity: 0.92,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', maxWidth: 480 }}>
        <Kicker color="var(--brand-200)">Pays de la loire · pilote 2026</Kicker>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 38,
            lineHeight: 1.15,
            marginTop: 16,
            marginBottom: 24,
            color: 'var(--cream-50)',
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
        >
          « Notre première location s'est faite trois jours après l'inscription. Le client était à
          12 km. »
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name="Léa M" size={40} tone="brand" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Léa Martineau</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Atelier Tente Loire — pro depuis mars 2026
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="tk-root" style={{ width: '100%', minHeight: '100%', display: 'flex' }}>
      {side === 'right' ? (
        <>
          {formCol}
          {editorialCol}
        </>
      ) : (
        <>
          {editorialCol}
          {formCol}
        </>
      )}
    </div>
  );
}

// ── 1. Inscription client ─────────────────────────────────────────────
function AuthSignupClientScreen() {
  return (
    <AuthShell
      kicker="Créer un compte · client"
      title="Trouvez les bons pros pour votre événement"
      subtitle="30 secondes, pas de carte bancaire. Vous payez uniquement quand vous réservez."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SocialBtn provider="google" />
        <SocialBtn provider="apple" />
        <Sep label="ou par email" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="tk-label">Prénom</label>
            <input className="tk-input" defaultValue="Camille" />
          </div>
          <div>
            <label className="tk-label">Nom</label>
            <input className="tk-input" defaultValue="Renaud" />
          </div>
        </div>
        <div>
          <label className="tk-label">Email</label>
          <input className="tk-input" defaultValue="camille@gmail.com" />
        </div>
        <div>
          <label className="tk-label">Mot de passe</label>
          <input className="tk-input" type="password" defaultValue="••••••••••••" />
          <div className="tk-helper" style={{ marginTop: 6 }}>
            <span style={{ color: 'var(--success-700)' }}>● Fort</span> · 12 caractères, majuscule,
            chiffre, symbole
          </div>
        </div>

        <label
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            fontSize: 13,
            color: 'var(--charcoal-500)',
            lineHeight: 1.5,
          }}
        >
          <input type="checkbox" defaultChecked style={{ marginTop: 3 }} />
          <span>
            J'accepte les <a style={{ color: 'var(--brand-700)', fontWeight: 500 }}>CGU</a> et la{' '}
            <a style={{ color: 'var(--brand-700)', fontWeight: 500 }}>
              politique de confidentialité
            </a>
          </span>
        </label>

        <button className="tk-btn tk-btn-primary tk-btn-lg" style={{ marginTop: 8 }}>
          Créer mon compte
        </button>

        <div
          style={{ fontSize: 13, color: 'var(--charcoal-500)', textAlign: 'center', marginTop: 8 }}
        >
          Déjà un compte ?{' '}
          <a style={{ color: 'var(--brand-700)', fontWeight: 500 }}>Se connecter</a>
        </div>
        <div
          style={{ fontSize: 12, color: 'var(--charcoal-400)', textAlign: 'center', marginTop: 4 }}
        >
          Vous êtes professionnel ?{' '}
          <a style={{ color: 'var(--charcoal-600)', fontWeight: 500 }}>Devenir pro sur tukio</a>
        </div>
      </div>
    </AuthShell>
  );
}

// ── 2. Connexion ──────────────────────────────────────────────────────
function AuthLoginScreen() {
  return (
    <AuthShell
      side="left"
      kicker="Connexion"
      title="Bon retour."
      subtitle="Connectez-vous pour suivre vos demandes ou répondre à vos clients."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SocialBtn provider="google" />
        <SocialBtn provider="apple" />
        <Sep label="ou par email" />

        <div>
          <label className="tk-label">Email</label>
          <input className="tk-input" defaultValue="camille@gmail.com" />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label className="tk-label">Mot de passe</label>
            <a style={{ fontSize: 12, color: 'var(--brand-700)', fontWeight: 500 }}>Oublié ?</a>
          </div>
          <input className="tk-input" type="password" defaultValue="••••••••••••" />
        </div>

        <label
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            fontSize: 13,
            color: 'var(--charcoal-500)',
          }}
        >
          <input type="checkbox" defaultChecked /> Me garder connectée
        </label>

        <button className="tk-btn tk-btn-primary tk-btn-lg" style={{ marginTop: 4 }}>
          Se connecter
        </button>

        <div
          style={{ fontSize: 13, color: 'var(--charcoal-500)', textAlign: 'center', marginTop: 12 }}
        >
          Pas encore de compte ?{' '}
          <a style={{ color: 'var(--brand-700)', fontWeight: 500 }}>S'inscrire</a>
        </div>
      </div>
    </AuthShell>
  );
}

// ── 3. Mot de passe oublié ────────────────────────────────────────────
function AuthResetScreen() {
  return (
    <AuthShell
      kicker="Mot de passe oublié"
      title="Réinitialiser votre mot de passe"
      subtitle="Saisissez l'email associé à votre compte. Vous recevrez un lien sécurisé valable 1 heure."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="tk-label">Email</label>
          <input className="tk-input" defaultValue="camille@gmail.com" />
        </div>

        <button className="tk-btn tk-btn-primary tk-btn-lg" style={{ marginTop: 4 }}>
          Envoyer le lien
        </button>

        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: 'var(--cream-100)',
            borderRadius: 'var(--radius)',
            fontSize: 13,
            color: 'var(--charcoal-500)',
            lineHeight: 1.55,
            display: 'flex',
            gap: 10,
          }}
        >
          <Icon name="shield" size={18} color="var(--charcoal-500)" />
          <span>
            Pour votre sécurité, nous ne précisons pas si l'email existe dans notre base. Si vous ne
            recevez rien après 5 min, vérifiez l'orthographe puis vos spams.
          </span>
        </div>

        <div
          style={{ fontSize: 13, color: 'var(--charcoal-500)', textAlign: 'center', marginTop: 12 }}
        >
          <a style={{ color: 'var(--brand-700)', fontWeight: 500 }}>← Retour à la connexion</a>
        </div>
      </div>
    </AuthShell>
  );
}

// ── 4. Vérification email ─────────────────────────────────────────────
function AuthVerifyEmailScreen() {
  return (
    <AuthShell
      side="left"
      kicker="Vérification email · étape finale"
      title="Vérifiez votre boîte mail."
      subtitle="Nous avons envoyé un lien à camille@gmail.com. Cliquez dessus pour activer votre compte."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Email envoyé visual */}
        <div
          style={{
            padding: 24,
            background: 'var(--cream-100)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--cream-300)',
            display: 'flex',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--success-50)',
              color: 'var(--success-700)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="check" size={28} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              Email envoyé à camille@gmail.com
            </div>
            <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 4 }}>
              Le lien expire dans 24 h. Pensez à vérifier vos spams.
            </div>
          </div>
        </div>

        <button className="tk-btn tk-btn-secondary tk-btn-lg" style={{ marginTop: 4 }}>
          <Icon name="repeat" size={16} /> Renvoyer l'email
          <span style={{ fontSize: 12, color: 'var(--charcoal-400)', marginLeft: 8 }}>
            (disponible dans 56 s)
          </span>
        </button>

        <div
          style={{
            padding: 16,
            background: 'var(--cream-100)',
            borderRadius: 'var(--radius)',
            fontSize: 13,
            color: 'var(--charcoal-500)',
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: 'var(--charcoal-700)' }}>Pas reçu ?</strong> Le délai est en
          général de 30 s. Si rien après 5 min, contactez{' '}
          <a style={{ color: 'var(--brand-700)' }}>support@tukio.one</a> ou{' '}
          <a style={{ color: 'var(--brand-700)' }}>changez d'email</a>.
        </div>

        <div
          style={{ fontSize: 13, color: 'var(--charcoal-400)', textAlign: 'center', marginTop: 12 }}
        >
          <a style={{ color: 'var(--charcoal-600)', fontWeight: 500 }}>← Se déconnecter</a>
        </div>
      </div>
    </AuthShell>
  );
}

// ── helpers ───────────────────────────────────────────────────────────
function SocialBtn({ provider }) {
  const cfg = {
    google: {
      label: 'Continuer avec Google',
      glyph: <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>G</span>,
    },
    apple: { label: 'Continuer avec Apple', glyph: <span style={{ fontSize: 18 }}>􀎟</span> },
  }[provider];
  return (
    <button
      className="tk-btn tk-btn-secondary tk-btn-lg"
      style={{ justifyContent: 'center', gap: 12 }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          background: 'var(--cream-50)',
          border: '1px solid var(--cream-300)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: 'var(--charcoal-700)',
        }}
      >
        {cfg.glyph}
      </span>
      {cfg.label}
    </button>
  );
}

function Sep({ label }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBlock: 4,
        color: 'var(--charcoal-400)',
        fontSize: 12,
      }}
    >
      <span style={{ flex: 1, height: 1, background: 'var(--cream-300)' }} />
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--cream-300)' }} />
    </div>
  );
}

window.AuthSignupClientScreen = AuthSignupClientScreen;
window.AuthLoginScreen = AuthLoginScreen;
window.AuthResetScreen = AuthResetScreen;
window.AuthVerifyEmailScreen = AuthVerifyEmailScreen;
