const docs = [
  {
    title: 'PRD v1',
    summary: 'Vision, scope MVP, personas, user stories et définition du succès produit.',
  },
  {
    title: 'Architecture',
    summary: 'Stack recommandée, stratégie temps réel, playback state et logique room-first.',
  },
  {
    title: 'Data model',
    summary: 'Tables de base pour users, rooms, queue, playback, votes, messages et modération.',
  },
  {
    title: 'Roadmap',
    summary: 'Découpage de la progression de v1.0.0 à v2.0.0.',
  },
];

export default function DocsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16 md:px-10">
      <div className="mb-10 space-y-3">
        <p className="text-sm uppercase tracking-[0.25em] text-gold/80">Documentation fondatrice</p>
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">Midas DJ v1.0.0</h1>
        <p className="max-w-3xl text-lg text-white/75">
          Cette première release pose le cadre produit et technique. Les documents détaillés vivent dans le dépôt GitHub.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {docs.map((doc) => (
          <article key={doc.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-2xl font-bold">{doc.title}</h2>
            <p className="text-white/70">{doc.summary}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
