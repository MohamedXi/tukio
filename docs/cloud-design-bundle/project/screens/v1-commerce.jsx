/* V1 — Marketplace complète : panier multi-vendeurs, devis, acomptes
   Respecte la grammaire visuelle du MVP Checkout : header logo + stepper, fond cream-100,
   container 1280, blocs numérotés en cartes, aside récap sticky, chiffres font-display. */

// ─────────── Header partagé (identique au MVP Checkout) ───────────
function V1Header({ step, steps, secure = 'Paiement sécurisé Stripe' }) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 40px',
        borderBottom: '1px solid var(--cream-200)',
        background: 'var(--cream-50)',
      }}
    >
      <Logo size={22} />
      {steps && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            fontSize: 13,
            color: 'var(--charcoal-500)',
          }}
        >
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <V1Step n={i + 1} label={s} done={i + 1 < step} active={i + 1 === step} />
              {i < steps.length - 1 && (
                <span style={{ width: 32, height: 1, background: 'var(--cream-300)' }} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      <span
        style={{
          fontSize: 13,
          color: 'var(--charcoal-500)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Icon name="shield" size={14} color="var(--success-500)" /> {secure}
      </span>
    </header>
  );
}
function V1Step({ n, label, active, done }) {
  const color = active ? 'var(--brand-500)' : done ? 'var(--success-500)' : 'var(--charcoal-400)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        color,
        fontWeight: active ? 600 : 500,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: active
            ? 'var(--brand-500)'
            : done
              ? 'var(--success-500)'
              : 'var(--cream-200)',
          color: active || done ? 'var(--cream-50)' : 'var(--charcoal-500)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {done ? <Icon name="check" size={12} color="currentColor" strokeWidth={2.5} /> : n}
      </span>
      {label}
    </span>
  );
}
function V1Block({ title, children, badge, hint }) {
  return (
    <section className="tk-card" style={{ padding: 24, marginTop: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 500 }}>{title}</h2>
          {hint && (
            <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 4 }}>{hint}</div>
          )}
        </div>
        {badge && (
          <span className="tk-badge tk-badge-success">
            <Icon name="check" size={12} /> {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
function V1Sline({ label, value, muted, strong }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 14,
        color: muted ? 'var(--charcoal-500)' : 'var(--charcoal-700)',
        fontWeight: strong ? 600 : 400,
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

// ─────────── 1. Panier multi-vendeurs ───────────
function V1MultiCartScreen() {
  const sellers = [
    {
      name: 'Atelier Tente Loire',
      initials: 'AT',
      date: '13 → 15 juin',
      items: [
        { t: 'Chapiteau bambou 8×12 m', q: 1, p: 1170 },
        { t: 'Plancher bois clair', q: 1, p: 280 },
      ],
      sub: 1450,
    },
    {
      name: "Mobilier d'Anjou",
      initials: 'MA',
      date: 'Livraison 13 juin',
      items: [
        { t: 'Tables rondes 8 pers.', q: 8, p: 22 },
        { t: 'Chaises Tiffany ivoire', q: 80, p: 4 },
      ],
      sub: 496,
    },
    {
      name: 'Lumière & Son 44',
      initials: 'LS',
      date: 'Livraison 13 juin',
      items: [{ t: 'Pack guirlandes guinguette 60 m', q: 1, p: 240 }],
      sub: 240,
    },
  ];
  const sub = sellers.reduce((s, x) => s + x.sub, 0);
  const fees = Math.round(sub * 0.03);
  const total = sub + fees;
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
      <V1Header step={1} steps={['Panier', 'Paiement', 'Confirmation']} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: 56,
          padding: '40px 80px 64px',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>Votre panier</h1>
          <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 6 }}>
            3 prestataires, un seul paiement. Chaque pro confirme indépendamment sa partie.
          </p>

          {sellers.map((s, i) => (
            <V1Block
              key={i}
              title={s.name}
              hint={`${s.items.length} article${s.items.length > 1 ? 's' : ''} · ${s.date}`}
              badge="Disponible"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {s.items.map((it, j) => (
                  <div
                    key={j}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: 'var(--charcoal-700)' }}>
                      {it.t}
                      <span style={{ color: 'var(--charcoal-400)', marginLeft: 8 }}>× {it.q}</span>
                    </span>
                    <span
                      style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--charcoal-700)' }}
                    >
                      {(it.q * it.p).toLocaleString('fr-FR')} €
                    </span>
                  </div>
                ))}
              </div>
              <hr className="tk-hr" />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <span>Sous-total</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {s.sub.toLocaleString('fr-FR')} €
                </span>
              </div>
            </V1Block>
          ))}
        </div>

        <aside>
          <div className="tk-card" style={{ padding: 20, position: 'sticky', top: 24 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 16,
              }}
            >
              Récapitulatif
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 0 16px' }}>
              {sellers.map((s) => (
                <V1Sline
                  key={s.name}
                  label={s.name}
                  value={`${s.sub.toLocaleString('fr-FR')} €`}
                  muted
                />
              ))}
            </div>
            <hr className="tk-hr" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0' }}>
              <V1Sline label="Sous-total" value={`${sub.toLocaleString('fr-FR')} €`} />
              <V1Sline label="Frais de service tukio (3 %)" value={`${fees} €`} muted />
            </div>
            <hr className="tk-hr" />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '16px 0 0',
                alignItems: 'baseline',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  fontWeight: 500,
                  color: 'var(--charcoal-800)',
                }}
              >
                {total.toLocaleString('fr-FR')} €
              </span>
            </div>

            <button
              className="tk-btn tk-btn-primary tk-btn-lg"
              style={{ width: '100%', marginTop: 20, justifyContent: 'center' }}
            >
              Passer au paiement
            </button>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: 'var(--info-50)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                gap: 10,
              }}
            >
              <Icon name="shield" size={18} color="var(--info-500)" />
              <div style={{ fontSize: 12, color: 'var(--info-700)', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: 2 }}>
                  Un paiement, plusieurs pros
                </strong>
                Tukio reverse à chaque prestataire après son événement. Vos fonds restent protégés.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────── 2. Checkout multi-vendeurs ───────────
