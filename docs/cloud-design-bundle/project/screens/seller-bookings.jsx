/* Pro side — request handling
   3 artboards in one file:
   1. SellerBookingsListScreen — /seller/bookings (queue de demandes + confirmées)
   2. SellerBookingDetailScreen — /seller/bookings/{id} (demande pending)
   3. SellerAcceptModalScreen — modale d'acceptation overlay sur la même vue détail */

// ── Local Section / Field (Babel scope is per-file) ─────────────
function SBSection({ title, icon, children }) {
  return (
    <div className="tk-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        {icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'var(--cream-100)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={14} color="var(--charcoal-600)" />
          </div>
        )}
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--charcoal-800)' }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}
function SBField({ label, value, sub }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--charcoal-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-mono)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--charcoal-800)', fontWeight: 500 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
const Section = SBSection;
const Field = SBField;

// ── ProTopNav — kept as a thin alias around ProShell so existing JSX
// (`<ProTopNav active="bookings" />`) is replaced by ProShell wrapping.
// We don't render it directly anymore; the screens below use ProShell.
const ProTopNav = () => null;

// ────────────────────────────────────────────────────────────────
// 1. /seller/bookings — file de demandes
// ────────────────────────────────────────────────────────────────
function SellerBookingsListScreen() {
  return (
    <ProShell active="bookings">
      <ProPageHeader
        breadcrumb="Espace pro · Mobilier des Mariées"
        title="Vos réservations"
        actions={
          <>
            <button className="tk-btn tk-btn-tertiary tk-btn-sm">
              <Icon name="upload" size={14} /> Exporter
            </button>
            <select
              defaultValue="urgency"
              style={{
                padding: '8px 32px 8px 12px',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                border: '1px solid var(--cream-300)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--cream-50)',
                color: 'var(--charcoal-700)',
                appearance: 'none',
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%23615C56' fill='none' stroke-width='1.5'/></svg>\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                cursor: 'pointer',
              }}
            >
              <option value="urgency">Tri : urgence</option>
              <option value="event-asc">Date événement (croissant)</option>
              <option value="amount-desc">Montant (décroissant)</option>
            </select>
          </>
        }
      />
      <div style={{ padding: '0 8px' }}>
        {/* Stats row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 28,
          }}
        >
          <ProStat label="À traiter" value="3" sub="dont 1 urgent" highlight="warning" />
          <ProStat label="Confirmées" value="8" sub="à venir" />
          <ProStat label="CA en cours" value="3 240 €" sub="net après commission" />
          <ProStat label="Taux d'acceptation" value="94 %" sub="30 derniers jours" />
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            borderBottom: '1px solid var(--cream-200)',
            marginBottom: 24,
          }}
        >
          <ProTab label="À traiter" count={3} active />
          <ProTab label="Confirmées" count={8} />
          <ProTab label="Terminées" count={42} />
          <ProTab label="Annulées / refusées" count={2} />
          <ProTab label="Toutes" count={55} />
        </div>

        {/* Pending requests block */}
        <SectionLabel>Demandes à accepter ou refuser</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          <SellerBookingCard
            urgent
            countdown="11 h 24 min"
            client="Marie D."
            clientNote="1ʳᵉ réservation"
            service="Pack mariage — 80 chaises Tiffany + 10 tables rondes"
            dates="15 → 17 juin 2026"
            location="Nantes 44000 · 8 km"
            total="1 395 €"
            net="1 255 €"
            commission="140 €"
          />
          <SellerBookingCard
            countdown="35 h 47 min"
            client="Léa R."
            clientNote="3ᵉ résa Tukio"
            service="20 chaises Tiffany dorées"
            dates="22 juin 2026"
            location="Saint-Sébastien-sur-Loire · 6 km"
            total="120 €"
            net="108 €"
            commission="12 €"
          />
          <SellerBookingCard
            countdown="2 j 4 h"
            client="Hugo T."
            service="Mobilier complet — 50 personnes"
            dates="5 → 6 juillet 2026"
            location="Pornic · 38 km"
            total="980 €"
            net="882 €"
            commission="98 €"
          />
        </div>

        <SectionLabel>Confirmées · à venir</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SellerConfirmedCard
            client="Pierre M."
            service="100 chaises pliantes"
            dates="22 juin 2026 · J-19"
            location="Saint-Nazaire · 62 km"
            total="500 €"
            net="450 €"
            messages={2}
          />
          <SellerConfirmedCard
            client="Sophie L."
            service="Pack lounge — 30 personnes"
            dates="29 juin 2026 · J-26"
            location="Nantes · 4 km"
            total="650 €"
            net="585 €"
          />
          <SellerConfirmedCard
            client="Thomas B."
            service="80 chaises Tiffany dorées"
            dates="4 juillet 2026 · J-31"
            location="La Baule · 65 km"
            total="240 €"
            net="216 €"
            urgent
            urgentLabel="Solde sera débité dans 24h"
          />
        </div>
      </div>
    </ProShell>
  );
}

