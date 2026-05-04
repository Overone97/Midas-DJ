'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { ensureProfile } from '@/lib/supabase/profile';

type AuthCardProps = {
  mode: 'login' | 'signup';
  envReady: boolean;
};

type Feedback = {
  tone: 'neutral' | 'success' | 'error';
  text: string;
};

const content = {
  login: {
    eyebrow: 'Auth live',
    title: 'Reprendre le contrôle de ta room',
    subtitle: 'Connecte-toi pour récupérer ta queue, tes rooms privées et ton historique de vote.',
    submit: 'Me connecter',
    loading: 'Connexion en cours…',
    altLabel: 'Pas encore de compte ?',
    altHref: '/signup',
    altCta: 'Créer mon accès',
  },
  signup: {
    eyebrow: 'Auth live',
    title: 'Créer ton identité Midas DJ',
    subtitle: 'Réserve ton pseudo, prépare tes rooms privées et invite ton crew avant le lancement complet.',
    submit: 'Créer mon compte',
    loading: 'Création du compte…',
    altLabel: 'Déjà membre ?',
    altHref: '/login',
    altCta: 'Me connecter',
  },
} as const;

const feedbackStyles: Record<Feedback['tone'], string> = {
  neutral: 'border-white/10 bg-white/5 text-white/72',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-50',
};

export function AuthCard({ mode, envReady }: AuthCardProps) {
  const current = content[mode];
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({
    tone: envReady ? 'neutral' : 'error',
    text: envReady
      ? 'Supabase est détecté. Tu peux brancher un vrai signup/login dès maintenant.'
      : 'Variables Supabase absentes : tant qu’elles ne sont pas configurées dans le build, le formulaire ne peut rien créer.',
  });

  const currentOrigin = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.location.origin;
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!envReady) {
      setFeedback({
        tone: 'error',
        text: 'Supabase n’est pas configuré dans cette build. Le visuel est prêt, mais l’auth réelle a besoin des variables publiques.',
      });
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setFeedback({ tone: 'error', text: 'Client Supabase indisponible. Vérifie la config publique.' });
      return;
    }

    setLoading(true);
    setFeedback({ tone: 'neutral', text: mode === 'login' ? 'Connexion…' : 'Création du compte…' });

    try {
      if (mode === 'signup') {
        const normalizedUsername = username.trim();

        if (!normalizedUsername) {
          setFeedback({ tone: 'error', text: 'Choisis un pseudo avant de créer ton compte.' });
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: normalizedUsername,
            },
            emailRedirectTo: currentOrigin || undefined,
          },
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          await ensureProfile(supabase, data.user);
        }

        setFeedback({
          tone: 'success',
          text: data.session
            ? 'Compte créé. Tu es connecté, on t’emmène vers le lobby.'
            : 'Compte créé. Si la confirmation email est active sur Supabase, valide ton inbox puis reconnecte-toi.',
        });

        if (data.session) {
          router.push('/rooms');
          router.refresh();
        }

        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      if (data.user) {
        await ensureProfile(supabase, data.user);
      }

      setFeedback({ tone: 'success', text: 'Connexion réussie. Direction le lobby.' });
      router.push('/rooms');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Une erreur inconnue a bloqué le flux.';
      setFeedback({ tone: 'error', text: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[2rem] border border-gold/20 bg-gradient-to-br from-gold/10 via-transparent to-fuchsia-500/10 p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-gold/80">{current.eyebrow}</p>
        <h2 className="mt-4 text-3xl font-bold">{current.title}</h2>
        <p className="mt-3 max-w-xl text-white/75">{current.subtitle}</p>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {[
            ['Queue persistante', 'Retrouve tes titres, tes rooms et tes futurs sets dès que tu reviens.'],
            ['Rooms privées', 'Crée ton cercle fermé puis distribue les accès sans bordel.'],
            ['Profil exploitable', 'Ton identité Supabase nourrit les rooms, la modération et la suite produit.'],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm text-white/65">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-white/75" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@midas.dj"
              required
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-gold/40"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === 'signup' ? 'Choisis un mot de passe solide' : '••••••••'}
              minLength={6}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-gold/40"
            />
          </div>

          {mode === 'signup' ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-white/75" htmlFor="username">
                Pseudo DJ
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="golden-selector"
                required
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-gold/40"
              />
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-gold px-5 py-3 font-semibold text-night transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? current.loading : current.submit}
          </button>
        </form>

        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${feedbackStyles[feedback.tone]}`}>
          {feedback.text}
        </div>

        <p className="mt-5 text-sm text-white/65">
          {current.altLabel}{' '}
          <Link href={current.altHref} className="font-semibold text-gold">
            {current.altCta}
          </Link>
        </p>
      </div>
    </section>
  );
}
