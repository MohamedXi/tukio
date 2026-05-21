// Placeholder Story 0.15 — final design + content delivered in Story 0.18.
import type { Metadata } from 'next';

export default function SellerComingSoonPlaceholderPage() {
  return (
    <main style={{ padding: 48, fontFamily: 'system-ui, sans-serif', maxWidth: 720 }}>
      <h1>seller.tukio.one — Bientôt</h1>
      <p>Placeholder pre-launch landing — Story 0.18 will deliver the full design.</p>
    </main>
  );
}

export const metadata: Metadata = {
  title: 'seller.tukio.one — Bientôt',
  // Story 0.21 will flip to index:true once final content + OG image ship.
  robots: { index: false, follow: false },
};