function V1MultiCheckoutScreen() {
  const sellers = [
    { name: 'Atelier Tente Loire', amount: 1450 },
    { name: "Mobilier d'Anjou", amount: 496 },
    { name: 'Lumière & Son 44', amount: 240 },
  ];
  const sub = sellers.reduce((s, x) => s + x.amount, 0);
  const fees = Math.round(sub * 0.03);
  const total = sub + fees;
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
      <V1Header step={2} steps={['Panier', 'Paiement', 'Confirmation']} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: 56,
          padding: '40px 80px 64px',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>Finalisez votre commande</h1>
          <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 6 }}>
            Vous ne serez débité qu'à l'acceptation par chaque pro. Confirmation sous 48 h.
          </p>

          <V1Block title="1. Coordonnées" badge="Vérifié">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="tk-label">Prénom</label>
                <input className="tk-input" defaultValue="Camille" />
              </div>
              <div>
                <label className="tk-label">Nom</label>
                <input className="tk-input" defaultValue="Renaud" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="tk-label">Email</label>
                <input className="tk-input" defaultValue="camille.renaud@example.fr" />
              </div>
            </div>
          </V1Block>

          <V1Block title="2. Adresse de livraison commune">
            <div>
              <label className="tk-label">Adresse</label>
              <input
                className="tk-input"
                defaultValue="Domaine de la Quintaine, 14 rue des Vignes"
              />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 1fr',
                gap: 16,
                marginTop: 12,
              }}
            >
              <div>
                <label className="tk-label">CP</label>
                <input className="tk-input" defaultValue="44120" />
              </div>
              <div>
                <label className="tk-label">Ville</label>
                <input className="tk-input" defaultValue="Vertou" />
              </div>
              <div>
                <label className="tk-label">Pays</label>
                <input className="tk-input" defaultValue="France" />
              </div>
            </div>
          </V1Block>

          <V1Block title="3. Paiement">
            <div
              style={{
                marginBottom: 16,
                padding: 14,
                background: 'var(--cream-100)',
                borderRadius: 'var(--radius)',
                fontSize: 13,
                color: 'var(--charcoal-600)',
                lineHeight: 1.5,
              }}
            >
              Un seul prélèvement, reversé automatiquement à chaque pro après son événement.
            </div>
            <div
              style={{
                padding: 20,
                background: 'var(--cream-50)',
                border: '1px solid var(--cream-300)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div>
                <label className="tk-label">Numéro de carte</label>
                <input className="tk-input" defaultValue="4242 4242 4242 4242" />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 16,
                  marginTop: 12,
                }}
              >
                <div>
                  <label className="tk-label">Expiration</label>
                  <input className="tk-input" defaultValue="06 / 28" />
                </div>
                <div>
                  <label className="tk-label">CVC</label>
                  <input className="tk-input" defaultValue="•••" />
                </div>
                <div>
                  <label className="tk-label">Code postal</label>
                  <input className="tk-input" defaultValue="44120" />
                </div>
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginTop: 16,
                fontSize: 13,
                color: 'var(--charcoal-600)',
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: 'var(--brand-500)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                <Icon name="check" size={12} color="var(--cream-50)" strokeWidth={2.5} />
              </span>
              J'accepte les{' '}
              <a style={{ color: 'var(--brand-700)', textDecoration: 'underline' }}>
                conditions de réservation
              </a>{' '}
              et la politique d'annulation de chaque pro.
            </label>
          </V1Block>

          <button
            className="tk-btn tk-btn-primary tk-btn-lg"
            style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
          >
            Confirmer la commande · {total.toLocaleString('fr-FR')} €
          </button>
          <p
            style={{
              fontSize: 12,
              color: 'var(--charcoal-400)',
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            Aucune somme débitée tant que les pros n'ont pas tous confirmé.
          </p>
        </div>

        <aside>
          <div className="tk-card" style={{ padding: 20, position: 'sticky', top: 24 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 16,
              }}
            >
              Votre commande
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sellers.map((s) => (
                <div
                  key={s.name}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--charcoal-300)',
                      }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--charcoal-700)' }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                    {s.amount.toLocaleString('fr-FR')} €
                  </span>
                </div>
              ))}
            </div>

            <hr className="tk-hr" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 0 16px' }}>
              <V1Sline label="Sous-total" value={`${sub.toLocaleString('fr-FR')} €`} />
              <V1Sline label="Frais de service tukio (3 %)" value={`${fees} €`} muted />
            </div>
            <hr className="tk-hr" />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '16px 0 0',
                alignItems: 'baseline',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  fontWeight: 500,
                  color: 'var(--charcoal-800)',
                }}
              >
                {total.toLocaleString('fr-FR')} €
              </span>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: 'var(--info-50)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                gap: 10,
              }}
            >
              <Icon name="shield" size={18} color="var(--info-500)" />
              <div style={{ fontSize: 12, color: 'var(--info-700)', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: 2 }}>Paiement protégé</strong>
                Reversé à chaque pro après son événement.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────── 3. Demande de devis ───────────
