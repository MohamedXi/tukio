/* V1 — Trust, sécurité, avis multi-critères, B2B, V2/V3 mid-fi & wireframes */

// ─────────── V1 · MFA setup ───────────
function V1MfaSetupScreen() {
  return (
    <div
      className="tk-root"
      style={{
        width: '100%',
        minHeight: '100%',
        background: 'var(--cream-50)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div className="tk-card" style={{ padding: 40, maxWidth: 480, width: '100%' }}>
        <Kicker>V1 · Sécurité du compte</Kicker>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 4 }}>
          Activer l'authentification à deux facteurs
        </h1>
        <p style={{ fontSize: 14, color: 'var(--charcoal-500)', marginTop: 8 }}>
          Scannez ce QR code avec votre application d'authentification (Google Authenticator, Authy,
          1Password…).
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0' }}>
          <div
            style={{
              width: 200,
              height: 200,
              background: 'var(--charcoal-800)',
              borderRadius: 'var(--radius)',
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              padding: 14,
              gap: 2,
            }}
          >
            {Array.from({ length: 64 }).map((_, i) => (
              <div
                key={i}
                style={{ background: Math.random() > 0.5 ? 'var(--cream-50)' : 'transparent' }}
              />
            ))}
          </div>
        </div>
        <div
          style={{
            padding: 12,
            background: 'var(--cream-100)',
            borderRadius: 'var(--radius)',
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            letterSpacing: '0.1em',
            color: 'var(--charcoal-700)',
          }}
        >
          JBSWY3DPEHPK3PXP
        </div>
        <label className="tk-label" style={{ marginTop: 24 }}>
          Code à 6 chiffres généré par l'app
        </label>
        <input
          className="tk-input tk-input-lg"
          placeholder="000000"
          style={{
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.2em',
            textAlign: 'center',
            fontSize: 22,
          }}
        />
        <button
          className="tk-btn tk-btn-primary tk-btn-lg"
          style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}
        >
          Vérifier & activer
        </button>
        <div
          style={{
            marginTop: 20,
            padding: 12,
            background: 'var(--info-50)',
            borderRadius: 'var(--radius)',
            fontSize: 12,
            color: 'var(--info-700)',
          }}
        >
          ⚠ Sauvegardez vos 8 codes de récupération avant de continuer.
        </div>
      </div>
    </div>
  );
}

