/* Mes réservations — /account/bookings (customer)
   Sidebar nav + liste filtrable + cards par statut. */

function BookingsListScreen() {
  const [filter, setFilter] = React.useState('all');
  const filters = [
    { id: 'all', label: 'Toutes', count: 5 },
    { id: 'upcoming', label: 'À venir', count: 2 },
    { id: 'pending', label: 'En attente', count: 1 },
    { id: 'past', label: 'Passées', count: 2 },
    { id: 'cancelled', label: 'Annulées', count: 0 },
  ];

  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <TopNav variant="customer" compactSearch={true} />

      {/* Header band */}
      <section
        style={{
          padding: '40px 40px 24px',
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
            <Kicker>Espace client · Marion D.</Kicker>
            <h1
              style={{
                fontSize: 44,
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                letterSpacing: '-0.02em',
                marginTop: 8,
                color: 'var(--charcoal-800)',
              }}
            >
              Mes réservations
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8 }}>
            <button className="tk-btn tk-btn-tertiary tk-btn-sm">
              <Icon name="doc" size={14} /> Télécharger l'historique
            </button>
            <button className="tk-btn tk-btn-primary tk-btn-sm">
              <Icon name="search" size={14} /> Nouvelle réservation
            </button>
          </div>
        </div>
      </section>

      {/* Layout : sidebar + main */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '32px 40px 64px',
          display: 'grid',
          gridTemplateColumns: '240px 1fr',
          gap: 40,
        }}
      >
        {/* ── Sidebar ─────────────────────────────────── */}
        <aside style={{ position: 'sticky', top: 88, alignSelf: 'start' }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--charcoal-400)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontFamily: 'var(--font-mono)',
              marginBottom: 12,
              paddingLeft: 12,
            }}
          >
            Mon compte
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SideLink icon="calendar" label="Réservations" badge="5" active />
            <SideLink icon="message" label="Messages" badge="2" />
            <SideLink icon="heart" label="Favoris" />
            <SideLink icon="star" label="Mes avis" />
            <SideLink icon="user" label="Profil" />
            <SideLink icon="card" label="Paiements & cartes" />
            <SideLink icon="bell" label="Notifications" />
          </nav>
          <div
            style={{
              marginTop: 24,
              padding: 16,
              background: 'var(--cream-100)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--cream-200)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--charcoal-800)',
                marginBottom: 6,
              }}
            >
              Besoin d'aide ?
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--charcoal-500)',
                lineHeight: 1.5,
                marginBottom: 12,
              }}
            >
              Notre équipe répond en 2 h ouvrées du lundi au vendredi.
            </div>
            <button
              className="tk-btn tk-btn-tertiary tk-btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Contacter Tukio
            </button>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────── */}
        <main>
          {/* Filter tabs */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              marginBottom: 20,
              borderBottom: '1px solid var(--cream-200)',
              paddingBottom: 0,
            }}
          >
            {filters.map((f) => (
              <FilterTab
                key={f.id}
                label={f.label}
                count={f.count}
                active={filter === f.id}
                onClick={() => setFilter(f.id)}
              />
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--charcoal-500)' }}>Trier par</span>
              <select
                style={{
                  fontSize: 13,
                  fontFamily: 'var(--font-body)',
                  padding: '6px 28px 6px 10px',
                  border: '1px solid var(--cream-300)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--cream-50)',
                  color: 'var(--charcoal-700)',
                  appearance: 'none',
                  backgroundImage:
                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23615C56' fill='none' stroke-width='1.5'/></svg>\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                }}
              >
                <option>Date d'événement</option>
                <option>Récemment ajoutées</option>
                <option>Statut</option>
              </select>
            </div>
          </div>

          {/* Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <BookingCard
              status="pending"
              bookingRef="#TUK-2026-00042"
              countdown="35 h 47 min"
              title="Chapiteau bambou 8×12 m"
              pro="Atelier Tente Loire · Saint-Herblain"
              proRating="4.9"
              proReviews="127"
              date="Sam. 14 sept. 2026"
              dateRel="dans 4 mois"
              location="Vertou (44)"
              total="926 €"
              totalNote="autorisé · non débité"
              plabel="chapiteau bambou"
              messages={1}
            />
            <BookingCard
              status="confirmed"
              bookingRef="#TUK-2026-00038"
              title="Pack 80 chaises Tiffany dorées"
              pro="Mobilier des Mariées · Nantes"
              proRating="4.7"
              proReviews="89"
              date="Sam. 22 juin 2026"
              dateRel="dans 3 semaines"
              location="Vertou (44)"
              total="240 €"
              totalNote="acompte 72 € débité"
              plabel="chaises tiffany"
              messages={0}
              progressIndex={1}
            />
            <BookingCard
              status="confirmed"
              bookingRef="#TUK-2026-00029"
              title="Mobilier lounge — séminaire"
              pro="Loca Events · Rezé"
              proRating="4.8"
              proReviews="62"
              date="Mar. 12 mai 2026"
              dateRel="dans 6 jours"
              location="Nantes (44)"
              total="2 100 €"
              totalNote="acompte débité · solde demain"
              plabel="lounge mobilier"
              messages={3}
              progressIndex={2}
              urgent
            />
            <BookingCard
              status="review"
              bookingRef="#TUK-2025-00874"
              title="100 chaises pliantes blanches"
              pro="Loca Events · Rezé"
              proRating="4.8"
              proReviews="62"
              date="Sam. 5 avril 2025"
              dateRel="il y a 4 semaines"
              location="Nantes (44)"
              total="500 €"
              totalNote="paiement complet"
              plabel="chaises pliantes"
              messages={0}
            />
            <BookingCard
              status="completed"
              bookingRef="#TUK-2024-00521"
              title="Tente berbère 6×4 m"
              pro="Camping Chic · La Baule"
              proRating="4.6"
              proReviews="34"
              date="Sam. 8 sept. 2024"
              dateRel="il y a 8 mois"
              location="La Baule (44)"
              total="780 €"
              totalNote="paiement complet"
              plabel="tente berbere"
              messages={0}
              userReview="5"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────

function SideLink({ icon, label, badge, active }) {
  return (
    <a
      href="#"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--cream-100)' : 'transparent',
        color: active ? 'var(--charcoal-800)' : 'var(--charcoal-600)',
        fontSize: 14,
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
      <Icon name={icon} size={16} color={active ? 'var(--brand-600)' : 'var(--charcoal-500)'} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: active ? 'var(--brand-600)' : 'var(--charcoal-500)',
            background: active ? 'var(--cream-50)' : 'var(--cream-200)',
            padding: '2px 7px',
            borderRadius: 999,
            minWidth: 20,
            textAlign: 'center',
          }}
        >
          {badge}
        </span>
      )}
    </a>
  );
}

function FilterTab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 16px 12px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--brand-600)' : '2px solid transparent',
        color: active ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        fontFamily: 'var(--font-body)',
        cursor: 'pointer',
        marginBottom: -1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: active ? 'var(--brand-600)' : 'var(--charcoal-400)',
          background: active ? 'var(--brand-50)' : 'var(--cream-100)',
          padding: '1px 7px',
          borderRadius: 999,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function BookingCard({
  status,
  bookingRef: refId,
  countdown,
  title,
  pro,
  proRating,
  proReviews,
  date,
  dateRel,
  location,
  total,
  totalNote,
  plabel,
  messages,
  progressIndex = 0,
  urgent,
  userReview,
}) {
  const meta = {
    pending: {
      label: 'En attente de confirmation',
      badgeClass: 'tk-badge-warning',
      icon: 'clock',
      accent: 'var(--warning-600)',
    },
    confirmed: {
      label: 'Confirmée',
      badgeClass: 'tk-badge-success',
      icon: 'check',
      accent: 'var(--success-600)',
    },
    review: {
      label: 'À évaluer',
      badgeClass: 'tk-badge-info',
      icon: 'star',
      accent: 'var(--info-600)',
    },
    completed: {
      label: 'Terminée',
      badgeClass: 'tk-badge-neutral',
      icon: 'check',
      accent: 'var(--charcoal-500)',
    },
    cancelled: {
      label: 'Annulée',
      badgeClass: 'tk-badge-neutral',
      icon: 'close',
      accent: 'var(--charcoal-500)',
    },
    refused: {
      label: 'Refusée — remboursée',
      badgeClass: 'tk-badge-neutral',
      icon: 'close',
      accent: 'var(--charcoal-500)',
    },
  }[status];

  return (
    <article
      className="tk-card"
      style={{ padding: 0, overflow: 'hidden', borderLeft: `3px solid ${meta.accent}` }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 220px', gap: 0 }}>
        {/* Image */}
        <Placeholder label={plabel} style={{ height: '100%', minHeight: 180, borderRadius: 0 }} />

        {/* Middle : info */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* status row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className={`tk-badge ${meta.badgeClass}`}>
              <Icon name={meta.icon} size={11} /> {meta.label}
            </span>
            <span
              style={{ fontSize: 11, color: 'var(--charcoal-400)', fontFamily: 'var(--font-mono)' }}
            >
              {refId}
            </span>
            {countdown && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--warning-700)',
                  fontWeight: 500,
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon name="clock" size={12} color="var(--warning-600)" />
                Réponse pro dans{' '}
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{countdown}</span>
              </span>
            )}
            {urgent && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--brand-700)',
                  fontWeight: 500,
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon name="bell" size={12} color="var(--brand-600)" />
                Solde débité demain
              </span>
            )}
          </div>

          {/* title */}
          <h3
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: 'var(--charcoal-800)',
              letterSpacing: '-0.005em',
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            {title}
          </h3>

          {/* pro */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              color: 'var(--charcoal-600)',
            }}
          >
            <span>{pro}</span>
            <span
              style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--cream-300)' }}
            />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="star" size={11} color="var(--brand-500)" strokeWidth={2} />{' '}
              <strong style={{ color: 'var(--charcoal-800)', fontWeight: 600 }}>{proRating}</strong>{' '}
              <span style={{ color: 'var(--charcoal-400)' }}>({proReviews})</span>
            </span>
          </div>

          {/* meta grid */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 4 }}
          >
            <Meta icon="calendar" label="Date" value={date} sub={dateRel} />
            <Meta icon="pin" label="Lieu" value={location} />
            <Meta icon="card" label="Total" value={total} sub={totalNote} mono />
          </div>

          {/* progress (confirmed only) */}
          {(status === 'confirmed' || status === 'review' || status === 'completed') && (
            <BookingProgress
              index={progressIndex || (status === 'review' ? 3 : status === 'completed' ? 3 : 0)}
            />
          )}

          {/* user review (completed) */}
          {userReview && (
            <div
              style={{
                marginTop: 4,
                padding: '8px 12px',
                background: 'var(--cream-100)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                color: 'var(--charcoal-600)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                alignSelf: 'flex-start',
              }}
            >
              <span>Votre avis :</span>
              <span style={{ display: 'inline-flex', gap: 1 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Icon
                    key={i}
                    name="star"
                    size={12}
                    color={i <= +userReview ? 'var(--brand-500)' : 'var(--cream-300)'}
                    strokeWidth={2}
                  />
                ))}
              </span>
              <a
                href="#"
                style={{ color: 'var(--brand-700)', textDecoration: 'none', fontWeight: 500 }}
              >
                Voir mon avis
              </a>
            </div>
          )}
        </div>

        {/* Right : actions */}
        <div
          style={{
            padding: '20px 20px',
            borderLeft: '1px solid var(--cream-200)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            justifyContent: 'center',
            background: 'var(--cream-50)',
          }}
        >
          {status === 'pending' && (
            <>
              <button
                className="tk-btn tk-btn-primary tk-btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Voir le détail
              </button>
              <button
                className="tk-btn tk-btn-secondary tk-btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Icon name="message" size={13} /> Messages{' '}
                {messages > 0 && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--brand-600)',
                      fontWeight: 600,
                    }}
                  >
                    ({messages})
                  </span>
                )}
              </button>
              <button
                className="tk-btn tk-btn-tertiary tk-btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Annuler
              </button>
            </>
          )}
          {status === 'confirmed' && (
            <>
              <button
                className="tk-btn tk-btn-primary tk-btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Voir le détail
              </button>
              <button
                className="tk-btn tk-btn-secondary tk-btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Icon name="message" size={13} /> Messages{' '}
                {messages > 0 && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--brand-600)',
                      fontWeight: 600,
                    }}
                  >
                    ({messages})
                  </span>
                )}
              </button>
              <button
                className="tk-btn tk-btn-tertiary tk-btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Annuler
              </button>
            </>
          )}
          {status === 'review' && (
            <>
              <button
                className="tk-btn tk-btn-primary tk-btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Icon name="star" size={13} /> Laisser un avis
              </button>
              <button
                className="tk-btn tk-btn-tertiary tk-btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Voir le détail
              </button>
            </>
          )}
          {status === 'completed' && (
            <>
              <button
                className="tk-btn tk-btn-tertiary tk-btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Voir le détail
              </button>
              <button
                className="tk-btn tk-btn-tertiary tk-btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Icon name="repeat" size={13} /> Réserver à nouveau
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function Meta({ icon, label, value, sub, mono }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <Icon
        name={icon}
        size={14}
        color="var(--charcoal-400)"
        style={{ marginTop: 3, flexShrink: 0 }}
      />
      <div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--charcoal-400)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-mono)',
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--charcoal-800)',
            lineHeight: 1.35,
            fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
          }}
        >
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: 'var(--charcoal-500)', marginTop: 1 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

function BookingProgress({ index }) {
  const steps = ['Demandée', 'Confirmée', 'Préparation', 'Réalisée'];
  return (
    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 0 }}>
      {steps.map((label, i) => {
        const done = i <= index;
        const current = i === index;
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: done ? 'var(--success-500)' : 'var(--cream-300)',
                  boxShadow: current ? '0 0 0 3px rgba(77, 124, 94, 0.18)' : 'none',
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: done ? 'var(--charcoal-700)' : 'var(--charcoal-400)',
                  fontWeight: current ? 600 : 500,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: i < index ? 'var(--success-500)' : 'var(--cream-300)',
                  margin: '0 10px',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

window.BookingsListScreen = BookingsListScreen;
