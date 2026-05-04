import Link from 'next/link';

type AuthCardProps = {
  mode: 'login' | 'signup';
  envReady: boolean;
};

const content = {
  login: {
    title: 'Reprendre le contrôle de ta room',
    subtitle: 'Connecte-toi pour récupérer ta queue, tes rooms privées et ton historique de vote.',
    submit: 'Continuer',
    altLabel: 'Pas encore de compte ?',
    altHref: '/signup',
    altCta: 'Créer mon accès',
  },
  signup: {
    title: 'Créer ton identité Midas DJ',
    subtitle: 'Réserve ton pseudo, prépare tes rooms privées et invite ton crew avant le lancement complet.',
    submit: 'Créer mon compte',
    altLabel: 'Déjà membre ?',
    altHref: '/login',
    altCta: 'Me connecter',
  },
} as const;

export function AuthCard({ mode, envReady }: AuthCardProps) {
  const current = content[mode];

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[2rem] border border-gold/20 bg-gradient-to-br from-gold/10 via-transparent to-fuchsia-500/10 p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-gold/80">Auth preview</p>
        <h2 className="mt-4 text-3xl font-bold">{current.title}</h2>
        <p className="mt-3 max-w-xl text-white/75">{current.subtitle}</p>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {[
            ['Queue persistante', 'Retrouve tes titres et ton tour de passage.'],
            ['Invitations privées', 'Partage des rooms VIP sans casser l’ambiance.'],
            ['Modération simple', 'Mute, skip, ban et historique d’actions.'],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm text-white/65">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <form className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/75" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@midas.dj"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-gold/40"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75" htmlFor="password">
              {mode === 'signup' ? 'Mot de passe' : 'Mot de passe ou magic link bientôt'}
            </label>
            <input
              id="password"
              type="password"
              placeholder={mode === 'signup' ? 'Choisis un mot de passe solide' : '••••••••'}
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
                placeholder="golden-selector"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-gold/40"
              />
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-full bg-gold px-5 py-3 font-semibold text-night transition hover:opacity-90"
          >
            {current.submit}
          </button>
        </form>

        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 text-white/72 ${
            envReady ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-400/30 bg-amber-400/10'
          }`}
        >
          {envReady
            ? 'Variables Supabase détectées. Branche ensuite les server actions ou routes pour finaliser le flux réel.'
            : 'Variables Supabase absentes : les formulaires restent en mode preview pour préserver le build statique GitHub Pages.'}
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
