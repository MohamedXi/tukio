/* Création / édition de service — /seller/services/new
   Wizard 4 étapes : Catégorie → Détails → Photos & options → Tarif & dispo
   On affiche l'étape 2 "Détails" qui est la plus dense, plus un footer wizard.
   Variante 2 : étape 4 "Tarif & dispo" sur un second artboard. */

function SellerServiceCreateScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
      <ProTopNav active="services" />

      {/* Header band */}
      <section
        style={{
          padding: '28px 40px 0',
          background: 'var(--cream-50)',
          borderBottom: '1px solid var(--cream-200)',
        }}
      >
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--charcoal-500)',
              marginBottom: 12,
            }}
          >
            <span>Mes services</span>
            <Icon name="arrow" size={11} />
            <span style={{ color: 'var(--charcoal-700)' }}>Nouveau service</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 24,
            }}
          >
            <div>
              <Kicker>Création service · brouillon</Kicker>
              <h1
                style={{
                  fontSize: 32,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 400,
                  letterSpacing: '-0.02em',
                  marginTop: 8,
                  color: 'var(--charcoal-800)',
                }}
              >
                Chapiteau bambou 8 × 12 m
              </h1>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--charcoal-400)',
                  marginTop: 4,
                }}
              >
                Auto-enregistré il y a 12 s
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingBottom: 6 }}>
              <button className="tk-btn tk-btn-tertiary tk-btn-sm">
                <Icon name="search" size={14} /> Aperçu
              </button>
              <button className="tk-btn tk-btn-tertiary tk-btn-sm">Enregistrer le brouillon</button>
            </div>
          </div>

          {/* Stepper */}
          <div style={{ marginTop: 24, paddingBottom: 20 }}>
            <Stepper
              steps={[
                { n: 1, label: 'Catégorie', state: 'done' },
                { n: 2, label: 'Détails', state: 'active' },
                { n: 3, label: 'Photos & options', state: 'upcoming' },
                { n: 4, label: 'Tarif & disponibilité', state: 'upcoming' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Layout : main + tip panel */}
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '32px 40px 120px',
          display: 'grid',
          gridTemplateColumns: '1fr 280px',
          gap: 32,
          alignItems: 'start',
        }}
      >
        {/* MAIN */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Catégorie résumée (step done) */}
          <div
            style={{
              padding: 16,
              background: 'var(--cream-50)',
              border: '1px solid var(--cream-200)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--success-50, #E8F4ED)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="check" size={16} color="var(--success-600, #2A7E55)" strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Étape 1 — Catégorie
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--charcoal-800)',
                  marginTop: 2,
                }}
              >
                Tentes & chapiteaux · Chapiteau structure rigide
              </div>
            </div>
            <button className="tk-btn tk-btn-tertiary tk-btn-sm" style={{ fontSize: 12 }}>
              Modifier
            </button>
          </div>

          {/* CARD : Identité */}
          <FormCard
            num="2.1"
            title="Identité"
            sub="Le titre apparaît dans les résultats de recherche — soyez précis sur les dimensions ou capacité."
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
              <FormField label="Titre du service" required hint="60 caractères max">
                <input
                  className="tk-input"
                  defaultValue="Chapiteau bambou 8 × 12 m — toile crème"
                />
              </FormField>

              <FormField label="Sous-titre / accroche" hint="Optionnel — visible sous le titre">
                <input
                  className="tk-input"
                  defaultValue="Structure bambou écoresponsable, montage inclus"
                  placeholder="ex. Idéal mariages 80-120 personnes"
                />
              </FormField>

              <FormField label="Description longue" required hint="412 / 1500 caractères">
                <div
                  style={{
                    minHeight: 130,
                    padding: '12px 14px',
                    background: 'var(--cream-50)',
                    border: '1px solid var(--cream-300)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 14,
                    color: 'var(--charcoal-700)',
                    lineHeight: 1.6,
                  }}
                >
                  Chapiteau bambou écoresponsable, conçu et fabriqué en Pays de la Loire. La
                  structure en bambou apporte une élégance naturelle, parfaite pour un mariage en
                  extérieur ou un événement corporate haut de gamme. Toile crème ignifugée, parois
                  latérales en option.
                  <br />
                  <br />
                  Livraison, montage et démontage inclus dans un rayon de 30 km autour de
                  Saint-Herblain. Au-delà, devis sur demande.
                </div>
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    background: 'var(--brand-50)',
                    border: '1px solid var(--brand-200)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    color: 'var(--brand-700)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Icon name="sparkle" size={13} color="var(--brand-600)" />
                  <span>
                    Suggestion tukio : ajoutez une mention sur la couleur de toile et la capacité.
                  </span>
                  <span style={{ flex: 1 }} />
                  <button
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--brand-700)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Appliquer
                  </button>
                </div>
              </FormField>
            </div>
          </FormCard>

          {/* CARD : Caractéristiques */}
          <FormCard
            num="2.2"
            title="Caractéristiques"
            sub="Affichées dans la fiche service — au moins 4 recommandées."
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <SpecField label="Dimensions" value="8 m × 12 m (96 m²)" icon="package" />
              <SpecField label="Capacité" value="80 à 120 personnes" icon="user" />
              <SpecField label="Matériau" value="Bambou & toile crème ignifugée" icon="tent" />
              <SpecField label="Hauteur" value="3,40 m au faîtage" icon="package" />
              <SpecField label="Plancher" value="Disponible en option" icon="grid" />
              <SpecField label="Éclairage" value="Guirlandes guinguette incluses" icon="bolt" />
            </div>

            <button
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: 'transparent',
                border: '1px dashed var(--cream-300)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--charcoal-500)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                justifyContent: 'center',
              }}
            >
              <Icon name="plus" size={14} /> Ajouter une caractéristique
            </button>
          </FormCard>

          {/* CARD : Inclus / non inclus */}
          <FormCard
            num="2.3"
            title="Ce qui est inclus / pas inclus"
            sub="Évite les malentendus avec le client."
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--success-700, #1E5C3D)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="check" size={12} color="var(--success-600, #2A7E55)" />
                  Inclus
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <IncludedItem label="Livraison aller-retour 30 km" />
                  <IncludedItem label="Montage par notre équipe (4 h)" />
                  <IncludedItem label="Démontage le lendemain" />
                  <IncludedItem label="Guirlandes guinguette" />
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--charcoal-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="x" size={12} color="var(--charcoal-500)" />
                  Pas inclus
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <IncludedItem label="Plancher bois (option +280 €)" excluded />
                  <IncludedItem label="Parois latérales (option +120 €)" excluded />
                  <IncludedItem label="Chauffage / clim (option)" excluded />
                </div>
              </div>
            </div>
          </FormCard>

          {/* CARD : SEO / discoverability */}
          <FormCard
            num="2.4"
            title="Visibilité & catégories"
            sub="Aide les clients à vous trouver."
          >
            <FormField label="Tags (max 8)" hint="Aident le moteur de recherche">
              <div
                style={{
                  padding: '8px 10px',
                  background: 'var(--cream-50)',
                  border: '1px solid var(--cream-300)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                {[
                  'chapiteau',
                  'bambou',
                  'mariage',
                  'écoresponsable',
                  'extérieur',
                  'Pays de la Loire',
                ].map((t) => (
                  <span
                    key={t}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      background: 'var(--brand-50)',
                      color: 'var(--brand-700)',
                      border: '1px solid var(--brand-200)',
                      borderRadius: 999,
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {t}
                    <Icon name="x" size={10} color="var(--brand-600)" />
                  </span>
                ))}
                <input
                  style={{
                    flex: 1,
                    minWidth: 100,
                    border: 'none',
                    outline: 'none',
                    padding: '4px 6px',
                    fontSize: 13,
                    background: 'transparent',
                  }}
                  placeholder="Ajouter un tag…"
                />
              </div>
            </FormField>

            <div style={{ marginTop: 14 }}>
              <FormField label="Convient pour" hint="Sélection multiple">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <ChipToggle label="Mariage" on />
                  <ChipToggle label="Anniversaire" on />
                  <ChipToggle label="Séminaire" on />
                  <ChipToggle label="Festival" />
                  <ChipToggle label="Repas de famille" />
                  <ChipToggle label="Cocktail / vin d'honneur" on />
                  <ChipToggle label="Tournage" />
                </div>
              </FormField>
            </div>
          </FormCard>
        </main>

        {/* SIDEBAR : Tips */}
        <aside
          style={{ position: 'sticky', top: 88, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="tk-card" style={{ padding: 18 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 10,
              }}
            >
              Aperçu fiche
            </div>
            <div
              style={{
                aspectRatio: '4/3',
                background: 'linear-gradient(135deg, #C7B89A 30%, #8C7A5C)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 12,
              }}
            />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              Chapiteau bambou 8 × 12 m
            </div>
            <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>
              Atelier Tente Loire
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--charcoal-800)',
                marginTop: 8,
                fontFamily: 'var(--font-mono)',
              }}
            >
              890 € / journée
            </div>
          </div>

          <div
            style={{
              padding: 16,
              background: 'var(--charcoal-700)',
              color: 'var(--cream-50)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Conseil tukio</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(250,247,242,0.75)' }}>
              Les fiches qui décrivent{' '}
              <strong style={{ color: 'var(--brand-300)' }}>ce qui n'est pas inclus</strong>{' '}
              reçoivent 22 % de demandes en moins, mais 40 % de réservations en plus.
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'rgba(250,247,242,0.5)',
              }}
            >
              Source — Données tukio, 2025
            </div>
          </div>

          <div className="tk-card" style={{ padding: 16 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--charcoal-800)',
                marginBottom: 10,
              }}
            >
              Complétion fiche
            </div>
            <div
              style={{
                height: 6,
                background: 'var(--cream-200)',
                borderRadius: 3,
                overflow: 'hidden',
                marginBottom: 12,
              }}
            >
              <div style={{ height: '100%', width: '62%', background: 'var(--brand-500)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CheckLi ok label="Titre & description" />
              <CheckLi ok label="Caractéristiques (6/4)" />
              <CheckLi ok label="Inclus / pas inclus" />
              <CheckLi label="Photos (à venir)" pending />
              <CheckLi label="Tarif (à venir)" pending />
              <CheckLi label="Disponibilités (à venir)" pending />
            </div>
          </div>
        </aside>
      </div>

      {/* Footer wizard sticky */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          borderTop: '1px solid var(--cream-200)',
          background: 'rgba(250, 247, 242, 0.92)',
          backdropFilter: 'blur(12px)',
          padding: '14px 40px',
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button className="tk-btn tk-btn-tertiary tk-btn-sm">
            <Icon name="arrowL" size={14} /> Retour
          </button>
          <div
            style={{ fontSize: 12, color: 'var(--charcoal-500)', fontFamily: 'var(--font-mono)' }}
          >
            Étape 2 sur 4 — Détails
          </div>
          <button className="tk-btn tk-btn-primary tk-btn-sm">
            Continuer · Photos & options <Icon name="arrow" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Variante : étape 4 — Tarif & disponibilité
// ────────────────────────────────────────────────────────────────
function SellerServicePricingScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
      <ProTopNav active="services" />

      <section
        style={{
          padding: '28px 40px 0',
          background: 'var(--cream-50)',
          borderBottom: '1px solid var(--cream-200)',
        }}
      >
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--charcoal-500)',
              marginBottom: 12,
            }}
          >
            <span>Mes services</span>
            <Icon name="arrow" size={11} />
            <span style={{ color: 'var(--charcoal-700)' }}>Chapiteau bambou 8 × 12 m</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 24,
            }}
          >
            <div>
              <Kicker>Création service · étape finale</Kicker>
              <h1
                style={{
                  fontSize: 32,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 400,
                  letterSpacing: '-0.02em',
                  marginTop: 8,
                  color: 'var(--charcoal-800)',
                }}
              >
                Tarif & disponibilité
              </h1>
            </div>
          </div>
          <div style={{ marginTop: 24, paddingBottom: 20 }}>
            <Stepper
              steps={[
                { n: 1, label: 'Catégorie', state: 'done' },
                { n: 2, label: 'Détails', state: 'done' },
                { n: 3, label: 'Photos & options', state: 'done' },
                { n: 4, label: 'Tarif & disponibilité', state: 'active' },
              ]}
            />
          </div>
        </div>
      </section>

      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '32px 40px 120px',
          display: 'grid',
          gridTemplateColumns: '1fr 280px',
          gap: 32,
          alignItems: 'start',
        }}
      >
        <main style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Tarif principal */}
          <FormCard num="4.1" title="Tarif principal" sub="Le client voit ce prix dans la fiche.">
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16 }}>
              <div>
                <label style={inputLabel2}>Modèle</label>
                <div
                  style={{
                    display: 'flex',
                    gap: 4,
                    padding: 3,
                    background: 'var(--cream-100)',
                    borderRadius: 999,
                  }}
                >
                  {['Forfait', 'Journée', 'Devis'].map((o, i) => (
                    <span
                      key={o}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: 12,
                        fontWeight: 500,
                        textAlign: 'center',
                        background: i === 1 ? 'var(--cream-50)' : 'transparent',
                        color: i === 1 ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
                        borderRadius: 999,
                        boxShadow: i === 1 ? '0 1px 2px rgba(0,0,0,0.06)' : undefined,
                      }}
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>

              <FormField
                label="Prix"
                required
                hint="HT — la TVA est ajoutée automatiquement à 20 %"
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input className="tk-input" defaultValue="890" style={{ paddingRight: 30 }} />
                    <span
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 14,
                        color: 'var(--charcoal-500)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      €
                    </span>
                  </div>
                  <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--charcoal-500)' }}>
                    par
                  </span>
                  <div style={{ flex: 1 }}>
                    <select className="tk-input" defaultValue="day" style={{ width: '100%' }}>
                      <option value="day">journée</option>
                      <option value="week">week-end</option>
                      <option value="3day">3 jours</option>
                    </select>
                  </div>
                </div>
              </FormField>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: 'var(--cream-100)',
                borderRadius: 'var(--radius-sm)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 16,
              }}
            >
              <PriceRow label="Prix affiché" value="890,00 €" />
              <PriceRow label="Frais tukio (10 %)" value="−89,00 €" muted />
              <PriceRow label="Vous touchez" value="801,00 €" highlight />
            </div>
          </FormCard>

          {/* Options payantes */}
          <FormCard
            num="4.2"
            title="Options payantes"
            sub="Le client peut les ajouter au moment de la réservation."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <OptionRow
                icon="grid"
                label="Plancher bois"
                sub="Forfait pour 96 m²"
                price="+ 280 €"
                enabled
              />
              <OptionRow
                icon="tent"
                label="Parois latérales"
                sub="4 panneaux toile"
                price="+ 120 €"
                enabled
              />
              <OptionRow
                icon="flame"
                label="Chauffage gaz 30 kW"
                sub="Du 1er oct. au 30 avr."
                price="+ 90 € / j"
                enabled
              />
              <OptionRow
                icon="bolt"
                label="Éclairage scénique"
                sub="6 spots LED + console"
                price="+ 150 €"
              />
              <button
                style={{
                  marginTop: 6,
                  padding: '10px 14px',
                  background: 'transparent',
                  border: '1px dashed var(--cream-300)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--charcoal-500)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  justifyContent: 'center',
                }}
              >
                <Icon name="plus" size={14} /> Ajouter une option
              </button>
            </div>
          </FormCard>

          {/* Disponibilité */}
          <FormCard
            num="4.3"
            title="Disponibilité"
            sub="Quand vous pouvez assurer cette prestation."
          >
            <FormField label="Délai minimum de prévenance">
              <div style={{ display: 'flex', gap: 8 }}>
                {['3 j', '7 j', '14 j', '21 j', '30 j'].map((o, i) => (
                  <span
                    key={o}
                    style={{
                      padding: '8px 14px',
                      background: i === 1 ? 'var(--charcoal-700)' : 'var(--cream-50)',
                      color: i === 1 ? 'var(--cream-50)' : 'var(--charcoal-700)',
                      border:
                        i === 1 ? '1px solid var(--charcoal-700)' : '1px solid var(--cream-300)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {o}
                  </span>
                ))}
              </div>
            </FormField>

            <div
              style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
            >
              <FormField label="Stock disponible" hint="Nombre d'unités simultanées">
                <input className="tk-input" defaultValue="2" />
              </FormField>
              <FormField label="Période d'ouverture" hint="Saison où le service est proposé">
                <select className="tk-input" defaultValue="all">
                  <option value="all">Toute l'année</option>
                  <option value="warm">Avril → octobre</option>
                  <option value="custom">Personnalisé</option>
                </select>
              </FormField>
            </div>

            {/* Mini-calendrier 2 mois */}
            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 10,
                }}
              >
                Bloquer des dates
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <MiniMonth label="Septembre 2026" blocked={[5, 6, 14]} />
                <MiniMonth label="Octobre 2026" blocked={[10, 11, 17, 18, 24, 25]} />
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  gap: 16,
                  fontSize: 12,
                  color: 'var(--charcoal-500)',
                }}
              >
                <LegendItem dot="var(--cream-50)" border="var(--cream-300)" label="Disponible" />
                <LegendItem dot="var(--brand-500)" label="Réservé" />
                <LegendItem dot="var(--charcoal-300, #B5AEA3)" label="Bloqué manuellement" />
              </div>
            </div>
          </FormCard>

          {/* Conditions */}
          <FormCard num="4.4" title="Conditions de réservation">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FormField label="Caution">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="tk-input" defaultValue="30" style={{ width: 70 }} />
                  <span style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>% du montant</span>
                </div>
              </FormField>
              <FormField label="Politique d'annulation">
                <select className="tk-input">
                  <option>Souple — gratuit jusqu'à J-7</option>
                  <option>Standard — gratuit jusqu'à J-14</option>
                  <option>Stricte — 50 % retenus jusqu'à J-30</option>
                </select>
              </FormField>
            </div>
          </FormCard>
        </main>

        {/* SIDEBAR */}
        <aside
          style={{ position: 'sticky', top: 88, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div
            style={{
              padding: 16,
              background: 'var(--brand-600)',
              color: 'var(--cream-50)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 8,
                opacity: 0.7,
              }}
            >
              Estimation revenu
            </div>
            <div
              style={{
                fontSize: 28,
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                letterSpacing: '-0.01em',
              }}
            >
              ≈ 9 612 € / an
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, lineHeight: 1.5 }}>
              Sur la base de 12 réservations/an, prix moyen 801 €.
            </div>
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid rgba(250,247,242,0.2)',
                fontSize: 11,
                opacity: 0.7,
                lineHeight: 1.5,
              }}
            >
              Estimation basée sur les pros similaires de votre zone.
            </div>
          </div>

          <div className="tk-card" style={{ padding: 16 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--charcoal-800)',
                marginBottom: 8,
              }}
            >
              Avant publication
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CheckLi ok label="Titre & description" />
              <CheckLi ok label="Caractéristiques" />
              <CheckLi ok label="6 photos" />
              <CheckLi ok label="Tarif principal" />
              <CheckLi label="Disponibilités du mois" pending />
            </div>
          </div>
        </aside>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          borderTop: '1px solid var(--cream-200)',
          background: 'rgba(250, 247, 242, 0.92)',
          backdropFilter: 'blur(12px)',
          padding: '14px 40px',
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button className="tk-btn tk-btn-tertiary tk-btn-sm">
            <Icon name="arrowL" size={14} /> Retour
          </button>
          <div
            style={{ fontSize: 12, color: 'var(--charcoal-500)', fontFamily: 'var(--font-mono)' }}
          >
            Étape 4 sur 4 — Tarif & disponibilité
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="tk-btn tk-btn-tertiary tk-btn-sm">Enregistrer en brouillon</button>
            <button className="tk-btn tk-btn-primary tk-btn-sm">
              Publier le service <Icon name="arrow" size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────

