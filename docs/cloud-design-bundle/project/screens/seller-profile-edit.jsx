/* Édition profil pro — /seller/profile
   Layout : ProTopNav + page d'édition de la vitrine publique.
   Sections : preview live, identité, bio, photos, services proposés, zone, conditions. */

function SellerProfileEditScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
      <ProTopNav active="settings" />

      {/* Header band */}
      <section
        style={{
          padding: '32px 40px 20px',
          background: 'var(--cream-50)',
          borderBottom: '1px solid var(--cream-200)',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <div>
            <Kicker>Espace pro · Atelier Tente Loire</Kicker>
            <h1
              style={{
                fontSize: 36,
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                letterSpacing: '-0.02em',
                marginTop: 8,
                color: 'var(--charcoal-800)',
              }}
            >
              Ma vitrine publique
            </h1>
            <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 6 }}>
              Cette page est ce que les clients voient sur{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                tukio.one/pro/atelier-tente-loire
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 6 }}>
            <span
              style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--charcoal-400)' }}
            >
              Modifié il y a 3 j
            </span>
            <button className="tk-btn tk-btn-tertiary tk-btn-sm">
              <Icon name="search" size={14} /> Aperçu public
            </button>
            <button className="tk-btn tk-btn-primary tk-btn-sm">Publier les modifications</button>
          </div>
        </div>
      </section>

      {/* Profile completion bar */}
      <section style={{ padding: '20px 40px 0', background: 'var(--cream-50)' }}>
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: 16,
            background: 'var(--brand-50)',
            border: '1px solid var(--brand-200)',
            borderRadius: 'var(--radius-md)',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 20,
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', width: 56, height: 56 }}>
            <svg width="56" height="56" viewBox="0 0 56 56">
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="var(--brand-200)"
                strokeWidth="4"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="var(--brand-600)"
                strokeWidth="4"
                strokeDasharray="150.8"
                strokeDashoffset="33"
                strokeLinecap="round"
                transform="rotate(-90 28 28)"
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--brand-700)',
              }}
            >
              78%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              Plus que 3 éléments pour une vitrine optimale
            </div>
            <div style={{ fontSize: 12, color: 'var(--charcoal-600)', marginTop: 2 }}>
              Ajouter une vidéo · Compléter la zone d'intervention · Ajouter 2 photos atelier
            </div>
          </div>
          <button className="tk-btn tk-btn-tertiary tk-btn-sm" style={{ fontSize: 12 }}>
            Voir la check-list
          </button>
        </div>
      </section>

      {/* Layout : sidebar TOC + form */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '32px 40px 64px',
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: 40,
        }}
      >
        {/* Sidebar TOC */}
        <aside style={{ position: 'sticky', top: 88, alignSelf: 'start' }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--charcoal-400)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontFamily: 'var(--font-mono)',
              marginBottom: 12,
            }}
          >
            Sections
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TocLink label="Identité" status="ok" active />
            <TocLink label="Bio & ton" status="ok" />
            <TocLink label="Photos" status="warn" />
            <TocLink label="Services proposés" status="ok" />
            <TocLink label="Zone d'intervention" status="warn" />
            <TocLink label="Conditions" status="ok" />
            <TocLink label="Vidéo" status="todo" />
            <TocLink label="Avis" status="ok" />
          </nav>

          <div
            style={{
              marginTop: 20,
              padding: 14,
              background: 'var(--charcoal-700)',
              color: 'var(--cream-50)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Conseil tukio</div>
            <div style={{ fontSize: 12, color: 'rgba(250,247,242,0.7)', lineHeight: 1.5 }}>
              Les profils avec une vidéo de présentation reçoivent{' '}
              <strong style={{ color: 'var(--brand-300)' }}>+34%</strong> de demandes en moyenne.
            </div>
          </div>
        </aside>

        {/* Main */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* IDENTITÉ */}
          <EditSection
            title="Identité"
            sub="Nom commercial, statut, et coordonnées professionnelles."
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <SettField label="Nom commercial" value="Atelier Tente Loire" />
              <SettField label="Slug — URL publique" value="atelier-tente-loire" />
              <SettField label="Catégorie principale" value="Tentes & chapiteaux" />
              <SettField label="Sous-catégories (max 3)" value="Mobilier · Décoration · Lounge" />
              <SettField label="SIRET" value="812 449 003 00027" verified />
              <SettField label="N° TVA" value="FR 76 812449003" verified />
              <SettField label="Année de création" value="1987" />
              <SettField label="Effectif" value="6 collaborateurs" />
            </div>
          </EditSection>

          {/* BIO */}
          <EditSection
            title="Bio & ton"
            sub="Visible en haut de votre profil. Évitez les superlatifs creux — soyez concrets."
            counter="412 / 800"
          >
            <div>
              <label style={inputLabel}>Tagline (1 ligne)</label>
              <div style={inputBox}>Tentiers depuis 1987 · Pays de la Loire</div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={inputLabel}>Bio longue (max 800 caractères)</label>
              <div style={{ ...inputBox, minHeight: 140, padding: 14, lineHeight: 1.6 }}>
                Famille de tentiers depuis trois générations. Nous installons chapiteaux bambou,
                tentes stretch et tonnelles à ossature bois pour mariages, repas d'entreprise et
                festivals — partout en Pays de la Loire.
                <br />
                <br />
                Notre atelier de Saint-Herblain conserve un stock de 2 200 m² de toile, monté et
                démonté chaque semaine. Nous travaillons en direct avec des organisateurs, mais
                aussi en sous-traitance pour des wedding planners et agences événementielles.
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={tagPill}>artisanal</span>
              <span style={tagPill}>famille</span>
              <span style={tagPill}>écoresponsable</span>
              <span style={tagPill}>sur-mesure</span>
              <button
                style={{
                  ...tagPill,
                  background: 'transparent',
                  border: '1px dashed var(--cream-300)',
                  color: 'var(--charcoal-500)',
                  cursor: 'pointer',
                }}
              >
                <Icon name="plus" size={11} /> ajouter
              </button>
            </div>
          </EditSection>

          {/* PHOTOS */}
          <EditSection
            title="Photos"
            sub="6 minimum recommandées. La première est la photo de couverture."
            warning="2 photos manquantes pour atteindre les 6 recommandées"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <PhotoSlot
                cover
                gradient="linear-gradient(135deg, #C7B89A 30%, #8C7A5C)"
                label="couverture · chapiteau jardin"
              />
              <PhotoSlot gradient="linear-gradient(135deg, #D3C4A8 30%, #9D8A6C)" label="atelier" />
              <PhotoSlot
                gradient="linear-gradient(135deg, #B8A688 30%, #6E5F44)"
                label="mariage Vertou"
              />
              <PhotoSlot
                gradient="linear-gradient(135deg, #C4B496 30%, #7A6A4E)"
                label="détail toile"
              />
              <PhotoSlot empty />
              <PhotoSlot empty />
              <PhotoSlot add />
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--charcoal-500)' }}>
              JPG ou PNG · 2000 px min · 8 Mo max par fichier · Glisser pour réordonner
            </div>
          </EditSection>

          {/* SERVICES */}
          <EditSection
            title="Services proposés"
            sub="Liés à votre catalogue. Modifier un service depuis « Mes services »."
            action="Voir mes services"
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <SrvRow
                title="Chapiteau bambou 8 × 12 m"
                sub="Disponible · 12 réservations · 4,9 ★"
                published
              />
              <SrvRow
                title="Chaises Tiffany dorées"
                sub="Disponible · 28 réservations · 4,8 ★"
                published
              />
              <SrvRow
                title="Pack lounge 30 personnes"
                sub="Disponible · 7 réservations · 5,0 ★"
                published
              />
              <SrvRow title="Tonnelle pliante 3 × 3 m" sub="Brouillon — non publié" draft />
              <SrvRow
                title="Décoration florale (anciennement)"
                sub="Archivé depuis nov. 2024"
                archived
                last
              />
            </div>
          </EditSection>

          {/* ZONE */}
          <EditSection
            title="Zone d'intervention"
            sub="Définit où vos services apparaissent dans la recherche."
            warning="Préciser le rayon vous fait apparaître dans les résultats locaux"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <SettField
                label="Adresse atelier"
                value="14 rue Ferdinand-Buisson · Saint-Herblain"
              />
              <SettField label="Rayon livraison" value="50 km autour de Saint-Herblain" />
              <SettField label="Tarif livraison" value="1,80 € / km au-delà de 30 km" />
              <SettField label="Délai de prévenance" value="J-7 minimum" />
            </div>

            <div
              style={{
                marginTop: 14,
                height: 200,
                background: 'linear-gradient(180deg, #DCD5C5, #C7BFA9)',
                borderRadius: 'var(--radius-sm)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Faux map */}
              <svg
                width="100%"
                height="100%"
                style={{ position: 'absolute', inset: 0, opacity: 0.4 }}
              >
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke="var(--charcoal-500)"
                      strokeWidth="0.5"
                      opacity="0.4"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%,-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: '50%',
                    background:
                      'radial-gradient(circle, rgba(217,119,87,0.25), rgba(217,119,87,0.05))',
                    border: '2px dashed var(--brand-500)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: 'var(--brand-600)',
                      border: '3px solid var(--cream-50)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  padding: '6px 10px',
                  background: 'rgba(250,247,242,0.92)',
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--charcoal-700)',
                }}
              >
                Rayon 50 km · ~1 850 km² couverts
              </div>
            </div>
          </EditSection>

          {/* CONDITIONS */}
          <EditSection
            title="Conditions"
            sub="Affichées dans la fiche service et dans le checkout."
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <SettField label="Caution" value="30% du montant — restituée sous 7 j" />
              <SettField
                label="Annulation client"
                value="Gratuite jusqu'à J-30 · 50% jusqu'à J-7 · 100% après"
              />
              <SettField label="Acompte au moment du débit" value="100% à confirmation" />
              <SettField label="Délai de réponse engagé" value="Sous 24 h ouvrées" verified />
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: 'var(--cream-100)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                gap: 12,
              }}
            >
              <Icon name="bolt" size={16} color="var(--warning-600, #B8721E)" />
              <div style={{ fontSize: 12, color: 'var(--charcoal-600)', lineHeight: 1.5 }}>
                Modifier vos conditions n'affecte que les <strong>nouvelles demandes</strong>. Les
                réservations en cours conservent les conditions à la date de leur acceptation.
              </div>
            </div>
          </EditSection>
        </main>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────

