/* /account/messages — messagerie client ↔ pro
   Layout 3 colonnes : liste conversations · fil · panneau résa contextuel */

function MessagesScreen() {
  return (
    <div
      className="tk-root"
      style={{
        width: '100%',
        minHeight: '100%',
        background: 'var(--cream-50)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TopNav active="messages" />

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '340px 1fr 320px',
          borderTop: '1px solid var(--cream-200)',
          minHeight: 0,
        }}
      >
        {/* ── Colonne 1 : liste des conversations ───────────────── */}
        <aside
          style={{
            borderRight: '1px solid var(--cream-200)',
            background: 'var(--cream-50)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '20px 20px 12px' }}>
            <h1
              style={{
                fontSize: 22,
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                letterSpacing: '-0.02em',
                color: 'var(--charcoal-800)',
                marginBottom: 14,
                lineHeight: 1.1,
              }}
            >
              Messages
            </h1>
            <div style={{ position: 'relative' }}>
              <Icon
                name="search"
                size={14}
                color="var(--charcoal-500)"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                placeholder="Rechercher une conversation…"
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  fontSize: 13,
                  fontFamily: 'var(--font-body)',
                  border: '1px solid var(--cream-300)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--cream-50)',
                  color: 'var(--charcoal-800)',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              <FilterChip label="Toutes" count={8} active />
              <FilterChip label="Non lues" count={2} />
              <FilterChip label="Archivées" count={3} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px' }}>
            <ConvItem
              name="Antoine — Event Co Nantes"
              snippet="Pas de souci pour le montage à 8h. Je vous envoie un SMS en arrivant."
              time="il y a 2 min"
              unread={2}
              active
              service="Chapiteau bambou · 15-17 juin"
            />
            <ConvItem
              name="Camille — Mobilier des Mariées"
              snippet="Vous : Merci, à demain pour la livraison !"
              time="il y a 1 h"
              service="80 chaises Tiffany · 22 juin"
            />
            <ConvItem
              name="Lucas — Light & Sound"
              snippet="Voici le devis détaillé pour le pack lumière."
              time="hier"
              unread={1}
              service="Pack lumière · 5-6 juillet"
            />
            <ConvItem
              name="Inès — Fleurs des Champs"
              snippet="Vous : Parfait, je valide la composition."
              time="3 j"
              service="Décoration florale · 22 juin"
            />
            <ConvItem
              name="Pierre — Sono Atlantique"
              snippet="L'événement est dans 2 jours, je passe demain confirmer le set."
              time="5 j"
              service="Sono complète · 8 juin"
              muted
            />
            <ConvItem
              name="Marie — Chefs Privés"
              snippet="Avis publié — merci pour votre retour ⭐⭐⭐⭐⭐"
              time="12 j"
              service="Buffet 80 personnes · 24 mai"
              muted
            />
          </div>
        </aside>

        {/* ── Colonne 2 : fil de discussion ───────────────────────── */}
        <main
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--cream-100)',
            minHeight: 0,
          }}
        >
          {/* En-tête conversation */}
          <header
            style={{
              padding: '16px 24px',
              background: 'var(--cream-50)',
              borderBottom: '1px solid var(--cream-200)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <Avatar name="Antoine" size={42} tone="brand" />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal-800)' }}>
                  Antoine — Event Co Nantes
                </span>
                <span className="tk-badge tk-badge-success" style={{ fontSize: 10 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--success-500)',
                    }}
                  />{' '}
                  En ligne
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--charcoal-500)', marginTop: 2 }}>
                Répond en ~ 14 min · ⭐ 4,9 (124 avis)
              </div>
            </div>
            <button className="tk-btn tk-btn-ghost tk-btn-sm" style={{ width: 36, padding: 0 }}>
              <Icon name="bell" size={16} />
            </button>
            <button className="tk-btn tk-btn-ghost tk-btn-sm" style={{ width: 36, padding: 0 }}>
              <Icon name="settings" size={16} />
            </button>
          </header>

          {/* Fil de messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {/* Système — démarrage conversation */}
            <SystemDivider label="Conversation démarrée le 14 juin · suite à votre réservation" />

            <DateLabel>Mercredi 11 juin</DateLabel>

            <Bubble from="me" time="10:24">
              Bonjour Antoine, je viens de réserver le chapiteau bambou pour notre mariage du 15 au
              17 juin. Quelques questions sur le montage&nbsp;: le terrain est en pelouse légèrement
              en pente côté ouest. Est-ce un souci&nbsp;?
            </Bubble>

            <Bubble from="them" time="10:41" name="Antoine">
              Bonjour Marie, merci pour votre réservation 🙌 Aucun souci pour la pente, je viendrai
              avec des cales. Pouvez-vous me confirmer l'accès véhicule&nbsp;? On a besoin d'un
              passage de 2,5m de large minimum jusqu'au lieu de pose.
            </Bubble>

            <Bubble from="me" time="10:47">
              Oui le portail fait 3m, et l'allée est gravillonnée. Pas de problème avec un Trafic ou
              équivalent.
            </Bubble>

            <DateLabel>Aujourd'hui</DateLabel>

            <Bubble from="them" time="14:32" name="Antoine" attached>
              Parfait. Je vous envoie le bon de livraison à signer à l'arrivée. Le voici en pièce
              jointe pour info.
              <FileAttachment name="bon-livraison-15-juin.pdf" size="146 Ko" />
            </Bubble>

            <Bubble from="me" time="14:38">
              Bien reçu, merci&nbsp;! Une dernière chose — vous arrivez bien à 8h le vendredi&nbsp;?
              On a la déco florale qui passe à 11h, donc il faudrait que le chapiteau soit monté
              avant.
            </Bubble>

            <Bubble from="them" time="14:51" name="Antoine">
              Pas de souci pour le montage à 8h. Je vous envoie un SMS en arrivant 👍
            </Bubble>

            {/* Indicateur "en train d'écrire" */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 8,
                paddingLeft: 4,
              }}
            >
              <Avatar name="Antoine" size={22} tone="brand" />
              <div
                style={{
                  background: 'var(--cream-50)',
                  border: '1px solid var(--cream-200)',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '10px 14px',
                  display: 'inline-flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                <Dot delay={0} />
                <Dot delay={0.15} />
                <Dot delay={0.3} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--charcoal-500)', fontStyle: 'italic' }}>
                Antoine est en train d'écrire…
              </span>
            </div>
          </div>

          {/* Composer */}
          <div
            style={{
              padding: '12px 24px 20px',
              background: 'var(--cream-50)',
              borderTop: '1px solid var(--cream-200)',
            }}
          >
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <QuickReply label="Tout est OK pour vous ?" />
              <QuickReply label="Je confirme l'horaire" />
              <QuickReply label="Pourriez-vous m'envoyer une photo ?" />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                background: 'var(--cream-50)',
                border: '1px solid var(--cream-300)',
                borderRadius: 'var(--radius-md)',
                padding: 8,
              }}
            >
              <button
                className="tk-btn tk-btn-ghost tk-btn-sm"
                style={{ width: 32, height: 32, padding: 0 }}
              >
                <Icon name="plus" size={16} />
              </button>
              <textarea
                placeholder="Écrire un message à Antoine…"
                rows={2}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  fontSize: 14,
                  fontFamily: 'var(--font-body)',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--charcoal-800)',
                  resize: 'none',
                  lineHeight: 1.5,
                }}
              />
              <button
                className="tk-btn tk-btn-primary tk-btn-sm"
                style={{ width: 36, height: 36, padding: 0, justifyContent: 'center' }}
              >
                <Icon name="arrow" size={14} color="var(--cream-50)" strokeWidth={2.5} />
              </button>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 6,
                fontSize: 11,
                color: 'var(--charcoal-400)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Icon name="shield" size={11} color="var(--charcoal-400)" />
                Conversation protégée — pas de partage de coordonnées hors plateforme
              </span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>↵ envoyer · ⇧↵ saut de ligne</span>
            </div>
          </div>
        </main>

        {/* ── Colonne 3 : panneau réservation ────────────────────── */}
        <aside
          style={{
            borderLeft: '1px solid var(--cream-200)',
            background: 'var(--cream-50)',
            padding: 20,
            overflowY: 'auto',
          }}
        >
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
            Réservation liée
          </div>

          <div className="tk-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div
              style={{
                height: 100,
                background: 'linear-gradient(135deg, #d4a574 0%, #8a6a4a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="tent" size={36} color="rgba(255,255,255,0.85)" />
            </div>
            <div style={{ padding: 16 }}>
              <span className="tk-badge tk-badge-success" style={{ fontSize: 10, marginBottom: 8 }}>
                <Icon name="check" size={10} strokeWidth={2.5} /> Confirmée · J-4
              </span>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--charcoal-800)',
                  marginBottom: 8,
                  lineHeight: 1.3,
                }}
              >
                Chapiteau bambou 8 × 12 m — toile crème
              </h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontSize: 12,
                  color: 'var(--charcoal-600)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="calendar" size={12} color="var(--charcoal-500)" /> 15 → 17 juin 2026
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="pin" size={12} color="var(--charcoal-500)" /> 12 rue des Lilas, Nantes
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="euro" size={12} color="var(--charcoal-500)" /> 1 395 €
                </span>
              </div>
              <button
                className="tk-btn tk-btn-secondary tk-btn-sm"
                style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
              >
                Voir le détail →
              </button>
            </div>
          </div>

          {/* Étapes à venir */}
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
            Prochaines étapes
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              marginBottom: 24,
              paddingLeft: 4,
            }}
          >
            <Step label="Rappel J-1" sub="14 juin · email & SMS" upcoming />
            <Step label="Livraison & montage" sub="15 juin, 8h00" upcoming highlight />
            <Step label="Reprise" sub="17 juin, 11h00" upcoming />
            <Step label="Demande d'avis" sub="18 juin · J+1" upcoming last />
          </div>

          {/* Quick actions */}
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
            Actions rapides
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SidebarAction icon="doc" label="Partager une pièce jointe" />
            <SidebarAction icon="pin" label="Envoyer ma localisation" />
            <SidebarAction icon="calendar" label="Proposer un créneau d'appel" />
            <SidebarAction icon="bookmark" label="Archiver la conversation" />
          </div>

          <div
            style={{
              marginTop: 24,
              padding: 14,
              background: 'var(--cream-100)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              color: 'var(--charcoal-600)',
              lineHeight: 1.55,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--charcoal-700)',
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              <Icon name="shield" size={13} color="var(--charcoal-700)" /> Litige ou problème&nbsp;?
            </div>
            Contactez notre équipe Tukio dans les 48h après l'événement.
            <a
              href="#"
              style={{
                display: 'block',
                marginTop: 6,
                color: 'var(--brand-700)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Ouvrir un litige →
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────

function FilterChip({ label, count, active }) {
  return (
    <button
      style={{
        padding: '5px 10px',
        fontSize: 12,
        fontWeight: 500,
        border: '1px solid',
        borderColor: active ? 'var(--charcoal-800)' : 'var(--cream-300)',
        background: active ? 'var(--charcoal-800)' : 'var(--cream-50)',
        color: active ? 'var(--cream-50)' : 'var(--charcoal-600)',
        borderRadius: 999,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          opacity: 0.7,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function ConvItem({ name, snippet, time, unread, active, service, muted }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 12px',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--brand-50)' : 'transparent',
        cursor: 'pointer',
        borderLeft: active ? '3px solid var(--brand-500)' : '3px solid transparent',
        marginBottom: 2,
        opacity: muted ? 0.7 : 1,
      }}
    >
      <Avatar name={name} size={40} tone={active ? 'brand' : 'cream'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: unread ? 700 : 600,
              color: 'var(--charcoal-800)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--charcoal-500)',
              flexShrink: 0,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {time}
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            color: unread ? 'var(--charcoal-700)' : 'var(--charcoal-500)',
            fontWeight: unread ? 500 : 400,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {snippet}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 6,
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: 'var(--charcoal-500)',
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {service}
          </span>
          {unread && (
            <span
              style={{
                minWidth: 18,
                height: 18,
                padding: '0 6px',
                borderRadius: 999,
                background: 'var(--brand-500)',
                color: 'var(--cream-50)',
                fontSize: 10,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {unread}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SystemDivider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 24px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--cream-300)' }} />
      <span
        style={{
          fontSize: 11,
          color: 'var(--charcoal-500)',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--cream-300)' }} />
    </div>
  );
}

function DateLabel({ children }) {
  return (
    <div style={{ textAlign: 'center', margin: '16px 0 12px' }}>
      <span
        style={{
          fontSize: 11,
          color: 'var(--charcoal-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          padding: '4px 10px',
          background: 'var(--cream-200)',
          borderRadius: 999,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function Bubble({ from, time, name, children, attached }) {
  const isMe = from === 'me';
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        flexDirection: isMe ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        marginBottom: 10,
        maxWidth: '100%',
      }}
    >
      {!isMe && <Avatar name={name || '?'} size={28} tone="brand" />}
      <div style={{ maxWidth: '70%' }}>
        <div
          style={{
            padding: '11px 15px',
            background: isMe ? 'var(--charcoal-800)' : 'var(--cream-50)',
            color: isMe ? 'var(--cream-50)' : 'var(--charcoal-800)',
            border: isMe ? 'none' : '1px solid var(--cream-200)',
            borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            fontSize: 14,
            lineHeight: 1.55,
          }}
        >
          {children}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--charcoal-500)',
            marginTop: 4,
            fontFamily: 'var(--font-mono)',
            textAlign: isMe ? 'right' : 'left',
            paddingLeft: isMe ? 0 : 4,
            paddingRight: isMe ? 4 : 0,
            display: 'flex',
            gap: 6,
            justifyContent: isMe ? 'flex-end' : 'flex-start',
            alignItems: 'center',
          }}
        >
          {time}
          {isMe && <Icon name="check" size={11} color="var(--charcoal-500)" strokeWidth={2.5} />}
        </div>
      </div>
    </div>
  );
}

function FileAttachment({ name, size }) {
  return (
    <div
      style={{
        marginTop: 10,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: '10px 12px',
        background: 'var(--cream-100)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: 'var(--brand-100)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="doc" size={16} color="var(--brand-700)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--charcoal-800)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--charcoal-500)', fontFamily: 'var(--font-mono)' }}>
          {size}
        </div>
      </div>
      <Icon
        name="upload"
        size={14}
        color="var(--charcoal-500)"
        style={{ transform: 'rotate(180deg)' }}
      />
    </div>
  );
}

function QuickReply({ label }) {
  return (
    <button
      style={{
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--charcoal-700)',
        background: 'var(--cream-50)',
        border: '1px solid var(--cream-300)',
        borderRadius: 999,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function Dot({ delay }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--charcoal-400)',
        display: 'inline-block',
        animation: `tk-typing 1.4s ${delay}s infinite`,
      }}
    />
  );
}

function Step({ label, sub, upcoming, highlight, last }) {
  const dotColor = highlight ? 'var(--brand-500)' : 'var(--cream-300)';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 1fr',
        gap: 10,
        paddingBottom: last ? 0 : 14,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: dotColor,
            border: highlight ? '2px solid var(--brand-100)' : 'none',
            boxShadow: highlight ? '0 0 0 4px rgba(217, 119, 87, 0.15)' : 'none',
            marginTop: 4,
          }}
        />
        {!last && (
          <div style={{ flex: 1, width: 1, background: 'var(--cream-300)', marginTop: 4 }} />
        )}
      </div>
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: highlight ? 600 : 500,
            color: highlight ? 'var(--brand-700)' : 'var(--charcoal-700)',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--charcoal-500)',
            marginTop: 2,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

function SidebarAction({ icon, label }) {
  return (
    <button
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 12px',
        background: 'var(--cream-50)',
        border: '1px solid var(--cream-200)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontSize: 13,
        color: 'var(--charcoal-700)',
        fontWeight: 500,
        textAlign: 'left',
      }}
    >
      <Icon name={icon} size={14} color="var(--charcoal-500)" />
      <span style={{ flex: 1 }}>{label}</span>
      <Icon name="arrow" size={12} color="var(--charcoal-400)" />
    </button>
  );
}

window.MessagesScreen = MessagesScreen;