// ─────────── V1 · Login social ───────────
function V1LoginSocialScreen() {
  return (
    <div
      className="tk-root"
      style={{
        width: '100%',
        minHeight: '100%',
        background: 'var(--cream-50)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div className="tk-card" style={{ padding: 40, maxWidth: 440, width: '100%' }}>
        <Logo size={22} />
        <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 24 }}>Connexion</h1>
        <p style={{ fontSize: 14, color: 'var(--charcoal-500)', marginTop: 6 }}>
          Accédez à votre espace tukio
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          {[
            {
              label: 'Continuer avec Google',
              icon: 'G',
              bg: 'var(--cream-50)',
              border: '1px solid var(--cream-300)',
              color: 'var(--charcoal-800)',
            },
            {
              label: 'Continuer avec Apple',
              icon: '',
              bg: 'var(--charcoal-800)',
              border: '1px solid var(--charcoal-800)',
              color: 'var(--cream-50)',
            },
          ].map((b) => (
            <button
              key={b.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 'var(--radius)',
                background: b.bg,
                border: b.border,
                color: b.color,
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  background:
                    b.color === 'var(--cream-50)' ? 'var(--cream-50)' : 'var(--charcoal-800)',
                  color: b.color === 'var(--cream-50)' ? 'var(--charcoal-800)' : 'var(--cream-50)',
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {b.icon}
              </span>
              {b.label}
            </button>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '24px 0',
            color: 'var(--charcoal-400)',
            fontSize: 12,
          }}
        >
          <span style={{ flex: 1, height: 1, background: 'var(--cream-300)' }} />
          OU
          <span style={{ flex: 1, height: 1, background: 'var(--cream-300)' }} />
        </div>
        <input className="tk-input" placeholder="Email" />
        <input
          className="tk-input"
          placeholder="Mot de passe"
          type="password"
          style={{ marginTop: 10 }}
        />
        <button
          className="tk-btn tk-btn-primary tk-btn-lg"
          style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
        >
          Se connecter
        </button>
      </div>
    </div>
  );
}

// ─────────── V1 · Anti-désintermédiation ───────────
function V1AntiDesinterScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 40px',
          borderBottom: '1px solid var(--cream-200)',
        }}
      >
        <Logo size={20} />
        <span style={{ fontSize: 13, color: 'var(--charcoal-500)' }}>
          Messagerie · Atelier Tente Loire
        </span>
      </header>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 32 }}>
        <div className="tk-card" style={{ padding: 0, overflow: 'hidden' }}>
          {[
            {
              from: 'client',
              t: 'Bonjour, est-ce que ce chapiteau est dispo le 14 juin ?',
              ts: '11:32',
            },
            { from: 'pro', t: 'Oui, parfait ! Je peux vous faire un devis détaillé.', ts: '11:45' },
            {
              from: 'client',
              t: "Top — vous pouvez m'envoyer ça par email à camille@gmail.com ? Ou m'appeler au 06 24 38 …",
              ts: '11:48',
              flagged: true,
            },
          ].map((m, i) => (
            <div
              key={i}
              style={{
                padding: '16px 20px',
                borderTop: i > 0 ? '1px solid var(--cream-200)' : 'none',
                display: 'flex',
                gap: 12,
              }}
            >
              <Avatar
                name={m.from === 'client' ? 'Camille R' : 'Atelier T'}
                size={32}
                tone="brand"
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--charcoal-500)' }}>
                  {m.from === 'client' ? 'Camille' : 'Léa'} · {m.ts}
                </div>
                <div style={{ fontSize: 14, marginTop: 4, color: 'var(--charcoal-800)' }}>
                  {m.t}
                </div>
                {m.flagged && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 16,
                      background: 'var(--warning-50)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--warning-500)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 600,
                        color: 'var(--warning-700)',
                        fontSize: 13,
                      }}
                    >
                      <Icon name="shield" size={16} />
                      Message détecté comme tentative de désintermédiation
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'var(--warning-700)',
                        marginTop: 8,
                        lineHeight: 1.5,
                      }}
                    >
                      Pour votre sécurité (paiement, garantie, support), tukio masque les
                      coordonnées hors plateforme tant que la réservation n'est pas confirmée. Les
                      fonds sont sécurisés et la médiation tukio s'applique uniquement aux échanges
                      intra-plateforme.
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="tk-btn tk-btn-secondary tk-btn-sm">Comprendre</button>
                      <button className="tk-btn tk-btn-tertiary tk-btn-sm">
                        Signaler une erreur
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────── V1 · Inscription B2B ───────────
function V1SignupB2BScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 40px',
          borderBottom: '1px solid var(--cream-200)',
        }}
      >
        <Logo size={20} />
        <a style={{ fontSize: 13 }}>Déjà un compte ? Se connecter</a>
      </header>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 40px' }}>
        <Kicker>V1 · Compte entreprise</Kicker>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 4 }}>Créer un compte entreprise</h1>
        <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 8, maxWidth: 560 }}>
          Pour les TPE, collectivités et grands comptes — facturation pro, multi-utilisateurs,
          conditions négociables.
        </p>
        <div className="tk-card" style={{ padding: 32, marginTop: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>
            Informations entreprise
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="tk-label">Raison sociale *</label>
              <input className="tk-input" defaultValue="TPE Saint-Nazaire" />
            </div>
            <div>
              <label className="tk-label">SIRET *</label>
              <input className="tk-input" defaultValue="789 456 123 00012" />
            </div>
            <div>
              <label className="tk-label">Numéro TVA intracom.</label>
              <input className="tk-input" defaultValue="FR 88 789456123" />
            </div>
            <div>
              <label className="tk-label">Forme juridique</label>
              <select className="tk-input">
                <option>SARL</option>
                <option>SAS</option>
                <option>EURL</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="tk-label">Adresse de facturation</label>
              <input
                className="tk-input"
                defaultValue="12 rue de la République, 44600 Saint-Nazaire"
              />
            </div>
          </div>
          <hr className="tk-hr" />
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Contact principal</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="tk-label">Prénom *</label>
              <input className="tk-input" />
            </div>
            <div>
              <label className="tk-label">Nom *</label>
              <input className="tk-input" />
            </div>
            <div>
              <label className="tk-label">Email pro *</label>
              <input className="tk-input" placeholder="prenom@entreprise.fr" />
            </div>
            <div>
              <label className="tk-label">Téléphone</label>
              <input className="tk-input" />
            </div>
          </div>
          <div
            style={{
              marginTop: 24,
              padding: 16,
              background: 'var(--info-50)',
              borderRadius: 'var(--radius)',
              fontSize: 13,
              color: 'var(--info-700)',
            }}
          >
            ⓘ Vous recevrez automatiquement les factures TTC avec votre SIRET et numéro TVA pour
            comptabilité pro.
          </div>
          <button
            className="tk-btn tk-btn-primary tk-btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 24 }}
          >
            Créer le compte
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────── V1 · Avis multi-critères ───────────
function V1ReviewMultiScreen() {
  const criteria = [
    { label: 'Qualité du service', v: 5 },
    { label: 'Communication', v: 5 },
    { label: 'Ponctualité', v: 4 },
    { label: 'Rapport qualité-prix', v: 4 },
  ];
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <header style={{ padding: '16px 40px', borderBottom: '1px solid var(--cream-200)' }}>
        <Logo size={20} />
      </header>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 40 }}>
        <Kicker>V1 · Avis détaillé</Kicker>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 4 }}>
          Comment s'est passé votre événement ?
        </h1>
        <p style={{ fontSize: 15, color: 'var(--charcoal-500)', marginTop: 8 }}>
          Atelier Tente Loire · Mariage du 14 juin 2026
        </p>
        <div className="tk-card" style={{ padding: 32, marginTop: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Notez chaque critère</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {criteria.map((c) => (
              <div
                key={c.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 12,
                  background: 'var(--cream-100)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500 }}>{c.label}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: n <= c.v ? 'var(--brand-500)' : 'var(--cream-200)',
                        color: n <= c.v ? 'var(--cream-50)' : 'var(--charcoal-400)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                      }}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <hr className="tk-hr" />
          <label className="tk-label">Votre commentaire</label>
          <textarea
            className="tk-input"
            style={{ height: 140, padding: 12 }}
            defaultValue="Léa et son équipe ont été parfaits. Le chapiteau bambou a fait sensation ! Tout pile à l'heure. Je recommande sans hésiter."
          />
          <div style={{ marginTop: 16 }}>
            <label className="tk-label">Photos de votre événement (V1)</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
                marginTop: 8,
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <Placeholder
                  key={i}
                  aspect="1 / 1"
                  label="photo"
                  style={{ borderRadius: 'var(--radius)' }}
                />
              ))}
            </div>
          </div>
          <button
            className="tk-btn tk-btn-primary tk-btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 24 }}
          >
            Publier mon avis
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────── V1 · Réponse pro ───────────
function V1ReviewReplyScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <ProTopBar active="reviews" />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: 40 }}>
        <Kicker>V1 · Réponse à un avis</Kicker>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 4 }}>Répondre publiquement</h1>
        <div className="tk-card" style={{ padding: 24, marginTop: 24 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <Avatar name="Camille R" size={40} tone="brand" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Camille R.</div>
              <div style={{ fontSize: 12, color: 'var(--charcoal-500)' }}>
                ★ 4.5/5 · 14 juin 2026
              </div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: 'var(--charcoal-700)', lineHeight: 1.6 }}>
            « Léa et son équipe ont été parfaits. Le chapiteau bambou a fait sensation ! Tout pile à
            l'heure. Je recommande sans hésiter. »
          </p>
        </div>
        <div
          className="tk-card"
          style={{
            padding: 24,
            marginTop: 16,
            background: 'var(--brand-50)',
            borderColor: 'var(--brand-200)',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <Avatar name="Atelier T" size={36} tone="brand" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Votre réponse <span className="tk-badge tk-badge-brand">officielle</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--charcoal-500)' }}>
                Visible publiquement sous l'avis
              </div>
            </div>
          </div>
          <textarea
            className="tk-input"
            style={{ height: 120, padding: 12, background: 'var(--cream-50)' }}
            defaultValue="Merci Camille pour ce retour qui nous touche ! Ce fut un honneur de participer à votre belle journée. À très bientôt — Léa & l'équipe Atelier Tente Loire."
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--charcoal-500)' }}>
              168 / 500 caractères · 1 réponse autorisée par avis
            </span>
            <button className="tk-btn tk-btn-primary tk-btn-sm">Publier la réponse</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────── V1 · Litige ───────────