function Stepper({ steps }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const isDone = s.state === 'done';
        const isActive = s.state === 'active';
        return (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: isDone
                    ? 'var(--brand-600)'
                    : isActive
                      ? 'var(--cream-50)'
                      : 'var(--cream-100)',
                  border: isDone
                    ? '2px solid var(--brand-600)'
                    : isActive
                      ? '2px solid var(--brand-500)'
                      : '2px solid var(--cream-300)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: isDone
                    ? 'var(--cream-50)'
                    : isActive
                      ? 'var(--brand-700)'
                      : 'var(--charcoal-400)',
                }}
              >
                {isDone ? (
                  <Icon name="check" size={13} color="var(--cream-50)" strokeWidth={2.5} />
                ) : (
                  s.n
                )}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive || isDone ? 'var(--charcoal-800)' : 'var(--charcoal-400)',
                }}
              >
                {s.label}
              </span>
            </div>
            {!last && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: isDone ? 'var(--brand-300)' : 'var(--cream-200)',
                  margin: '0 16px',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function FormCard({ num, title, sub, children }) {
  return (
    <section className="tk-card" style={{ padding: 24 }}>
      <header
        style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--cream-200)' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          {num && (
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--brand-700)',
                fontWeight: 600,
              }}
            >
              {num}
            </span>
          )}
          <h2
            style={{
              fontSize: 17,
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              color: 'var(--charcoal-800)',
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            {title}
          </h2>
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 4 }}>{sub}</div>
        )}
      </header>
      {children}
    </section>
  );
}

