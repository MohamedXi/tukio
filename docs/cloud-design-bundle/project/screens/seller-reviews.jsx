/* Avis reçus pro — /seller/reviews
   ProTopNav + score global + breakdown étoiles + tabs filtre + liste avis. */

function SellerReviewsScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
      <ProTopNav active="reviews" />

      {/* Header band */}
      <section
        style={{
          padding: '32px 40px 24px',
          background: 'var(--cream-50)',
          borderBottom: '1px solid var(--cream-200)',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
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
            Avis clients
          </h1>
          <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 6 }}>
            Vos clients laissent un avis dans les 14 jours suivant l'événement. Vous pouvez répondre
            publiquement à chaque avis.
          </div>
        </div>
      </section>

      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '32px 40px 64px',
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: 32,
          alignItems: 'start',
        }}
      >
        {/* ── Sidebar : score + breakdown ──────────────── */}
        <aside
          style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 88 }}
        >
          {/* Score global card */}
          <div className="tk-card" style={{ padding: 24 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}
            >
              Note globale
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                style={{
                  fontSize: 56,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 400,
                  color: 'var(--charcoal-800)',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                4,9
              </span>
              <span style={{ fontSize: 14, color: 'var(--charcoal-500)' }}>/ 5</span>
            </div>
            <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon key={i} name="star" size={14} color="var(--brand-500)" />
              ))}
            </div>
            <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 10 }}>
              <span style={{ fontWeight: 600, color: 'var(--charcoal-800)' }}>47 avis</span> · 124
              réservations
            </div>
            <div
              style={{
                marginTop: 14,
                padding: '8px 12px',
                background: 'var(--success-50, #E8F4ED)',
                color: 'var(--success-700, #1E5C3D)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon name="bolt" size={12} /> Top 3% des pros de votre catégorie
            </div>
          </div>

          {/* Breakdown étoiles */}
          <div className="tk-card" style={{ padding: 24 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 14,
              }}
            >
              Répartition
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <BreakdownRow stars={5} count={42} total={47} />
              <BreakdownRow stars={4} count={4} total={47} />
              <BreakdownRow stars={3} count={1} total={47} />
              <BreakdownRow stars={2} count={0} total={47} />
              <BreakdownRow stars={1} count={0} total={47} />
            </div>
          </div>

          {/* Sub-ratings */}
          <div className="tk-card" style={{ padding: 24 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 14,
              }}
            >
              Détail par critère
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SubRatingRow label="Communication" value={4.9} />
              <SubRatingRow label="Ponctualité" value={4.8} />
              <SubRatingRow label="Conformité" value={5.0} />
              <SubRatingRow label="Rapport qualité-prix" value={4.7} />
            </div>
          </div>

          {/* Action card */}
          <div
            style={{
              padding: 16,
              background: 'var(--charcoal-700)',
              color: 'var(--cream-50)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              3 avis en attente de réponse
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(250,247,242,0.7)',
                lineHeight: 1.5,
                marginBottom: 12,
              }}
            >
              Répondre aux avis (positifs comme négatifs) augmente la confiance des clients
              potentiels.
            </div>
            <button
              className="tk-btn tk-btn-primary tk-btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Voir les avis sans réponse
            </button>
          </div>
        </aside>

        {/* ── Main : list ────────────────────────────── */}
        <main>
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              marginBottom: 16,
              borderBottom: '1px solid var(--cream-200)',
            }}
          >
            <RevTab label="Tous" count="47" active />
            <RevTab label="Sans réponse" count="3" warn />
            <RevTab label="5 étoiles" count="42" />
            <RevTab label="≤ 3 étoiles" count="1" />
            <RevTab label="Cette année" count="18" />
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
                <option>Plus récents</option>
                <option>Note la plus basse</option>
                <option>Note la plus haute</option>
              </select>
            </div>
          </div>

          {/* Reviews */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Avis sans réponse */}
            <ReviewCard
              author="Camille R."
              authorSub="Mariage civil · Le Pellerin"
              date="il y a 4 jours"
              service="Chapiteau bambou 8 × 12 m"
              stars={5}
              title="Une équipe rare"
              body="L'installation a démarré à 7h pile, comme convenu. Le chapiteau était impeccable, et l'équipe a même aidé à réajuster une guirlande qui n'était pas de leur ressort. On a ressenti l'amour du métier — vraiment merci."
              subs={{ communication: 5, ponctualite: 5, conformite: 5, prix: 5 }}
              photos={2}
              needsReply
            />

            <ReviewCard
              author="Olivier M."
              authorSub="Anniversaire 50 ans · Vertou"
              date="il y a 6 jours"
              service="Pack lounge 30 personnes"
              stars={4}
              title="Pile ce qu'il fallait"
              body="Mobilier nickel, bien dans le ton qu'on cherchait. Petit moins sur l'horaire de retrait — l'équipe est venue à 23h alors qu'on avait demandé 22h, mais ils ont prévenu. Sinon top."
              subs={{ communication: 5, ponctualite: 3, conformite: 5, prix: 4 }}
              needsReply
            />

            <ReviewCard
              author="Sophie L."
              authorSub="Mariage · La Baule"
              date="il y a 12 jours"
              service="Chapiteau bambou 8 × 12 m"
              stars={5}
              title="On a été bluffés"
              body="Tout simplement parfait. L'arrivée la veille, le montage en silence pendant qu'on accueillait nos invités, et le démontage le lendemain sans qu'on s'en aperçoive. Ce genre de prestation où on n'a rien à gérer."
              subs={{ communication: 5, ponctualite: 5, conformite: 5, prix: 5 }}
              photos={4}
              reply={{
                date: 'il y a 11 jours',
                body: "Merci beaucoup Sophie ! Ravis d'avoir contribué à votre journée. On garde en mémoire la lumière du soir sur la plage — un vrai cadeau pour nous aussi.",
              }}
            />

            {/* Avis 3★ avec réponse exemplaire */}
            <ReviewCard
              author="Julien T."
              authorSub="Festival · Nantes"
              date="il y a 1 mois"
              service="Tonnelle pliante 3 × 3 m"
              stars={3}
              title="Bien mais une tonnelle abîmée"
              body="L'équipe est sympa et professionnelle. Sur les 8 tonnelles livrées, une avait un bras tordu — pas catastrophique mais ça se voyait. Remplacée le lendemain matin sans discussion, ce qui sauve la note."
              subs={{ communication: 5, ponctualite: 4, conformite: 2, prix: 3 }}
              reply={{
                date: 'il y a 1 mois',
                body: "Bonjour Julien, merci pour votre retour honnête. La tonnelle abîmée a été retirée du parc et remplacée chez le fabricant. C'est précisément ce type de retour qui nous fait progresser — au plaisir de retravailler avec vous.",
                badge: 'Réponse exemplaire',
              }}
            />

            <ReviewCard
              author="Léa B."
              authorSub="Baptême · Pornic"
              date="il y a 1 mois"
              service="Chaises Tiffany dorées"
              stars={5}
              title="Élégantes et confortables"
              body="60 chaises livrées et reprises sans accroc. Vraiment belles en photo, et solides. Service au top du début à la fin."
              subs={{ communication: 5, ponctualite: 5, conformite: 5, prix: 4 }}
              reply={{
                date: 'il y a 4 semaines',
                body: "Merci Léa ! C'était un plaisir.",
              }}
            />

            <ReviewCard
              author="Antoine D."
              authorSub="Séminaire entreprise · Saint-Nazaire"
              date="il y a 2 mois"
              service="Chapiteau bambou 8 × 12 m"
              stars={5}
              title="Sauvés par l'équipe"
              body="Pluie battante la veille, l'équipe a re-tendu la toile à 6h du matin pour qu'on n'ait pas une goutte. Au-delà du contrat. Merci."
              subs={{ communication: 5, ponctualite: 5, conformite: 5, prix: 5 }}
              reply={{
                date: 'il y a 2 mois',
                body: "Merci Antoine — c'est pour ces matinées-là qu'on continue.",
              }}
            />

            {/* Pagination */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: 12,
                gap: 10,
                alignItems: 'center',
              }}
            >
              <button className="tk-btn tk-btn-tertiary tk-btn-sm">
                <Icon name="arrowL" size={14} /> Précédent
              </button>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--charcoal-500)',
                }}
              >
                1 — 6 sur 47
              </span>
              <button className="tk-btn tk-btn-tertiary tk-btn-sm">
                Suivant <Icon name="arrow" size={14} />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────