function V1QuoteRequestScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
      <V1Header
        step={1}
        steps={['Demande', 'Échange', 'Acceptation']}
        secure="Réponse sous 4 h en moyenne"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: 56,
          padding: '40px 80px 64px',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>Demander un devis personnalisé</h1>
          <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 6 }}>
            Décrivez votre projet, le pro vous revient avec une proposition sur mesure. Sans
            engagement.
          </p>

          <V1Block title="1. Votre événement">
            <label className="tk-label">Type d'événement</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {['Mariage', 'Anniversaire', 'Corporate', 'Festival', 'Autre'].map((t) => (
                <Pill key={t} active={t === 'Mariage'}>
                  {t}
                </Pill>
              ))}
            </div>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}
            >
              <div>
                <label className="tk-label">Date prévue</label>
                <input className="tk-input" defaultValue="14 juin 2026" />
              </div>
              <div>
                <label className="tk-label">Nombre d'invités</label>
                <input className="tk-input" defaultValue="120" />
              </div>
            </div>
          </V1Block>

          <V1Block title="2. Votre projet">
            <div>
              <label className="tk-label">Budget indicatif</label>
              <input className="tk-input" defaultValue="2 500 € — 3 500 €" />
            </div>
            <div style={{ marginTop: 16 }}>
              <label className="tk-label">Décrivez votre projet</label>
              <textarea
                className="tk-input"
                style={{ height: 140, padding: 12, resize: 'vertical' }}
                defaultValue="Mariage en plein air, jardin privé près de Nantes. Besoin d'un chapiteau pour 120 personnes, mobilier élégant et ambiance lumineuse pour la soirée. Préférence pour les structures écoresponsables."
              />
            </div>
            <div
              style={{
                marginTop: 16,
                padding: 16,
                background: 'var(--cream-100)',
                border: '1px dashed var(--cream-300)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Icon name="upload" size={18} color="var(--charcoal-500)" />
              <span style={{ fontSize: 13, color: 'var(--charcoal-600)' }}>
                Joindre moodboard, plan ou inspirations · jusqu'à 5 fichiers
              </span>
            </div>
          </V1Block>

          <button
            className="tk-btn tk-btn-primary tk-btn-lg"
            style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
          >
            Envoyer ma demande
          </button>
          <p
            style={{
              fontSize: 12,
              color: 'var(--charcoal-400)',
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            Le pro a 48 h pour répondre. Vous recevrez une notification dès l'arrivée du devis.
          </p>
        </div>

        <aside>
          <div className="tk-card" style={{ padding: 20, position: 'sticky', top: 24 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 16,
              }}
            >
              Votre interlocuteur
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <Avatar name="Atelier Tente Loire" size={56} tone="brand" />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Atelier Tente Loire</div>
                <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
                  Léa B. · Nantes (44)
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--success-700)',
                    marginTop: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--success-500)',
                    }}
                  />{' '}
                  Répond &lt; 4 h
                </div>
              </div>
            </div>

            <hr className="tk-hr" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0' }}>
              <V1Sline label="Note" value="4,9 / 5 (47)" muted />
              <V1Sline label="Devis acceptés" value="92 %" muted />
              <V1Sline label="Délai moyen" value="3 h 40" muted />
            </div>

            <div
              style={{
                marginTop: 8,
                padding: 14,
                background: 'var(--info-50)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                gap: 10,
              }}
            >
              <Icon name="shield" size={18} color="var(--info-500)" />
              <div style={{ fontSize: 12, color: 'var(--info-700)', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: 2 }}>Sans engagement</strong>
                Acceptez, négociez ou refusez à tout moment. Aucun frais avant acceptation.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────── 4. Fil de devis ───────────
