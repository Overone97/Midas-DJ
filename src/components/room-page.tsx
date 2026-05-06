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
    <section className="space-y-4">
      <div className="overflow-hidden rounded-[1.6rem] border border-fuchsia-400/15 bg-[radial-gradient(circle_at_top,#fb71851c,transparent_26%),radial-gradient(circle_at_85%_15%,#22d3ee18,transparent_24%),linear-gradient(180deg,#170f23,#09070f)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-fuchsia-200/72">Plug floor</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-white">{state.room.name}</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70">{state.room.type}</span>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${roleAccent[state.currentUser.role]}`}>{roleLabels[state.currentUser.role]}</span>
            </div>
            <p className="mt-2 max-w-4xl text-sm text-white/66">{state.room.description}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[20rem]">
            <div className="rounded-[1rem] border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/72">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Accès</p>
              <p className="mt-1 text-sm font-black text-white">{missing ? 'Introuvable' : denied ? 'Refusé' : preview ? 'Preview statique' : 'Disponible'}</p>
            </div>
            <div className="rounded-[1rem] border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-50/90">
              <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-100/60">Présence</p>
              <p className="mt-1 text-sm font-black">{state.presence?.enabled ? state.presence.connected ? `${state.presence.onlineCount} en ligne` : 'connexion…' : `${onlineMembers} visibles`}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-white/62">
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">slug · {state.room.slug}</span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">owner · {state.room.ownerLabel}</span>
          {typeof state.room.listenerCount === 'number' ? <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">audience · {state.room.listenerCount}</span> : null}
          {typeof state.room.queueDepth === 'number' ? <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">queue · {state.room.queueDepth} titres</span> : null}
          {state.playback ? <span className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-gold">sync · {state.playback.state}</span> : null}
          {state.currentUser.isLoggedIn ? <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-cyan-50">session · {state.currentUser.email}</span> : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="rounded-[1.8rem] border border-fuchsia-400/12 bg-[linear-gradient(180deg,rgba(12,10,18,0.96),rgba(7,6,11,0.95))] p-3 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-fuchsia-200/72">Main stage</p>
              <h3 className="mt-1 text-xl font-black text-white">Scène synchronisée</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">{currentTrack ? currentTrack.status : 'placeholder'}</span>
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

        <div className="rounded-[1.8rem] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(8,14,20,0.96),rgba(8,10,16,0.94))] p-4 xl:sticky xl:top-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/72">Chat live</p>
          <h3 className="mt-1 text-lg font-black text-white">Le dancefloor parle</h3>
          <div className="mt-4 max-h-[46rem] space-y-2 overflow-y-auto rounded-[1.2rem] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(2,6,10,0.66),rgba(4,6,12,0.88))] p-3 shadow-[inset_0_0_30px_rgba(34,211,238,0.05)]">
            {chatMessages.length > 0 ? (
              chatMessages.slice(-18).map((message) => (
                <div key={message.id} className="rounded-[1.1rem] border-l-2 border-cyan-300/60 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(255,255,255,0.02))] px-3 py-2.5 shadow-[0_0_18px_rgba(34,211,238,0.08)]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-cyan-50/95">{message.authorLabel}</p>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/40">{new Date(message.createdAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-white/78">{message.content}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.1rem] border border-dashed border-cyan-300/15 bg-cyan-300/5 px-4 py-5 text-sm text-cyan-50/55">Pas encore de messages. Quelqu’un doit bien casser la glace.</div>
            )}
          </div>
          {chatComposer && state.currentUser.isLoggedIn ? (
            <>
              <div className="mt-4 space-y-3">
                <textarea value={chatComposer.value} onChange={(event) => chatComposer.onChange(event.target.value)} placeholder="Balance une réaction sur le morceau..." rows={3} className="w-full resize-none rounded-[1.2rem] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(0,0,0,0.28),rgba(34,211,238,0.05))] px-4 py-3 text-white outline-none shadow-[inset_0_0_20px_rgba(34,211,238,0.04)] focus:border-cyan-300/45" />
                {chatComposer.feedback?.tone === 'error' ? <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackStyles[chatComposer.feedback.tone]}`}>{chatComposer.feedback.text}</div> : null}
              </div>
              <button type="button" onClick={chatComposer.onSubmit} disabled={chatComposer.submitting} className="mt-4 w-full rounded-full border border-cyan-300/20 bg-cyan-300/8 px-5 py-3 font-semibold text-cyan-50 transition hover:bg-cyan-300/12 disabled:cursor-not-allowed disabled:opacity-60">
                {chatComposer.submitting ? 'Envoi…' : 'Envoyer dans la room'}
              </button>
            </>
          ) : (
            <div className="mt-4 rounded-[1.2rem] border border-dashed border-white/10 bg-black/30 p-4 text-white/68">
              {preview ? 'Preview statique : le chat n’est pas branché hors backend.' : !state.currentUser.isLoggedIn ? 'Connecte-toi pour chatter avec la room.' : 'Le chat live attend son formulaire.'}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(14,13,19,0.96),rgba(10,10,14,0.95))] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/72">Audience</p>
            <h3 className="mt-3 text-2xl font-black text-white">Dans la room</h3>
            <p className="mt-2 text-sm text-white/58">{state.presence?.enabled ? `${onlineMembers} présence${onlineMembers > 1 ? 's' : ''} live détectée${state.presence.connected ? 's' : ''}.` : 'Roster statique pour l’instant.'}</p>
            <div className="mt-5 space-y-3">
              {state.members.length > 0 ? (
                state.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${member.online ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]' : 'bg-white/20'}`} />
                      <span className="truncate font-medium text-white/88">{member.label}</span>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${roleAccent[member.role]}`}>{roleLabels[member.role]}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-white/60">Aucun roster exploitable pour l’instant.</div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 text-sm text-white/72">
            <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/72">Actions</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/rooms" className="rounded-full bg-gold px-4 py-2 font-semibold text-night">Retour au lobby</Link>
              {!state.currentUser.isLoggedIn ? <Link href="/login" className="rounded-full border border-white/15 px-4 py-2 font-semibold text-white/85">Se connecter</Link> : null}
              {denied ? <Link href="/rooms" className="rounded-full border border-white/15 px-4 py-2 font-semibold text-white/85">Demander un autre accès</Link> : null}
              {missing ? <Link href="/rooms" className="rounded-full border border-white/15 px-4 py-2 font-semibold text-white/85">Explorer les rooms visibles</Link> : null}
            </div>
          </div>
        </aside>

        <div className="space-y-5">
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

      </div>
    </section>
  );
}