function V1DisputeFlowScreen() {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <SiteHeader />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: 40 }}>
        <Kicker>V1 · Litige #DSP-04</Kicker>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 4 }}>Médiation en cours</h1>
        <p style={{ fontSize: 14, color: 'var(--charcoal-500)', marginTop: 6 }}>
          Booking BK-1271 · Atelier Tente Loire · ouvert il y a 3 jours
        </p>

        <div className="tk-card" style={{ padding: 24, marginTop: 32, display: 'flex', gap: 0 }}>
          {[
            { label: 'Ouverture', state: 'done', date: '04/05' },
            { label: 'Réponse pro', state: 'done', date: '05/05' },
            { label: 'Médiation tukio', state: 'active', date: 'En cours' },
            { label: 'Résolution', state: 'todo', date: '—' },
            { label: 'Clôture', state: 'todo', date: '—' },
          ].map((s, i, arr) => (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background:
                    s.state === 'done'
                      ? 'var(--success-500)'
                      : s.state === 'active'
                        ? 'var(--brand-500)'
                        : 'var(--cream-200)',
                  color: s.state === 'todo' ? 'var(--charcoal-400)' : 'var(--cream-50)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 14,
                  zIndex: 1,
                }}
              >
                {s.state === 'done' ? '✓' : i + 1}
              </div>
              {i < arr.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 17,
                    left: '60%',
                    right: '-40%',
                    height: 2,
                    background: s.state === 'done' ? 'var(--success-500)' : 'var(--cream-200)',
                  }}
                />
              )}
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--charcoal-500)' }}>{s.date}</div>
            </div>
          ))}
        </div>

        <div className="tk-card" style={{ padding: 24, marginTop: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Résumé du désaccord</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div className="tk-card" style={{ padding: 16, background: 'var(--cream-100)' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Position client
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.5 }}>
                « La toile du chapiteau était percée. Photo à l'appui. Je demande un remboursement
                partiel de 30 %. »
              </p>
            </div>
            <div className="tk-card" style={{ padding: 16, background: 'var(--cream-100)' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--charcoal-500)',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Position pro
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.5 }}>
                « Le trou est antérieur à la livraison, signalé sur le PV de réception. Geste
                commercial possible : bon d'achat 100 €. »
              </p>
            </div>
          </div>
          <hr className="tk-hr" />
          <div style={{ padding: 16, background: 'var(--info-50)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontWeight: 600, color: 'var(--info-700)', fontSize: 14 }}>
              Proposition de médiation tukio
            </div>
            <p style={{ fontSize: 13, color: 'var(--info-700)', marginTop: 8, lineHeight: 1.5 }}>
              Remboursement partiel de 15 % (192 €) — au vu des éléments fournis par les deux
              parties.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="tk-btn tk-btn-primary tk-btn-sm">J'accepte</button>
              <button className="tk-btn tk-btn-secondary tk-btn-sm">Je propose autre chose</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────── V2 · Configurator ───────────
function V2ConfiguratorScreen() {
  return (
    <V2Wireframe title="Configurateur d'événement" kicker="V2 · Mid-fi">
      <p style={{ fontSize: 14, color: 'var(--charcoal-500)', maxWidth: 640, marginBottom: 24 }}>
        L'utilisateur décrit son événement (type, taille, budget, lieu) et tukio génère un panier de
        services compatibles à valider.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
        <aside className="tk-card" style={{ padding: 20 }}>
          <h4
            style={{
              fontSize: 13,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--charcoal-500)',
              letterSpacing: '0.04em',
              marginBottom: 16,
            }}
          >
            Mon événement
          </h4>
          {[
            ['Type', 'Mariage'],
            ['Date', '12 sept. 2026'],
            ['Invités', '120 personnes'],
            ['Lieu', 'Nantes (44)'],
            ['Budget', '5 000 € — 8 000 €'],
            ['Style', 'Champêtre chic'],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '10px 0', borderTop: '1px solid var(--cream-200)' }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--charcoal-400)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {k}
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{v}</div>
            </div>
          ))}
          <button
            className="tk-btn tk-btn-secondary tk-btn-sm"
            style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
          >
            Modifier
          </button>
        </aside>
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <h3 style={{ fontSize: 20, fontWeight: 600 }}>Sélection optimisée par tukio AI</h3>
            <span className="tk-badge tk-badge-brand">Total estimé · 6 480 €</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Tente', 'Chapiteau bambou 8×12 m · Atelier Tente Loire', 1280],
              ['Mobilier', "80 chaises Tiffany + 8 tables rondes · Mobilier d'Anjou", 580],
              ['Traiteur', 'Menu champêtre 3 services · Le Verger des Saveurs', 3960],
              ['Sono', 'Pack DJ + light · Lumière & Son 44', 660],
            ].map(([cat, name, price]) => (
              <div
                key={cat}
                className="tk-card"
                style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    background: 'var(--cream-100)',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--charcoal-500)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      fontWeight: 600,
                    }}
                  >
                    {cat}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--success-700)', marginTop: 4 }}>
                    ✓ Disponible · ★ 4.9
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 18 }}>
                  {price} €
                </div>
                <button className="tk-btn tk-btn-tertiary tk-btn-sm">Changer</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </V2Wireframe>
  );
}

