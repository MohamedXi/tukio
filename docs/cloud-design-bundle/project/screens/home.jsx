/* Homepage — éditoriale, fidèle au brief
   Hero serif large + barre de recherche unifiée + catégories + grid services
   + "comment ça marche" + section pros + footer */

function HomeScreen({ heroVariant = 'editorial' }) {
  return (
    <div className="tk-root" style={{ width: '100%', minHeight: '100%' }}>
      <TopNav variant="public" compactSearch={false} transparent={true} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section style={{ padding: '64px 80px 56px', background: 'var(--cream-50)' }}>
        {heroVariant === 'minimal' ? (
          <div style={{ textAlign: 'center', maxWidth: 920, margin: '0 auto' }}>
            <Kicker>Pays de la Loire · 142 pros vérifiés</Kicker>
            <h1
              style={{
                fontSize: 'var(--text-6xl)',
                lineHeight: 1.02,
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                letterSpacing: '-0.025em',
                marginTop: 20,
                marginBottom: 20,
                color: 'var(--charcoal-800)',
              }}
            >
              Vos événements,{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--brand-600)', fontWeight: 400 }}>
                réservés.
              </em>
            </h1>
            <p
              style={{
                fontSize: 19,
                color: 'var(--charcoal-500)',
                lineHeight: 1.55,
                maxWidth: 620,
                margin: '0 auto',
              }}
            >
              Tentes, mobilier, traiteur — sélectionnés près de chez vous, réservés en ligne, payés
              en sécurité.
            </p>
          </div>
        ) : heroVariant === 'split' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0,
              alignItems: 'stretch',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '56px 48px',
                background: 'var(--charcoal-700)',
                color: 'var(--cream-50)',
              }}
            >
              <Kicker color="var(--brand-300)">Pays de la Loire · 142 pros</Kicker>
              <h1
                style={{
                  fontSize: 'var(--text-5xl)',
                  lineHeight: 1.05,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 400,
                  letterSpacing: '-0.02em',
                  marginTop: 20,
                  marginBottom: 20,
                }}
              >
                Vos événements,{' '}
                <em style={{ fontStyle: 'italic', color: 'var(--brand-300)', fontWeight: 400 }}>
                  réservés
                </em>
                .
              </h1>
              <p style={{ fontSize: 17, color: 'rgba(250, 247, 242, 0.7)', lineHeight: 1.55 }}>
                Marketplace dédiée aux événements en Pays de la Loire. Pros locaux vérifiés,
                paiement sécurisé.
              </p>
            </div>
            <Placeholder
              aspect="auto"
              label="photo réelle · chapiteau"
              style={{ borderRadius: 0, height: '100%' }}
            />
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.15fr 1fr',
              gap: 56,
              alignItems: 'end',
            }}
          >
            <div>
              <Kicker>Pays de la Loire · 142 pros vérifiés</Kicker>
              <h1
                style={{
                  fontSize: 'var(--text-6xl)',
                  lineHeight: 1.02,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 400,
                  letterSpacing: '-0.02em',
                  marginTop: 20,
                  marginBottom: 24,
                  color: 'var(--charcoal-800)',
                }}
              >
                Vos événements,{' '}
                <em style={{ fontStyle: 'italic', color: 'var(--brand-600)', fontWeight: 400 }}>
                  réservés
                </em>{' '}
                avec les meilleurs pros près de chez vous.
              </h1>
              <p
                style={{
                  fontSize: 18,
                  color: 'var(--charcoal-500)',
                  lineHeight: 1.55,
                  maxWidth: 540,
                }}
              >
                Trouvez tentes, mobilier, traiteur — réservez en ligne, payez en sécurité. Pas
                d'appels, pas de devis qui traînent.
              </p>
            </div>
            <div style={{ position: 'relative' }}>
              <Placeholder
                aspect="5 / 4"
                label="photo réelle · mariage en chapiteau"
                style={{ borderRadius: 'var(--radius-lg)' }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 20,
                  left: 20,
                  padding: '10px 14px',
                  borderRadius: 999,
                  background: 'var(--cream-50)',
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Icon name="shield" size={16} color="var(--success-500)" />
                <span style={{ fontSize: 13, fontWeight: 500 }}>Paiement sécurisé · Stripe</span>
              </div>
            </div>
          </div>
        )}

        {/* Search bar — unified Quoi / Où / Quand */}
        <div
          style={{
            marginTop: 48,
            background: 'var(--cream-50)',
            borderRadius: 999,
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--cream-200)',
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr 1fr auto',
            alignItems: 'center',
            padding: 6,
          }}
        >
          <SearchField label="Quoi" value="Tentes & chapiteaux" icon="search" />
          <SearchField label="Où" value="Nantes · 30 km" icon="pin" divider />
          <SearchField label="Quand" value="15 juin 2026" icon="calendar" divider />
          <button
            className="tk-btn tk-btn-primary tk-btn-lg"
            style={{ borderRadius: 999, paddingLeft: 24, paddingRight: 24, marginRight: 4 }}
          >
            <Icon name="search" size={18} color="currentColor" strokeWidth={2} /> Rechercher
          </button>
        </div>

        {/* Trust strip */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginTop: 32,
            color: 'var(--charcoal-500)',
            fontSize: 13,
          }}
        >
          <TrustItem icon="check" text="Pros vérifiés (SIRET, KYC)" />
          <TrustItem icon="bolt" text="Réponse pro sous 48 h" />
          <TrustItem icon="shield" text="Paiement protégé jusqu'à l'événement" />
          <TrustItem icon="pin" text="Made in Pays de la Loire" />
        </div>
      </section>

      {/* ── Categories ─────────────────────────────────────────── */}
      <section style={{ padding: '64px 80px', background: 'var(--cream-100)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 32,
          }}
        >
          <div>
            <Kicker>Catégories</Kicker>
            <h2 style={{ fontSize: 'var(--text-3xl)', marginTop: 8 }}>Par où commencer ?</h2>
          </div>
          <a
            style={{
              fontSize: 14,
              color: 'var(--brand-700)',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Toutes les catégories <Icon name="arrow" size={14} />
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          <CategoryCard icon="tent" title="Tentes & chapiteaux" count="38 pros" featured />
          <CategoryCard icon="chair" title="Mobilier événementiel" count="54 pros" />
          <CategoryCard icon="flame" title="Traiteur & food trucks" count="21 pros" soon />
          <CategoryCard icon="sparkle" title="Décoration & fleurs" count="29 pros" soon />
        </div>
      </section>

      {/* ── Services proches ───────────────────────────────────── */}
      <section style={{ padding: '64px 80px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 32,
          }}
        >
          <div>
            <Kicker>Près de Nantes</Kicker>
            <h2 style={{ fontSize: 'var(--text-3xl)', marginTop: 8 }}>Disponibles ce week-end</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="tk-btn tk-btn-ghost tk-btn-sm" style={{ width: 36, padding: 0 }}>
              <Icon name="arrowL" size={16} />
            </button>
            <button className="tk-btn tk-btn-secondary tk-btn-sm" style={{ width: 36, padding: 0 }}>
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          <ServiceCard
            title="Chapiteau bambou 8×12 m"
            pro="Atelier Tente Loire"
            rating={4.9}
            reviews={47}
            price="à partir de 890 €"
            location="Saint-Herblain · 8 km"
            badge="Top pro"
            plabel="chapiteau · vue extérieure"
          />
          <ServiceCard
            title="Pack 60 chaises Tiffany blanches"
            pro="Mobilier des Mariées"
            rating={4.8}
            reviews={132}
            price="3 € / unité"
            location="Vertou · 12 km"
            plabel="chaises Tiffany alignées"
          />
          <ServiceCard
            title="Tente stretch 100 personnes"
            pro="Évèn'Loire"
            rating={4.7}
            reviews={28}
            price="forfait 1 450 €"
            location="Angers · 92 km"
            badge="Réponse rapide"
            plabel="tente stretch éclairée nuit"
          />
          <ServiceCard
            title="Tables nappées + dorures"
            pro="La Belle Tablée"
            rating={5.0}
            reviews={19}
            price="sur devis"
            location="Nantes · 4 km"
            badge="Nouveau"
            plabel="dressage table corporate"
          />
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section
        style={{
          padding: '80px 80px',
          background: 'var(--charcoal-700)',
          color: 'var(--cream-100)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.3fr',
            gap: 64,
            alignItems: 'start',
          }}
        >
          <div>
            <Kicker color="var(--brand-300)">Comment ça marche</Kicker>
            <h2
              style={{
                fontSize: 'var(--text-4xl)',
                marginTop: 12,
                color: 'var(--cream-50)',
                lineHeight: 1.1,
              }}
            >
              Quatre étapes, pas dix appels.
            </h2>
            <p
              style={{
                marginTop: 20,
                color: 'var(--cream-200)',
                fontSize: 16,
                lineHeight: 1.6,
                maxWidth: 360,
              }}
            >
              Tukio.one centralise les pros locaux, leurs disponibilités, et le paiement. Vous
              décidez, on s'occupe du reste.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <Step
              n="01"
              title="Cherchez"
              body="Filtrez par catégorie, ville, date. Voyez les vrais prix, les vrais avis."
            />
            <Step
              n="02"
              title="Réservez"
              body="Paiement sécurisé. La somme n'est débitée qu'à l'acceptation du pro (sous 48 h)."
            />
            <Step
              n="03"
              title="Échangez"
              body="Une messagerie dédiée par réservation pour caler les détails."
            />
            <Step
              n="04"
              title="Vivez l'événement"
              body="Le pro est payé après l'événement. Vous laissez un avis si tout s'est bien passé."
              last
            />
          </div>
        </div>
      </section>

      {/* ── For pros ───────────────────────────────────────────── */}
      <section style={{ padding: '64px 80px', background: 'var(--brand-50)' }}>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}
        >
          <div>
            <Kicker>Vous êtes professionnel</Kicker>
            <h2
              style={{ fontSize: 'var(--text-3xl)', marginTop: 12, color: 'var(--charcoal-800)' }}
            >
              Concentrez-vous sur votre métier. On s'occupe du reste.
            </h2>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '24px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {[
                'Visibilité auprès des organisateurs locaux',
                'Paiement garanti, reversement automatique',
                'Calendrier de disponibilités intégré',
                'Aucun engagement — résiliez quand vous voulez',
              ].map((t) => (
                <li
                  key={t}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    fontSize: 15,
                    color: 'var(--charcoal-600)',
                  }}
                >
                  <span style={{ marginTop: 2 }}>
                    <Icon name="check" size={18} color="var(--brand-600)" strokeWidth={2} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="tk-btn tk-btn-primary tk-btn-lg">Devenir pro</button>
              <button className="tk-btn tk-btn-tertiary tk-btn-lg">Voir les tarifs</button>
            </div>
          </div>
          <Placeholder
            aspect="4 / 3"
            label="photo réelle · pro qui monte un chapiteau"
            style={{ borderRadius: 'var(--radius-lg)' }}
          />
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}

