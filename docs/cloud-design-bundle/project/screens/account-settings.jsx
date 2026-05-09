/* Paramètres compte client — /account/settings
   Sidebar nav (réutilise SideLink de bookings-list) + sections empilées :
   profil, paiement, notifications, sécurité, préférences. */

function AccountSettingsScreen() {
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
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
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
            Paramètres
          </h1>
          <div style={{ marginTop: 8, fontSize: 14, color: 'var(--charcoal-500)' }}>
            Mettez à jour vos informations, vos moyens de paiement et la façon dont nous vous
            contactons.
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
            <SideLink icon="calendar" label="Réservations" badge="5" />
            <SideLink icon="message" label="Messages" badge="2" />
            <SideLink icon="heart" label="Favoris" />
            <SideLink icon="star" label="Mes avis" />
            <SideLink icon="user" label="Profil" />
            <SideLink icon="card" label="Paiements & cartes" />
            <SideLink icon="bell" label="Notifications" />
            <SideLink icon="settings" label="Paramètres" active />
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
              Sur cette page
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {[
                ['Profil', true],
                ['Paiement', false],
                ['Notifications', false],
                ['Sécurité', false],
                ['Préférences', false],
                ['Zone dangereuse', false],
              ].map(([l, active]) => (
                <li
                  key={l}
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    color: active ? 'var(--brand-700)' : 'var(--charcoal-500)',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────── */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* PROFIL */}
          <SettingsSection
            id="profil"
            title="Profil"
            sub="Visible des prestataires lors d'une demande."
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                gap: 32,
                alignItems: 'start',
              }}
            >
              {/* Avatar */}
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}
              >
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--brand-200), var(--brand-400))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 36,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--brand-800)',
                    fontWeight: 500,
                  }}
                >
                  MD
                </div>
                <button className="tk-btn tk-btn-tertiary tk-btn-sm" style={{ fontSize: 12 }}>
                  Modifier
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <SettField label="Prénom" value="Marion" />
                <SettField label="Nom" value="Delcour" />
                <SettField label="Email" value="marion.delcour@gmail.com" verified />
                <SettField label="Téléphone" value="+33 6 14 22 88 03" verified />
                <SettField label="Date de naissance" value="14 mars 1991" />
                <SettField label="Ville" value="Vertou (44)" />
                <div style={{ gridColumn: '1 / -1' }}>
                  <SettField
                    label="Adresse de facturation"
                    value="12 rue des Tilleuls — 44120 Vertou, France"
                    wide
                  />
                </div>
              </div>
            </div>

            <SectionFooter />
          </SettingsSection>

          {/* PAIEMENT */}
          <SettingsSection
            id="paiement"
            title="Paiement"
            sub="Vos cartes restent stockées chez Stripe — Tukio n'y a jamais accès."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PayCard brand="Visa" last4="4242" exp="08/27" holder="Marion Delcour" primary />
              <PayCard brand="Mastercard" last4="0094" exp="11/26" holder="Marion Delcour" />
              <button
                className="tk-btn tk-btn-tertiary tk-btn-sm"
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
              >
                <Icon name="plus" size={14} /> Ajouter un moyen de paiement
              </button>
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 14,
                background: 'var(--cream-100)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <Icon name="shield" size={16} color="var(--brand-600)" />
              <div style={{ fontSize: 12, color: 'var(--charcoal-600)', lineHeight: 1.5 }}>
                Au moment de la réservation, Tukio <strong>autorise</strong> votre carte sans la
                débiter. Le débit n'a lieu qu'après confirmation du prestataire.
              </div>
            </div>
          </SettingsSection>

          {/* NOTIFICATIONS */}
          <SettingsSection
            id="notifications"
            title="Notifications"
            sub="Choisissez ce que vous souhaitez recevoir, et par quel canal."
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 80px 80px',
                gap: 0,
                alignItems: 'center',
                borderTop: '1px solid var(--cream-200)',
              }}
            >
              <div style={{ ...notifHeaderCell, textAlign: 'left', paddingLeft: 4 }}></div>
              <div style={notifHeaderCell}>Email</div>
              <div style={notifHeaderCell}>SMS</div>
              <div style={notifHeaderCell}>Push</div>

              <NotifRow
                label="Confirmation de demande"
                sub="Quand un pro accepte ou refuse"
                channels={[true, true, true]}
                required
              />
              <NotifRow
                label="Rappel J-3"
                sub="Détails et contacts du jour J"
                channels={[true, true, false]}
              />
              <NotifRow
                label="Nouveau message"
                sub="Quand un pro vous écrit"
                channels={[true, false, true]}
              />
              <NotifRow
                label="Demande d'avis"
                sub="Après un événement"
                channels={[true, false, false]}
              />
              <NotifRow
                label="Promotions & nouveautés"
                sub="Sélections, nouveaux pros près de chez vous"
                channels={[false, false, false]}
              />
              <NotifRow
                label="Newsletter mensuelle"
                sub="Inspiration et tendances"
                channels={[true, false, false]}
                last
              />
            </div>
          </SettingsSection>

          {/* SÉCURITÉ */}
          <SettingsSection
            id="securite"
            title="Sécurité"
            sub="Mot de passe, double authentification, sessions actives."
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <SecRow
                icon="bolt"
                title="Mot de passe"
                value="Modifié il y a 4 mois"
                action="Modifier"
              />
              <SecRow
                icon="shield"
                title="Double authentification"
                value="Activée par SMS · +33 6 14 22 88 03"
                action="Configurer"
                badge="active"
              />
              <SecRow
                icon="user"
                title="Sessions actives"
                value="2 appareils — Mac (Vertou), iPhone (Vertou)"
                action="Voir"
              />
              <SecRow
                icon="doc"
                title="Téléchargement des données"
                value="Recevez une copie de votre compte (RGPD art. 20)"
                action="Demander"
                last
              />
            </div>
          </SettingsSection>

          {/* PRÉFÉRENCES */}
          <SettingsSection
            id="preferences"
            title="Préférences"
            sub="Langue, devise, accessibilité."
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <PrefSelect label="Langue" value="Français" />
              <PrefSelect label="Devise" value="Euro (€)" />
              <PrefSelect label="Fuseau horaire" value="Europe/Paris (UTC+1)" />
              <PrefSelect label="Format de date" value="14 sept. 2026" />
            </div>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <PrefToggle
                label="Mode sombre"
                sub="Suit les réglages système par défaut"
                value="auto"
              />
              <PrefToggle
                label="Réduire les animations"
                sub="Pour le confort visuel et la batterie"
                value={false}
              />
              <PrefToggle
                label="Recherche basée sur ma position"
                sub="Affiche d'abord les pros proches de vous"
                value={true}
              />
            </div>
          </SettingsSection>

          {/* DANGER */}
          <SettingsSection id="danger" title="Zone dangereuse" sub="Actions irréversibles." danger>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <DangerRow
                title="Désactiver mon compte"
                sub="Réservations en cours préservées. Vous pouvez réactiver à tout moment."
                action="Désactiver"
              />
              <DangerRow
                title="Supprimer définitivement"
                sub="Vos données sont effacées sous 30 jours. Cette action est irréversible."
                action="Supprimer"
                destructive
                last
              />
            </div>
          </SettingsSection>
        </main>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────