// ─────────── V2 · Recommendations ───────────
function V2RecommendationsScreen() {
  return (
    <V2Wireframe title="Recommandations personnalisées" kicker="V2 · Pour vous">
      <p style={{ fontSize: 14, color: 'var(--charcoal-500)', maxWidth: 640, marginBottom: 24 }}>
        Suggestions basées sur vos recherches récentes, votre historique et les événements
        similaires de votre région.
      </p>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Parce que vous avez aimé Atelier Tente Loire
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="tk-card" style={{ overflow: 'hidden' }}>
            <Placeholder aspect="4 / 3" label={`reco ${i}`} />
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Pro recommandé #{i}</div>
              <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 4 }}>
                ★ 4.{8 + (i % 2)} · à partir de {640 + i * 120} €
              </div>
            </div>
          </div>
        ))}
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Tendance à Nantes ce mois-ci
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="tk-card" style={{ overflow: 'hidden' }}>
            <Placeholder aspect="4 / 3" label={`tendance ${i}`} />
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Service tendance #{i}</div>
              <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 4 }}>
                +{15 * i} % de demandes
              </div>
            </div>
          </div>
        ))}
      </div>
    </V2Wireframe>
  );
}

// ─────────── V2 · Loyalty ───────────
function V2LoyaltyScreen() {
  return (
    <V2Wireframe title="Programme tukio fidélité" kicker="V2 · Récompenses">
      <div
        className="tk-card"
        style={{
          padding: 32,
          background: 'linear-gradient(135deg, var(--brand-50), var(--cream-100))',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Avatar name="Camille R" size={64} tone="brand" />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--brand-700)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Niveau actuel
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 32,
                fontWeight: 500,
                marginTop: 4,
              }}
            >
              Argent · 1 240 pts
            </div>
            <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 4 }}>
              Plus que 760 pts pour atteindre Or
            </div>
            <div
              style={{
                marginTop: 12,
                height: 8,
                background: 'var(--cream-200)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div style={{ width: '62%', height: '100%', background: 'var(--brand-500)' }} />
            </div>
          </div>
        </div>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Vos avantages</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          ['−5 % sur votre prochaine résa', 'Disponible', true],
          ['Réservation prioritaire', 'Argent +', true],
          ['Surclassement gratuit', 'Or — 760 pts manquants', false],
        ].map(([t, sub, ok], i) => (
          <div key={i} className="tk-card" style={{ padding: 20, opacity: ok ? 1 : 0.6 }}>
            <Icon
              name={ok ? 'sparkle' : 'lock'}
              size={20}
              color={ok ? 'var(--brand-500)' : 'var(--charcoal-400)'}
            />
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>{t}</div>
            <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>
    </V2Wireframe>
  );
}

// ─────────── V2 · Enterprise ───────────
function V2EnterpriseScreen() {
  return (
    <V2Wireframe title="Espace Enterprise" kicker="V2 · Multi-équipes">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          ['Événements actifs', '12'],
          ['Budget annuel', '240 k€'],
          ['Équipes', '4'],
          ['Account manager', 'Sophie L.'],
        ].map(([k, v]) => (
          <div key={k} className="tk-card" style={{ padding: 20 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 600,
              }}
            >
              {k}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginTop: 6 }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="tk-card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Équipes & permissions</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--charcoal-500)', textAlign: 'left' }}>
              {['Équipe', 'Membres', 'Budget', 'Rôle', ''].map((h, i) => (
                <th
                  key={i}
                  style={{ padding: 8, fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['Marketing', 6, '80 k€', 'Admin'],
              ['RH', 4, '60 k€', 'Membre'],
              ['Comm. interne', 3, '40 k€', 'Lecteur'],
              ['Direction', 2, '60 k€', 'Admin'],
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--cream-200)' }}>
                {r.map((c, j) => (
                  <td key={j} style={{ padding: 12 }}>
                    {c}
                  </td>
                ))}
                <td style={{ padding: 12 }}>
                  <a style={{ fontSize: 12 }}>Gérer →</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </V2Wireframe>
  );
}

// ─────────── V2 · Badges ───────────
function V2BadgesScreen() {
  const badges = [
    {
      name: 'Vérifié',
      icon: 'shield',
      color: 'var(--success-500)',
      desc: 'KYC + Stripe + 5 résas réussies',
    },
    {
      name: "Pro de l'année",
      icon: 'sparkle',
      color: 'var(--brand-500)',
      desc: 'Top 1 % par catégorie',
    },
    { name: 'Réponse rapide', icon: 'bolt', color: 'var(--info-500)', desc: '&lt; 2 h en moyenne' },
    {
      name: 'Écoresponsable',
      icon: 'leaf',
      color: 'var(--success-700)',
      desc: 'Charte verte signée',
    },
  ];
  return (
    <V2Wireframe title="Badges de confiance" kicker="V2 · Reconnaissance pros">
      <p style={{ fontSize: 14, color: 'var(--charcoal-500)', marginBottom: 24, maxWidth: 640 }}>
        Les badges sont attribués automatiquement selon des critères stricts et apparaissent sur les
        fiches services et profils pros.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {badges.map((b) => (
          <div key={b.name} className="tk-card" style={{ padding: 24, textAlign: 'center' }}>
            <span
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: b.color,
                color: 'var(--cream-50)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <Icon name={b.icon} size={26} />
            </span>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 12 }}>{b.name}</div>
            <div
              style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 4, lineHeight: 1.5 }}
              dangerouslySetInnerHTML={{ __html: b.desc }}
            />
          </div>
        ))}
      </div>
    </V2Wireframe>
  );
}

// ─────────── V2 · SEO pages ───────────
function V2SeoPagesScreen() {
  return (
    <V2Wireframe title="Chapiteaux bambou à Nantes" kicker="V2 · Page catégorie × ville (SEO)">
      <p style={{ fontSize: 15, color: 'var(--charcoal-600)', lineHeight: 1.6, maxWidth: 720 }}>
        Découvrez les meilleurs prestataires de chapiteaux bambou à Nantes et en Loire-Atlantique.
        Réservation sécurisée, devis en 24 h.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 24 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="tk-card" style={{ overflow: 'hidden' }}>
            <Placeholder aspect="4 / 3" label={`pro #${i}`} />
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 600 }}>Chapiteau bambou {i}</div>
              <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>
                Nantes (44) · ★ 4.{7 + (i % 3)}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  marginTop: 8,
                  fontSize: 14,
                  color: 'var(--brand-700)',
                  fontWeight: 600,
                }}
              >
                à partir de {880 + i * 60} €
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 32,
          padding: 20,
          background: 'var(--cream-100)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Questions fréquentes</h3>
        {[
          "Combien coûte la location d'un chapiteau bambou à Nantes ?",
          'Quelle taille de tente choisir pour 100 personnes ?',
          "Qui s'occupe du montage et démontage ?",
        ].map((q) => (
          <div
            key={q}
            style={{
              padding: '10px 0',
              borderTop: '1px solid var(--cream-200)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 14 }}>{q}</span>
            <span style={{ color: 'var(--charcoal-400)' }}>+</span>
          </div>
        ))}
      </div>
    </V2Wireframe>
  );
}