function SearchField({ label, value, icon, divider }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 20px',
        borderLeft: divider ? '1px solid var(--cream-200)' : 'none',
      }}
    >
      <Icon name={icon} size={18} color="var(--brand-500)" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--charcoal-500)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 14, color: 'var(--charcoal-700)', fontWeight: 500 }}>{value}</span>
      </div>
    </div>
  );
}

function TrustItem({ icon, text }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size={16} color="var(--brand-600)" />
      {text}
    </span>
  );
}

function CategoryCard({ icon, title, count, featured, soon }) {
  return (
    <div
      style={{
        background: 'var(--cream-50)',
        border: '1px solid var(--cream-200)',
        borderRadius: 'var(--radius-md)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: 180,
        position: 'relative',
        ...(featured
          ? { background: 'var(--charcoal-700)', borderColor: 'var(--charcoal-700)' }
          : {}),
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--radius)',
          background: featured ? 'var(--brand-500)' : 'var(--brand-50)',
          color: featured ? 'var(--cream-50)' : 'var(--brand-600)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={22} color="currentColor" strokeWidth={1.6} />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: featured ? 'var(--cream-50)' : 'var(--charcoal-700)',
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, color: featured ? 'var(--cream-200)' : 'var(--charcoal-400)' }}>
          {soon ? 'Bientôt disponible' : count}
        </div>
      </div>
      {!soon && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: featured ? 'var(--brand-300)' : 'var(--brand-700)',
          }}
        >
          Explorer <Icon name="arrow" size={14} />
        </div>
      )}
      {soon && (
        <span className="tk-badge" style={{ alignSelf: 'flex-start' }}>
          V1
        </span>
      )}
    </div>
  );
}

