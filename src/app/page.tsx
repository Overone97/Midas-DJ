import Link from 'next/link';
import { AppShell } from '@/components/app-shell';

const pillars = [
  'Auth Supabase prête à brancher',
  'Rooms publiques/privées avec lobby crédible',
  'Queue, votes, chat et modération déjà modélisés',
  'Build statique conservé pour GitHub Pages',
];

export default function HomePage() {
  return (
    <AppShell
      eyebrow="Social listening, rebuilt"
      title="Midas DJ"
      description="Le projet passe de landing page à vrai squelette d’app : auth, lobby rooms, data model Supabase et base produit prête pour la room live."
      actions={
        <>
          <Link href="/rooms" className="rounded-full bg-gold px-5 py-3 font-semibold text-night transition hover:opacity-90">
            Ouvrir le lobby
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white/85 transition hover:bg-white/5"
          >
            Réserver mon pseudo
          </Link>
        </>
      }
    >
      <section className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-2xl shadow-black/15">
          <div className="inline-flex w-fit items-center rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-sm text-gold">
            Midas DJ · v1.1.0
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl font-black tracking-tight md:text-6xl">Une base d’app élégante, prête pour le vrai temps réel.</h2>
            <p className="max-w-2xl text-lg text-white/75 md:text-xl">
              Auth preview, découverte de rooms, schéma SQL initial et helpers Supabase : tout est posé sans casser l’export statique.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-gold px-5 py-3 font-semibold text-night transition hover:opacity-90">
              Tester le login
            </Link>
            <Link
              href="/docs"
              className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white/85 transition hover:bg-white/5"
            >
              Parcourir les docs
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6 shadow-2xl shadow-black/20 backdrop-blur">
          <p className="mb-4 text-sm uppercase tracking-[0.2em] text-gold/70">Piliers v1.1.0</p>
          <ul className="space-y-3 text-white/80">
            {pillars.map((pillar) => (
              <li key={pillar} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                {pillar}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </AppShell>
  );
}
