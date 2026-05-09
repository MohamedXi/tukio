/* Design system summary card — type, color, components */

function DesignSystemScreen() {
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
        <Kicker>Système de design v0</Kicker>
        <h1 style={{ fontSize: 'var(--text-4xl)', marginTop: 8 }}>tukio.one — fondations</h1>
        <p style={{ fontSize: 16, color: 'var(--charcoal-500)', marginTop: 8, maxWidth: 640 }}>
          Direction terracotta · neutres chauds · fonctionnels désaturés. Fraunces (display) + Inter
          (body). Modular scale 1.250.
        </p>
      </div>

      {/* Type scale */}
      <Block title="Typographie">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Tline
            label="Display 6xl · Fraunces 400"
            size={61}
            sample="Vos événements, réservés."
            display
          />
          <Tline
            label="H1 · 4xl · Fraunces 500"
            size={49}
            sample="Trouvez les bons pros près de chez vous"
            display
          />
          <Tline
            label="H2 · 3xl · Fraunces 500"
            size={39}
            sample="Disponibles ce week-end"
            display
          />
          <Tline
            label="H3 · 2xl · Fraunces 500"
            size={31}
            sample="Politique d'annulation"
            display
          />
          <Tline
            label="Body lg · Inter 400"
            size={20}
            sample="Tukio.one centralise les pros locaux."
          />
          <Tline
            label="Body · Inter 400"
            size={16}
            sample="Trouvez tentes, mobilier, traiteur — réservez en ligne."
          />
          <Tline label="Body sm · Inter 400" size={14} sample="Saint-Herblain · 8 km de Nantes" />
          <Tline label="Caption · Inter 500" size={12} sample="PRÈS DE NANTES · 142 PROS" mono />
        </div>
      </Block>

      {/* Palette */}
      <Block title="Palette — terracotta + neutres chauds">
        <div
          style={{
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--charcoal-500)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontWeight: 600,
          }}
        >
          Brand · terracotta
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, 1fr)',
            gap: 6,
            marginBottom: 24,
          }}
        >
          {['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].map((s) => (
            <Sw
              key={s}
              bg={`var(--brand-${s})`}
              label={s}
              primary={s === '500'}
              dark={parseInt(s) >= 400}
            />
          ))}
        </div>

        <div
          style={{
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--charcoal-500)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontWeight: 600,
          }}
        >
          Neutres · cream + charcoal
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, 1fr)',
            gap: 6,
            marginBottom: 24,
          }}
        >
          <Sw bg="var(--cream-50)" label="50" />
          <Sw bg="var(--cream-100)" label="100" />
          <Sw bg="var(--cream-200)" label="200" />
          <Sw bg="var(--cream-300)" label="300" />
          <Sw bg="var(--charcoal-400)" label="400" dark />
          <Sw bg="var(--charcoal-500)" label="500" dark />
          <Sw bg="var(--charcoal-600)" label="600" dark />
          <Sw bg="var(--charcoal-700)" label="700" dark />
          <Sw bg="var(--charcoal-800)" label="800" dark />
          <Sw bg="var(--charcoal-900)" label="900" dark />
        </div>

        <div
          style={{
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--charcoal-500)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontWeight: 600,
          }}
        >
          Fonctionnels · désaturés
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <FuncSw name="success" bg="var(--success-500)" sub="ECF1ED · 4D7C5E" />
          <FuncSw name="warning" bg="var(--warning-500)" sub="F8ECD9 · B45309" />
          <FuncSw name="error" bg="var(--error-500)" sub="FCE8E8 · B91C1C" />
          <FuncSw name="info" bg="var(--info-500)" sub="E2EEF3 · 1E5F7E" />
        </div>
      </Block>

      {/* Components */}
      <Block title="Composants clés">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div>
            <Sub>Boutons</Sub>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <button className="tk-btn tk-btn-primary">Réserver</button>
              <button className="tk-btn tk-btn-secondary">Contacter</button>
              <button className="tk-btn tk-btn-tertiary">Voir plus</button>
              <button className="tk-btn tk-btn-ghost">
                <Icon name="heart" size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="tk-btn tk-btn-primary tk-btn-sm">SM</button>
              <button className="tk-btn tk-btn-primary">MD</button>
              <button className="tk-btn tk-btn-primary tk-btn-lg">LG</button>
            </div>
          </div>

          <div>
            <Sub>Inputs</Sub>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="tk-label">Email</label>
                <input className="tk-input" placeholder="vous@exemple.fr" />
              </div>
              <div>
                <label className="tk-label">Code postal</label>
                <input
                  className="tk-input"
                  defaultValue="44120"
                  style={{
                    borderColor: 'var(--brand-500)',
                    boxShadow: '0 0 0 3px rgba(194, 65, 12, 0.18)',
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <Sub>Badges</Sub>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="tk-badge">Mariage</span>
              <span className="tk-badge tk-badge-brand">Top pro</span>
              <span className="tk-badge tk-badge-success">Vérifié</span>
              <span className="tk-badge tk-badge-warning">En attente</span>
              <span className="tk-badge tk-badge-info">B2B</span>
            </div>
          </div>

          <div>
            <Sub>Radius & shadow</Sub>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { r: 4, l: 'sm' },
                { r: 8, l: 'md' },
                { r: 12, l: 'lg' },
                { r: 16, l: 'xl' },
              ].map((x) => (
                <div
                  key={x.l}
                  style={{
                    flex: 1,
                    height: 56,
                    borderRadius: x.r,
                    background: 'var(--cream-100)',
                    border: '1px solid var(--cream-300)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: 'var(--charcoal-500)',
                  }}
                >
                  {x.l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Block>

      {/* Voice */}
      <Block title="Ton & voix">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div
            style={{
              padding: 20,
              background: 'var(--success-50)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div className="tk-mono" style={{ color: 'var(--success-700)', marginBottom: 10 }}>
              ✓ À utiliser
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: 14,
                lineHeight: 1.7,
                color: 'var(--charcoal-700)',
              }}
            >
              <li>"Réservez maintenant"</li>
              <li>"Le pro répondra sous 48 h."</li>
              <li>"Cette adresse n'est pas dans la zone…"</li>
              <li>Vouvoiement systématique · 1 200 €</li>
            </ul>
          </div>
          <div
            style={{ padding: 20, background: 'var(--error-50)', borderRadius: 'var(--radius-md)' }}
          >
            <div className="tk-mono" style={{ color: 'var(--error-700)', marginBottom: 10 }}>
              ✗ À éviter
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: 14,
                lineHeight: 1.7,
                color: 'var(--charcoal-700)',
              }}
            >
              <li>"Démarrez votre aventure 🎉"</li>
              <li>"Erreur" / "OK" / "Loading…"</li>
              <li>"Dashboard / Checkout / Listing"</li>
              <li>Tutoiement · $1,200.00</li>
            </ul>
          </div>
        </div>
      </Block>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <section
      style={{ marginBottom: 48, paddingBottom: 40, borderBottom: '1px solid var(--cream-200)' }}
    >
      <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 24 }}>{title}</h2>
      {children}
    </section>
  );
}

