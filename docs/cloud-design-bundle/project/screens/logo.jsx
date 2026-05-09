/* Logo lockup — 3 directions for tukio.one */

function LogoExplorationScreen() {
  return (
    <div
      className="tk-root"
      style={{
        width: '100%',
        minHeight: '100%',
        padding: '48px 56px',
        background: 'var(--cream-50)',
      }}
    >
      <div style={{ marginBottom: 40 }}>
        <Kicker>Wordmark — exploration</Kicker>
        <h1 style={{ fontSize: 'var(--text-4xl)', marginTop: 8 }}>
          Trois directions pour tukio.one
        </h1>
        <p style={{ fontSize: 16, color: 'var(--charcoal-500)', marginTop: 8, maxWidth: 640 }}>
          Toutes en Fraunces (display, serif chaleureux). Le ".one" est traité comme une signature,
          pas comme un suffixe.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        {/* A · Arch */}
        <LogoCard
          letter="A"
          name="Arche"
          desc="Pictogramme arche/tente — point de rendez-vous. Marque et wordmark séparables."
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 20 C 6 8, 18 8, 21 20"
                stroke="var(--brand-500)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="6" r="1.6" fill="var(--brand-500)" />
            </svg>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 56,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                color: 'var(--charcoal-800)',
              }}
            >
              tukio<span style={{ color: 'var(--brand-500)' }}>.</span>
              <span style={{ color: 'var(--charcoal-500)', fontWeight: 400 }}>one</span>
            </span>
          </div>
        </LogoCard>

        {/* B · Italic accent */}
        <LogoCard
          letter="B"
          name="Italique éditorial"
          desc="Pas de pictogramme. ‹one› en italique Fraunces — signe une marque éditoriale, premium."
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 64,
              fontWeight: 400,
              letterSpacing: '-0.025em',
              color: 'var(--charcoal-800)',
            }}
          >
            tukio<span style={{ color: 'var(--brand-500)' }}>.</span>
            <em style={{ fontStyle: 'italic', color: 'var(--brand-600)', fontWeight: 400 }}>one</em>
          </span>
        </LogoCard>

        {/* C · Mono dot */}
        <LogoCard
          letter="C"
          name="Point ancré"
          desc="Le ‹.one› devient une étiquette mono — code postal, repère géographique. Plus utilitaire."
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 64,
                fontWeight: 500,
                letterSpacing: '-0.025em',
                color: 'var(--charcoal-800)',
              }}
            >
              tukio
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                color: 'var(--cream-50)',
                background: 'var(--brand-500)',
                padding: '5px 10px',
                borderRadius: 4,
                letterSpacing: '0.05em',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              .one
            </span>
          </div>
        </LogoCard>
      </div>

      {/* Sizes & contexts */}
      <h2 style={{ fontSize: 'var(--text-2xl)', marginTop: 56, marginBottom: 20 }}>
        Échelles & contextes — direction A retenue
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ContextCard label="Header desktop" bg="var(--cream-50)">
          <Logo size={28} showDomain={true} />
        </ContextCard>
        <ContextCard label="Sur fond foncé" bg="var(--charcoal-700)">
          <Logo size={28} showDomain={true} mono color="var(--cream-50)" />
        </ContextCard>
        <ContextCard label="Mobile · 18 px" bg="var(--cream-50)">
          <Logo size={18} showDomain={true} />
        </ContextCard>
        <ContextCard label="Favicon · 24 px" bg="var(--brand-500)">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 20 C 6 8, 18 8, 21 20"
              stroke="var(--cream-50)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="12" cy="6" r="1.8" fill="var(--cream-50)" />
          </svg>
        </ContextCard>
      </div>
    </div>
  );
}

function LogoCard({ letter, name, desc, children }) {
  return (
    <div
      style={{
        padding: '40px 32px',
        background: 'var(--cream-100)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--cream-200)',
        display: 'grid',
        gridTemplateColumns: '60px 1fr 1fr',
        gap: 32,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 24,
          fontWeight: 600,
          color: 'var(--brand-600)',
        }}
      >
        {letter}
      </span>
      <div style={{ display: 'flex', alignItems: 'center' }}>{children}</div>
      <div>
        <div
          style={{ fontSize: 16, fontWeight: 600, color: 'var(--charcoal-800)', marginBottom: 6 }}
        >
          {name}
        </div>
        <div style={{ fontSize: 13, color: 'var(--charcoal-500)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

function ContextCard({ label, bg, children }) {
  return (
    <div
      style={{
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--cream-200)',
      }}
    >
      <div
        style={{
          background: bg,
          padding: '32px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 110,
        }}
      >
        {children}
      </div>
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--cream-50)',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--charcoal-500)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

window.LogoExplorationScreen = LogoExplorationScreen;
