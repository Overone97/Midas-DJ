import { AppShell } from '@/components/app-shell';

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
  {
    title: 'Supabase notes',
    summary: 'Helpers client/server, variables d’environnement et schéma SQL de démarrage pour v1.1.0.',
  },
];

export default function DocsPage() {
  return (
    <AppShell
      eyebrow="Documentation fondatrice"
      title="Midas DJ v1.1.0"
      description="La base produit et technique reste documentée, mais cette release ajoute enfin un vrai squelette applicatif et le point d’entrée Supabase."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {docs.map((doc) => (
          <article key={doc.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-2xl font-bold">{doc.title}</h2>
            <p className="text-white/70">{doc.summary}</p>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