function V2Wireframe({ title, kicker, children }) {
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-50)' }}
    >
      <SiteHeader />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 40 }}>
        <Kicker>{kicker}</Kicker>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginTop: 4, marginBottom: 24 }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

// ─────────── V3 · Wireframes ───────────
function V3Wireframe({ title, kicker, children }) {
  return (
    <div className="tk-root" style={{ width: '100%', minHeight: '100%', background: '#fafafa' }}>
      <header
        style={{
          padding: 16,
          borderBottom: '1px dashed #999',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#666' }}>
          WIREFRAME · {kicker}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#666' }}>
          tukio.one
        </span>
      </header>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 40 }}>
        <h1
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 24,
            fontWeight: 600,
            color: '#333',
            marginBottom: 32,
          }}
        >
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

function WBox({ h = 80, label, children, style }) {
  return (
    <div
      style={{
        border: '1.5px dashed #999',
        padding: 16,
        height: h,
        color: '#666',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        ...style,
      }}
    >
      {label && <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>[{label}]</div>}
      {children}
    </div>
  );
}

function V3I18nScreen() {
  return (
    <V3Wireframe title="Sélecteur pays / langue" kicker="V3 · i18n">
      <WBox h={140} label="Modal — choix pays/langue">
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}
        >
          {[
            '🇫🇷 France · FR',
            '🇧🇪 Belgique · FR/NL',
            '🇨🇭 Suisse · FR/DE/IT',
            '🇨🇦 Canada · FR/EN',
            '🇪🇸 Espagne · ES',
            '🇩🇪 Allemagne · DE',
            '🇮🇹 Italie · IT',
            '🇬🇧 UK · EN',
          ].map((c) => (
            <div key={c} style={{ padding: 8, border: '1px dashed #999', textAlign: 'center' }}>
              {c}
            </div>
          ))}
        </div>
      </WBox>
      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <WBox h={120} label="Devise détectée auto">
          EUR · CHF · CAD · GBP — taux Stripe live
        </WBox>
        <WBox h={120} label="Trad. dynamique">
          FR (réf.) → DeepL → EN/DE/IT/ES/NL · auto-review humain
        </WBox>
      </div>
    </V3Wireframe>
  );
}

