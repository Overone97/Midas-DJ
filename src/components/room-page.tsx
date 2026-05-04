import Link from 'next/link';
import type { RoomPageState, RoomRole } from '@/lib/rooms';

const roleLabels: Record<RoomRole, string> = {
  owner: 'Owner',
  mod: 'Mod',
  member: 'Member',
  visitor: 'Visiteur',
};

const roleAccent: Record<RoomRole, string> = {
  owner: 'border-gold/30 bg-gold/10 text-gold',
  mod: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  member: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-50',
  visitor: 'border-white/10 bg-white/5 text-white/75',
};

export function RoomPageView({ state }: { state: RoomPageState }) {
  const isPrivate = state.room.type === 'private';
  const denied = state.status === 'forbidden';
  const missing = state.status === 'missing';
  const preview = state.status === 'preview';

  return (
    <section className="space-y-8">
      <div className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-gold/75">Room live</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-bold">{state.room.name}</h2>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/70">
              {state.room.type}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${roleAccent[state.currentUser.role]}`}>
              {roleLabels[state.currentUser.role]}
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-white/72">{state.room.description}</p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/60">
            <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">slug · {state.room.slug}</span>
            <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">owner · {state.room.ownerLabel}</span>
            {typeof state.room.listenerCount === 'number' ? (
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">audience · {state.room.listenerCount}</span>
            ) : null}
            {typeof state.room.queueDepth === 'number' ? (
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">queue · {state.room.queueDepth} titres</span>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-gold/20 bg-gold/10 p-5 text-sm text-white/80">
          <p className="text-white/55">État d’accès</p>
          <p className="mt-2 text-2xl font-black text-white">
            {missing ? 'Introuvable' : denied ? 'Refusé' : preview ? 'Preview statique' : 'Disponible'}
          </p>
          <p className="mt-3 leading-6 text-white/72">
            {missing
              ? 'Ce slug ne correspond à aucune room connue.'
              : denied
                ? 'Cette room privée existe, mais le membre courant n’a pas le droit d’y entrer.'
                : preview
                  ? 'Fallback GitHub Pages actif : UI crédible, sans backend ni session réelle.'
                  : state.currentUser.isLoggedIn
                    ? `Connecté en ${state.currentUser.email}`
                    : 'Aucune session détectée côté serveur.'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Membres</p>
            <h3 className="mt-3 text-2xl font-bold">Qui est déjà dans la room</h3>
            <div className="mt-5 space-y-3">
              {state.members.length > 0 ? (
                state.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="font-medium text-white/88">{member.label}</span>
                    <span className={`rounded-full border px-3 py-1 text-xs ${roleAccent[member.role]}`}>{roleLabels[member.role]}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-white/60">
                  Aucun roster exploitable pour l’instant. On garde un fallback propre jusqu’à brancher la présence live.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-white/72">
            <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Actions</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/rooms" className="rounded-full bg-gold px-4 py-2 font-semibold text-night">
                Retour au lobby
              </Link>
              {!state.currentUser.isLoggedIn ? (
                <Link href="/login" className="rounded-full border border-white/15 px-4 py-2 font-semibold text-white/85">
                  Se connecter
                </Link>
              ) : null}
              {denied ? (
                <Link href="/rooms" className="rounded-full border border-white/15 px-4 py-2 font-semibold text-white/85">
                  Demander un autre accès
                </Link>
              ) : null}
              {missing ? (
                <Link href="/rooms" className="rounded-full border border-white/15 px-4 py-2 font-semibold text-white/85">
                  Explorer les rooms visibles
                </Link>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="grid gap-5">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Player</p>
                <h3 className="mt-3 text-2xl font-bold">Deck principal</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/65">Premium placeholder</span>
            </div>
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-gold/20 bg-black/30 p-5 text-white/68">
              Bloc prévu pour la lecture synchronisée YouTube, les états realtime et les contrôles DJ. La room existe déjà visuellement sans promettre le moteur final.
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Queue</p>
              <h3 className="mt-3 text-2xl font-bold">File collaborative</h3>
              <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-black/30 p-5 text-white/68">
                Placeholder premium pour les prochains titres, votes et rotation DJ. {state.room.vibe ? `Vibe actuelle : ${state.room.vibe}.` : 'Le ton de la room se branchera ici.'}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Chat</p>
              <h3 className="mt-3 text-2xl font-bold">Canal room</h3>
              <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-black/30 p-5 text-white/68">
                Placeholder premium pour le chat live, les événements système et la modération. {isPrivate ? 'Accès réservé au cercle invité.' : 'Conversation ouverte à la room publique.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