function SettingsSection({ id, title, sub, children, danger }) {
  return (
    <section
      id={id}
      className="tk-card"
      style={{
        padding: 28,
        border: danger ? '1px solid var(--error-200, #F0CFC7)' : undefined,
      }}
    >
      <header
        style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--cream-200)' }}
      >
        <h2
          style={{
            fontSize: 22,
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            color: danger ? 'var(--error-700, #8C2A1A)' : 'var(--charcoal-800)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h2>
        {sub && (
          <div style={{ fontSize: 13, color: 'var(--charcoal-500)', marginTop: 4 }}>{sub}</div>
        )}
      </header>
      {children}
    </section>
  );
}

function SectionFooter() {
  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: '1px solid var(--cream-200)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--charcoal-400)', fontFamily: 'var(--font-mono)' }}>
        Modifié il y a 12 jours
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="tk-btn tk-btn-tertiary tk-btn-sm">Annuler</button>
        <button className="tk-btn tk-btn-primary tk-btn-sm">Enregistrer</button>
      </div>
    </div>
  );
}

function SettField({ label, value, verified, wide }) {
  return (
    <div>
      <label
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--charcoal-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          display: 'block',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <div
        style={{
          padding: '10px 12px',
          background: 'var(--cream-50)',
          border: '1px solid var(--cream-300)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 14,
          color: 'var(--charcoal-700)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{value}</span>
        {verified && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--success-700, #1E5C3D)',
            }}
          >
            <Icon name="check" size={12} color="var(--success-600, #2A7E55)" /> vérifié
          </span>
        )}
      </div>
    </div>
  );
}