function V1QuoteThreadScreen() {
  const msgs = [
    {
      from: 'client',
      t: 'Bonjour Léa, je vous joins notre moodboard. On vise un effet champêtre chic.',
      ts: 'Hier, 14:32',
    },
    {
      from: 'pro',
      t: 'Parfait ! Notre chapiteau bambou 10×15 m correspond bien. Je prépare une proposition détaillée.',
      ts: 'Hier, 16:18',
      quote: {
        title: 'Devis #DV-0042',
        v: 'v1',
        items: [
          ['Chapiteau bambou 10×15 m', '1 580 €'],
          ['Plancher bois 80 m²', '640 €'],
          ['Montage J-1 + démontage J+1', 'inclus'],
        ],
        total: 2220,
      },
    },
    {
      from: 'client',
      t: 'Top ! Petit ajustement : peut-on avoir un côté ouvert sur le jardin ?',
      ts: "Aujourd'hui, 09:12",
    },
    {
      from: 'pro',
      t: 'Bien sûr — voici la version révisée.',
      ts: "Aujourd'hui, 11:45",
      quote: {
        title: 'Devis #DV-0042',
        v: 'v2 · final',
        items: [
          ['Chapiteau bambou 10×15 m, 1 côté ouvert', '1 580 €'],
          ['Plancher bois 80 m²', '640 €'],
          ['Montage J-1 + démontage J+1', 'inclus'],
          ['Remise client fidèle', '−80 €'],
        ],
        total: 2140,
        accept: true,
      },
    },
  ];
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
      <V1Header
        step={2}
        steps={['Demande', 'Échange', 'Acceptation']}
        secure="Discussion sécurisée"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: 56,
          padding: '40px 80px 64px',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>Devis · Mariage 14 juin</h1>
          <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 6 }}>
            Échange avec Léa B. — Atelier Tente Loire. La dernière version fait foi.
          </p>

          <section className="tk-card" style={{ padding: 24, marginTop: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {msgs.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: m.from === 'client' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{ maxWidth: 520 }}>
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: 14,
                        background: m.from === 'client' ? 'var(--brand-500)' : 'var(--cream-100)',
                        color: m.from === 'client' ? 'var(--cream-50)' : 'var(--charcoal-800)',
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}
                    >
                      {m.t}
                    </div>
                    {m.quote && (
                      <div
                        className="tk-card"
                        style={{ padding: 16, marginTop: 8, background: 'var(--cream-50)' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 12,
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{m.quote.title}</span>
                          <span className="tk-badge tk-badge-neutral">{m.quote.v}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {m.quote.items.map((it, j) => (
                            <div
                              key={j}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 13,
                                color: 'var(--charcoal-600)',
                              }}
                            >
                              <span>{it[0]}</span>
                              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{it[1]}</span>
                            </div>
                          ))}
                        </div>
                        <hr className="tk-hr" />
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 600,
                          }}
                        >
                          <span>Total TTC</span>
                          <span
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontSize: 22,
                              fontWeight: 500,
                              color: 'var(--charcoal-800)',
                            }}
                          >
                            {m.quote.total.toLocaleString('fr-FR')} €
                          </span>
                        </div>
                        {m.quote.accept && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button
                              className="tk-btn tk-btn-primary tk-btn-md"
                              style={{ flex: 1, justifyContent: 'center' }}
                            >
                              Accepter & payer
                            </button>
                            <button className="tk-btn tk-btn-secondary tk-btn-md">
                              Demander une révision
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--charcoal-400)',
                        marginTop: 6,
                        textAlign: m.from === 'client' ? 'right' : 'left',
                      }}
                    >
                      {m.ts}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 24,
                padding: 12,
                border: '1px solid var(--cream-300)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                background: 'var(--cream-50)',
              }}
            >
              <input
                className="tk-input"
                placeholder="Votre message…"
                style={{ flex: 1, border: 'none', padding: '0 8px', background: 'transparent' }}
              />
              <button className="tk-btn tk-btn-tertiary tk-btn-sm">
                <Icon name="upload" size={14} />
              </button>
              <button className="tk-btn tk-btn-primary tk-btn-sm">Envoyer</button>
            </div>
          </section>
        </div>

        <aside>
          <div className="tk-card" style={{ padding: 20, position: 'sticky', top: 24 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 16,
              }}
            >
              Devis en cours
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <Avatar name="Atelier Tente Loire" size={48} tone="brand" />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Atelier Tente Loire</div>
                <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
                  14 juin 2026 · 120 invités
                </div>
              </div>
            </div>

            <hr className="tk-hr" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0' }}>
              <V1Sline label="Version courante" value="v2 · final" muted />
              <V1Sline label="Échanges" value="4 messages" muted />
              <V1Sline label="Validité du devis" value="J+30" muted />
            </div>
            <hr className="tk-hr" />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '16px 0 0',
                alignItems: 'baseline',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>Montant proposé</span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  fontWeight: 500,
                  color: 'var(--charcoal-800)',
                }}
              >
                2 140 €
              </span>
            </div>

            <button
              className="tk-btn tk-btn-primary tk-btn-lg"
              style={{ width: '100%', marginTop: 20, justifyContent: 'center' }}
            >
              Accepter & payer
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────── 5. Acomptes / échéancier ───────────
function V1InstallmentsScreen() {
  const total = 2140;
  const acompte = Math.round(total * 0.3);
  const solde = total - acompte;
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
      <V1Header
        step={2}
        steps={['Devis accepté', 'Acompte', 'Solde']}
        secure="Paiement sécurisé Stripe"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: 56,
          padding: '40px 80px 64px',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>Plan de paiement</h1>
          <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 6 }}>
            Réglez 30 % aujourd'hui pour bloquer la date, le solde 30 jours avant l'événement. Sans
            frais.
          </p>

          <V1Block title="1. Échéancier">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                {
                  n: 1,
                  label: 'Acompte',
                  amount: acompte,
                  date: "Aujourd'hui · 7 mai 2026",
                  state: 'now',
                },
                {
                  n: 2,
                  label: 'Solde',
                  amount: solde,
                  date: '15 mai 2026 · J-30',
                  state: 'scheduled',
                },
              ].map((p) => (
                <div
                  key={p.n}
                  style={{
                    padding: 16,
                    border: `1px solid ${p.state === 'now' ? 'var(--brand-500)' : 'var(--cream-300)'}`,
                    background: p.state === 'now' ? 'var(--brand-50)' : 'var(--cream-50)',
                    borderRadius: 'var(--radius)',
                    display: 'flex',
                    gap: 14,
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: p.state === 'now' ? 'var(--brand-500)' : 'var(--cream-200)',
                      color: p.state === 'now' ? 'var(--cream-50)' : 'var(--charcoal-500)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-display)',
                      fontSize: 15,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {p.n}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>
                      {p.date}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 22,
                      fontWeight: 500,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {p.amount.toLocaleString('fr-FR')} €
                  </div>
                  <span className={`tk-badge tk-badge-${p.state === 'now' ? 'brand' : 'neutral'}`}>
                    {p.state === 'now' ? 'À payer' : 'Programmé'}
                  </span>
                </div>
              ))}
            </div>
          </V1Block>

          <V1Block title="2. Moyen de paiement">
            <div
              style={{
                padding: 14,
                background: 'var(--cream-50)',
                border: '1px solid var(--cream-300)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span
                style={{
                  padding: '4px 8px',
                  border: '1px solid var(--cream-300)',
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--charcoal-500)',
                  letterSpacing: '0.04em',
                }}
              >
                VISA
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Visa •••• 4242</div>
                <div style={{ fontSize: 12, color: 'var(--charcoal-500)' }}>
                  Expire 06/28 · sera utilisée pour les deux échéances
                </div>
              </div>
              <button className="tk-btn tk-btn-tertiary tk-btn-sm">Changer</button>
            </div>
          </V1Block>

          <button
            className="tk-btn tk-btn-primary tk-btn-lg"
            style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
          >
            Payer l'acompte · {acompte.toLocaleString('fr-FR')} €
          </button>
          <p
            style={{
              fontSize: 12,
              color: 'var(--charcoal-400)',
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            Le solde sera prélevé automatiquement le 15 mai. Vous recevrez un rappel 7 jours avant.
          </p>
        </div>

        <aside>
          <div className="tk-card" style={{ padding: 20, position: 'sticky', top: 24 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 16,
              }}
            >
              Récapitulatif
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <Avatar name="Atelier Tente Loire" size={48} tone="brand" />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Devis #DV-0042</div>
                <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
                  Atelier Tente Loire
                </div>
                <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
                  14 juin 2026 · 120 invités
                </div>
              </div>
            </div>

            <hr className="tk-hr" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0' }}>
              <V1Sline label="Acompte (30 %)" value={`${acompte.toLocaleString('fr-FR')} €`} />
              <V1Sline
                label="Solde (70 %) · 15 mai"
                value={`${solde.toLocaleString('fr-FR')} €`}
                muted
              />
              <V1Sline label="Frais d'échéancier" value="0 €" muted />
            </div>
            <hr className="tk-hr" />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '16px 0 0',
                alignItems: 'baseline',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  fontWeight: 500,
                  color: 'var(--charcoal-800)',
                }}
              >
                {total.toLocaleString('fr-FR')} €
              </span>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: 'var(--info-50)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                gap: 10,
              }}
            >
              <Icon name="shield" size={18} color="var(--info-500)" />
              <div style={{ fontSize: 12, color: 'var(--info-700)', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: 2 }}>Date bloquée</strong>
                Dès l'acompte versé, la date est réservée pour vous.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────── 6. Pricing pros ───────────
