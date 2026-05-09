/* Flat layout — every artboard rendered as an isolated, fixed-size frame
   stacked vertically. No canvas, no transforms, no overflow clipping.
   Optimized for HTML→Figma plugins (html.to.design, Figma to HTML, etc.) */

const FLAT_FRAMES = [
  // 01 — Foundations
  {
    id: 'ds',
    section: '01 · Fondations',
    label: 'Design system',
    w: 1280,
    h: 2400,
    comp: 'DesignSystemScreen',
  },
  {
    id: 'logos',
    section: '01 · Fondations',
    label: 'Wordmark — A · B · C',
    w: 1280,
    h: 1400,
    comp: 'LogoExplorationScreen',
  },

  // 02 — Client desktop
  {
    id: 'home',
    section: '02 · Parcours client',
    label: 'Homepage',
    w: 1440,
    h: 2800,
    comp: 'HomeScreen',
  },
  {
    id: 'search',
    section: '02 · Parcours client',
    label: 'Résultats de recherche',
    w: 1440,
    h: 1900,
    comp: 'SearchScreen',
  },
  {
    id: 'service',
    section: '02 · Parcours client',
    label: 'Fiche service',
    w: 1440,
    h: 2200,
    comp: 'ServiceScreen',
  },
  {
    id: 'pro-profile',
    section: '02 · Parcours client',
    label: 'Profil pro public',
    w: 1440,
    h: 2400,
    comp: 'ProProfileScreen',
  },
  {
    id: 'checkout',
    section: '02 · Parcours client',
    label: 'Checkout — paiement',
    w: 1440,
    h: 1100,
    comp: 'CheckoutScreen',
  },
  {
    id: 'confirmation',
    section: '02 · Parcours client',
    label: 'Confirmation',
    w: 1440,
    h: 1900,
    comp: 'ConfirmationScreen',
  },

  // 03 — Espace client
  {
    id: 'bookings',
    section: '03 · Espace client',
    label: 'Mes réservations',
    w: 1440,
    h: 1500,
    comp: 'BookingsListScreen',
  },
  {
    id: 'booking-detail',
    section: '03 · Espace client',
    label: 'Détail réservation',
    w: 1440,
    h: 2200,
    comp: 'BookingDetailScreen',
  },
  {
    id: 'cancel-form',
    section: '03 · Espace client',
    label: 'Annulation — étape 1',
    w: 1440,
    h: 1700,
    comp: 'CancelFlowFormScreen',
  },
  {
    id: 'cancel-modal',
    section: '03 · Espace client',
    label: 'Annulation — modale',
    w: 1440,
    h: 1700,
    comp: 'CancelFlowModalScreen',
  },
  {
    id: 'cancel-success',
    section: '03 · Espace client',
    label: 'Annulation — succès',
    w: 1440,
    h: 900,
    comp: 'CancelFlowSuccessScreen',
  },
  {
    id: 'review',
    section: '03 · Espace client',
    label: 'Avis post-événement',
    w: 1440,
    h: 2400,
    comp: 'ReviewFormScreen',
  },
  {
    id: 'messages',
    section: '03 · Espace client',
    label: 'Messagerie',
    w: 1440,
    h: 900,
    comp: 'MessagesScreen',
  },
  {
    id: 'settings',
    section: '03 · Espace client',
    label: 'Paramètres compte',
    w: 1440,
    h: 2800,
    comp: 'AccountSettingsScreen',
  },

  // 04 — Espace pro
  {
    id: 'onboarding',
    section: '04 · Espace pro',
    label: 'Onboarding pro — étape 3/5',
    w: 1440,
    h: 1000,
    comp: 'ProOnboardingScreen',
  },
  {
    id: 'dashboard',
    section: '04 · Espace pro',
    label: 'Dashboard pro',
    w: 1440,
    h: 1200,
    comp: 'ProDashboardScreen',
  },
  {
    id: 'seller-bookings',
    section: '04 · Espace pro',
    label: 'File des demandes',
    w: 1440,
    h: 1700,
    comp: 'SellerBookingsListScreen',
  },
  {
    id: 'seller-detail',
    section: '04 · Espace pro',
    label: 'Détail demande pro',
    w: 1440,
    h: 2400,
    comp: 'SellerBookingDetailScreen',
  },
  {
    id: 'seller-accept',
    section: '04 · Espace pro',
    label: "Modale d'acceptation",
    w: 1440,
    h: 2400,
    comp: 'SellerAcceptModalScreen',
  },
  {
    id: 'seller-calendar',
    section: '04 · Espace pro',
    label: 'Calendrier pro',
    w: 1440,
    h: 1500,
    comp: 'SellerCalendarScreen',
  },
  {
    id: 'seller-services',
    section: '04 · Espace pro',
    label: 'Mes services',
    w: 1440,
    h: 1700,
    comp: 'SellerServicesScreen',
  },
  {
    id: 'seller-profile-edit',
    section: '04 · Espace pro',
    label: 'Édition vitrine pro',
    w: 1440,
    h: 2700,
    comp: 'SellerProfileEditScreen',
  },
  {
    id: 'seller-reviews',
    section: '04 · Espace pro',
    label: 'Avis reçus',
    w: 1440,
    h: 2400,
    comp: 'SellerReviewsScreen',
  },
  {
    id: 'seller-service-create',
    section: '04 · Espace pro',
    label: 'Création service — Détails',
    w: 1440,
    h: 2200,
    comp: 'SellerServiceCreateScreen',
  },
  {
    id: 'seller-service-pricing',
    section: '04 · Espace pro',
    label: 'Création service — Tarif & dispo',
    w: 1440,
    h: 1900,
    comp: 'SellerServicePricingScreen',
  },

  // 05 — Mobile
  {
    id: 'm-home',
    section: '05 · Mobile iOS',
    label: 'Mobile · Accueil',
    w: 402,
    h: 874,
    comp: 'MobileHomeScreen',
    mobile: true,
  },
  {
    id: 'm-service',
    section: '05 · Mobile iOS',
    label: 'Mobile · Fiche service',
    w: 402,
    h: 874,
    comp: 'MobileServiceScreen',
    mobile: true,
  },
  {
    id: 'm-checkout',
    section: '05 · Mobile iOS',
    label: 'Mobile · Paiement',
    w: 402,
    h: 874,
    comp: 'MobileCheckoutScreen',
    mobile: true,
  },
  {
    id: 'm-confirmation',
    section: '05 · Mobile iOS',
    label: 'Mobile · Confirmation',
    w: 402,
    h: 874,
    comp: 'MobileConfirmationScreen',
    mobile: true,
  },
  {
    id: 'm-bookings',
    section: '05 · Mobile iOS',
    label: 'Mobile · Mes réservations',
    w: 402,
    h: 874,
    comp: 'MobileBookingsScreen',
    mobile: true,
  },
];

