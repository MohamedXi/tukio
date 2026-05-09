/* MVP · Back-office admin — 7 screens
   Validation pros, modération, transactions, litiges, audit log.
   Shared AdminShell with sidebar + topbar. */

function AdminShell({ active, title, subtitle, actions, children }) {
  const nav = [
    { id: 'home', icon: 'grid', label: 'Tableau de bord' },
    { id: 'pros', icon: 'user', label: 'Validation pros', badge: 12 },
    { id: 'reports', icon: 'shield', label: 'Signalements', badge: 4 },
    { id: 'transactions', icon: 'card', label: 'Transactions' },
    { id: 'disputes', icon: 'bolt', label: 'Litiges', badge: 2 },
    { id: 'audit', icon: 'doc', label: 'Audit log' },
  ];
  return (
    <div
      className="tk-root"
      style={{ width: '100%', minHeight: '100%', background: 'var(--cream-100)', display: 'flex' }}
    >
      <aside
        style={{
          width: 240,
          background: 'var(--charcoal-800)',
          color: 'var(--cream-200)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 0',
        }}
      >
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Logo size={20} mono color="var(--cream-50)" />
          <div
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.1em',
              color: 'var(--brand-300)',
              marginTop: 6,
              textTransform: 'uppercase',
            }}
          >
            Back-office admin
          </div>
        </div>
        <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map((n) => (
            <button
              key={n.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                background: active === n.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: active === n.id ? 'var(--cream-50)' : 'var(--cream-200)',
                fontSize: 13,
                fontWeight: 500,
                textAlign: 'left',
              }}
            >
              <Icon name={n.icon} size={16} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.badge && (
                <span
                  style={{
                    background: 'var(--brand-500)',
                    color: 'var(--cream-50)',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 999,
                  }}
                >
                  {n.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div
          style={{
            marginTop: 'auto',
            padding: '16px 20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name="Theo M" size={32} tone="brand" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--cream-50)' }}>Théo M.</div>
              <div style={{ fontSize: 11, color: 'var(--brand-300)' }}>admin-modo · MFA ✓</div>
            </div>
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 32px',
            borderBottom: '1px solid var(--cream-200)',
            background: 'var(--cream-50)',
          }}
        >
          <div>
            <Kicker>Admin</Kicker>
            <h1 style={{ fontSize: 'var(--text-xl)', marginTop: 4 }}>{title}</h1>
            {subtitle && (
              <p style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 2 }}>{subtitle}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>{actions}</div>
        </header>
        <div style={{ padding: 32, flex: 1, overflow: 'auto' }}>{children}</div>
      </main>
    </div>
  );
}

// ── Stat card ──
function StatCard({ label, value, delta, tone = 'neutral' }) {
  const c = {
    neutral: 'var(--charcoal-500)',
    up: 'var(--success-700)',
    down: 'var(--danger-600)',
    brand: 'var(--brand-700)',
  }[tone];
  return (
    <div className="tk-card" style={{ padding: 20, background: 'var(--cream-50)' }}>
      <div
        style={{
          fontSize: 12,
          color: 'var(--charcoal-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 500,
          marginTop: 8,
          color: 'var(--charcoal-800)',
        }}
      >
        {value}
      </div>
      {delta && <div style={{ fontSize: 12, marginTop: 6, color: c }}>{delta}</div>}
    </div>
  );
}

