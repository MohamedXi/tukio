/* /account/bookings/{id}/review — formulaire d'avis post-événement
   Ton chaleureux, structure simple : note globale, sous-notes, commentaire,
   photos optionnelles. Pas de modale de confirmation (action constructive). */

function ReviewFormScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <TopNav active="bookings" />

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 40px 64px' }}>
        <a
          href="#"
          style={{
            fontSize: 13,
            color: 'var(--charcoal-500)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 28,
          }}
        >
          <Icon name="arrowL" size={14} /> Retour à ma réservation
        </a>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <Kicker color="var(--brand-700)">Votre événement · 15 juin 2026 · il y a 4 jours</Kicker>
          <h1
            style={{
              fontSize: 44,
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: 'var(--charcoal-800)',
              marginTop: 10,
              marginBottom: 12,
              lineHeight: 1.05,
            }}
          >
            Comment s'est passé
            <br />
            votre événement&nbsp;?
          </h1>
          <p
            style={{ fontSize: 16, color: 'var(--charcoal-500)', lineHeight: 1.55, maxWidth: 580 }}
          >
            Votre retour aide d'autres organisateurs à choisir le bon pro, et permet à Event Co
            Nantes de progresser. Comptez 2 minutes.
          </p>
        </div>

        {/* Booking strip */}
        <div
          className="tk-card"
          style={{
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 28,
            background: 'var(--cream-100)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, var(--brand-200), var(--brand-400))',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--cream-50)',
              flexShrink: 0,
            }}
          >
            <Icon name="tent" size={26} color="var(--cream-50)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal-800)' }}>
              Chapiteau bambou 8 × 12 m — toile crème
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--charcoal-500)',
                marginTop: 3,
                display: 'flex',
                gap: '2px 14px',
                flexWrap: 'wrap',
              }}
            >
              <span>Event Co Nantes</span>
              <span>·</span>
              <span>15 → 17 juin 2026</span>
              <span>·</span>
              <span>1 395 €</span>
            </div>
          </div>
          <a
            href="#"
            style={{
              fontSize: 13,
              color: 'var(--brand-700)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Voir détail →
          </a>
        </div>

        {/* Note globale */}
        <div className="tk-card" style={{ padding: 32, marginBottom: 16 }}>
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
            1 / 4 · Note globale
          </div>
          <h2
            style={{
              fontSize: 22,
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              color: 'var(--charcoal-800)',
              marginBottom: 6,
              letterSpacing: '-0.01em',
            }}
          >
            Recommanderiez-vous Event Co Nantes&nbsp;?
          </h2>
          <p style={{ fontSize: 14, color: 'var(--charcoal-500)', marginBottom: 24 }}>
            Cliquez sur le nombre d'étoiles correspondant.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                style={{
                  width: 56,
                  height: 56,
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: n <= 5 ? 'var(--brand-500)' : 'var(--cream-300)',
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width={48}
                  height={48}
                  fill={n <= 5 ? 'var(--brand-500)' : 'none'}
                  stroke="var(--brand-500)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9Z" />
                </svg>
              </button>
            ))}
            <div style={{ marginLeft: 16, display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: 28,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 400,
                  color: 'var(--charcoal-800)',
                  lineHeight: 1,
                }}
              >
                5,0
              </span>
              <span
                style={{ fontSize: 13, color: 'var(--brand-700)', fontWeight: 600, marginTop: 4 }}
              >
                Excellent — un coup de cœur
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              maxWidth: 320,
              fontSize: 11,
              color: 'var(--charcoal-400)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span>Décevant</span>
            <span>Excellent</span>
          </div>
        </div>

        {/* Sous-notes */}
        <div className="tk-card" style={{ padding: 32, marginBottom: 16 }}>
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
            2 / 4 · Détails
          </div>
          <h2
            style={{
              fontSize: 22,
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              color: 'var(--charcoal-800)',
              marginBottom: 24,
              letterSpacing: '-0.01em',
            }}
          >
            Plus précisément&hellip;
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SubRating label="Communication" sub="Clarté des échanges, réactivité" filled={5} />
            <SubRating
              label="Ponctualité"
              sub="Livraison et reprise dans les créneaux annoncés"
              filled={5}
            />
            <SubRating
              label="Conformité du matériel"
              sub="Correspond aux photos et description"
              filled={4}
            />
            <SubRating label="Rapport qualité-prix" sub="Pour le tarif payé" filled={5} />
          </div>
        </div>

        {/* Commentaire */}
        <div className="tk-card" style={{ padding: 32, marginBottom: 16 }}>
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
            3 / 4 · Votre commentaire
          </div>
          <h2
            style={{
              fontSize: 22,
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              color: 'var(--charcoal-800)',
              marginBottom: 6,
              letterSpacing: '-0.01em',
            }}
          >
            Racontez votre expérience
          </h2>
          <p style={{ fontSize: 14, color: 'var(--charcoal-500)', marginBottom: 18 }}>
            Qu'est-ce qui a fonctionné&nbsp;? Qu'est-ce qui pourrait être amélioré&nbsp;? Soyez
            précis et bienveillant.
          </p>

          <textarea
            defaultValue="Chapiteau magnifique, exactement comme sur les photos. Antoine est arrivé pile à l'heure le vendredi matin, montage rapide et propre. Il a même pris le temps de nous expliquer comment lester en cas de vent. La toile crème a sublimé le repas du soir avec les guirlandes LED. Démontage au petit matin du dimanche, sans bruit. On le rappellera l'année prochaine pour les 30 ans de mon mari."
            rows={8}
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: 15,
              fontFamily: 'var(--font-body)',
              border: '1px solid var(--cream-300)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--cream-50)',
              color: 'var(--charcoal-800)',
              resize: 'vertical',
              lineHeight: 1.6,
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
              fontSize: 12,
              color: 'var(--charcoal-500)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="check" size={12} color="var(--success-700)" strokeWidth={2.5} />
              <span style={{ color: 'var(--success-700)', fontWeight: 600 }}>478 caractères</span>
              <span>· min 50 requis</span>
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--charcoal-400)' }}>
              2000 max
            </span>
          </div>
        </div>

        {/* Photos */}
        <div className="tk-card" style={{ padding: 32, marginBottom: 16 }}>
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
            4 / 4 · Photos{' '}
            <span style={{ color: 'var(--charcoal-400)', fontWeight: 400 }}>· optionnel</span>
          </div>
          <h2
            style={{
              fontSize: 22,
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              color: 'var(--charcoal-800)',
              marginBottom: 6,
              letterSpacing: '-0.01em',
            }}
          >
            Ajoutez quelques photos
          </h2>
          <p style={{ fontSize: 14, color: 'var(--charcoal-500)', marginBottom: 18 }}>
            Une photo vaut mille mots — surtout pour un mariage. Elles seront publiées avec votre
            avis.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <PhotoTile filled gradient="linear-gradient(135deg, #d4a574, #8a6a4a)" />
            <PhotoTile filled gradient="linear-gradient(135deg, #c89a8a, #6a4a3a)" />
            <PhotoTile filled gradient="linear-gradient(135deg, #b89a7a, #7a5a4a)" />
            <PhotoTile />
          </div>
          <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 10 }}>
            3 photos ajoutées · jusqu'à 8 max · JPG, PNG · 10 Mo / photo
          </div>
        </div>

        {/* Disclosure */}
        <div
          style={{
            padding: 20,
            background: 'var(--cream-100)',
            border: '1px solid var(--cream-200)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            gap: 14,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--brand-100)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="shield" size={16} color="var(--brand-700)" />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--charcoal-800)',
                marginBottom: 4,
              }}
            >
              Bon à savoir
            </div>
            <div style={{ fontSize: 13, color: 'var(--charcoal-600)', lineHeight: 1.6 }}>
              Votre avis sera publié sous{' '}
              <strong style={{ color: 'var(--charcoal-800)', fontWeight: 600 }}>
                Marie&nbsp;D.
              </strong>{' '}
              (prénom + initiale). Le pro pourra y répondre publiquement. Vous pourrez le modifier
              pendant 30 jours.
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 0',
          }}
        >
          <button className="tk-btn tk-btn-tertiary">Plus tard</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="tk-btn tk-btn-secondary">Enregistrer comme brouillon</button>
            <button className="tk-btn tk-btn-primary">
              <Icon name="check" size={14} strokeWidth={2.5} /> Publier mon avis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubRating({ label, sub, filled }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        gap: 24,
        padding: '12px 16px',
        background: 'var(--cream-100)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal-800)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <svg
            key={n}
            viewBox="0 0 24 24"
            width={22}
            height={22}
            fill={n <= filled ? 'var(--brand-500)' : 'none'}
            stroke={n <= filled ? 'var(--brand-500)' : 'var(--cream-300)'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9Z" />
          </svg>
        ))}
      </div>
    </div>
  );
}

function PhotoTile({ filled, gradient }) {
  if (filled) {
    return (
      <div
        style={{
          aspectRatio: '1 / 1',
          borderRadius: 'var(--radius-sm)',
          background: gradient,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <button
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'rgba(34,30,26,0.65)',
            border: 'none',
            color: 'var(--cream-50)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="x" size={12} color="var(--cream-50)" strokeWidth={2.5} />
        </button>
      </div>
    );
  }
  return (
    <button
      style={{
        aspectRatio: '1 / 1',
        borderRadius: 'var(--radius-sm)',
        border: '1.5px dashed var(--cream-300)',
        background: 'var(--cream-50)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 4,
        color: 'var(--charcoal-500)',
      }}
    >
      <Icon name="plus" size={20} color="var(--charcoal-500)" />
      <span style={{ fontSize: 11, fontWeight: 600 }}>Ajouter</span>
    </button>
  );
}

window.ReviewFormScreen = ReviewFormScreen;
