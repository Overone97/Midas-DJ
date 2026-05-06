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
    <section className="space-y-5">
      <div className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,13,26,0.96),rgba(8,8,12,0.98))] px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-white/46">
              <span>Midas DJ</span>
              <span>•</span>
              <span>{state.room.slug}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-black text-white">{state.room.name}</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70">{state.room.type}</span>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${roleAccent[state.currentUser.role]}`}>{roleLabels[state.currentUser.role]}</span>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-white/64">{state.room.description}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-4 xl:min-w-[34rem]">
            <div className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Accès</p>
              <p className="mt-1 text-sm font-black text-white">{missing ? 'Introuvable' : denied ? 'Refusé' : preview ? 'Preview' : 'Disponible'}</p>
            </div>
            <div className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Audience</p>
              <p className="mt-1 text-sm font-black text-white">{typeof state.room.listenerCount === 'number' ? state.room.listenerCount : onlineMembers}</p>
            </div>
            <div className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Queue</p>
              <p className="mt-1 text-sm font-black text-white">{typeof state.room.queueDepth === 'number' ? state.room.queueDepth : queueItems.length}</p>
            </div>
            <div className="rounded-[1rem] border border-emerald-400/15 bg-emerald-400/10 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-100/60">Présence</p>
              <p className="mt-1 text-sm font-black text-emerald-50">{state.presence?.enabled ? state.presence.connected ? `${state.presence.onlineCount} live` : 'connexion…' : `${onlineMembers} visibles`}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_330px] xl:items-start">
        <aside className="space-y-4 xl:sticky xl:top-5">
          <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(13,13,18,0.98),rgba(6,6,9,0.98))] shadow-[0_16px_45px_rgba(0,0,0,0.28)]">
            <div className="border-b border-white/8 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.28em] text-fuchsia-200/70">Sidebar</p>
              <h3 className="mt-1 text-lg font-black text-white">Room info</h3>
            </div>

            <div className="space-y-3 p-4 text-sm">
              <div className="rounded-[1rem] border border-white/8 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Booth owner</p>
                <p className="mt-1 truncate font-semibold text-white">{state.room.ownerLabel}</p>
              </div>

              <div className="rounded-[1rem] border border-white/8 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Room status</p>
                  {state.playback ? <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-gold">{state.playback.state}</span> : null}
                </div>
                <div className="mt-3 space-y-2 text-white/72">
                  <div className="flex items-center justify-between gap-3"><span>Type</span><span className="font-semibold text-white">{isPrivate ? 'Privée' : 'Publique'}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>Queue</span><span className="font-semibold text-white">{queueItems.length}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>En ligne</span><span className="font-semibold text-white">{state.presence?.enabled ? state.presence.connected ? state.presence.onlineCount : onlineMembers : onlineMembers}</span></div>
                </div>
              </div>

              <div className="rounded-[1rem] border border-white/8 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Audience</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-white/55">{state.members.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {state.members.length > 0 ? (
                    state.members.slice(0, 8).map((member) => (
                      <div key={member.id} className="flex items-center justify-between gap-3 rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${member.online ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]' : 'bg-white/20'}`} />
                          <span className="truncate text-white/86">{member.label}</span>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[10px] ${roleAccent[member.role]}`}>{roleLabels[member.role]}</span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/5 px-3 py-4 text-white/60">Aucun roster exploitable.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4 text-sm text-white/72">
            <p className="text-[10px] uppercase tracking-[0.24em] text-fuchsia-200/72">Actions</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/rooms" className="rounded-full bg-gold px-4 py-2.5 text-center font-semibold text-night">Retour au lobby</Link>
              {!state.currentUser.isLoggedIn ? <Link href="/login" className="rounded-full border border-white/15 px-4 py-2.5 text-center font-semibold text-white/85">Se connecter</Link> : null}
              {denied ? <Link href="/rooms" className="rounded-full border border-white/15 px-4 py-2.5 text-center font-semibold text-white/85">Demander un autre accès</Link> : null}
              {missing ? <Link href="/rooms" className="rounded-full border border-white/15 px-4 py-2.5 text-center font-semibold text-white/85">Explorer les rooms visibles</Link> : null}
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          <div className="rounded-[1.8rem] border border-fuchsia-400/12 bg-[linear-gradient(180deg,rgba(12,10,18,0.96),rgba(7,6,11,0.95))] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-fuchsia-200/72">Main stage</p>
                <h3 className="mt-1 text-2xl font-black text-white">Scène synchronisée</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/65">{currentTrack ? currentTrack.status : 'placeholder'}</span>
            </div>

            {currentTrack ? (
              <SyncScenePlayer
                track={currentTrack}
                playback={state.playback}
                canControl={playerControls?.canControl ?? false}
                members={state.members}
                ownerLabel={state.room.ownerLabel}
                onTogglePlayback={playerControls?.onTogglePlayback ?? (() => undefined)}
                onNextTrack={playerControls?.onNextTrack ?? (() => undefined)}
              />
            ) : (
              <div className="rounded-[1.6rem] border border-dashed border-gold/20 bg-black/30 p-6 text-white/68">
                Aucun titre dans la queue pour l’instant. Ajoute un lien YouTube et on arrête enfin de regarder du vide.
              </div>
            )}
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,11,18,0.98),rgba(9,9,12,0.96))] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/72">Queue</p>
            <h3 className="mt-3 text-2xl font-black text-white">File collaborative</h3>
            <p className="mt-3 text-white/72">{queueItems.length > 0 ? `${queueItems.length} titre${queueItems.length > 1 ? 's' : ''} visible${queueItems.length > 1 ? 's' : ''} dans la file.` : 'La queue est vide. Ça se corrige vite.'}</p>
            <div className="mt-5 space-y-3">
              {queueItems.length > 0 ? (
                queueItems.map((item) => (
                  <div key={item.id} className="flex gap-3 rounded-[1.5rem] border border-white/10 bg-black/30 p-3">
                    {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="Miniature YouTube" className="h-16 w-28 rounded-xl object-cover" /> : <div className="flex h-16 w-28 items-center justify-center rounded-xl bg-white/5 text-xs text-white/40">no thumb</div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">#{item.position}</span>
                        <span className="rounded-full border border-gold/15 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-gold/85">{item.status}</span>
                      </div>
                      <p className="mt-2 truncate font-semibold text-white/88">{item.title}</p>
                      <p className="mt-1 text-xs text-white/55">Ajouté par {item.addedByLabel} · {formatDuration(item.durationSeconds)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/30 p-5 text-white/60">Toujours rien. La room est prête à encaisser son premier lien.</div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,11,18,0.98),rgba(9,9,12,0.96))] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/72">Ajouter un titre</p>
            <h3 className="mt-3 text-2xl font-black text-white">Drop YouTube dans la file</h3>
            {queueComposer ? (
              <>
                <p className="mt-3 text-white/72">Colle un lien YouTube propre. Le titre est optionnel, sinon on garde une version basée sur l’identifiant vidéo.</p>
                <div className="mt-5 space-y-3">
                  <input type="text" value={queueComposer.url} onChange={(event) => queueComposer.onUrlChange(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40" />
                  <input type="text" value={queueComposer.title} onChange={(event) => queueComposer.onTitleChange(event.target.value)} placeholder="Titre custom optionnel" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40" />
                  {queueComposer.feedback ? <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackStyles[queueComposer.feedback.tone]}`}>{queueComposer.feedback.text}</div> : null}
                </div>
                <button type="button" onClick={queueComposer.onSubmit} disabled={queueComposer.submitting} className="mt-5 rounded-full bg-gold px-5 py-3 font-semibold text-night transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                  {queueComposer.submitting ? 'Ajout…' : 'Ajouter à la queue'}
                </button>
              </>
            ) : (
              <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-black/30 p-5 text-white/68">
                {preview ? 'Preview statique : la room montre la queue, mais elle ne persiste rien.' : !state.currentUser.isLoggedIn ? 'Connecte-toi pour empiler de vrais titres.' : 'Le formulaire live n’est pas branché ici.'}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(8,14,20,0.96),rgba(8,10,16,0.94))] p-5 xl:sticky xl:top-5">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/72">Chat live</p>
          <h3 className="mt-2 text-xl font-black text-white">Le dancefloor parle</h3>
          <p className="mt-3 text-white/72">Petit chat temps réel pour réagir au set sans quitter la room.</p>
          <div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto rounded-[1.3rem] border border-white/10 bg-black/30 p-3">
            {chatMessages.length > 0 ? (
              chatMessages.slice(-12).map((message) => (
                <div key={message.id} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white/88">{message.authorLabel}</p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">{new Date(message.createdAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/72">{message.content}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-white/60">Pas encore de messages. Quelqu’un doit bien casser la glace.</div>
            )}
          </div>
          {chatComposer && state.currentUser.isLoggedIn ? (
            <>
              <div className="mt-4 space-y-3">
                <textarea value={chatComposer.value} onChange={(event) => chatComposer.onChange(event.target.value)} placeholder="Balance une réaction sur le morceau, un lien, une vanne, un skip bien senti…" rows={4} className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40" />
                {chatComposer.feedback ? <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackStyles[chatComposer.feedback.tone]}`}>{chatComposer.feedback.text}</div> : null}
              </div>
              <button type="button" onClick={chatComposer.onSubmit} disabled={chatComposer.submitting} className="mt-4 rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60">
                {chatComposer.submitting ? 'Envoi…' : 'Envoyer dans la room'}
              </button>
            </>
          ) : (
            <div className="mt-4 rounded-[1.5rem] border border-dashed border-white/10 bg-black/30 p-5 text-white/68">
              {preview ? 'Preview statique : le chat n’est pas branché hors backend.' : !state.currentUser.isLoggedIn ? 'Connecte-toi pour chatter avec la room.' : 'Le chat live attend son formulaire.'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