function TocLink({ label, status, active }) {
  const dotColor = {
    ok: 'var(--success-600, #2A7E55)',
    warn: 'var(--warning-500, #C18527)',
    todo: 'var(--cream-300)',
  }[status];
  return (
    <a
      href="#"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--cream-100)' : 'transparent',
        color: active ? 'var(--charcoal-800)' : 'var(--charcoal-600)',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        textDecoration: 'none',
        position: 'relative',
      }}
    >
      {active && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 8,
            bottom: 8,
            width: 2,
            background: 'var(--brand-600)',
            borderRadius: 1,
          }}
        />
      )}
      <span
        style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }}
      />
      <span style={{ flex: 1 }}>{label}</span>
    </a>
  );
}

function EditSection({ title, sub, counter, warning, action, children }) {
  return (
    <section className="tk-card" style={{ padding: 24 }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
          paddingBottom: 14,
          borderBottom: '1px solid var(--cream-200)',
          gap: 16,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 18,
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              color: 'var(--charcoal-800)',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h2>
          {sub && (
            <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 3 }}>{sub}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {counter && (
            <span
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--charcoal-400)' }}
            >
              {counter}
            </span>
          )}
          {action && (
            <button className="tk-btn tk-btn-tertiary tk-btn-sm" style={{ fontSize: 12 }}>
              {action}
            </button>
          )}
          <button
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: '6px 12px',
              background: 'var(--brand-50)',
              color: 'var(--brand-700)',
              border: '1px solid var(--brand-200)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Modifier
          </button>
        </div>
      </header>

      {warning && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 12px',
            background: 'var(--warning-50, #FBF1DD)',
            border: '1px solid var(--warning-200, #EBD9A8)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            fontSize: 12,
            color: 'var(--warning-800, #7E5215)',
          }}
        >
          <Icon name="bolt" size={13} color="var(--warning-600, #B8721E)" />
          {warning}
        </div>
      )}

      {children}
    </section>
  );
}