function FormField({ label, required, hint, children }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <label
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: 'var(--charcoal-600)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label} {required && <span style={{ color: 'var(--brand-600)' }}>*</span>}
        </label>
        {hint && (
          <span
            style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--charcoal-400)' }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function SpecField({ label, value, icon }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--cream-50)',
        border: '1px solid var(--cream-300)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--cream-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={14} color="var(--brand-600)" />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--charcoal-500)',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--charcoal-800)', fontWeight: 500, marginTop: 1 }}>
          {value}
        </div>
      </div>
      <button
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--charcoal-400)',
          cursor: 'pointer',
          padding: 4,
        }}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}

function IncludedItem({ label, excluded }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        background: 'var(--cream-50)',
        border: '1px solid var(--cream-200)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: excluded ? 'var(--charcoal-500)' : 'var(--charcoal-800)',
      }}
    >
      <Icon
        name={excluded ? 'minus' : 'check'}
        size={12}
        color={excluded ? 'var(--charcoal-400)' : 'var(--success-600, #2A7E55)'}
      />
      <span style={{ flex: 1 }}>{label}</span>
      <button
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--charcoal-400)',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <Icon name="x" size={11} />
      </button>
    </div>
  );
}

function ChipToggle({ label, on }) {
  return (
    <span
      style={{
        padding: '6px 12px',
        background: on ? 'var(--brand-50)' : 'var(--cream-50)',
        color: on ? 'var(--brand-700)' : 'var(--charcoal-600)',
        border: on ? '1px solid var(--brand-300)' : '1px solid var(--cream-300)',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {on && <Icon name="check" size={11} color="var(--brand-700)" />}
      {label}
    </span>
  );
}

function CheckLi({ label, ok, pending }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: ok ? 'var(--charcoal-700)' : 'var(--charcoal-500)',
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: ok ? 'var(--success-600, #2A7E55)' : 'var(--cream-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {ok && <Icon name="check" size={9} color="var(--cream-50)" strokeWidth={3} />}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </div>
  );
}

const inputLabel2 = {
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  color: 'var(--charcoal-600)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  display: 'block',
  marginBottom: 6,
};

function PriceRow({ label, value, muted, highlight }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--charcoal-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          marginTop: 4,
          color: highlight
            ? 'var(--brand-700)'
            : muted
              ? 'var(--charcoal-500)'
              : 'var(--charcoal-800)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function OptionRow({ icon, label, sub, price, enabled }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        gap: 14,
        alignItems: 'center',
        padding: '12px 14px',
        background: enabled ? 'var(--cream-50)' : 'var(--cream-100)',
        border: enabled ? '1px solid var(--cream-300)' : '1px dashed var(--cream-300)',
        borderRadius: 'var(--radius-sm)',
        opacity: enabled ? 1 : 0.7,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--cream-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={15} color="var(--brand-600)" />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal-800)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--charcoal-500)', marginTop: 2 }}>{sub}</div>
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          color: 'var(--brand-700)',
        }}
      >
        {price}
      </div>
      <span
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          background: enabled ? 'var(--brand-500)' : 'var(--cream-300)',
          position: 'relative',
          display: 'inline-block',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: enabled ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--cream-50)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}
        />
      </span>
    </div>
  );
}

function MiniMonth({ label, blocked = [] }) {
  // Faux mois 30 jours, démarre lundi.
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  return (
    <div
      style={{
        padding: 14,
        background: 'var(--cream-50)',
        border: '1px solid var(--cream-200)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)', marginBottom: 8 }}>
        {label}
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}
      >
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div
            key={i}
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--charcoal-400)',
              textAlign: 'center',
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {days.map((d) => {
          const isBlocked = blocked.includes(d);
          return (
            <div
              key={d}
              style={{
                aspectRatio: '1',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isBlocked ? 'var(--charcoal-300, #B5AEA3)' : 'var(--cream-50)',
                color: isBlocked ? 'var(--cream-50)' : 'var(--charcoal-700)',
                border: isBlocked ? 'none' : '1px solid var(--cream-200)',
                cursor: 'pointer',
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendItem({ dot, border, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: dot,
          border: border ? `1px solid ${border}` : 'none',
        }}
      />
      {label}
    </span>
  );
}

Object.assign(window, { SellerServiceCreateScreen, SellerServicePricingScreen });