function V3ApiScreen() {
  return (
    <V3Wireframe title="API publique tukio" kicker="V3 · Documentation développeurs">
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
        <WBox h={420} label="Sidebar nav">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {[
              'Quickstart',
              'Auth (OAuth2)',
              'Services',
              'Bookings',
              'Webhooks',
              'Stripe Connect',
              'Errors',
              'Changelog',
            ].map((t) => (
              <div key={t}>· {t}</div>
            ))}
          </div>
        </WBox>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <WBox h={80} label="Endpoint">
            GET /v1/services?city=nantes&category=tent
          </WBox>
          <WBox h={180} label="Code sample (curl + JS + Python)">
            <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', color: '#444' }}>
              $ curl -H "Authorization: Bearer sk_..." https://api.tukio.one/v1/services
              <br />→ 200 OK · [{`{...}`}]
            </div>
          </WBox>
          <WBox h={120} label="Response schema">
            {`JSON · id, slug, title, price, seller, availability[], reviews{}, …`}
          </WBox>
        </div>
      </div>
    </V3Wireframe>
  );
}

function V3AiMatchingScreen() {
  return (
    <V3Wireframe title="IA matching client ↔ pro" kicker="V3 · Matching intelligent">
      <WBox h={140} label="Brief client (NL)">
        « Je veux un mariage champêtre pour 80 personnes, plutôt minimaliste, près de Nantes, fin
        août, budget max 4000€ »
      </WBox>
      <div style={{ marginTop: 16 }}>
        <WBox h={60} label="Pipeline IA">
          extract entities → match availability → score (style, budget, ★, distance) → top 5
        </WBox>
      </div>
      <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 14, marginTop: 24, color: '#666' }}>
        Top 5 matchs · score [0-100]
      </h3>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 12 }}
      >
        {[94, 88, 82, 78, 71].map((s, i) => (
          <WBox key={i} h={110}>
            Pro #{i + 1}
            <br />
            score {s}
            <br />
            {['Style 95%', 'Budget 100%', 'Dispo ✓', '★ 4.9', '45 km'][i]}
          </WBox>
        ))}
      </div>
    </V3Wireframe>
  );
}