function FlatFrame({ frame }) {
  const Comp = window[frame.comp];
  if (!Comp) {
    return (
      <div
        style={{
          width: frame.w,
          height: frame.h,
          background: '#fff5f5',
          border: '2px dashed #f88',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#a44',
        }}
      >
        Composant introuvable : {frame.comp}
      </div>
    );
  }
  return (
    <div
      data-figma-frame={frame.id}
      data-figma-label={frame.label}
      style={{
        width: frame.w,
        height: frame.h,
        background: 'var(--cream-50)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 2px 24px rgba(31, 29, 24, 0.08)',
        borderRadius: 4,
      }}
    >
      {frame.mobile ? (
        <IOSDevice>
          <Comp />
        </IOSDevice>
      ) : (
        <Comp />
      )}
    </div>
  );
}

function FlatLayout() {
  // Group by section
  const sections = {};
  FLAT_FRAMES.forEach((f) => {
    if (!sections[f.section]) sections[f.section] = [];
    sections[f.section].push(f);
  });

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: '#E8E4DB',
        padding: '60px 60px 120px',
        fontFamily: 'var(--font-sans, Inter), system-ui, sans-serif',
      }}
    >
      {/* Header for the document */}
      <header
        style={{
          maxWidth: 1560,
          margin: '0 auto 60px',
          paddingBottom: 32,
          borderBottom: '1px solid #C9C2B3',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: '#75705F',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          tukio.one — design exploration
        </div>
        <h1
          style={{
            fontSize: 56,
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: 'var(--charcoal-800)',
            margin: '12px 0 8px',
          }}
        >
          Export à plat{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--brand-600)' }}>pour Figma</em>
        </h1>
        <p style={{ fontSize: 14, color: '#5C5849', maxWidth: 720, lineHeight: 1.6 }}>
          Tous les écrans à plat, à dimensions exactes (1440 × N px desktop, 402 × 874 mobile).
          Importez ce HTML avec un plugin <strong>html.to.design</strong> ou{' '}
          <strong>Figma to HTML</strong> pour obtenir des frames Figma éditables.
        </p>
        <div
          style={{
            marginTop: 18,
            padding: '12px 16px',
            background: '#FAF7F2',
            border: '1px solid #C9C2B3',
            borderRadius: 8,
            fontSize: 13,
            color: '#3A372E',
            maxWidth: 720,
          }}
        >
          <strong>Astuce :</strong> dans{' '}
          <code style={{ background: '#EFEAE0', padding: '2px 6px', borderRadius: 3 }}>
            html.to.design
          </code>
          , collez le lien public de cette page. Chaque{' '}
          <code style={{ background: '#EFEAE0', padding: '2px 6px', borderRadius: 3 }}>
            data-figma-frame
          </code>
          devient un calque Figma nommé.
        </div>
      </header>

      {Object.entries(sections).map(([title, frames]) => (
        <section key={title} style={{ maxWidth: 1560, margin: '0 auto 80px' }}>
          <h2
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: '#75705F',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 32,
              paddingBottom: 12,
              borderBottom: '1px solid #C9C2B3',
            }}
          >
            {title}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 80 }}>
            {frames.map((f) => (
              <article key={f.id}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: '#75705F',
                      padding: '3px 8px',
                      background: '#FAF7F2',
                      border: '1px solid #C9C2B3',
                      borderRadius: 4,
                    }}
                  >
                    {f.id}
                  </span>
                  <h3
                    style={{
                      fontSize: 18,
                      fontFamily: 'var(--font-display)',
                      fontWeight: 500,
                      letterSpacing: '-0.01em',
                      color: 'var(--charcoal-800)',
                      margin: 0,
                    }}
                  >
                    {f.label}
                  </h3>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#75705F' }}>
                    {f.w} × {f.h}
                  </span>
                </div>
                <FlatFrame frame={f} />
              </article>
            ))}
          </div>
        </section>
      ))}

      <footer
        style={{
          maxWidth: 1560,
          margin: '0 auto',
          paddingTop: 40,
          borderTop: '1px solid #C9C2B3',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          color: '#75705F',
        }}
      >
        {FLAT_FRAMES.length} frames · tukio.one — flat export for Figma
      </footer>
    </div>
  );
}

const flatRoot = ReactDOM.createRoot(document.getElementById('root'));
flatRoot.render(<FlatLayout />);