function ProStat({ label, value, sub, highlight }) {
  const isWarning = highlight === 'warning';
  return (
    <div
      className="tk-card"
      style={{
        padding: 18,
        background: isWarning ? 'var(--warning-50)' : 'var(--cream-50)',
        borderColor: isWarning ? 'var(--warning-200)' : undefined,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: isWarning ? 'var(--warning-700)' : 'var(--charcoal-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 30,
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          color: 'var(--charcoal-800)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function ProTab({ label, count, active }) {
  return (
    <a
      style={{
        padding: '12px 16px',
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
        borderBottom: active ? '2px solid var(--brand-500)' : '2px solid transparent',
        marginBottom: -1,
        cursor: 'pointer',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 11,
          padding: '1px 7px',
          background: active ? 'var(--brand-100)' : 'var(--cream-100)',
          color: active ? 'var(--brand-700)' : 'var(--charcoal-500)',
          borderRadius: 999,
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {count}
      </span>
    </a>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: 'var(--charcoal-500)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function SellerBookingCard({
  urgent,
  countdown,
  client,
  clientNote,
  service,
  dates,
  location,
  total,
  net,
  commission,
}) {
  const accent = urgent ? 'var(--danger-600)' : 'var(--warning-600)';
  return (
    <div
      className="tk-card"
      style={{ padding: 0, overflow: 'hidden', borderLeft: `3px solid ${accent}` }}
    >
      {/* Top band — countdown */}
      <div
        style={{
          padding: '10px 24px',
          background: urgent ? 'rgba(181, 58, 43, 0.06)' : 'var(--warning-50)',
          borderBottom: '1px solid var(--cream-200)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Icon name="clock" size={14} color={accent} strokeWidth={2.5} />
        <span style={{ fontSize: 13, fontWeight: 600, color: accent }}>
          {urgent ? '⚠ Urgent — ' : 'Reste '}
          {countdown}
          {urgent ? ' avant expiration' : ' pour répondre'}
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          padding: 20,
          display: 'grid',
          gridTemplateColumns: '1fr 280px',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Avatar name={client} size={28} tone="cream" />
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>
                {client}
              </span>
              {clientNote && (
                <span style={{ fontSize: 12, color: 'var(--charcoal-500)', marginLeft: 8 }}>
                  · {clientNote}
                </span>
              )}
            </div>
          </div>
          <h3
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: 'var(--charcoal-800)',
              marginBottom: 10,
              lineHeight: 1.3,
            }}
          >
            {service}
          </h3>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 14px',
              fontSize: 13,
              color: 'var(--charcoal-600)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="calendar" size={13} color="var(--charcoal-500)" /> {dates}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="pin" size={13} color="var(--charcoal-500)" /> {location}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--charcoal-500)',
              marginTop: 10,
              fontStyle: 'italic',
            }}
          >
            "Accès véhicule possible jusqu'à 10 m du lieu de pose. Préférez livraison matin avant 10
            h."
          </div>
        </div>

        {/* Money + actions */}
        <div
          style={{ background: 'var(--cream-100)', borderRadius: 'var(--radius-sm)', padding: 14 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              color: 'var(--charcoal-500)',
              marginBottom: 4,
            }}
          >
            <span>Total client</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--charcoal-700)' }}>
              {total}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              color: 'var(--charcoal-500)',
              marginBottom: 8,
            }}
          >
            <span>Commission Tukio</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>−{commission}</span>
          </div>
          <div style={{ height: 1, background: 'var(--cream-200)', margin: '4px 0 8px' }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--charcoal-700)', fontWeight: 600 }}>
              Vous toucherez
            </span>
            <span
              style={{
                fontSize: 18,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: 'var(--success-700)',
              }}
            >
              {net}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              className="tk-btn tk-btn-primary tk-btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Icon name="check" size={13} strokeWidth={2.5} /> Accepter
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="tk-btn tk-btn-tertiary tk-btn-sm"
                style={{ flex: 1, justifyContent: 'center', color: 'var(--charcoal-600)' }}
              >
                Refuser
              </button>
              <button
                className="tk-btn tk-btn-tertiary tk-btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Détail
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SellerConfirmedCard({
  client,
  service,
  dates,
  location,
  total,
  net,
  messages,
  urgent,
  urgentLabel,
}) {
  return (
    <div
      className="tk-card"
      style={{
        padding: 18,
        display: 'grid',
        gridTemplateColumns: '1fr 200px 160px',
        gap: 24,
        alignItems: 'center',
        borderLeft: urgent ? '3px solid var(--brand-500)' : '3px solid var(--success-500)',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Avatar name={client} size={26} tone="cream" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>
            {client}
          </span>
          <span className="tk-badge tk-badge-success" style={{ fontSize: 10 }}>
            <Icon name="check" size={10} /> Confirmée
          </span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--charcoal-700)', marginBottom: 6 }}>{service}</div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 14px',
            fontSize: 12,
            color: 'var(--charcoal-500)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="calendar" size={12} /> {dates}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="pin" size={12} /> {location}
          </span>
        </div>
        {urgent && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: 'var(--brand-700)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon name="bolt" size={12} color="var(--brand-700)" /> {urgentLabel}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--charcoal-400)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Vous toucherez
        </div>
        <div
          style={{
            fontSize: 18,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: 'var(--charcoal-800)',
          }}
        >
          {net}
        </div>
        <div style={{ fontSize: 11, color: 'var(--charcoal-500)' }}>sur {total} client</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          className="tk-btn tk-btn-secondary tk-btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Détail
        </button>
        <button
          className="tk-btn tk-btn-tertiary tk-btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <Icon name="message" size={12} /> Messages{' '}
          {messages ? (
            <span
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-700)', fontWeight: 600 }}
            >
              ({messages})
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 2. /seller/bookings/{id} — détail demande pending
// ────────────────────────────────────────────────────────────────
function SellerBookingDetailScreen({ withAcceptModal }) {
  return (
    <ProShell active="bookings">
      <div style={{ position: 'relative' }}>
        <div style={{ padding: '0 8px 12px' }}>
          <a
            href="#"
            style={{
              fontSize: 13,
              color: 'var(--charcoal-500)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon name="arrowL" size={14} /> Retour aux réservations
          </a>
        </div>

        {/* Urgency banner */}
        <div style={{ padding: '12px 8px 0' }}>
          <div
            style={{
              padding: '14px 20px',
              background: 'var(--warning-50)',
              border: '1px solid var(--warning-200)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Icon name="clock" size={18} color="var(--warning-700)" strokeWidth={2.5} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning-700)' }}>
                Reste 35 h 47 min pour répondre
              </div>
              <div style={{ fontSize: 12, color: 'var(--charcoal-600)', marginTop: 2 }}>
                Au-delà, la demande expire automatiquement et le client est remboursé.
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 8px 0' }}>
          <Kicker color="var(--charcoal-500)">
            Demande · #TUK-2026-00091 · reçue il y a 12 min
          </Kicker>
          <h1
            style={{
              fontSize: 32,
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: 'var(--charcoal-800)',
              marginTop: 6,
              marginBottom: 24,
              lineHeight: 1.1,
            }}
          >
            Demande de Marie D.
          </h1>
        </div>

        <div
          style={{
            padding: '0 8px 64px',
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: 32,
            alignItems: 'start',
          }}
        >
          {/* Main */}
          <main style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Section title="Détails de la demande" icon="doc">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 24,
                  marginBottom: 20,
                }}
              >
                <Field
                  label="Service demandé"
                  value="Chapiteau bambou 8 × 12 m"
                  sub="toile crème · stock 2/2 disponible"
                />
                <Field label="Quantité" value="1 chapiteau" />
                <Field label="Dates" value="Du 15 au 17 juin 2026" sub="3 jours · livraison J-1" />
                <Field
                  label="Lieu"
                  value="12 rue des Lilas, 44000 Nantes"
                  sub="≈ 8 km de votre adresse · accès véhicule OK"
                />
              </div>
              <div style={{ height: 1, background: 'var(--cream-200)', marginBottom: 16 }} />
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 8,
                }}
              >
                Options
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <span className="tk-badge tk-badge-success">
                  <Icon name="check" size={11} /> Éclairage LED guirlandes
                </span>
                <span className="tk-badge tk-badge-neutral">— Plancher</span>
                <span className="tk-badge tk-badge-neutral">— Chauffage</span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 8,
                }}
              >
                Instructions client
              </div>
              <div
                style={{
                  padding: 14,
                  background: 'var(--cream-100)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  color: 'var(--charcoal-700)',
                  lineHeight: 1.55,
                  fontStyle: 'italic',
                }}
              >
                "Accès véhicule possible jusqu'à 10 m du lieu de pose. Préférez livraison matin
                avant 10 h. C'est un mariage en plein air, terrain en pelouse, prévoir cales si
                besoin."
              </div>
            </Section>

            <Section title="Détail financier" icon="card">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--charcoal-500)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontFamily: 'var(--font-mono)',
                      marginBottom: 12,
                    }}
                  >
                    Décomposition
                  </div>
                  <PayRow2 label="Chapiteau bambou (3 jours)" value="1 200 €" />
                  <PayRow2 label="Éclairage LED" value="195 €" />
                  <PayRow2 label="Livraison & reprise" value="incluse" sub />
                  <Divider2 />
                  <PayRow2 label="Total client" value="1 395 €" bold />
                </div>
                <div style={{ borderLeft: '1px solid var(--cream-200)', paddingLeft: 32 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--charcoal-500)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontFamily: 'var(--font-mono)',
                      marginBottom: 12,
                    }}
                  >
                    Votre revenu
                  </div>
                  <PayRow2 label="Total client" value="1 395 €" />
                  <PayRow2 label="Commission Tukio (10 %)" value="−140 €" sub />
                  <Divider2 />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      padding: '5px 0',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)' }}>
                      Vous toucherez
                    </span>
                    <span
                      style={{
                        fontSize: 24,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        color: 'var(--success-700)',
                      }}
                    >
                      1 255 €
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 6 }}>
                    Reversement automatique{' '}
                    <strong style={{ color: 'var(--charcoal-700)', fontWeight: 600 }}>
                      J+1 après l'événement
                    </strong>{' '}
                    (≈ 18 juin 2026) sur votre compte Stripe.
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Cliente" icon="user">
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                <Avatar name="Marie Dupont" size={56} tone="info" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--charcoal-800)' }}>
                    Marie D.
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
                    Membre depuis février 2026 · 1ʳᵉ réservation Tukio
                  </div>
                </div>
                <span className="tk-badge tk-badge-info">
                  <Icon name="sparkle" size={11} /> Nouvelle cliente
                </span>
              </div>
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--cream-100)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  color: 'var(--charcoal-600)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icon name="shield" size={13} color="var(--charcoal-500)" />
                <span>
                  Email et téléphone seront{' '}
                  <strong style={{ color: 'var(--charcoal-800)', fontWeight: 600 }}>
                    débloqués après acceptation
                  </strong>
                  . Pour l'instant, échangez via la messagerie Tukio.
                </span>
              </div>
            </Section>

            <Section title="Vérification automatique des disponibilités" icon="check">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CheckRow
                  ok
                  label="Aucune autre réservation sur ces dates"
                  sub="Calendrier vérifié pour les 15-17 juin"
                />
                <CheckRow
                  ok
                  label="Stock disponible"
                  sub="2 chapiteaux bambou disponibles, 0 réservés sur cette période"
                />
                <CheckRow
                  ok
                  label="Zone de livraison"
                  sub="Nantes 44000 — distance 8 km, dans votre rayon de 30 km"
                />
                <CheckRow
                  warn
                  label="Conflit potentiel proche"
                  sub="Vous avez une autre réservation le 14 juin (J-1) à La Baule (65 km)"
                />
              </div>
            </Section>
          </main>

          {/* Sidebar — actions */}
          <aside
            style={{
              position: 'sticky',
              top: 88,
              alignSelf: 'start',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div className="tk-card" style={{ padding: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 14,
                }}
              >
                Décision
              </div>

              <button
                className="tk-btn tk-btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
              >
                <Icon name="check" size={14} strokeWidth={2.5} /> Accepter la demande
              </button>
              <button
                className="tk-btn tk-btn-secondary"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
              >
                <Icon name="message" size={14} /> Demander une précision
              </button>
              <button
                className="tk-btn tk-btn-tertiary"
                style={{ width: '100%', justifyContent: 'center', color: 'var(--danger-700)' }}
              >
                <Icon name="x" size={14} /> Refuser
              </button>

              <div style={{ height: 1, background: 'var(--cream-200)', margin: '16px 0' }} />

              <div
                style={{
                  fontSize: 11,
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 10,
                }}
              >
                Aide à la décision
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--charcoal-600)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ display: 'flex', gap: 8 }}>
                  <Icon
                    name="bolt"
                    size={13}
                    color="var(--charcoal-500)"
                    style={{ flexShrink: 0, marginTop: 1 }}
                  />
                  <span>
                    Votre taux d'acceptation est de{' '}
                    <strong style={{ color: 'var(--charcoal-800)', fontWeight: 600 }}>94 %</strong>{' '}
                    — refuser cette demande le baissera à 92 %.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Icon
                    name="euroBig"
                    size={13}
                    color="var(--charcoal-500)"
                    style={{ flexShrink: 0, marginTop: 1 }}
                  />
                  <span>
                    Cette demande équivaut à{' '}
                    <strong style={{ color: 'var(--charcoal-800)', fontWeight: 600 }}>~ 8 %</strong>{' '}
                    de votre CA prévisionnel sur juin.
                  </span>
                </div>
              </div>
            </div>

            <div
              className="tk-card"
              style={{
                padding: 16,
                background: 'var(--cream-100)',
                border: '1px solid var(--cream-200)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 8,
                }}
              >
                Récap
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: 'var(--charcoal-600)' }}>Total client</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--charcoal-800)',
                    fontWeight: 500,
                  }}
                >
                  1 395 €
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--charcoal-600)' }}>Vous toucherez</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--success-700)',
                    fontWeight: 600,
                  }}
                >
                  1 255 €
                </span>
              </div>
            </div>
          </aside>
        </div>

        {withAcceptModal && <AcceptModal />}
      </div>
    </ProShell>
  );
}

