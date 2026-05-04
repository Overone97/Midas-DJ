type Room = {
  name: string;
  slug: string;
  type: 'public' | 'private';
  listeners: number;
  queueDepth: number;
  dj: string;
  vibe: string;
  description: string;
  tags: string[];
};

const rooms: Room[] = [
  {
    name: 'Golden Hour',
    slug: 'golden-hour',
    type: 'public',
    listeners: 142,
    queueDepth: 18,
    dj: 'Ari Vega',
    vibe: 'Nu-disco, edits solaires, transitions velvet',
    description: 'La room signature pour les débuts de soirée qui montent proprement en intensité.',
    tags: ['Warmup', 'Disco', 'Community pick'],
  },
  {
    name: 'Night Shift FM',
    slug: 'night-shift-fm',
    type: 'public',
    listeners: 86,
    queueDepth: 11,
    dj: 'Kito Nova',
    vibe: 'UK garage, bassline et club cuts calibrés',
    description: 'Un flux plus nerveux pour les crews qui veulent skip le small talk et entrer direct dans le groove.',
    tags: ['UKG', 'Bass', 'Late set'],
  },
  {
    name: 'Velvet Booth',
    slug: 'velvet-booth',
    type: 'private',
    listeners: 12,
    queueDepth: 6,
    dj: 'Mina Lux',
    vibe: 'R&B futuriste et sélections after-hours',
    description: 'Room privée sur invitation, parfaite pour un cercle restreint et une modération stricte.',
    tags: ['Private', 'Invite-only', 'After hours'],
  },
];

export function RoomsShowcase() {
  return (
    <section className="space-y-8">
      <div className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-gold/75">Lobby preview</p>
          <h2 className="mt-3 text-3xl font-bold">Des rooms publiques vivantes, des salons privés bien tenus.</h2>
          <p className="mt-3 max-w-2xl text-white/72">
            La v1.1.0 transforme la vitrine en vrai lobby d’application : discovery, aperçu d’activité, CTA de création et entrée guidée dans une room privée.
          </p>
        </div>

        <div className="grid gap-3 rounded-3xl border border-gold/20 bg-gold/10 p-5 text-sm text-white/80">
          <div>
            <p className="text-white/55">Rooms publiques</p>
            <p className="mt-1 text-3xl font-black text-white">2</p>
          </div>
          <div>
            <p className="text-white/55">Rooms privées mockées</p>
            <p className="mt-1 text-3xl font-black text-white">1</p>
          </div>
          <div>
            <p className="text-white/55">Capacité live ciblée</p>
            <p className="mt-1 text-3xl font-black text-white">50–150+</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {rooms.map((room) => (
          <article key={room.slug} className="rounded-[2rem] border border-white/10 bg-black/20 p-6 shadow-2xl shadow-black/15">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-gold/80">
                  {room.type}
                </div>
                <h3 className="mt-4 text-2xl font-bold">{room.name}</h3>
              </div>
              <div className="text-right text-sm text-white/60">
                <p>{room.listeners} listeners</p>
                <p>{room.queueDepth} titres en queue</p>
              </div>
            </div>

            <p className="mt-4 text-white/74">{room.description}</p>
            <p className="mt-4 text-sm text-gold/85">DJ actif · {room.dj}</p>
            <p className="mt-2 text-sm text-white/62">{room.vibe}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {room.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button className="rounded-full bg-gold px-4 py-2 font-semibold text-night">Rejoindre</button>
              <button className="rounded-full border border-white/15 px-4 py-2 font-semibold text-white/80">Voir la queue</button>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Créer une room</p>
          <h3 className="mt-3 text-2xl font-bold">Lancer un nouveau dancefloor en 30 secondes</h3>
          <p className="mt-3 text-white/72">
            Choisis public ou privé, définis un mood, active une file collaborative et garde la main sur les rôles owner/mod/member.
          </p>
          <button className="mt-5 rounded-full bg-gold px-5 py-3 font-semibold text-night">Créer une room</button>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-gold/75">Rejoindre en privé</p>
          <h3 className="mt-3 text-2xl font-bold">Entrer avec une invitation ou un slug secret</h3>
          <p className="mt-3 text-white/72">
            La future version branchera la vérification Supabase. Pour l’instant, on expose un flux crédible sans dépendre du runtime serveur.
          </p>
          <div className="mt-5 flex gap-3">
            <input
              type="text"
              placeholder="velvet-booth / invite code"
              className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
            />
            <button className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white/85">Rejoindre</button>
          </div>
        </div>
      </div>
    </section>
  );
}