function Sub({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: 'var(--charcoal-500)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        fontWeight: 600,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function Tline({ label, size, sample, display, mono }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        gap: 24,
        alignItems: 'baseline',
        padding: '10px 0',
        borderBottom: '1px solid var(--cream-200)',
      }}
    >
      <span className="tk-mono" style={{ color: 'var(--charcoal-400)' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: size,
          fontFamily: display
            ? 'var(--font-display)'
            : mono
              ? 'var(--font-mono)'
              : 'var(--font-body)',
          fontWeight: display ? 500 : 400,
          letterSpacing: display ? '-0.02em' : mono ? '0.04em' : 0,
          color: 'var(--charcoal-800)',
          lineHeight: 1.2,
          textTransform: mono ? 'uppercase' : 'none',
        }}
      >
        {sample}
      </span>
    </div>
  );
}

function Sw({ bg, label, primary, dark }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          height: 56,
          background: bg,
          borderRadius: 6,
          border: '1px solid rgba(31, 29, 24, 0.06)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: 6,
        }}
      >
        {primary && (
          <span
            style={{
              fontSize: 9,
              color: 'var(--cream-50)',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
            }}
          >
            primary
          </span>
        )}
      </div>
      <span style={{ fontSize: 11, color: 'var(--charcoal-500)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </span>
    </div>
  );
}

function FuncSw({ name, bg, sub }) {
  return (
    <div
      style={{
        padding: 14,
        background: 'var(--cream-100)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <span style={{ width: 32, height: 32, borderRadius: 8, background: bg }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--charcoal-400)', fontFamily: 'var(--font-mono)' }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

window.DesignSystemScreen = DesignSystemScreen;
