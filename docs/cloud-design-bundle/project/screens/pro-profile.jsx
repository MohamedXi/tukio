/* Public pro profile — /pro/{slug}
   Hero éditorial · bio + chiffres · grille services · avis · zone d'intervention · contact */

function ProProfileScreen() {
  return (
    <div className="tk-root" style={{ width: '100%', minHeight: '100%' }}>
      <TopNav variant="public" compactSearch={true} />

      {/* ── Breadcrumb ─────────────────────────── */}
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
        <span>Pros</span>
        <Icon name="arrow" size={12} />
        <span>Pays de la Loire</span>
        <Icon name="arrow" size={12} />
        <span style={{ color: 'var(--charcoal-700)' }}>Atelier Tente Loire</span>
      </div>

      {/* ── Hero éditorial ─────────────────────── */}
      <section style={{ padding: '32px 40px 40px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.3fr 1fr',
            gap: 40,
            alignItems: 'stretch',
          }}
        >
          {/* Left: identity + bio */}
          <div
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <span className="tk-badge tk-badge-success">
                  <Icon name="shield" size={11} /> Pro vérifié
                </span>
                <span className="tk-badge tk-badge-brand">Top pro</span>
                <span className="tk-badge">Membre depuis 2022</span>
              </div>

              <Kicker>Tentes &amp; chapiteaux · Saint-Herblain</Kicker>
              <h1
                style={{
                  fontSize: 'var(--text-5xl)',
                  lineHeight: 1.05,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 400,
                  letterSpacing: '-0.02em',
                  marginTop: 14,
                  marginBottom: 20,
                  color: 'var(--charcoal-800)',
                }}
              >
                Atelier{' '}
                <em style={{ fontStyle: 'italic', color: 'var(--brand-600)', fontWeight: 400 }}>
                  Tente Loire
                </em>
              </h1>

              <p
                style={{
                  fontSize: 17,
                  lineHeight: 1.6,
                  color: 'var(--charcoal-600)',
                  maxWidth: 540,
                  margin: 0,
                }}
              >
                Famille de tentiers depuis trois générations. Nous installons chapiteaux bambou,
                tentes stretch et tonnelles à ossature bois pour mariages, repas d'entreprise et
                festivals — partout en Pays de la Loire.
              </p>
            </div>

            {/* Stat row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 0,
                marginTop: 32,
                paddingTop: 24,
                borderTop: '1px solid var(--cream-200)',
              }}
            >
              <Stat value="4,9" sub="47 avis" icon="star" />
              <Stat value="124" sub="réservations" />
              <Stat value="2 h" sub="réponse moyenne" />
              <Stat value="50 km" sub="zone livraison" />
            </div>
          </div>

          {/* Right: photo card + sticky CTA */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Placeholder
              label="atelier · stockage chapiteaux"
              style={{ borderRadius: 'var(--radius-lg)', aspectRatio: '5/4' }}
            />
            <div
              style={{
                padding: '20px',
                background: 'var(--charcoal-700)',
                color: 'var(--cream-50)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <Avatar name="Atelier Tente Loire" size={48} tone="brand" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Disponible cette semaine</div>
                <div style={{ fontSize: 12, color: 'rgba(250, 247, 242, 0.6)', marginTop: 2 }}>
                  3 créneaux libres en juin
                </div>
              </div>
              <button className="tk-btn tk-btn-primary tk-btn-sm">
                <Icon name="message" size={14} /> Contacter
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs / anchor nav ─────────────────── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          borderTop: '1px solid var(--cream-200)',
          borderBottom: '1px solid var(--cream-200)',
          background: 'rgba(250, 247, 242, 0.85)',
          backdropFilter: 'blur(12px)',
          padding: '0 40px',
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          <Tab label="Services" count="8" active />
          <Tab label="À propos" />
          <Tab label="Avis" count="47" />
          <Tab label="Zone d'intervention" />
          <Tab label="Conditions" />
        </div>
      </nav>

      {/* ── Services grid ─────────────────────── */}
      <section style={{ padding: '48px 40px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 24,
          }}
        >
          <div>
            <Kicker>8 services proposés</Kicker>
            <h2 style={{ fontSize: 'var(--text-2xl)', marginTop: 6 }}>
              Catalogue Atelier Tente Loire
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Pill icon="grid" active>
              Tout
            </Pill>
            <Pill>Tentes</Pill>
            <Pill>Tonnelles</Pill>
            <Pill>Accessoires</Pill>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          <SCard
            label="chapiteau bambou monté"
            title="Chapiteau bambou 8×12 m"
            sub="96 m² · jusqu'à 80p"
            price="890 €"
            rating={4.9}
            count={47}
            top
          />
          <SCard
            label="stretch tendue · soir"
            title="Tente stretch 12×8 m"
            sub="100 m² · jusqu'à 100p"
            price="1 450 €"
            rating={4.8}
            count={22}
          />
          <SCard
            label="tonnelle bois 4×4"
            title="Tonnelle bois 4×4 m"
            sub="16 m² · jusqu'à 20p"
            price="320 €"
            rating={4.7}
            count={18}
          />
          <SCard
            label="chapiteau crème jardin"
            title="Chapiteau pagode 5×5 m"
            sub="25 m² · jusqu'à 25p"
            price="540 €"
            rating={5.0}
            count={12}
          />
          <SCard
            label="auvent réception"
            title="Auvent réception 6×3 m"
            sub="18 m² · usage entrée"
            price="280 €"
            rating={4.9}
            count={9}
          />
          <SCard
            label="plancher bois neuf"
            title="Plancher bois (option)"
            sub="100 m² · €/m²"
            price="14 €/m²"
            rating={4.8}
            count={31}
          />
        </div>
      </section>

      {/* ── About + zone d'intervention ─────── */}
      <section style={{ padding: '0 40px 56px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          {/* About */}
          <div>
            <Kicker>À propos</Kicker>
            <h2 style={{ fontSize: 'var(--text-2xl)', marginTop: 6, marginBottom: 20 }}>
              L'histoire d'un atelier familial
            </h2>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.65,
                color: 'var(--charcoal-600)',
                marginBottom: 16,
              }}
            >
              Fondé en 1987 par René Pasquier, repris en 2018 par sa petite-fille Camille, l'Atelier
              Tente Loire fabrique et loue des structures en bambou, bois et toile naturelle. Toutes
              nos tentes sont stockées et entretenues à Saint-Herblain.
            </p>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.65,
                color: 'var(--charcoal-600)',
                marginBottom: 24,
              }}
            >
              Nous travaillons exclusivement avec des matériaux européens (bambou Portugal, toiles
              Bretagne) et accompagnons chaque montage avec une équipe de 2 à 4 personnes selon la
              taille du chapiteau.
            </p>
            <div
              style={{
                display: 'flex',
                gap: 24,
                paddingTop: 16,
                borderTop: '1px solid var(--cream-200)',
              }}
            >
              <KV label="Forme juridique" value="SARL" />
              <KV label="SIRET" value="894 ••• ••• 00012" />
              <KV label="Effectif" value="4 personnes" />
            </div>
          </div>

          {/* Map / zone */}
          <div>
            <Kicker>Zone d'intervention</Kicker>
            <h2 style={{ fontSize: 'var(--text-2xl)', marginTop: 6, marginBottom: 20 }}>
              Pays de la Loire · 50 km autour de Nantes
            </h2>
            <div
              style={{
                position: 'relative',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                aspectRatio: '5/3',
              }}
            >
              <Placeholder
                label="carte · zone Nantes 50 km"
                style={{ height: '100%', borderRadius: 0 }}
              />
              {/* Pin marker */}
              <span
                style={{
                  position: 'absolute',
                  left: '38%',
                  top: '52%',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'var(--brand-500)',
                  boxShadow: '0 0 0 6px rgba(194, 65, 12, 0.18)',
                  border: '2px solid var(--cream-50)',
                }}
              />
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span className="tk-badge">Nantes</span>
              <span className="tk-badge">Saint-Herblain</span>
              <span className="tk-badge">Rezé</span>
              <span className="tk-badge">Vannes (sup. 80 €)</span>
              <span className="tk-badge">Angers (sup. 60 €)</span>
              <span className="tk-badge">La Roche-sur-Yon</span>
              <span className="tk-badge">+ 12 villes</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Reviews ─────────────────────────── */}
      <section style={{ padding: '48px 40px', background: 'var(--cream-100)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 56 }}>
          <div>
            <Kicker>Avis clients</Kicker>
            <h2 style={{ fontSize: 'var(--text-3xl)', marginTop: 6, marginBottom: 24 }}>4,9 / 5</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              <Bar n="5" pct={88} />
              <Bar n="4" pct={9} />
              <Bar n="3" pct={2} />
              <Bar n="2" pct={1} />
              <Bar n="1" pct={0} />
            </div>
            <button className="tk-btn tk-btn-secondary" style={{ width: '100%' }}>
              Voir les 47 avis <Icon name="arrow" size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ReviewCard
              name="Marion D."
              date="juin 2024"
              rating={5}
              context="Mariage · 80 personnes"
              text="Équipe ponctuelle, montage propre, démontage discret. Le chapiteau bambou est sublime au coucher du soleil. Camille a su nous conseiller sur les options."
            />
            <ReviewCard
              name="Hugo T."
              date="mai 2024"
              rating={5}
              context="Anniversaire 50 ans · 60 personnes"
              text="Réactivité parfaite (réponse en 30 min), chapiteau impeccable, prix tenu. Je recommande sans hésiter pour un événement en extérieur."
            />
            <ReviewCard
              name="Lucie B."
              date="avril 2024"
              rating={4}
              context="Repas d'entreprise · 40 personnes"
              text="Très bon service, juste un retard de 30 min au démontage. Mais qualité du chapiteau et de l'équipe au top."
            />
            <ReviewCard
              name="Yann M."
              date="mars 2024"
              rating={5}
              context="Mariage civil · 100 personnes"
              text="Merci à toute l'équipe d'Atelier Tente Loire. La structure tient parfaitement, et le rendu visuel a fait son effet."
            />
          </div>
        </div>
      </section>

      {/* ── CTA fin ─────────────────────────── */}
      <section
        style={{
          padding: '64px 40px',
          textAlign: 'center',
          borderTop: '1px solid var(--cream-200)',
        }}
      >
        <Kicker>Un projet en tête ?</Kicker>
        <h2
          style={{
            fontSize: 'var(--text-4xl)',
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            marginTop: 12,
            marginBottom: 20,
          }}
        >
          Discutez avec{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--brand-600)', fontWeight: 400 }}>
            Camille
          </em>{' '}
          avant de réserver.
        </h2>
        <p
          style={{
            fontSize: 16,
            color: 'var(--charcoal-500)',
            maxWidth: 540,
            margin: '0 auto 24px',
          }}
        >
          Camille répond en moyenne en 2 h. Demandez un conseil sur la taille, les options ou la
          livraison.
        </p>
        <div style={{ display: 'inline-flex', gap: 10 }}>
          <button className="tk-btn tk-btn-primary tk-btn-lg">
            <Icon name="message" size={16} /> Envoyer un message
          </button>
          <button className="tk-btn tk-btn-secondary tk-btn-lg">Voir le calendrier</button>
        </div>
      </section>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────
function Stat({ value, sub, icon }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        {icon && <Icon name={icon} size={18} color="var(--brand-500)" strokeWidth={2} />}
        <span
          style={{
            fontSize: 28,
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            color: 'var(--charcoal-800)',
            letterSpacing: '-0.01em',
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--charcoal-500)',
          marginTop: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function Tab({ label, count, active }) {
  return (
    <button
      style={{
        padding: '16px 4px',
        marginRight: 28,
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--brand-500)' : '2px solid transparent',
        color: active ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
      }}
    >
      {label}
      {count && (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--charcoal-400)' }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SCard({ label, title, sub, price, rating, count, top }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative' }}>
        <Placeholder label={label} aspect="5/4" style={{ borderRadius: 'var(--radius-md)' }} />
        {top && (
          <span
            className="tk-badge tk-badge-brand"
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              background: 'var(--cream-50)',
              border: '1px solid var(--cream-200)',
            }}
          >
            Best-seller
          </span>
        )}
        <button
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--cream-50)',
            border: '1px solid var(--cream-200)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="heart" size={14} />
        </button>
      </div>
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            alignItems: 'baseline',
          }}
        >
          <h3 style={{ fontSize: 16, margin: 0, fontWeight: 600, color: 'var(--charcoal-800)' }}>
            {title}
          </h3>
          <Stars value={rating} count={count} size={12} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 4 }}>{sub}</div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--charcoal-800)',
            marginTop: 8,
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.01em',
          }}
        >
          {price}
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--charcoal-400)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-mono)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--charcoal-700)' }}>{value}</div>
    </div>
  );
}

function Bar({ n, pct }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--charcoal-500)', width: 14 }}>{n}</span>
      <div
        style={{
          flex: 1,
          height: 6,
          background: 'var(--cream-200)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand-500)' }} />
      </div>
      <span
        style={{
          fontSize: 11,
          color: 'var(--charcoal-500)',
          fontFamily: 'var(--font-mono)',
          width: 30,
          textAlign: 'right',
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

function ReviewCard({ name, date, rating, context, text }) {
  return (
    <div
      style={{
        padding: 20,
        background: 'var(--cream-50)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--cream-200)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={name} size={36} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              {name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--charcoal-400)' }}>
              {date} · {context}
            </div>
          </div>
        </div>
        <Stars value={rating} size={12} showCount={false} />
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--charcoal-600)', margin: 0 }}>
        {text}
      </p>
    </div>
  );
}

window.ProProfileScreen = ProProfileScreen;
