const pillars = [
  'Écoute sociale en temps réel',
  'Rooms publiques et privées',
  'File DJ collaborative et votes',
  'Expérience web moderne inspirée de plug.dj',
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-16 md:px-10">
      <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-gold">
        Midas DJ · v1.0.0
      </div>

      <section className="grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-center">
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.25em] text-gold/80">Social listening, rebuilt</p>
            <h1 className="text-5xl font-black tracking-tight md:text-7xl">Midas DJ</h1>
            <p className="max-w-2xl text-lg text-white/75 md:text-xl">
              Le successeur moderne de plug.dj : une room, un DJ actif, une queue communautaire, du chat live et une synchro solide.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              className="rounded-full bg-gold px-5 py-3 font-semibold text-night transition hover:opacity-90"
              href="/docs"
            >
              Explorer la vision produit
            </a>
            <a
              className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white/85 transition hover:bg-white/5"
              href="/docs"
            >
              Voir la roadmap
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
          <p className="mb-4 text-sm uppercase tracking-[0.2em] text-gold/70">Piliers MVP</p>
          <ul className="space-y-3 text-white/80">
            {pillars.map((pillar) => (
              <li key={pillar} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                {pillar}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