function PayCard({ brand, last4, exp, holder, primary }) {
  const accent = brand === 'Visa' ? '#1A1F71' : '#EB001B';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr auto',
        gap: 16,
        alignItems: 'center',
        padding: 16,
        background: 'var(--cream-50)',
        border: primary ? '1px solid var(--brand-300)' : '1px solid var(--cream-200)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div
        style={{
          width: 60,
          height: 38,
          background: 'var(--cream-100)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontStyle: 'italic',
          fontSize: 13,
          color: accent,
          letterSpacing: '-0.02em',
        }}
      >
        {brand}
      </div>

      <div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--charcoal-800)',
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.02em',
          }}
        >
          •••• •••• •••• {last4}
        </div>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>
          {holder} · expire {exp}
          {primary && (
            <span
              style={{
                marginLeft: 10,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                background: 'var(--brand-50)',
                color: 'var(--brand-700)',
                borderRadius: 999,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
              }}
            >
              par défaut
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {!primary && (
          <button className="tk-btn tk-btn-tertiary tk-btn-sm" style={{ fontSize: 12 }}>
            Définir par défaut
          </button>
        )}
        <button className="tk-btn tk-btn-tertiary tk-btn-sm" style={{ fontSize: 12 }}>
          Supprimer
        </button>
      </div>
    </div>
  );
}

const notifHeaderCell = {
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  color: 'var(--charcoal-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  textAlign: 'center',
  padding: '10px 0',
};

function NotifRow({ label, sub, channels, required, last }) {
  return (
    <React.Fragment>
      <div
        style={{ padding: '14px 4px', borderBottom: last ? 'none' : '1px solid var(--cream-200)' }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--charcoal-800)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {label}
          {required && (
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--charcoal-500)',
                padding: '2px 6px',
                background: 'var(--cream-100)',
                borderRadius: 4,
              }}
            >
              obligatoire
            </span>
          )}
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>{sub}</div>
        )}
      </div>
      {channels.map((on, i) => (
        <div
          key={i}
          style={{
            padding: '14px 0',
            borderBottom: last ? 'none' : '1px solid var(--cream-200)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Toggle on={on} disabled={required} />
        </div>
      ))}
    </React.Fragment>
  );
}

function Toggle({ on, disabled }) {
  return (
    <span
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        background: on ? 'var(--brand-500)' : 'var(--cream-300)',
        position: 'relative',
        display: 'inline-block',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 120ms ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'var(--cream-50)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          transition: 'left 120ms ease',
        }}
      />
    </span>
  );
}

function SecRow({ icon, title, value, action, badge, last }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        gap: 16,
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: last ? 'none' : '1px solid var(--cream-200)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          background: 'var(--cream-100)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={16} color="var(--charcoal-600)" />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--charcoal-800)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>{value}</div>
      </div>
      {badge === 'active' ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            background: 'var(--success-50, #E8F4ED)',
            color: 'var(--success-700, #1E5C3D)',
            borderRadius: 999,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--success-600, #2A7E55)',
            }}
          />
          activée
        </span>
      ) : (
        <span />
      )}
      <button className="tk-btn tk-btn-tertiary tk-btn-sm" style={{ fontSize: 12 }}>
        {action}
      </button>
    </div>
  );
}

function PrefSelect({ label, value }) {
  return (
    <div>
      <label
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--charcoal-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          display: 'block',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <div
        style={{
          padding: '10px 12px',
          background: 'var(--cream-50)',
          border: '1px solid var(--cream-300)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 14,
          color: 'var(--charcoal-700)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{value}</span>
        <Icon name="caret" size={14} color="var(--charcoal-400)" />
      </div>
    </div>
  );
}

function PrefToggle({ label, sub, value }) {
  const auto = value === 'auto';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        padding: '10px 0',
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--charcoal-800)' }}>{label}</div>
        {sub && (
          <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>{sub}</div>
        )}
      </div>
      {auto ? (
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: 3,
            background: 'var(--cream-100)',
            borderRadius: 999,
          }}
        >
          {['Auto', 'Clair', 'Sombre'].map((o) => (
            <span
              key={o}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 500,
                background: o === 'Auto' ? 'var(--cream-50)' : 'transparent',
                color: o === 'Auto' ? 'var(--charcoal-800)' : 'var(--charcoal-500)',
                borderRadius: 999,
                boxShadow: o === 'Auto' ? '0 1px 2px rgba(0,0,0,0.06)' : undefined,
              }}
            >
              {o}
            </span>
          ))}
        </div>
      ) : (
        <Toggle on={value} />
      )}
    </div>
  );
}

function DangerRow({ title, sub, action, destructive, last }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 16,
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: last ? 'none' : '1px solid var(--cream-200)',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: destructive ? 'var(--error-700, #8C2A1A)' : 'var(--charcoal-800)',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2, lineHeight: 1.5 }}>
          {sub}
        </div>
      </div>
      <button
        style={{
          padding: '8px 14px',
          background: 'transparent',
          border: destructive
            ? '1px solid var(--error-400, #C26A56)'
            : '1px solid var(--cream-300)',
          color: destructive ? 'var(--error-700, #8C2A1A)' : 'var(--charcoal-700)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'var(--font-body)',
          cursor: 'pointer',
        }}
      >
        {action}
      </button>
    </div>
  );
}