function V1PricingScreen() {
  const plans = [
    {
      name: 'Starter',
      price: 'Gratuit',
      desc: 'Pour démarrer',
      commission: '10 %',
      feats: ['3 fiches services', 'Messagerie standard', 'Stats de base'],
      cta: 'Plan actuel',
    },
    {
      name: 'Business',
      price: '39 €',
      suffix: '/ mois HT',
      desc: 'Pour développer votre activité',
      commission: '7 %',
      feats: [
        'Fiches illimitées',
        'Boost visibilité ×3',
        'Stats avancées',
        'Réponse devis prioritaire',
        'Badge Business',
      ],
      featured: true,
      cta: 'Passer Business',
    },
    {
      name: 'Enterprise',
      price: 'Sur devis',
      desc: 'Multi-équipes & API',
      commission: '5 %',
      feats: [
        'Tout Business +',
        'API & intégrations',
        'Account manager dédié',
        'SLA 99.9 %',
        'Multi-utilisateurs',
      ],
      cta: 'Nous contacter',
    },
  ];
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
      <V1Header secure="Sans engagement · résiliable" />
      <div style={{ padding: '40px 80px 64px', maxWidth: 1280, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)' }}>Choisissez votre plan</h1>
        <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 6, maxWidth: 640 }}>
          Plus vous montez en gamme, plus la commission tukio baisse. Sans engagement, résiliable à
          tout moment.
        </p>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 32 }}
        >
          {plans.map((p) => (
            <div
              key={p.name}
              className="tk-card"
              style={{
                padding: 28,
                position: 'relative',
                border: p.featured ? '2px solid var(--brand-500)' : '1px solid var(--cream-300)',
                background: p.featured ? 'var(--brand-50)' : 'var(--cream-50)',
              }}
            >
              {p.featured && (
                <span
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: 24,
                    background: 'var(--brand-500)',
                    color: 'var(--cream-50)',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 999,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Recommandé
                </span>
              )}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {p.name}
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 36,
                    fontWeight: 500,
                    color: 'var(--charcoal-800)',
                  }}
                >
                  {p.price}
                </span>
                {p.suffix && (
                  <span style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>{p.suffix}</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 4 }}>
                {p.desc}
              </div>
              <div
                style={{
                  marginTop: 16,
                  padding: '10px 12px',
                  background: p.featured ? 'var(--cream-50)' : 'var(--cream-100)',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                }}
              >
                <span style={{ color: 'var(--charcoal-500)' }}>Commission</span>
                <span style={{ fontWeight: 700, color: 'var(--brand-700)' }}>{p.commission}</span>
              </div>
              <hr className="tk-hr" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.feats.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 13,
                      color: 'var(--charcoal-700)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <Icon name="check" size={14} color="var(--brand-700)" strokeWidth={2.5} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button
                className={`tk-btn ${p.featured ? 'tk-btn-primary' : 'tk-btn-secondary'} tk-btn-md`}
                style={{ width: '100%', justifyContent: 'center', marginTop: 24 }}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────── 7. Upgrade ───────────
function V1UpgradeScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
      <V1Header step={2} steps={['Plan', 'Confirmation', 'Activation']} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: 56,
          padding: '40px 80px 64px',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>Passer au plan Business</h1>
          <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 6 }}>
            Activation immédiate. Vous pouvez rétrograder ou résilier à tout moment.
          </p>

          <V1Block title="Ce que vous gagnez">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['Fiches services illimitées', 'Plus que 3 — toutes vos prestations en ligne'],
                ['Boost visibilité ×3', 'Vos fiches remontent dans les recherches'],
                ['Commission réduite à 7 %', '−3 points vs Starter (10 %)'],
                ['Badge Business', 'Renforce la confiance des clients'],
              ].map(([t, d], i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <Icon name="sparkle" size={18} color="var(--brand-500)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t}</div>
                    <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
                      {d}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </V1Block>
        </div>

        <aside>
          <div className="tk-card" style={{ padding: 20, position: 'sticky', top: 24 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 16,
              }}
            >
              Récapitulatif
            </div>
            <div style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
              Plan actuel · <strong style={{ color: 'var(--charcoal-700)' }}>Starter</strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 4 }}>
              Nouveau plan · <strong style={{ color: 'var(--brand-700)' }}>Business</strong>
            </div>
            <hr className="tk-hr" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 0 16px' }}>
              <V1Sline label="Abonnement mensuel" value="39,00 € HT" />
              <V1Sline label="TVA (20 %)" value="7,80 €" muted />
              <V1Sline label="Engagement" value="Aucun" muted />
            </div>
            <hr className="tk-hr" />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '16px 0 0',
                alignItems: 'baseline',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>Prélèvement aujourd'hui</span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  fontWeight: 500,
                  color: 'var(--charcoal-800)',
                }}
              >
                46,80 €
              </span>
            </div>
            <button
              className="tk-btn tk-btn-primary tk-btn-lg"
              style={{ width: '100%', marginTop: 20, justifyContent: 'center' }}
            >
              Confirmer l'upgrade
            </button>
            <p
              style={{
                fontSize: 12,
                color: 'var(--charcoal-400)',
                textAlign: 'center',
                marginTop: 10,
              }}
            >
              Activation immédiate · prochain prélèvement le 7 juin
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────── 8. Billing pro ───────────
function V1BillingScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)' }}
    >
      <V1Header secure="Espace pro" />
      <div style={{ padding: '40px 80px 64px', maxWidth: 1280, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)' }}>Facturation</h1>
        <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 6 }}>
          Votre abonnement et l'historique de vos commissions.
        </p>

        <V1Block title="Plan actuel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500 }}>
                Business · 39 € / mois
              </div>
              <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 4 }}>
                Prochain prélèvement · 1 juin 2026 · Visa •••• 4242
              </div>
              <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>
                Commission · 7 % par réservation
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="tk-btn tk-btn-secondary tk-btn-sm">Changer de carte</button>
              <button className="tk-btn tk-btn-tertiary tk-btn-sm">Résilier</button>
            </div>
          </div>
        </V1Block>

        <section className="tk-card" style={{ padding: 0, marginTop: 20, overflow: 'hidden' }}>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--cream-200)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 500 }}>Factures</h2>
            <button className="tk-btn tk-btn-tertiary tk-btn-sm">Tout télécharger</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  background: 'var(--cream-100)',
                  color: 'var(--charcoal-500)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {['N°', 'Date', 'Type', 'Montant', 'Statut', ''].map((h, i) => (
                  <th key={i} style={{ padding: '12px 24px', textAlign: 'left', fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['INV-2026-005', '01/05/26', 'Abonnement', '39,00 €', 'Payée'],
                ['INV-2026-004', '12/04/26', 'Commission BK-1212', '12,80 €', 'Payée'],
                ['INV-2026-003', '01/04/26', 'Abonnement', '39,00 €', 'Payée'],
                ['INV-2026-002', '02/03/26', 'Commission BK-1188', '42,00 €', 'Payée'],
              ].map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--cream-200)' }}>
                  {r.map((c, j) => (
                    <td
                      key={j}
                      style={{
                        padding: '14px 24px',
                        fontFamily: j === 0 ? 'var(--font-mono)' : 'inherit',
                        fontVariantNumeric: j === 3 ? 'tabular-nums' : 'normal',
                      }}
                    >
                      {j === 4 ? <span className="tk-badge tk-badge-success">{c}</span> : c}
                    </td>
                  ))}
                  <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                    <a style={{ fontSize: 12, color: 'var(--brand-700)' }}>PDF ↓</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

window.V1PricingScreen = V1PricingScreen;
window.V1UpgradeScreen = V1UpgradeScreen;
window.V1BillingScreen = V1BillingScreen;
window.V1MultiCartScreen = V1MultiCartScreen;
window.V1MultiCheckoutScreen = V1MultiCheckoutScreen;
window.V1QuoteRequestScreen = V1QuoteRequestScreen;
window.V1QuoteThreadScreen = V1QuoteThreadScreen;
window.V1InstallmentsScreen = V1InstallmentsScreen;