// ── 1. Home ──
function AdminHomeScreen() {
  return (
    <AdminShell active="home" title="Tableau de bord" subtitle="MVP · 7 mai 2026 · 142 pros actifs">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="Pros à valider" value="12" delta="+ 4 cette semaine" tone="brand" />
        <StatCard label="Signalements ouverts" value="4" delta="2 &lt; 24 h" tone="up" />
        <StatCard label="Litiges en médiation" value="2" delta="moyenne 3 j" />
        <StatCard label="GMV semaine" value="42 380 €" delta="+ 18 % vs S-1" tone="up" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginTop: 24 }}>
        <div className="tk-card" style={{ padding: 24, background: 'var(--cream-50)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Activité des dernières 24 h</h3>
            <button className="tk-btn tk-btn-ghost tk-btn-sm">Tout voir</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                t: '11:42',
                k: 'pro',
                c: 'Atelier Tente Loire — dossier soumis',
                b: 'Validation requise',
              },
              { t: '10:18', k: 'report', c: 'Photo signalée sur fiche #SVC-203', b: 'À examiner' },
              { t: '09:30', k: 'tx', c: 'Booking #BK-1284 capturé · 1 280 €', b: 'Auto' },
              {
                t: '08:55',
                k: 'dispute',
                c: 'Litige ouvert sur #BK-1271 par Camille R.',
                b: 'Médiation',
              },
              {
                t: '07:00',
                k: 'audit',
                c: 'Théo M. a bani user-9921 (récidive spam)',
                b: 'Bannissement',
              },
            ].map((e, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: i < 4 ? '1px solid var(--cream-200)' : 'none',
                }}
              >
                <span
                  className="tk-mono"
                  style={{ width: 56, fontSize: 11, color: 'var(--charcoal-400)' }}
                >
                  {e.t}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--charcoal-700)' }}>{e.c}</span>
                <span className="tk-badge tk-badge-neutral">{e.b}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="tk-card" style={{ padding: 24, background: 'var(--cream-50)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Actions urgentes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                c: 'var(--brand-50)',
                b: 'var(--brand-700)',
                t: '12 dossiers pros à valider · le plus ancien : 2 j',
              },
              {
                c: 'var(--warning-50)',
                b: 'var(--warning-700)',
                t: '2 litiges &gt; 5 j sans réponse pro',
              },
              {
                c: 'var(--info-50)',
                b: 'var(--info-700)',
                t: 'Audit comptable expert TVA · échéance V1',
              },
            ].map((a, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  background: a.c,
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                  color: a.b,
                  lineHeight: 1.5,
                }}
              >
                {a.t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// ── 2. Pros list ──
function AdminProsListScreen() {
  const rows = [
    {
      name: 'Atelier Tente Loire',
      siret: '852 478 901 00018',
      ville: 'Saint-Herblain',
      date: 'il y a 2 j',
      state: 'pending_admin_review',
    },
    {
      name: "Mobilier d'Anjou",
      siret: '893 102 555 00012',
      ville: 'Angers',
      date: 'il y a 1 j',
      state: 'pending_admin_review',
    },
    {
      name: 'Chapiteaux Loire',
      siret: '428 901 222 00033',
      ville: 'Nantes',
      date: 'il y a 1 j',
      state: 'pending_documents',
    },
    {
      name: 'Ouest Events',
      siret: '712 559 003 00010',
      ville: 'Vannes',
      date: 'il y a 6 h',
      state: 'pending_admin_review',
    },
  ];
  return (
    <AdminShell
      active="pros"
      title="Validation des pros"
      subtitle="12 dossiers en attente · délai cible &lt; 24 h"
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Pill active>À valider · 12</Pill>
        <Pill>Documents incomplets · 5</Pill>
        <Pill>Validés · 142</Pill>
        <Pill>Rejetés · 8</Pill>
        <Pill>Bannis · 2</Pill>
      </div>
      <div
        className="tk-card"
        style={{ background: 'var(--cream-50)', padding: 0, overflow: 'hidden' }}
      >
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
              {['Nom commercial', 'SIRET', 'Ville', 'Soumis', 'Statut', ''].map((h, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--cream-200)' }}>
                <td style={{ padding: '16px', fontWeight: 500, color: 'var(--charcoal-800)' }}>
                  {r.name}
                </td>
                <td
                  style={{
                    padding: '16px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--charcoal-500)',
                  }}
                >
                  {r.siret}
                </td>
                <td style={{ padding: '16px', color: 'var(--charcoal-600)' }}>{r.ville}</td>
                <td style={{ padding: '16px', color: 'var(--charcoal-500)' }}>{r.date}</td>
                <td style={{ padding: '16px' }}>
                  <span
                    className={`tk-badge tk-badge-${r.state === 'pending_admin_review' ? 'warning' : 'neutral'}`}
                  >
                    {r.state}
                  </span>
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button className="tk-btn tk-btn-secondary tk-btn-sm">Examiner →</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

// ── 3. Pro review ──
function AdminProReviewScreen() {
  return (
    <AdminShell
      active="pros"
      title="Atelier Tente Loire"
      subtitle="Léa Martineau · soumis il y a 2 j"
      actions={
        <>
          <button className="tk-btn tk-btn-secondary tk-btn-sm">Demander un complément</button>
          <button
            className="tk-btn tk-btn-secondary tk-btn-sm"
            style={{ borderColor: 'var(--danger-500)', color: 'var(--danger-600)' }}
          >
            Rejeter
          </button>
          <button className="tk-btn tk-btn-primary tk-btn-sm">Valider le compte</button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="tk-card" style={{ padding: 24, background: 'var(--cream-50)' }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 16,
              }}
            >
              Identité
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Info label="Prénom Nom" v="Léa Martineau" />
              <Info label="Email" v="lea@ateliertenteloire.fr" badge="vérifié" />
              <Info label="Téléphone" v="+33 6 24 56 78 90" />
              <Info label="Date de naissance" v="14/09/1989" />
            </div>
          </div>
          <div className="tk-card" style={{ padding: 24, background: 'var(--cream-50)' }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 16,
              }}
            >
              Activité
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Info label="Nom commercial" v="Atelier Tente Loire" />
              <Info label="SIRET" v="852 478 901 00018" badge="✓ INSEE" />
              <Info label="Forme juridique" v="SAS" />
              <Info label="TVA" v="FR 67 852478901 · assujetti" />
            </div>
          </div>
          <div className="tk-card" style={{ padding: 24, background: 'var(--cream-50)' }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 16,
              }}
            >
              Documents
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {['CNI recto-verso', 'KBIS &lt; 3 mois', 'RIB'].map((d) => (
                <div key={d}>
                  <Placeholder
                    aspect="3 / 4"
                    label="document soumis"
                    style={{ borderRadius: 'var(--radius)' }}
                  />
                  <div
                    style={{ fontSize: 12, fontWeight: 500, marginTop: 8 }}
                    dangerouslySetInnerHTML={{ __html: d }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--charcoal-400)', marginTop: 2 }}>
                    PDF · 1.2 Mo
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="tk-card" style={{ padding: 24, background: 'var(--cream-50)' }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--charcoal-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 16,
              }}
            >
              Stripe Connect
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="tk-badge tk-badge-success">✓ Charges enabled</span>
              <span className="tk-badge tk-badge-success">✓ Payouts enabled</span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--charcoal-400)',
                  marginLeft: 'auto',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                acct_1Pq8Az…
              </span>
            </div>
          </div>
        </div>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            className="tk-card"
            style={{ padding: 20, background: 'var(--success-50)', borderColor: 'transparent' }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--success-700)',
                marginBottom: 8,
              }}
            >
              ✓ Tous les pré-checks passent
            </div>
            <div style={{ fontSize: 12, color: 'var(--success-700)', lineHeight: 1.55 }}>
              SIRET valide INSEE · email vérifié · documents lisibles · Stripe configuré · pas de
              doublon SIRET.
            </div>
          </div>
          <div className="tk-card" style={{ padding: 20, background: 'var(--cream-50)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Notes internes</div>
            <textarea
              className="tk-input"
              style={{ height: 100, padding: 10, resize: 'vertical' }}
              placeholder="Note privée, visible uniquement par les admins…"
            />
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}
function Info({ label, v, badge }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--charcoal-400)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--charcoal-800)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>{v}</span>
        {badge && (
          <span className="tk-badge tk-badge-success" style={{ fontSize: 10 }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

// ── 4. Reports ──
function AdminReportsScreen() {
  const rows = [
    {
      who: 'user-#882 → fiche #SVC-203',
      reason: 'Photo non conforme · droits',
      sev: 'warning',
      ago: 'il y a 14 h',
    },
    {
      who: 'Pro #PR-141 → message',
      reason: 'Tentative de désintermédiation',
      sev: 'danger',
      ago: 'il y a 2 j',
    },
    {
      who: 'user-#771 → avis #RV-091',
      reason: 'Avis diffamatoire',
      sev: 'warning',
      ago: 'il y a 3 j',
    },
    {
      who: 'user-#440 → fiche #SVC-180',
      reason: 'Prix anormalement bas (-60% médiane)',
      sev: 'info',
      ago: 'il y a 5 j',
    },
  ];
  return (
    <AdminShell
      active="reports"
      title="Signalements"
      subtitle="4 ouverts · 132 traités cette année"
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Pill active>Ouverts · 4</Pill>
        <Pill>En cours · 1</Pill>
        <Pill>Résolus</Pill>
        <Pill>Rejetés</Pill>
      </div>
      <div
        className="tk-card"
        style={{ background: 'var(--cream-50)', padding: 0, overflow: 'hidden' }}
      >
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
              {['Cible', 'Raison', 'Sévérité', 'Reçu', ''].map((h, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--cream-200)' }}>
                <td style={{ padding: '16px', fontWeight: 500 }}>{r.who}</td>
                <td style={{ padding: '16px', color: 'var(--charcoal-600)' }}>{r.reason}</td>
                <td style={{ padding: '16px' }}>
                  <span className={`tk-badge tk-badge-${r.sev}`}>{r.sev}</span>
                </td>
                <td style={{ padding: '16px', color: 'var(--charcoal-500)' }}>{r.ago}</td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button className="tk-btn tk-btn-secondary tk-btn-sm">Examiner</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

// ── 5. Transactions ──
function AdminTransactionsScreen() {
  const rows = [
    {
      id: 'BK-1284',
      date: '07/05 11:42',
      client: 'Camille R.',
      pro: 'Atelier Tente Loire',
      amount: '1 280 €',
      state: 'captured',
    },
    {
      id: 'BK-1283',
      date: '07/05 09:18',
      client: 'Marie B.',
      pro: "Mobilier d'Anjou",
      amount: '780 €',
      state: 'authorized',
    },
    {
      id: 'BK-1282',
      date: '06/05 17:30',
      client: 'TPE Saint-Nazaire',
      pro: 'Atelier Tente Loire',
      amount: '2 140 €',
      state: 'captured',
    },
    {
      id: 'BK-1280',
      date: '06/05 12:11',
      client: 'Pierre L.',
      pro: 'Chapiteaux Loire',
      amount: '950 €',
      state: 'refunded',
    },
  ];
  return (
    <AdminShell
      active="transactions"
      title="Transactions"
      subtitle="42 380 € cette semaine · commission 10 %"
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard label="GMV semaine" value="42 380 €" delta="+ 18 %" tone="up" />
        <StatCard label="Commission" value="4 238 €" delta="part : 10 %" />
        <StatCard label="Bookings capturés" value="38" />
        <StatCard label="En autorisation" value="12" tone="brand" />
      </div>
      <div
        className="tk-card"
        style={{ background: 'var(--cream-50)', padding: 0, overflow: 'hidden' }}
      >
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
              {['ID', 'Date', 'Client', 'Pro', 'Montant', 'État'].map((h, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--cream-200)' }}>
                <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  {r.id}
                </td>
                <td style={{ padding: '16px', color: 'var(--charcoal-500)' }}>{r.date}</td>
                <td style={{ padding: '16px' }}>{r.client}</td>
                <td style={{ padding: '16px', color: 'var(--charcoal-600)' }}>{r.pro}</td>
                <td style={{ padding: '16px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {r.amount}
                </td>
                <td style={{ padding: '16px' }}>
                  <span
                    className={`tk-badge tk-badge-${{ captured: 'success', authorized: 'warning', refunded: 'neutral' }[r.state]}`}
                  >
                    {r.state}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

// ── 6. Disputes ──
function AdminDisputesScreen() {
  return (
    <AdminShell
      active="disputes"
      title="Litiges"
      subtitle="2 ouverts · délai moyen de résolution : 3 jours"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          {
            id: 'DSP-04',
            booking: 'BK-1271',
            client: 'Camille R.',
            pro: 'Atelier Tente Loire',
            reason: 'Service non conforme — toile percée',
            amount: '1 280 €',
            phase: 'Médiation',
            days: 3,
          },
          {
            id: 'DSP-03',
            booking: 'BK-1259',
            client: 'TPE Mauges',
            pro: "Mobilier d'Anjou",
            reason: 'Annulation pro J-2 sans remboursement',
            amount: '640 €',
            phase: 'Ouverture',
            days: 1,
          },
        ].map((d) => (
          <div
            key={d.id}
            className="tk-card"
            style={{
              padding: 24,
              background: 'var(--cream-50)',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: 24,
              alignItems: 'center',
            }}
          >
            <span
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: 'var(--danger-500)',
                color: 'var(--cream-50)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="bolt" size={24} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>
                  {d.id}
                </span>
                <span className="tk-badge tk-badge-warning">Phase : {d.phase}</span>
                <span style={{ fontSize: 12, color: 'var(--charcoal-500)' }}>· J+{d.days}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{d.reason}</div>
              <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 4 }}>
                {d.client} ⟷ {d.pro} · booking{' '}
                <span style={{ fontFamily: 'var(--font-mono)' }}>{d.booking}</span> · {d.amount}
              </div>
            </div>
            <button className="tk-btn tk-btn-primary tk-btn-sm">Médiation →</button>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 32,
          padding: 20,
          background: 'var(--info-50)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          gap: 16,
        }}
      >
        <Icon name="shield" size={20} color="var(--info-700)" />
        <div style={{ fontSize: 13, color: 'var(--info-700)', lineHeight: 1.55 }}>
          <strong>Workflow MVP simplifié</strong> : ouverture → résolution amiable. Le workflow
          complet (médiation 48h → résolution → réouverture 15j) arrive en V1.
        </div>
      </div>
    </AdminShell>
  );
}

// ── 7. Audit log ──
function AdminAuditScreen() {
  const rows = [
    {
      t: '07/05 11:50',
      who: 'Théo M.',
      action: 'validate_pro',
      target: 'Pro #PR-148 · Atelier Tente Loire',
      note: 'Tous pré-checks ✓',
    },
    {
      t: '07/05 10:32',
      who: 'Théo M.',
      action: 'ban_user',
      target: 'user-#9921',
      note: 'Récidive spam · 3e signalement',
    },
    {
      t: '07/05 09:18',
      who: 'Sophie L.',
      action: 'refund_full',
      target: 'BK-1280 · 950 €',
      note: 'Annulation pro · cas force majeure',
    },
    {
      t: '06/05 17:00',
      who: 'system',
      action: 'auto_payout',
      target: 'Pro #PR-141 · 1 728 €',
      note: 'J+1 après événement',
    },
    {
      t: '06/05 11:11',
      who: 'Théo M.',
      action: 'reject_listing',
      target: 'fiche #SVC-203',
      note: 'Photos non conformes droits',
    },
  ];
  return (
    <AdminShell
      active="audit"
      title="Audit log"
      subtitle="Toutes les actions admin sont loggées de manière immuable"
    >
      <div
        className="tk-card"
        style={{ background: 'var(--cream-50)', padding: 0, overflow: 'hidden' }}
      >
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
              {['Horodatage', 'Acteur', 'Action', 'Cible', 'Note'].map((h, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--cream-200)' }}>
                <td
                  style={{
                    padding: '12px 16px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--charcoal-500)',
                  }}
                >
                  {r.t}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{r.who}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    className="tk-badge tk-badge-neutral"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {r.action}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--charcoal-600)' }}>{r.target}</td>
                <td style={{ padding: '12px 16px', color: 'var(--charcoal-500)' }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

window.AdminHomeScreen = AdminHomeScreen;
window.AdminProsListScreen = AdminProsListScreen;
window.AdminProReviewScreen = AdminProReviewScreen;
window.AdminReportsScreen = AdminReportsScreen;
window.AdminTransactionsScreen = AdminTransactionsScreen;
window.AdminDisputesScreen = AdminDisputesScreen;
window.AdminAuditScreen = AdminAuditScreen;
