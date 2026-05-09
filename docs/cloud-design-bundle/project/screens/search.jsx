/* Search results — list view + filters sidebar + map preview teaser */

function SearchScreen() {
  return (
    <div className="tk-root" style={{ width: '100%', minHeight: '100%' }}>
      <TopNav variant="public" compactSearch={true} />

      {/* Breadcrumb + sticky filter row */}
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
        <span>Accueil</span>
        <Icon name="arrow" size={12} />
        <span>Catégories</span>
        <Icon name="arrow" size={12} />
        <span style={{ color: 'var(--charcoal-700)' }}>Tentes &amp; chapiteaux</span>
      </div>

      <div
        style={{
          padding: '16px 40px 12px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', color: 'var(--charcoal-800)' }}>
            Tentes &amp; chapiteaux
          </h1>
          <span style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
            38 services · Nantes &amp; 30 km · 15 juin 2026
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill icon="grid">Grille</Pill>
          <Pill icon="map">Carte</Pill>
          <Pill icon="filter">Filtres</Pill>
        </div>
      </div>

      <div style={{ padding: '8px 40px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        <Pill active>Disponible 15 juin</Pill>
        <Pill>Capacité 80–150 pers.</Pill>
        <Pill>Livraison incluse</Pill>
        <Pill>4★ et +</Pill>
        <Pill>&lt; 1 500 €</Pill>
        <Pill>Top pro</Pill>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 360px',
          gap: 32,
          padding: '24px 40px 56px',
        }}
      >
        {/* ── Filters sidebar ──────────────────────────────────────── */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <FilterGroup title="Prix">
            <PriceRange />
          </FilterGroup>
          <FilterGroup title="Capacité">
            {['20–50 personnes', '50–100 personnes', '100–200 personnes', '200+'].map((l) => (
              <Check key={l} label={l} />
            ))}
          </FilterGroup>
          <FilterGroup title="Type de tente">
            {['Chapiteau bambou', 'Tente stretch', 'Tente garden', 'Pagode'].map((l) => (
              <Check key={l} label={l} />
            ))}
          </FilterGroup>
          <FilterGroup title="Distance">
            {['10 km', '30 km', '60 km', '100 km'].map((l, i) => (
              <Radio key={l} label={l} checked={i === 1} />
            ))}
          </FilterGroup>
          <FilterGroup title="Garanties">
            <Check label="Livraison + montage inclus" />
            <Check label="Annulation souple" checked />
            <Check label="Réponse &lt; 12 h" />
          </FilterGroup>
        </aside>

        {/* ── Result cards ───────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ResultRow
            title="Chapiteau bambou 8×12 m"
            pro="Atelier Tente Loire"
            rating={4.9}
            reviews={47}
            price="à partir de 890 €"
            priceNote="livraison incluse · &lt; 30 km"
            location="Saint-Herblain · 8 km"
            badge="Top pro"
            specs={['80–120 personnes', 'Bambou & toile crème', 'Montage J-1']}
            plabel="chapiteau bambou jour"
          />
          <ResultRow
            title="Tente stretch 100 personnes"
            pro="Évèn'Loire"
            rating={4.7}
            reviews={28}
            price="forfait 1 450 €"
            priceNote="3 jours · démontage compris"
            location="Angers · 92 km"
            badge="Réponse rapide"
            specs={['100 personnes max', 'Tente blanche stretch', 'Éclairage LED inclus']}
            plabel="tente stretch nuit"
          />
          <ResultRow
            title="Pagode 5×5 m — Pack 2 unités"
            pro="Loire Réception"
            rating={4.6}
            reviews={94}
            price="690 € le pack"
            priceNote="le week-end"
            location="Nantes · 4 km"
            specs={['50 personnes max', 'Idéal jardin', 'Auto-portante']}
            plabel="deux pagodes côte à côte"
          />
          <ResultRow
            title="Chapiteau garden 6×9 m"
            pro="Tentes Atlantique"
            rating={4.8}
            reviews={61}
            price="à partir de 720 €"
            priceNote="forfait week-end"
            location="Pornic · 48 km"
            badge="Annulation souple"
            specs={['60 personnes max', 'Vitrages latéraux', 'Plancher en option']}
            plabel="garden vitrée jardin"
          />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <button className="tk-btn tk-btn-secondary">Charger 12 services suivants</button>
          </div>
        </div>

        {/* ── Map preview ─────────────────────────────────────────── */}
        <aside style={{ position: 'sticky', top: 24, height: 'fit-content' }}>
          <div
            style={{
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              border: '1px solid var(--cream-200)',
            }}
          >
            <MapPlaceholder />
            <div
              style={{
                padding: 16,
                background: 'var(--cream-50)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>Voir sur la carte</div>
              <div style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
                38 services dans un rayon de 30 km
              </div>
              <button
                className="tk-btn tk-btn-secondary tk-btn-sm"
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
              >
                <Icon name="map" size={14} /> Ouvrir la carte
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--charcoal-700)',
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function Check({ label, checked }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 14,
        color: 'var(--charcoal-600)',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `1.5px solid ${checked ? 'var(--brand-500)' : 'var(--cream-300)'}`,
          background: checked ? 'var(--brand-500)' : 'var(--cream-50)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Icon name="check" size={12} color="var(--cream-50)" strokeWidth={2.5} />}
      </span>
      {label}
    </label>
  );
}

function Radio({ label, checked }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 14,
        color: 'var(--charcoal-600)',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `1.5px solid ${checked ? 'var(--brand-500)' : 'var(--cream-300)'}`,
          background: 'var(--cream-50)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && (
          <span
            style={{ width: 8, height: 8, background: 'var(--brand-500)', borderRadius: '50%' }}
          />
        )}
      </span>
      {label}
    </label>
  );
}

