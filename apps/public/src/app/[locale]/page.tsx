export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream-50 flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-5xl text-charcoal-800">Tukio</h1>
      <p className="text-base text-charcoal-700 max-w-md text-center">
        La marketplace événementielle française. Sprint 0 placeholder — design system actif.
      </p>
      <button
        type="button"
        className="bg-brand-500 text-cream-50 px-6 py-3 rounded-md hover:bg-brand-400 transition-colors"
      >
        Coming soon
      </button>
    </main>
  );
}
