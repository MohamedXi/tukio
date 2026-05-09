/* tukio.one — Design canvas
   Assembles all screens into pannable/zoomable sections.
   Each artboard is tagged with its version (MVP/V1/V2/V3) via VBoard. */

const ARTBOARD_PHONE = { width: 402, height: 874 };

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(() => {
    applyTweaks(t);
  }, [t]);

  const heroVariant = t.heroVariant;

  // Active version filter (drives VBoard visibility)
  const filter = [];
  if (t.showMVP) filter.push('MVP');
  if (t.showV1) filter.push('V1');
  if (t.showV2) filter.push('V2');
  if (t.showV3) filter.push('V3');
  const F = { filter };

  // Sections are inlined as `{[…].some(v => filter.includes(v)) && <DCSection …>}`
  // so DesignCanvas's React.Children walk sees them as DCSection (not a wrapper).

  return (
    <React.Fragment>
      <DesignCanvas>
        {t.showSystem && (
          <DCSection
            id="system"
            title="00 · Fondations"
            subtitle="Direction visuelle, type, couleurs, ton de voix — transversal toutes versions"
          >
            <DCArtboard id="ds" label="Design system" width={1280} height={2400}>
              <DesignSystemScreen />
            </DCArtboard>
          </DCSection>
        )}

        {t.showLogos && (
          <DCSection id="logo" title="00 · Logo tukio.one" subtitle="Trois directions de wordmark">
            <DCArtboard id="logos" label="Wordmark — A · B · C" width={1280} height={1400}>
              <LogoExplorationScreen />
            </DCArtboard>
          </DCSection>
        )}

        {/* ───────────────────────────── MVP ───────────────────────────── */}

        {['MVP'].some((v) => filter.includes(v)) && (
          <DCSection
            id="mvp-auth"
            title="MVP · Authentification & onboarding"
            subtitle="Inscription, login, vérification email, KYC pro — Keycloak hosted pages stylées"
          >
            {filter.includes('MVP') && (
              <DCArtboard
                id="auth-signup-client"
                label={
                  <>
                    <VersionBadge v="MVP" /> Inscription client
                  </>
                }
                width={1440}
                height={1100}
              >
                <AuthSignupClientScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="auth-login"
                label={
                  <>
                    <VersionBadge v="MVP" /> Connexion
                  </>
                }
                width={1440}
                height={1100}
              >
                <AuthLoginScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="auth-reset"
                label={
                  <>
                    <VersionBadge v="MVP" /> Mot de passe oublié
                  </>
                }
                width={1440}
                height={1100}
              >
                <AuthResetScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="auth-verify-email"
                label={
                  <>
                    <VersionBadge v="MVP" /> Vérification email
                  </>
                }
                width={1440}
                height={1100}
              >
                <AuthVerifyEmailScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="onb-1"
                label={
                  <>
                    <VersionBadge v="MVP" /> Onboarding pro · 1/5 — Identité
                  </>
                }
                width={1440}
                height={1200}
              >
                <ProOnbStep1Screen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="onb-2"
                label={
                  <>
                    <VersionBadge v="MVP" /> Onboarding pro · 2/5 — Activité
                  </>
                }
                width={1440}
                height={1200}
              >
                <ProOnbStep2Screen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="onb-3"
                label={
                  <>
                    <VersionBadge v="MVP" /> Onboarding pro · 3/5 — Documents (KYC)
                  </>
                }
                width={1440}
                height={1000}
              >
                <ProOnboardingScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="onb-4"
                label={
                  <>
                    <VersionBadge v="MVP" /> Onboarding pro · 4/5 — Compte de paiement (Stripe)
                  </>
                }
                width={1440}
                height={1200}
              >
                <ProOnbStep4Screen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="onb-5"
                label={
                  <>
                    <VersionBadge v="MVP" /> Onboarding pro · 5/5 — Récap & soumission
                  </>
                }
                width={1440}
                height={1200}
              >
                <ProOnbStep5Screen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="onb-pending"
                label={
                  <>
                    <VersionBadge v="MVP" /> Dossier en attente de validation admin
                  </>
                }
                width={1440}
                height={900}
              >
                <ProOnbPendingScreen />
              </DCArtboard>
            )}
          </DCSection>
        )}

        {['MVP', 'V1'].some((v) => filter.includes(v)) && (
          <DCSection
            id="client"
            title="03 · Parcours client"
            subtitle="De la découverte à la confirmation — desktop"
          >
            {filter.includes('MVP') && (
              <DCArtboard
                id="home"
                label={
                  <>
                    <VersionBadge v="MVP" /> Homepage
                  </>
                }
                width={1440}
                height={2800}
              >
                <HomeScreen heroVariant={heroVariant} />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="search"
                label={
                  <>
                    <VersionBadge v="MVP" /> Résultats de recherche
                  </>
                }
                width={1440}
                height={1900}
              >
                <SearchScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="service"
                label={
                  <>
                    <VersionBadge v="MVP" /> Fiche service
                  </>
                }
                width={1440}
                height={2200}
              >
                <ServiceScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="pro-profile"
                label={
                  <>
                    <VersionBadge v="MVP" /> Profil pro public — /pro/{'{slug}'}
                  </>
                }
                width={1440}
                height={2400}
              >
                <ProProfileScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="checkout"
                label={
                  <>
                    <VersionBadge v="MVP" /> Checkout — paiement
                  </>
                }
                width={1440}
                height={1100}
              >
                <CheckoutScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="confirmation"
                label={
                  <>
                    <VersionBadge v="MVP" /> Confirmation — /cart/confirmation/{'{id}'}
                  </>
                }
                width={1440}
                height={1900}
              >
                <ConfirmationScreen />
              </DCArtboard>
            )}
          </DCSection>
        )}

        {['MVP'].some((v) => filter.includes(v)) && (
          <DCSection
            id="client-account"
            title="04 · Espace client"
            subtitle="Gestion des réservations après paiement"
          >
            {filter.includes('MVP') && (
              <DCArtboard
                id="bookings"
                label={
                  <>
                    <VersionBadge v="MVP" /> Mes réservations — /account/bookings
                  </>
                }
                width={1440}
                height={1500}
              >
                <BookingsListScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="booking-detail"
                label={
                  <>
                    <VersionBadge v="MVP" /> Détail réservation — /account/bookings/{'{id}'}
                  </>
                }
                width={1440}
                height={2200}
              >
                <BookingDetailScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="cancel-form"
                label={
                  <>
                    <VersionBadge v="MVP" /> Annulation — étape 1 (impact + raison)
                  </>
                }
                width={1440}
                height={1700}
              >
                <CancelFlowFormScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="cancel-modal"
                label={
                  <>
                    <VersionBadge v="MVP" /> Annulation — modale destructive
                  </>
                }
                width={1440}
                height={1700}
              >
                <CancelFlowModalScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="cancel-success"
                label={
                  <>
                    <VersionBadge v="MVP" /> Annulation — confirmation
                  </>
                }
                width={1440}
                height={900}
              >
                <CancelFlowSuccessScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="review"
                label={
                  <>
                    <VersionBadge v="MVP" /> Avis post-événement — /account/bookings/{'{id}'}/review
                  </>
                }
                width={1440}
                height={2400}
              >
                <ReviewFormScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="messages"
                label={
                  <>
                    <VersionBadge v="MVP" /> Messagerie — /account/messages
                  </>
                }
                width={1440}
                height={900}
              >
                <MessagesScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="settings"
                label={
                  <>
                    <VersionBadge v="MVP" /> Paramètres compte — /account/settings
                  </>
                }
                width={1440}
                height={2800}
              >
                <AccountSettingsScreen />
              </DCArtboard>
            )}
          </DCSection>
        )}

        {['MVP'].some((v) => filter.includes(v)) && (
          <DCSection
            id="pro"
            title="05 · Espace pro"
            subtitle="Tableau de bord, demandes, services"
          >
            {filter.includes('MVP') && (
              <DCArtboard
                id="dashboard"
                label={
                  <>
                    <VersionBadge v="MVP" /> Dashboard pro
                  </>
                }
                width={1440}
                height={1200}
              >
                <ProDashboardScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="seller-bookings"
                label={
                  <>
                    <VersionBadge v="MVP" /> File des demandes — /seller/bookings
                  </>
                }
                width={1440}
                height={1700}
              >
                <SellerBookingsListScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="seller-detail"
                label={
                  <>
                    <VersionBadge v="MVP" /> Détail demande pro — /seller/bookings/{'{id}'}
                  </>
                }
                width={1440}
                height={2400}
              >
                <SellerBookingDetailScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="seller-accept"
                label={
                  <>
                    <VersionBadge v="MVP" /> Modale d'acceptation
                  </>
                }
                width={1440}
                height={2400}
              >
                <SellerAcceptModalScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="seller-calendar"
                label={
                  <>
                    <VersionBadge v="MVP" /> Calendrier pro — /seller/calendar
                  </>
                }
                width={1440}
                height={1500}
              >
                <SellerCalendarScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="seller-services"
                label={
                  <>
                    <VersionBadge v="MVP" /> Mes services — /seller/services
                  </>
                }
                width={1440}
                height={1700}
              >
                <SellerServicesScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="seller-profile-edit"
                label={
                  <>
                    <VersionBadge v="MVP" /> Édition vitrine pro — /seller/profile
                  </>
                }
                width={1440}
                height={2700}
              >
                <SellerProfileEditScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="seller-reviews"
                label={
                  <>
                    <VersionBadge v="MVP" /> Avis reçus — /seller/reviews
                  </>
                }
                width={1440}
                height={2400}
              >
                <SellerReviewsScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="svc-1"
                label={
                  <>
                    <VersionBadge v="MVP" /> Création service · 1/5 — Catégorie
                  </>
                }
                width={1440}
                height={1500}
              >
                <SvcCreateStep1Screen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="seller-service-create"
                label={
                  <>
                    <VersionBadge v="MVP" /> Création service · 2/5 — Détails
                  </>
                }
                width={1440}
                height={2200}
              >
                <SellerServiceCreateScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="svc-3"
                label={
                  <>
                    <VersionBadge v="MVP" /> Création service · 3/5 — Photos & médias
                  </>
                }
                width={1440}
                height={1700}
              >
                <SvcCreateStep3Screen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="seller-service-pricing"
                label={
                  <>
                    <VersionBadge v="MVP" /> Création service · 4/5 — Tarif & dispo
                  </>
                }
                width={1440}
                height={1900}
              >
                <SellerServicePricingScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="svc-5"
                label={
                  <>
                    <VersionBadge v="MVP" /> Création service · 5/5 — Aperçu & publication
                  </>
                }
                width={1440}
                height={1700}
              >
                <SvcCreateStep5Screen />
              </DCArtboard>
            )}
          </DCSection>
        )}

        {['MVP'].some((v) => filter.includes(v)) && (
          <DCSection
            id="admin"
            title="MVP · Back-office admin"
            subtitle="Validation pros, modération, transactions, litiges"
          >
            {filter.includes('MVP') && (
              <DCArtboard
                id="admin-home"
                label={
                  <>
                    <VersionBadge v="MVP" /> Admin · Tableau de bord
                  </>
                }
                width={1440}
                height={1200}
              >
                <AdminHomeScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="admin-pros-list"
                label={
                  <>
                    <VersionBadge v="MVP" /> Admin · File de validation pros
                  </>
                }
                width={1440}
                height={1300}
              >
                <AdminProsListScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="admin-pro-review"
                label={
                  <>
                    <VersionBadge v="MVP" /> Admin · Dossier pro à valider
                  </>
                }
                width={1440}
                height={1900}
              >
                <AdminProReviewScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="admin-reports"
                label={
                  <>
                    <VersionBadge v="MVP" /> Admin · Signalements
                  </>
                }
                width={1440}
                height={1300}
              >
                <AdminReportsScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="admin-transactions"
                label={
                  <>
                    <VersionBadge v="MVP" /> Admin · Transactions
                  </>
                }
                width={1440}
                height={1300}
              >
                <AdminTransactionsScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="admin-disputes"
                label={
                  <>
                    <VersionBadge v="MVP" /> Admin · Litiges
                  </>
                }
                width={1440}
                height={1500}
              >
                <AdminDisputesScreen />
              </DCArtboard>
            )}
            {filter.includes('MVP') && (
              <DCArtboard
                id="admin-audit"
                label={
                  <>
                    <VersionBadge v="MVP" /> Admin · Audit log
                  </>
                }
                width={1440}
                height={1100}
              >
                <AdminAuditScreen />
              </DCArtboard>
            )}
          </DCSection>
        )}

        {/* ───────────────────────────── V1 ───────────────────────────── */}

        {['V1'].some((v) => filter.includes(v)) && (
          <DCSection
            id="v1-checkout"
            title="V1 · Marketplace complète — checkout & devis"
            subtitle="Panier multi-vendeurs, devis personnalisés, acomptes"
          >
            {filter.includes('V1') && (
              <DCArtboard
                id="multi-cart"
                label={
                  <>
                    <VersionBadge v="V1" /> Panier multi-vendeurs
                  </>
                }
                width={1440}
                height={1400}
              >
                <V1MultiCartScreen />
              </DCArtboard>
            )}
            {filter.includes('V1') && (
              <DCArtboard
                id="multi-checkout"
                label={
                  <>
                    <VersionBadge v="V1" /> Checkout multi-vendeurs (splits Stripe)
                  </>
                }
                width={1440}
                height={1500}
              >
                <V1MultiCheckoutScreen />
              </DCArtboard>
            )}
            {filter.includes('V1') && (
              <DCArtboard
                id="quote-request"
                label={
                  <>
                    <VersionBadge v="V1" /> Demande de devis personnalisé
                  </>
                }
                width={1440}
                height={1400}
              >
                <V1QuoteRequestScreen />
              </DCArtboard>
            )}
            {filter.includes('V1') && (
              <DCArtboard
                id="quote-thread"
                label={
                  <>
                    <VersionBadge v="V1" /> Fil de devis (client/pro)
                  </>
                }
                width={1440}
                height={1400}
              >
                <V1QuoteThreadScreen />
              </DCArtboard>
            )}
            {filter.includes('V1') && (
              <DCArtboard
                id="installments"
                label={
                  <>
                    <VersionBadge v="V1" /> Acompte 30/70 — calendrier de paiements
                  </>
                }
                width={1440}
                height={1300}
              >
                <V1InstallmentsScreen />
              </DCArtboard>
            )}
          </DCSection>
        )}

        {['V1'].some((v) => filter.includes(v)) && (
          <DCSection
            id="v1-pro-billing"
            title="V1 · Abonnements pros"
            subtitle="Starter / Business / Enterprise — Stripe Billing"
          >
            {filter.includes('V1') && (
              <DCArtboard
                id="pricing"
                label={
                  <>
                    <VersionBadge v="V1" /> Page Pricing pros
                  </>
                }
                width={1440}
                height={1700}
              >
                <V1PricingScreen />
              </DCArtboard>
            )}
            {filter.includes('V1') && (
              <DCArtboard
                id="upgrade"
                label={
                  <>
                    <VersionBadge v="V1" /> Upgrade Starter → Business
                  </>
                }
                width={1440}
                height={1200}
              >
                <V1UpgradeScreen />
              </DCArtboard>
            )}
            {filter.includes('V1') && (
              <DCArtboard
                id="billing"
                label={
                  <>
                    <VersionBadge v="V1" /> Espace facturation pro — /seller/billing
                  </>
                }
                width={1440}
                height={1500}
              >
                <V1BillingScreen />
              </DCArtboard>
            )}
          </DCSection>
        )}

        {['V1'].some((v) => filter.includes(v)) && (
          <DCSection
            id="v1-trust"
            title="V1 · Sécurité & confiance"
            subtitle="MFA, login social, anti-désintermédiation, B2B"
          >
            {filter.includes('V1') && (
              <DCArtboard
                id="mfa-setup"
                label={
                  <>
                    <VersionBadge v="V1" /> MFA · Activer la 2FA (TOTP)
                  </>
                }
                width={1440}
                height={1100}
              >
                <V1MfaSetupScreen />
              </DCArtboard>
            )}
            {filter.includes('V1') && (
              <DCArtboard
                id="login-social"
                label={
                  <>
                    <VersionBadge v="V1" /> Connexion · login social Google + Apple
                  </>
                }
                width={1440}
                height={1100}
              >
                <V1LoginSocialScreen />
              </DCArtboard>
            )}
            {filter.includes('V1') && (
              <DCArtboard
                id="anti-desinter"
                label={
                  <>
                    <VersionBadge v="V1" /> Messagerie · alerte anti-désintermédiation
                  </>
                }
                width={1440}
                height={1100}
              >
                <V1AntiDesinterScreen />
              </DCArtboard>
            )}
            {filter.includes('V1') && (
              <DCArtboard
                id="signup-b2b"
                label={
                  <>
                    <VersionBadge v="V1" /> Inscription entreprise (B2B)
                  </>
                }
                width={1440}
                height={1300}
              >
                <V1SignupB2BScreen />
              </DCArtboard>
            )}
          </DCSection>
        )}

        {['V1'].some((v) => filter.includes(v)) && (
          <DCSection
            id="v1-reviews"
            title="V1 · Avis & litiges"
            subtitle="Multi-critères, réponse pro, workflow litige structuré"
          >
            {filter.includes('V1') && (
              <DCArtboard
                id="review-multi"
                label={
                  <>
                    <VersionBadge v="V1" /> Avis multi-critères
                  </>
                }
                width={1440}
                height={1700}
              >
                <V1ReviewMultiScreen />
              </DCArtboard>
            )}
            {filter.includes('V1') && (
              <DCArtboard
                id="review-reply"
                label={
                  <>
                    <VersionBadge v="V1" /> Réponse pro à un avis
                  </>
                }
                width={1440}
                height={1100}
              >
                <V1ReviewReplyScreen />
              </DCArtboard>
            )}
            {filter.includes('V1') && (
              <DCArtboard
                id="dispute-flow"
                label={
                  <>
                    <VersionBadge v="V1" /> Litige · ouverture → médiation
                  </>
                }
                width={1440}
                height={1700}
              >
                <V1DisputeFlowScreen />
              </DCArtboard>
            )}
          </DCSection>
        )}

        {/* ───────────────────────────── V2 ───────────────────────────── */}

        {['V2'].some((v) => filter.includes(v)) && (
          <DCSection
            id="v2"
            title="V2 · Croissance & rétention (mid-fi)"
            subtitle="Configurateur, recommandations, fidélité, Enterprise"
          >
            {filter.includes('V2') && (
              <DCArtboard
                id="configurator"
                label={
                  <>
                    <VersionBadge v="V2" /> Configurateur d'événement
                  </>
                }
                width={1440}
                height={1500}
              >
                <V2ConfiguratorScreen />
              </DCArtboard>
            )}
            {filter.includes('V2') && (
              <DCArtboard
                id="recommendations"
                label={
                  <>
                    <VersionBadge v="V2" /> Recommandations personnalisées
                  </>
                }
                width={1440}
                height={1100}
              >
                <V2RecommendationsScreen />
              </DCArtboard>
            )}
            {filter.includes('V2') && (
              <DCArtboard
                id="loyalty"
                label={
                  <>
                    <VersionBadge v="V2" /> Programme de fidélité
                  </>
                }
                width={1440}
                height={1200}
              >
                <V2LoyaltyScreen />
              </DCArtboard>
            )}
            {filter.includes('V2') && (
              <DCArtboard
                id="enterprise"
                label={
                  <>
                    <VersionBadge v="V2" /> Tier Enterprise · espace dédié
                  </>
                }
                width={1440}
                height={1300}
              >
                <V2EnterpriseScreen />
              </DCArtboard>
            )}
            {filter.includes('V2') && (
              <DCArtboard
                id="badges"
                label={
                  <>
                    <VersionBadge v="V2" /> Badges vérifié & pro de l'année
                  </>
                }
                width={1440}
                height={900}
              >
                <V2BadgesScreen />
              </DCArtboard>
            )}
            {filter.includes('V2') && (
              <DCArtboard
                id="seo-pages"
                label={
                  <>
                    <VersionBadge v="V2" /> Pages catégorie × ville (SEO)
                  </>
                }
                width={1440}
                height={1500}
              >
                <V2SeoPagesScreen />
              </DCArtboard>
            )}
          </DCSection>
        )}

        {/* ───────────────────────────── V3 ───────────────────────────── */}

        {['V3'].some((v) => filter.includes(v)) && (
          <DCSection
            id="v3"
            title="V3 · Vision long terme (wireframes)"
            subtitle="i18n, API publique, IA matching, white-label"
          >
            {filter.includes('V3') && (
              <DCArtboard
                id="i18n"
                label={
                  <>
                    <VersionBadge v="V3" /> Internationalisation · sélecteur pays/langue
                  </>
                }
                width={1440}
                height={900}
              >
                <V3I18nScreen />
              </DCArtboard>
            )}
            {filter.includes('V3') && (
              <DCArtboard
                id="api"
                label={
                  <>
                    <VersionBadge v="V3" /> API publique · documentation développeurs
                  </>
                }
                width={1440}
                height={1500}
              >
                <V3ApiScreen />
              </DCArtboard>
            )}
            {filter.includes('V3') && (
              <DCArtboard
                id="ai-matching"
                label={
                  <>
                    <VersionBadge v="V3" /> IA matching client ↔ pro
                  </>
                }
                width={1440}
                height={1300}
              >
                <V3AiMatchingScreen />
              </DCArtboard>
            )}
            {filter.includes('V3') && (
              <DCArtboard
                id="talents"
                label={
                  <>
                    <VersionBadge v="V3" /> Marketplace de talents (DJ, animateurs)
                  </>
                }
                width={1440}
                height={1200}
              >
                <V3TalentsScreen />
              </DCArtboard>
            )}
          </DCSection>
        )}

        {/* ───────────────────────────── Mobile ─────────────────────── */}

        {['MVP'].some((v) => filter.includes(v)) && (
          <DCSection
            id="mobile"
            title="06 · Mobile · MVP"
            subtitle="iOS — parcours réservation complet"
          >
            <DCArtboard
              id="m-home"
              label={
                <>
                  <VersionBadge v="MVP" /> Mobile · Accueil
                </>
              }
              width={ARTBOARD_PHONE.width}
              height={ARTBOARD_PHONE.height}
            >
              <IOSDevice>
                <MobileHomeScreen />
              </IOSDevice>
            </DCArtboard>
            <DCArtboard
              id="m-service"
              label={
                <>
                  <VersionBadge v="MVP" /> Mobile · Fiche service
                </>
              }
              width={ARTBOARD_PHONE.width}
              height={ARTBOARD_PHONE.height}
            >
              <IOSDevice>
                <MobileServiceScreen />
              </IOSDevice>
            </DCArtboard>
            <DCArtboard
              id="m-checkout"
              label={
                <>
                  <VersionBadge v="MVP" /> Mobile · Paiement
                </>
              }
              width={ARTBOARD_PHONE.width}
              height={ARTBOARD_PHONE.height}
            >
              <IOSDevice>
                <MobileCheckoutScreen />
              </IOSDevice>
            </DCArtboard>
            <DCArtboard
              id="m-confirmation"
              label={
                <>
                  <VersionBadge v="MVP" /> Mobile · Confirmation
                </>
              }
              width={ARTBOARD_PHONE.width}
              height={ARTBOARD_PHONE.height}
            >
              <IOSDevice>
                <MobileConfirmationScreen />
              </IOSDevice>
            </DCArtboard>
            <DCArtboard
              id="m-bookings"
              label={
                <>
                  <VersionBadge v="MVP" /> Mobile · Mes réservations
                </>
              }
              width={ARTBOARD_PHONE.width}
              height={ARTBOARD_PHONE.height}
            >
              <IOSDevice>
                <MobileBookingsScreen />
              </IOSDevice>
            </DCArtboard>
          </DCSection>
        )}
      </DesignCanvas>
      <TukioTweaks />
    </React.Fragment>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