function V3TalentsScreen() {
  return (
    <V3Wireframe title="Marketplace de talents" kicker="V3 · DJ, animateurs, photographes">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['DJ', 'Animateurs', 'Photographes', 'Vidéastes', 'Musiciens', 'Magiciens'].map((c) => (
          <div
            key={c}
            style={{
              padding: '6px 12px',
              border: '1px dashed #999',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          >
            {c}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <WBox key={i} h={200}>
            [avatar]
            <br />
            Talent #{i}
            <br />★ 4.{7 + (i % 3)}
            <br />
            {640 + i * 40} €/prestation
            <br />
            <br />
            [lecteur audio/vidéo]
          </WBox>
        ))}
      </div>
    </V3Wireframe>
  );
}

window.V1MfaSetupScreen = V1MfaSetupScreen;
window.V1LoginSocialScreen = V1LoginSocialScreen;
window.V1AntiDesinterScreen = V1AntiDesinterScreen;
window.V1SignupB2BScreen = V1SignupB2BScreen;
window.V1ReviewMultiScreen = V1ReviewMultiScreen;
window.V1ReviewReplyScreen = V1ReviewReplyScreen;
window.V1DisputeFlowScreen = V1DisputeFlowScreen;
window.V2ConfiguratorScreen = V2ConfiguratorScreen;
window.V2RecommendationsScreen = V2RecommendationsScreen;
window.V2LoyaltyScreen = V2LoyaltyScreen;
window.V2EnterpriseScreen = V2EnterpriseScreen;
window.V2BadgesScreen = V2BadgesScreen;
window.V2SeoPagesScreen = V2SeoPagesScreen;
window.V3I18nScreen = V3I18nScreen;
window.V3ApiScreen = V3ApiScreen;
window.V3AiMatchingScreen = V3AiMatchingScreen;
window.V3TalentsScreen = V3TalentsScreen;