function BreakdownRow({ stars, count, total }) {
  const pct = total === 0 ? 0 : (count / total) * 100;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 32px',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          color: 'var(--charcoal-700)',
        }}
      >
        {stars} <Icon name="star" size={10} color="var(--brand-500)" />
      </div>
      <div
        style={{ height: 6, background: 'var(--cream-200)', borderRadius: 3, overflow: 'hidden' }}
      >
        <div
          style={{
            height: '100%',
            width: pct + '%',
            background: 'var(--brand-500)',
            borderRadius: 3,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--charcoal-500)',
          textAlign: 'right',
        }}
      >
        {count}
      </span>
    </div>
  );
}

function SubRatingRow({ label, value }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--charcoal-700)' }}>{label}</span>
        <span
          style={{
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: 'var(--charcoal-800)',
          }}
        >
          {value.toFixed(1).replace('.', ',')}
        </span>
      </div>
      <div
        style={{ height: 4, background: 'var(--cream-200)', borderRadius: 2, overflow: 'hidden' }}
      >
        <div
          style={{
            height: '100%',
            width: (value / 5) * 100 + '%',
            background: 'var(--brand-500)',
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
}

function RevTab({ label, count, active, warn }) {
  return (
    <button
      style={{
        padding: '12px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--brand-600)' : '2px solid transparent',
        color: active ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
        fontSize: 13,
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
          padding: '2px 7px',
          background: warn
            ? 'var(--warning-50, #FBF1DD)'
            : active
              ? 'var(--brand-50)'
              : 'var(--cream-100)',
          color: warn
            ? 'var(--warning-800, #7E5215)'
            : active
              ? 'var(--brand-700)'
              : 'var(--charcoal-500)',
          borderRadius: 999,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function ReviewCard({
  author,
  authorSub,
  date,
  service,
  stars,
  title,
  body,
  subs,
  photos,
  needsReply,
  reply,
}) {
  return (
    <article
      className="tk-card"
      style={{
        padding: 24,
        borderLeft: needsReply ? '3px solid var(--warning-500, #C18527)' : undefined,
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 14,
          alignItems: 'start',
        }}
      >
        <Avatar name={author} size={40} tone="warm" />
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              {author}
            </span>
            <span
              style={{ fontSize: 12, color: 'var(--charcoal-400)', fontFamily: 'var(--font-mono)' }}
            >
              · {date}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>
            {authorSub} · service : <span style={{ color: 'var(--charcoal-700)' }}>{service}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Icon
              key={i}
              name="star"
              size={14}
              color={i <= stars ? 'var(--brand-500)' : 'var(--cream-300)'}
            />
          ))}
          <span
            style={{ marginLeft: 6, fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}
          >
            {stars},0
          </span>
        </div>
      </header>

      {/* Body */}
      <div style={{ marginTop: 16, paddingLeft: 54 }}>
        <h3
          style={{
            fontSize: 16,
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            color: 'var(--charcoal-800)',
            marginBottom: 6,
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 14, color: 'var(--charcoal-600)', lineHeight: 1.6, margin: 0 }}>
          {body}
        </p>

        {/* Sub-ratings inline */}
        {subs && (
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              marginTop: 14,
              padding: '10px 14px',
              background: 'var(--cream-100)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <SubChip label="Comm." value={subs.communication} />
            <SubChip label="Ponct." value={subs.ponctualite} />
            <SubChip label="Conform." value={subs.conformite} />
            <SubChip label="Prix" value={subs.prix} />
          </div>
        )}

        {/* Photos */}
        {photos > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {Array.from({ length: photos }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 64,
                  height: 64,
                  background: `linear-gradient(135deg, hsl(${30 + i * 12}, 28%, 70%), hsl(${30 + i * 12}, 28%, 50%))`,
                  borderRadius: 'var(--radius-sm)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reply */}
      {reply ? (
        <div
          style={{
            marginTop: 16,
            marginLeft: 54,
            padding: 14,
            background: 'var(--cream-100)',
            borderRadius: 'var(--radius-sm)',
            borderLeft: '2px solid var(--brand-500)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Avatar name="Atelier Tente Loire" size={22} tone="brand" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              Votre réponse
            </span>
            <span
              style={{ fontSize: 11, color: 'var(--charcoal-400)', fontFamily: 'var(--font-mono)' }}
            >
              · {reply.date}
            </span>
            {reply.badge && (
              <span
                style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  background: 'var(--brand-50)',
                  color: 'var(--brand-700)',
                  borderRadius: 999,
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {reply.badge}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--charcoal-600)', lineHeight: 1.6, margin: 0 }}>
            {reply.body}
          </p>
          <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 12,
                color: 'var(--charcoal-500)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Modifier
            </button>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 12,
                color: 'var(--charcoal-500)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Supprimer
            </button>
          </div>
        </div>
      ) : needsReply ? (
        <div
          style={{
            marginTop: 16,
            marginLeft: 54,
            padding: 14,
            background: 'var(--warning-50, #FBF1DD)',
            border: '1px dashed var(--warning-300, #DDC279)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon
              name="message"
              size={16}
              color="var(--warning-600, #B8721E)"
              style={{ marginTop: 2 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal-800)' }}>
                En attente de votre réponse
              </div>
              <div style={{ fontSize: 12, color: 'var(--charcoal-600)', marginTop: 2 }}>
                Répondre dans les 7 jours augmente la visibilité de votre profil.
              </div>
            </div>
            <button className="tk-btn tk-btn-primary tk-btn-sm">Répondre</button>
          </div>
        </div>
      ) : null}

      {/* Footer actions */}
      <div
        style={{
          marginTop: 14,
          marginLeft: 54,
          paddingTop: 12,
          borderTop: '1px solid var(--cream-200)',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <button style={footerBtn}>
          <Icon name="message" size={13} /> Contacter le client
        </button>
        <button style={footerBtn}>
          <Icon name="bolt" size={13} /> Signaler
        </button>
        <div style={{ flex: 1 }} />
        <span
          style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--charcoal-400)' }}
        >
          réservation #TUK-2025-0{Math.floor(Math.random() * 900) + 100}
        </span>
      </div>
    </article>
  );
}

function SubChip({ label, value }) {
  const muted = value <= 3;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        color: 'var(--charcoal-600)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--charcoal-500)', fontSize: 11 }}>
        {label}
      </span>
      <span style={{ display: 'flex', gap: 1 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background:
                i <= value
                  ? muted
                    ? 'var(--warning-500, #C18527)'
                    : 'var(--brand-500)'
                  : 'var(--cream-300)',
            }}
          />
        ))}
      </span>
    </span>
  );
}

const footerBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'transparent',
  border: 'none',
  padding: 0,
  fontSize: 12,
  color: 'var(--charcoal-500)',
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
};