function ServiceCard({ title, pro, rating, reviews, price, location, badge, plabel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative' }}>
        <Placeholder aspect="4 / 3" label={plabel} style={{ borderRadius: 'var(--radius-md)' }} />
        <button
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--cream-50)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Icon name="heart" size={16} color="var(--charcoal-600)" />
        </button>
        {badge && (
          <span
            className="tk-badge tk-badge-brand"
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              background: 'var(--cream-50)',
              border: '1px solid var(--cream-200)',
              color: 'var(--brand-700)',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal-800)' }}>
            {title}
          </span>
          <Stars value={rating} count={reviews} size={13} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
          {pro} · {location}
        </div>
        <div style={{ fontSize: 14, color: 'var(--charcoal-700)', marginTop: 6, fontWeight: 500 }}>
          {price}
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, body, last }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 24,
        padding: '24px 0',
        borderBottom: last ? 'none' : '1px solid rgba(245, 241, 234, 0.12)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 400,
          color: 'var(--brand-300)',
          letterSpacing: '-0.02em',
          fontStyle: 'italic',
        }}
      >
        {n}
      </span>
      <div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 500,
            color: 'var(--cream-50)',
            marginBottom: 6,
            fontFamily: 'var(--font-display)',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 14, color: 'var(--cream-200)', lineHeight: 1.55, maxWidth: 460 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