function CheckRow({ ok, warn, label, sub }) {
  const color = warn ? 'var(--warning-700)' : 'var(--success-700)';
  const icon = warn ? 'bolt' : 'check';
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '10px 12px',
        background: warn ? 'var(--warning-50)' : 'var(--success-50)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <Icon
        name={icon}
        size={14}
        color={color}
        strokeWidth={2.5}
        style={{ flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: color }}>{label}</div>
        {sub && (
          <div style={{ fontSize: 12, color: 'var(--charcoal-600)', marginTop: 2 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

function PayRow2({ label, value, sub, bold }) {
  return (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}
    >
      <span
        style={{
          color: sub ? 'var(--charcoal-500)' : 'var(--charcoal-700)',
          fontWeight: bold ? 600 : 400,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: sub ? 'var(--charcoal-500)' : 'var(--charcoal-800)',
          fontWeight: bold ? 600 : 500,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider2() {
  return <div style={{ height: 1, background: 'var(--cream-200)', margin: '8px 0' }} />;
}

// ────────────────────────────────────────────────────────────────
// 3. Modale d'acceptation
// ────────────────────────────────────────────────────────────────
function AcceptModal() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(34, 30, 26, 0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 120,
        paddingBottom: 40,
        zIndex: 100,
      }}
    >
      <div
        className="tk-card"
        style={{
          padding: 0,
          maxWidth: 520,
          width: 'calc(100% - 80px)',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ padding: '28px 28px 0' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--success-50)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Icon name="check" size={22} color="var(--success-700)" strokeWidth={2.5} />
          </div>
          <h2
            style={{
              fontSize: 24,
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              color: 'var(--charcoal-800)',
              marginBottom: 8,
              lineHeight: 1.2,
            }}
          >
            Confirmer l'acceptation ?
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'var(--charcoal-500)',
              lineHeight: 1.55,
              marginBottom: 20,
            }}
          >
            En acceptant, vous vous engagez à honorer cette réservation. Le paiement sera capturé
            sur la carte de Marie et reversé après l'événement.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <CommitRow icon="calendar" title="Honorer la réservation" sub="Du 15 au 17 juin 2026" />
            <CommitRow
              icon="truck"
              title="Livrer à l'adresse indiquée"
              sub="12 rue des Lilas, 44000 Nantes"
            />
            <CommitRow
              icon="euroBig"
              title="Le client sera débité de 1 395 €"
              sub="Vous toucherez 1 255 € (J+1 après l'événement)"
            />
          </div>

          <div style={{ marginBottom: 4 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--charcoal-800)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Message à Marie{' '}
              <span style={{ fontWeight: 400, color: 'var(--charcoal-400)' }}>· optionnel</span>
            </label>
            <textarea
              defaultValue="Bonjour Marie, je confirme votre réservation. Je reviendrai vers vous 7 jours avant l'événement pour caler la livraison. À bientôt !"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                border: '1px solid var(--cream-300)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--cream-50)',
                color: 'var(--charcoal-800)',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
          </div>
        </div>

        <div
          style={{
            padding: '20px 28px 24px',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--cream-200)',
            marginTop: 16,
          }}
        >
          <button className="tk-btn tk-btn-tertiary">Retour</button>
          <button className="tk-btn tk-btn-primary">
            <Icon name="check" size={14} strokeWidth={2.5} /> Confirmer l'acceptation
          </button>
        </div>
      </div>
    </div>
  );
}

function CommitRow({ icon, title, sub }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: '10px 12px',
        background: 'var(--cream-100)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: 'var(--cream-50)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={14} color="var(--charcoal-600)" strokeWidth={2} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

// Wrapper for "with modal open" view
function SellerAcceptModalScreen() {
  return <SellerBookingDetailScreen withAcceptModal />;
}

window.SellerBookingsListScreen = SellerBookingsListScreen;
window.SellerBookingDetailScreen = SellerBookingDetailScreen;
window.SellerAcceptModalScreen = SellerAcceptModalScreen;
