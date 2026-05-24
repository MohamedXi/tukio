// Placeholder Story 0.15 — final design + success state delivered in Story 0.18.
import type { Metadata } from 'next';

export default function SellerComingSoonSuccessPlaceholderPage() {
  return (
    <main style={{ padding: 48, fontFamily: 'system-ui, sans-serif', maxWidth: 720 }}>
      <h1>Merci !</h1>
      <p>Placeholder success state. Story 0.18 will deliver the full design.</p>
    </main>
  );
}

export const metadata: Metadata = {
  title: 'seller.tukio.one · Merci',
  robots: { index: false, follow: false },
};