const inputLabel = {
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  color: 'var(--charcoal-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  display: 'block',
  marginBottom: 6,
};

const inputBox = {
  padding: '10px 12px',
  background: 'var(--cream-50)',
  border: '1px solid var(--cream-300)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 14,
  color: 'var(--charcoal-700)',
};

const tagPill = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  padding: '5px 10px',
  background: 'var(--brand-50)',
  color: 'var(--brand-700)',
  border: '1px solid var(--brand-200)',
  borderRadius: 999,
};

function PhotoSlot({ cover, gradient, label, empty, add }) {
  if (add) {
    return (
      <button
        style={{
          aspectRatio: '4/3',
          background: 'var(--cream-50)',
          border: '2px dashed var(--cream-300)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
          color: 'var(--charcoal-500)',
        }}
      >
        <Icon name="plus" size={20} />
        <span style={{ fontSize: 11, fontWeight: 500 }}>Ajouter</span>
      </button>
    );
  }
  if (empty) {
    return (
      <div
        style={{
          aspectRatio: '4/3',
          background: 'var(--cream-100)',
          border: '1px dashed var(--cream-300)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'var(--charcoal-400)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        vide
      </div>
    );
  }
  return (
    <div
      style={{
        aspectRatio: '4/3',
        background: gradient,
        borderRadius: 'var(--radius-sm)',
        position: 'relative',
        overflow: 'hidden',
        border: cover ? '2px solid var(--brand-500)' : '1px solid var(--cream-200)',
      }}
    >
      {cover && (
        <span
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            padding: '2px 8px',
            background: 'var(--brand-600)',
            color: 'var(--cream-50)',
            borderRadius: 999,
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          couverture
        </span>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 8px 6px',
          background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.5))',
          fontSize: 10,
          color: 'rgba(255,255,255,0.85)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          display: 'flex',
          gap: 4,
        }}
      >
        <button style={photoBtn}>
          <Icon name="x" size={11} />
        </button>
      </div>
    </div>
  );
}

const photoBtn = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'rgba(0,0,0,0.5)',
  border: 'none',
  color: 'white',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

function SrvRow({ title, sub, published, draft, archived, last }) {
  const status = published
    ? { label: 'Publié', bg: 'var(--success-50, #E8F4ED)', color: 'var(--success-700, #1E5C3D)' }
    : draft
      ? {
          label: 'Brouillon',
          bg: 'var(--warning-50, #FBF1DD)',
          color: 'var(--warning-800, #7E5215)',
        }
      : { label: 'Archivé', bg: 'var(--cream-100)', color: 'var(--charcoal-500)' };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 16,
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px solid var(--cream-200)',
        opacity: archived ? 0.6 : 1,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--charcoal-800)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>{sub}</div>
      </div>
      <span
        style={{
          padding: '3px 9px',
          background: status.bg,
          color: status.color,
          borderRadius: 999,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        }}
      >
        {status.label}
      </span>
      <button className="tk-btn tk-btn-tertiary tk-btn-sm" style={{ fontSize: 12 }}>
        Modifier
      </button>
    </div>
  );
}