function PriceRange() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{ height: 4, background: 'var(--cream-200)', borderRadius: 2, position: 'relative' }}
      >
        <div
          style={{
            position: 'absolute',
            left: '15%',
            right: '40%',
            top: 0,
            bottom: 0,
            background: 'var(--brand-500)',
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '15%',
            top: -6,
            width: 16,
            height: 16,
            background: 'var(--cream-50)',
            border: '2px solid var(--brand-500)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '60%',
            top: -6,
            width: 16,
            height: 16,
            background: 'var(--cream-50)',
            border: '2px solid var(--brand-500)',
            borderRadius: '50%',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div
          style={{
            flex: 1,
            padding: '8px 10px',
            background: 'var(--cream-50)',
            border: '1px solid var(--cream-300)',
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          300 €
        </div>
        <div
          style={{
            flex: 1,
            padding: '8px 10px',
            background: 'var(--cream-50)',
            border: '1px solid var(--cream-300)',
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          2 000 €
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  title,
  pro,
  rating,
  reviews,
  price,
  priceNote,
  location,
  badge,
  specs,
  plabel,
}) {
  return (
    <div
      className="tk-card"
      style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr auto',
        gap: 20,
        padding: 16,
        alignItems: 'stretch',
      }}
    >
      <div style={{ position: 'relative' }}>
        <Placeholder aspect="4 / 3" label={plabel} style={{ borderRadius: 'var(--radius)' }} />
        {badge && (
          <span
            className="tk-badge tk-badge-brand"
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              background: 'var(--cream-50)',
              border: '1px solid var(--cream-200)',
              color: 'var(--brand-700)',
            }}
          >
            {badge}
          </span>
        )}
        <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 4 }}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: i === 0 ? 'var(--cream-50)' : 'rgba(250, 247, 242, 0.5)',
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--charcoal-800)' }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
            par {pro} · {location}
          </div>
        </div>
        <Stars value={rating} count={reviews} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {specs.map((s) => (
            <span key={s} className="tk-badge">
              {s}
            </span>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 'auto',
            color: 'var(--charcoal-500)',
            fontSize: 13,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="truck" size={14} color="var(--success-500)" /> Livraison incluse
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="clock" size={14} color="var(--success-500)" /> Réponse &lt; 4 h
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          padding: '4px 4px 0 0',
          minWidth: 160,
        }}
      >
        <button
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--cream-100)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="heart" size={16} color="var(--charcoal-600)" />
        </button>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 19,
              fontWeight: 600,
              color: 'var(--charcoal-800)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {price}
          </div>
          <div style={{ fontSize: 12, color: 'var(--charcoal-400)' }}>{priceNote}</div>
          <button className="tk-btn tk-btn-primary tk-btn-sm" style={{ marginTop: 12 }}>
            Voir le service
          </button>
        </div>
      </div>
    </div>
  );
}

function MapPlaceholder() {
  return (
    <div
      style={{
        height: 280,
        background: 'var(--cream-100)',
        backgroundImage: `
        repeating-linear-gradient(0deg, transparent 0 39px, rgba(31, 29, 24, 0.06) 39px 40px),
        repeating-linear-gradient(90deg, transparent 0 39px, rgba(31, 29, 24, 0.06) 39px 40px)
      `,
        position: 'relative',
      }}
    >
      {[
        { x: 28, y: 35, big: true },
        { x: 60, y: 50 },
        { x: 45, y: 70 },
        { x: 75, y: 28 },
        { x: 18, y: 62 },
        { x: 88, y: 78 },
      ].map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: p.big ? 'var(--brand-500)' : 'var(--cream-50)',
              color: p.big ? 'var(--cream-50)' : 'var(--charcoal-700)',
              border: p.big ? 'none' : '1px solid var(--cream-300)',
              fontSize: 11,
              fontWeight: 600,
              boxShadow: 'var(--shadow-sm)',
              whiteSpace: 'nowrap',
            }}
          >
            {p.big ? '890 €' : ['720 €', '1 450 €', '690 €', '560 €', '1 100 €'][i - 1]}
          </div>
        </div>
      ))}
    </div>
  );
}

window.SearchScreen = SearchScreen;
