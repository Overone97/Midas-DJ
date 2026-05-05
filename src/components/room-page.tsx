'use client';

import Link from 'next/link';
import { SyncScenePlayer } from '@/components/sync-scene-player';
import type { RoomPageState, RoomRole } from '@/lib/rooms';

type QueueComposerProps = {
  url: string;
  title: string;
  submitting: boolean;
  feedback?: {
    tone: 'neutral' | 'success' | 'error';
    text: string;
  } | null;
  onUrlChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onSubmit: () => void;
};

type PlayerControlsProps = {
  canControl: boolean;
  onTogglePlayback: (nextState: 'playing' | 'paused', currentOffset: number) => void;
  onNextTrack: () => void;
};

type ChatComposerProps = {
  value: string;
  submitting: boolean;
  feedback?: {
    tone: 'neutral' | 'success' | 'error';
    text: string;
  } | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

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

const feedbackStyles: Record<NonNullable<QueueComposerProps['feedback']>['tone'], string> = {
  neutral: 'border-white/10 bg-white/5 text-white/72',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-50',
};

function formatDuration(durationSeconds?: number) {
  if (!durationSeconds || durationSeconds <= 0) {
    return 'durée inconnue';
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function RoomPageView({
  state,
  queueComposer,
  playerControls,
  chatComposer,
}: {
  state: RoomPageState;
  queueComposer?: QueueComposerProps;
  playerControls?: PlayerControlsProps;
  chatComposer?: ChatComposerProps;
}) {
  const isPrivate = state.room.type === 'private';
  const denied = state.status === 'forbidden';
  const missing = state.status === 'missing';
  const preview = state.status === 'preview';
  const onlineMembers = state.members.filter((member) => member.online).length;
  const queueItems = state.queue?.items ?? [];
  const currentTrack = queueItems.find((item) => item.id === state.playback?.currentQueueItemId) ?? queueItems.find((item) => item.status === 'playing') ?? queueItems[0];
  const chatMessages = state.chat?.messages ?? [];

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
            {state.presence?.enabled ? (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-emerald-50">
                présence · {state.presence.connected ? `${state.presence.onlineCount} en ligne` : 'connexion…'}
              </span>
            ) : null}
            {typeof state.room.queueDepth === 'number' ? (
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">queue · {state.room.queueDepth} titres</span>
            ) : null}
            {state.playback ? (
              <span className="rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-gold">sync · {state.playback.state}</span>
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
                    ? `Connecté en ${state.currentUser.email}${state.presence?.enabled ? state.presence.connected ? ' · présence live active' : ' · présence live en attente' : ''}`
                    : 'Aucune session détectée côté serveur.'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Membres</p>
            <h3 className="mt-3 text-2xl font-bold">Qui est déjà dans la room</h3>
            <p className="mt-2 text-sm text-white/58">
              {state.presence?.enabled
                ? `${onlineMembers} présence${onlineMembers > 1 ? 's' : ''} live détectée${state.presence.connected ? 's' : ''}.`
                : 'Roster statique pour l’instant.'}
            </p>
            <div className="mt-5 space-y-3">
              {state.members.length > 0 ? (
                state.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${member.online ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]' : 'bg-white/20'}`} />
                      <span className="font-medium text-white/88">{member.label}</span>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${roleAccent[member.role]}`}>{roleLabels[member.role]}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-white/60">
                  Aucun roster exploitable pour l’instant. On garde un fallback propre jusqu’à brancher quelque chose de moins décoratif.
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
                <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Stage</p>
                <h3 className="mt-3 text-2xl font-bold">Scène synchronisée</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/65">
                {currentTrack ? currentTrack.status : 'placeholder'}
              </span>
            </div>

            {currentTrack ? (
              <div className="mt-5">
                <SyncScenePlayer
                  track={currentTrack}
                  playback={state.playback}
                  canControl={playerControls?.canControl ?? false}
                  members={state.members}
                  ownerLabel={state.room.ownerLabel}
                  onTogglePlayback={playerControls?.onTogglePlayback ?? (() => undefined)}
                  onNextTrack={playerControls?.onNextTrack ?? (() => undefined)}
                />
              </div>
            ) : (
              <div className="mt-5 rounded-[1.5rem] border border-dashed border-gold/20 bg-black/30 p-5 text-white/68">
                Aucun titre dans la queue pour l’instant. Ajoute un lien YouTube et on arrête enfin de regarder un placeholder vide.
              </div>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr_0.95fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Queue</p>
              <h3 className="mt-3 text-2xl font-bold">File collaborative</h3>
              <p className="mt-3 text-white/72">
                {queueItems.length > 0
                  ? `${queueItems.length} titre${queueItems.length > 1 ? 's' : ''} visible${queueItems.length > 1 ? 's' : ''} dans la file.`
                  : 'La queue est vide. Ça, on peut le corriger tout de suite.'}
              </p>

              <div className="mt-5 space-y-3">
                {queueItems.length > 0 ? (
                  queueItems.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-[1.5rem] border border-white/10 bg-black/30 p-3">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="Miniature YouTube" className="h-16 w-28 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-16 w-28 items-center justify-center rounded-xl bg-white/5 text-xs text-white/40">no thumb</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                            #{item.position}
                          </span>
                          <span className="rounded-full border border-gold/15 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-gold/85">
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-2 truncate font-semibold text-white/88">{item.title}</p>
                        <p className="mt-1 text-xs text-white/55">Ajouté par {item.addedByLabel} · {formatDuration(item.durationSeconds)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/30 p-5 text-white/60">
                    Toujours rien. La room est prête à encaisser son premier lien.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Ajouter un titre</p>
              <h3 className="mt-3 text-2xl font-bold">Drop YouTube dans la file</h3>

              {queueComposer ? (
                <>
                  <p className="mt-3 text-white/72">
                    Colle un lien YouTube propre. Le titre est optionnel, sinon on garde une version basée sur l’identifiant vidéo.
                  </p>
                  <div className="mt-5 space-y-3">
                    <input
                      type="text"
                      value={queueComposer.url}
                      onChange={(event) => queueComposer.onUrlChange(event.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
                    />
                    <input
                      type="text"
                      value={queueComposer.title}
                      onChange={(event) => queueComposer.onTitleChange(event.target.value)}
                      placeholder="Titre custom optionnel"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
                    />
                    {queueComposer.feedback ? (
                      <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackStyles[queueComposer.feedback.tone]}`}>
                        {queueComposer.feedback.text}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={queueComposer.onSubmit}
                    disabled={queueComposer.submitting}
                    className="mt-5 rounded-full bg-gold px-5 py-3 font-semibold text-night transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {queueComposer.submitting ? 'Ajout…' : 'Ajouter à la queue'}
                  </button>
                </>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-black/30 p-5 text-white/68">
                  {preview
                    ? 'Preview statique : la room montre la queue, mais elle ne persiste rien.'
                    : !state.currentUser.isLoggedIn
                      ? 'Connecte-toi pour empiler de vrais titres.'
                      : 'Le formulaire live n’est pas branché ici.'}
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Chat live</p>
              <h3 className="mt-3 text-2xl font-bold">Le dancefloor parle enfin</h3>
              <p className="mt-3 text-white/72">
                Petit chat temps réel pour réagir au set sans quitter la room. C’était la suite logique, franchement.
              </p>

              <div className="mt-5 space-y-3 rounded-[1.5rem] border border-white/10 bg-black/30 p-3">
                {chatMessages.length > 0 ? (
                  chatMessages.slice(-12).map((message) => (
                    <div key={message.id} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white/88">{message.authorLabel}</p>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                          {new Date(message.createdAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/72">{message.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-white/60">
                    Pas encore de messages. Quelqu’un doit bien casser la glace.
                  </div>
                )}
              </div>

              {chatComposer && state.currentUser.isLoggedIn ? (
                <>
                  <div className="mt-4 space-y-3">
                    <textarea
                      value={chatComposer.value}
                      onChange={(event) => chatComposer.onChange(event.target.value)}
                      placeholder="Balance une réaction sur le morceau, un lien, une vanne, un skip bien senti…"
                      rows={4}
                      className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
                    />
                    {chatComposer.feedback ? (
                      <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackStyles[chatComposer.feedback.tone]}`}>
                        {chatComposer.feedback.text}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={chatComposer.onSubmit}
                    disabled={chatComposer.submitting}
                    className="mt-4 rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {chatComposer.submitting ? 'Envoi…' : 'Envoyer dans la room'}
                  </button>
                </>
              ) : (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-white/10 bg-black/30 p-5 text-white/68">
                  {preview
                    ? 'Preview statique : le chat n’est pas branché hors backend.'
                    : !state.currentUser.isLoggedIn
                      ? 'Connecte-toi pour chatter avec la room.'
                      : 'Le chat live attend son formulaire.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
