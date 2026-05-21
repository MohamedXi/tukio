// Placeholder Story 0.15 enriched with Story 0.16 atoms (Kicker + Pill + SiteHeader).
// Final design + form delivered in Story 0.17 — this version is a smoke test
// to validate the @tukio/ui subpath imports work end-to-end.
import type { Metadata } from 'next';
import { Kicker } from '@tukio/ui/components/Kicker';
import { Pill } from '@tukio/ui/components/Pill';
import { SiteHeader } from '@tukio/ui/patterns/SiteHeader';

export default function ComingSoonPlaceholderPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <SiteHeader
        rightSlot={
          <span className="text-xs font-mono uppercase tracking-wider text-charcoal-500">
            Bientôt en Pays de la Loire
          </span>
        }
      />
      <main className="px-10 py-16 max-w-4xl mx-auto max-md:px-4">
        <Pill pulseDot>En construction</Pill>
        <Kicker className="mt-6 block">Rester informé·e</Kicker>
        <h1 className="font-display font-normal text-[52px] leading-[1.05] tracking-[-0.025em] text-charcoal-800 mt-3.5 max-md:text-[40px]">
          tukio.one — Bientôt en Pays de la Loire
        </h1>
        <p className="mt-4 text-[17px] leading-[1.6] text-charcoal-600 max-w-[640px]">
          Placeholder pre-launch landing. Story 0.17 livrera le design final (form 5 fields RHF +
          success state ICU position).
        </p>
      </main>
    </div>
  );
}

export const metadata: Metadata = {
  title: 'tukio.one — Bientôt en Pays de la Loire',
  // Story 0.21 will flip to index:true once final content + OG image ship.
  robots: { index: false, follow: false },
};