function Footer() {
  const cols = [
    { title: 'tukio.one', links: ['À propos', 'Carrières', 'Presse', 'Le journal'] },
    { title: 'Aide', links: ["Centre d'aide", 'Comment ça marche', 'Nous contacter', 'Sécurité'] },
    { title: 'Pour les pros', links: ['Devenir pro', 'Tarifs', 'Outils pro', 'Témoignages'] },
    { title: 'Légal', links: ['CGU', 'CGV', 'Mentions légales', 'Confidentialité'] },
  ];
  return (
    <footer
      style={{
        padding: '64px 80px 40px',
        background: 'var(--cream-50)',
        borderTop: '1px solid var(--cream-200)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr repeat(4, 1fr)',
          gap: 48,
          marginBottom: 48,
        }}
      >
        <div>
          <Logo size={26} />
          <p
            style={{
              fontSize: 13,
              color: 'var(--charcoal-500)',
              marginTop: 16,
              lineHeight: 1.55,
              maxWidth: 280,
            }}
          >
            La place de marché des événements en Pays de la Loire. Pros locaux, paiement sécurisé,
            sans appel.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--charcoal-700)',
                marginBottom: 16,
              }}
            >
              {c.title}
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {c.links.map((l) => (
                <li key={l} style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 24,
          borderTop: '1px solid var(--cream-200)',
          fontSize: 12,
          color: 'var(--charcoal-400)',
        }}
      >
        <span>© 2026 tukio.one — Made in Nantes</span>
        <span>Hébergeur LCEN · Tiers de confiance Stripe</span>
      </div>
    </footer>
  );
}

window.HomeScreen = HomeScreen;
