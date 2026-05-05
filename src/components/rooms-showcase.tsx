'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LiveRoomPage } from '@/components/live-room-page';
import { APP_RELEASE_LABEL } from '@/lib/app-version';
import { featuredRooms, getPreviewRoomState, slugifyRoom, type FeaturedRoom, type LiveRoom, type RoomType } from '@/lib/rooms';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type Feedback = {
  tone: 'neutral' | 'success' | 'error';
  text: string;
};

const feedbackStyles: Record<Feedback['tone'], string> = {
  neutral: 'border-white/10 bg-white/5 text-white/72',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-50',
};

function buildRoomHref(slug: string) {
  return `/rooms?slug=${encodeURIComponent(slug)}`;
}

export function RoomsShowcase({ envReady }: { envReady: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomSlugParam = slugifyRoom(searchParams.get('slug') ?? '');
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [liveRooms, setLiveRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(envReady);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomSlug, setRoomSlug] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('public');
  const [roomDescription, setRoomDescription] = useState('');
  const [privateSlug, setPrivateSlug] = useState('');
  const [feedback, setFeedback] = useState<Feedback>({
    tone: envReady ? 'neutral' : 'error',
    text: envReady
      ? 'Mode live disponible. Connecte-toi pour créer ou rejoindre de vraies rooms Supabase.'
      : 'Variables Supabase absentes : le lobby reste en démonstration, sans vraie auth ni persistance.',
  });

  const publicRoomsCount = useMemo(() => liveRooms.filter((room) => room.type === 'public').length, [liveRooms]);
  const privateRoomsCount = useMemo(() => liveRooms.filter((room) => room.type === 'private').length, [liveRooms]);

  useEffect(() => {
    if (!envReady) {
      setLiveRooms([]);
      setLoading(false);
      return;
    }

    let ignore = false;

    async function hydrate() {
      const supabase = getSupabaseBrowserClient();

      if (!supabase) {
        if (!ignore) {
          setLoading(false);
          setFeedback({ tone: 'error', text: 'Client Supabase indisponible. Vérifie la config publique.' });
        }
        return;
      }

      const [{ data: authData, error: authError }, { data: roomsData, error: roomsError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('rooms').select('id, name, slug, type, description, owner_id').eq('type', 'public').order('created_at', { ascending: false }).limit(12),
      ]);

      if (ignore) {
        return;
      }

      if (authError) {
        setFeedback({ tone: 'error', text: authError.message });
      } else {
        setSessionUser(authData.user ?? null);
      }

      if (roomsError) {
        setFeedback({ tone: 'error', text: roomsError.message });
      } else {
        setLiveRooms((roomsData as LiveRoom[]) ?? []);
      }

      setLoading(false);
    }

    void hydrate();

    return () => {
      ignore = true;
    };
  }, [envReady]);

  async function refreshRooms() {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, slug, type, description, owner_id')
      .eq('type', 'public')
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) {
      setFeedback({ tone: 'error', text: error.message });
      return;
    }

    setLiveRooms((data as LiveRoom[]) ?? []);
  }

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSessionUser(null);
    setFeedback({ tone: 'success', text: 'Session fermée. Le lobby reste visible, mais les actions live sont verrouillées.' });
  }

  async function handleCreateRoom() {
    if (!envReady) {
      setFeedback({ tone: 'error', text: 'Impossible de créer une room sans variables Supabase actives.' });
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setFeedback({ tone: 'error', text: 'Client Supabase indisponible.' });
      return;
    }

    if (!sessionUser) {
      setFeedback({ tone: 'error', text: 'Connecte-toi d’abord. Une room sans owner, c’est du sabotage.' });
      return;
    }

    const normalizedName = roomName.trim();
    const normalizedSlug = slugifyRoom(roomSlug || roomName);

    if (!normalizedName || !normalizedSlug) {
      setFeedback({ tone: 'error', text: 'Donne au moins un nom crédible à la room.' });
      return;
    }

    setCreating(true);
    setFeedback({ tone: 'neutral', text: 'Création de la room…' });

    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          name: normalizedName,
          slug: normalizedSlug,
          type: roomType,
          description: roomDescription.trim() || null,
          owner_id: sessionUser.id,
        })
        .select('id, name, slug, type, description, owner_id')
        .single();

      if (roomError) {
        throw roomError;
      }

      const { error: memberError } = await supabase.from('room_members').upsert({
        room_id: room.id,
        user_id: sessionUser.id,
        role: 'owner',
      });

      if (memberError) {
        throw memberError;
      }

      setRoomName('');
      setRoomSlug('');
      setRoomDescription('');
      setRoomType('public');
      await refreshRooms();
      router.push(buildRoomHref(room.slug));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'La room a refusé de naître.';
      setFeedback({ tone: 'error', text: message });
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinPrivateRoom() {
    if (!envReady) {
      setFeedback({ tone: 'error', text: 'Impossible de rejoindre une room live sans config Supabase.' });
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setFeedback({ tone: 'error', text: 'Client Supabase indisponible.' });
      return;
    }

    if (!sessionUser) {
      setFeedback({ tone: 'error', text: 'Connecte-toi d’abord pour rejoindre une room privée.' });
      return;
    }

    const normalizedSlug = slugifyRoom(privateSlug);

    if (!normalizedSlug) {
      setFeedback({ tone: 'error', text: 'Entre un slug ou un code de room valide.' });
      return;
    }

    setJoining(true);
    setFeedback({ tone: 'neutral', text: 'Recherche de la room…' });

    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id, name, slug, type')
        .eq('slug', normalizedSlug)
        .single();

      if (roomError) {
        throw roomError;
      }

      const { error: memberError } = await supabase.from('room_members').upsert({
        room_id: room.id,
        user_id: sessionUser.id,
        role: 'member',
      });

      if (memberError) {
        throw memberError;
      }

      setPrivateSlug('');
      router.push(buildRoomHref(room.slug));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de rejoindre cette room.';
      setFeedback({ tone: 'error', text: message });
    } finally {
      setJoining(false);
    }
  }

  if (roomSlugParam) {
    return <LiveRoomPage initialState={getPreviewRoomState(roomSlugParam)} />;
  }

  return (
    <section className="space-y-8">
      <div className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-gold/75">Lobby live</p>
          <h2 className="mt-3 text-3xl font-bold">Des rooms visibles, un vrai signup/login, et une navigation room enfin réelle.</h2>
          <p className="mt-3 max-w-2xl text-white/72">
            {`La ${APP_RELEASE_LABEL} garde une vraie room jouable, mais passe maintenant par /rooms?slug=... pour éviter le 404 GitHub Pages sur les slugs dynamiques.`}
          </p>
        </div>

        <div className="grid gap-3 rounded-3xl border border-gold/20 bg-gold/10 p-5 text-sm text-white/80">
          <div>
            <p className="text-white/55">Rooms publiques live</p>
            <p className="mt-1 text-3xl font-black text-white">{envReady ? (loading ? '…' : publicRoomsCount) : '—'}</p>
          </div>
          <div>
            <p className="text-white/55">Rooms privées connues</p>
            <p className="mt-1 text-3xl font-black text-white">{envReady ? privateRoomsCount : '—'}</p>
          </div>
          <div>
            <p className="text-white/55">Session active</p>
            <p className="mt-1 text-lg font-bold text-white">{sessionUser?.email ?? 'Aucune'}</p>
          </div>
        </div>
      </div>

      <div className={`rounded-[2rem] border px-4 py-4 text-sm leading-6 ${feedbackStyles[feedback.tone]}`}>
        {feedback.text}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-[2rem] border border-white/10 bg-black/20 p-5">
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/72">
          {envReady ? 'Supabase connecté côté build' : 'Supabase absent côté build'}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/72">
          {sessionUser ? `Connecté en ${sessionUser.email}` : 'Non connecté'}
        </span>
        {sessionUser ? (
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/5"
          >
            Se déconnecter
          </button>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {(liveRooms.length > 0 ? liveRooms : featuredRooms).map((room) => (
          <article key={room.slug} className="rounded-[2rem] border border-white/10 bg-black/20 p-6 shadow-2xl shadow-black/15">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-gold/80">
                  {room.type}
                </div>
                <h3 className="mt-4 text-2xl font-bold">{room.name}</h3>
              </div>
              {'listeners' in room ? (
                <div className="text-right text-sm text-white/60">
                  <p>{room.listeners} listeners</p>
                  <p>{room.queueDepth} titres en queue</p>
                </div>
              ) : (
                <div className="text-right text-sm text-white/60">
                  <p>Live room</p>
                  <p>slug · {room.slug}</p>
                </div>
              )}
            </div>

            <p className="mt-4 text-white/74">{room.description || 'Room live créée sur Supabase. La scène complète arrive ensuite.'}</p>

            {'dj' in room ? (
              <>
                <p className="mt-4 text-sm text-gold/85">DJ actif · {room.dj}</p>
                <p className="mt-2 text-sm text-white/62">{room.vibe}</p>
              </>
            ) : (
              <p className="mt-4 text-sm text-gold/85">Owner id · {room.owner_id.slice(0, 8)}…</p>
            )}

            {'tags' in room ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {room.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <Link href={buildRoomHref(room.slug)} className="rounded-full bg-gold px-4 py-2 font-semibold text-night">
                {'id' in room ? 'Ouvrir la room' : 'Voir la preview'}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setPrivateSlug(room.slug);
                  setFeedback({
                    tone: 'neutral',
                    text: `Slug "${room.slug}" placé dans le champ de join. Tu peux maintenant ouvrir ou rejoindre cette room pour de vrai.`,
                  });
                }}
                className="rounded-full border border-white/15 px-4 py-2 font-semibold text-white/80"
              >
                Préparer le join
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Créer une room</p>
          <h3 className="mt-3 text-2xl font-bold">Lancer un nouveau dancefloor pour de vrai</h3>
          <p className="mt-3 text-white/72">
            Quand Supabase est branché et que tu es connecté, cette carte crée une vraie ligne dans la table `rooms`, t’ajoute comme owner puis t’ouvre la room sans passer par une route cassée par GitHub Pages.
          </p>

          <div className="mt-5 space-y-3">
            <input
              type="text"
              value={roomName}
              onChange={(event) => {
                const value = event.target.value;
                setRoomName(value);
                setRoomSlug(slugifyRoom(value));
              }}
              placeholder="Nom de la room"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
            />
            <input
              type="text"
              value={roomSlug}
              onChange={(event) => setRoomSlug(slugifyRoom(event.target.value))}
              placeholder="slug-de-room"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
            />
            <textarea
              value={roomDescription}
              onChange={(event) => setRoomDescription(event.target.value)}
              placeholder="Décris l’ambiance de la room"
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRoomType('public')}
                className={`rounded-full px-4 py-2 font-semibold transition ${
                  roomType === 'public' ? 'bg-gold text-night' : 'border border-white/15 text-white/75'
                }`}
              >
                Publique
              </button>
              <button
                type="button"
                onClick={() => setRoomType('private')}
                className={`rounded-full px-4 py-2 font-semibold transition ${
                  roomType === 'private' ? 'bg-gold text-night' : 'border border-white/15 text-white/75'
                }`}
              >
                Privée
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleCreateRoom()}
            disabled={creating}
            className="mt-5 rounded-full bg-gold px-5 py-3 font-semibold text-night transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Création…' : 'Créer une room'}
          </button>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Rejoindre en privé</p>
          <h3 className="mt-3 text-2xl font-bold">Entrer avec un slug de room</h3>
          <p className="mt-3 text-white/72">
            Le flow cherche la room, t’inscrit dans `room_members`, puis t’ouvre la room via un slug en query string pour contourner la limite de GitHub Pages.
          </p>
          <div className="mt-5 flex gap-3">
            <input
              type="text"
              value={privateSlug}
              onChange={(event) => setPrivateSlug(event.target.value)}
              placeholder="velvet-booth"
              className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
            />
            <button
              type="button"
              onClick={() => void handleJoinPrivateRoom()}
              disabled={joining}
              className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joining ? 'Join…' : 'Rejoindre'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
