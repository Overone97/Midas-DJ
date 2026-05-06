'use client';

import {
  AVATAR_ACCESSORIES,
  AVATAR_BADGES,
  AVATAR_OUTFIT_COLORS,
  AVATAR_SPECIES,
  avatarColorThemes,
  avatarOptionLabels,
  normalizeAvatar,
  type AvatarAccessory,
  type AvatarConfig,
} from '@/lib/avatar';
import { AvatarDisplay } from '@/components/avatar-display';

function ToggleChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
        active
          ? 'border-cyan-300/45 bg-cyan-300/14 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
          : 'border-white/10 bg-white/5 text-white/72 hover:border-white/15 hover:bg-white/8'
      }`}
    >
      {label}
    </button>
  );
}

export function AvatarCustomizer({
  open,
  value,
  submitting,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  value: AvatarConfig;
  submitting: boolean;
  onClose: () => void;
  onChange: (avatar: AvatarConfig) => void;
  onSave: () => void;
}) {
  const avatar = normalizeAvatar(value);

  if (!open) {
    return null;
  }

  function toggleAccessory(accessory: AvatarAccessory) {
    const next = avatar.accessories.includes(accessory)
      ? avatar.accessories.filter((item) => item !== accessory)
      : [...avatar.accessories, accessory];

    onChange({ ...avatar, accessories: next.slice(0, 4) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-[2rem] border border-fuchsia-300/15 bg-[radial-gradient(circle_at_top,#a855f71f,transparent_30%),linear-gradient(180deg,#120f1d,#07070d)] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-fuchsia-200/70">Avatar lab</p>
            <h3 className="mt-2 text-2xl font-black text-white">Forge ton animal de scène</h3>
            <p className="mt-2 max-w-2xl text-sm text-white/68">Base modulaire, options extensibles, et rendu néon cohérent partout dans la room.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/78 transition hover:bg-white/10">
            Fermer
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-[1.6rem] border border-cyan-300/12 bg-[linear-gradient(180deg,rgba(4,10,16,0.95),rgba(7,9,15,0.92))] p-5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/68">Preview</p>
            <div className="mt-5 flex min-h-[20rem] items-center justify-center rounded-[1.4rem] border border-white/10 bg-black/25">
              <AvatarDisplay avatar={avatar} label="Ton avatar" size="lg" showLabel badge={avatar.badge !== 'none' ? avatarOptionLabels.badges[avatar.badge] : undefined} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {AVATAR_OUTFIT_COLORS.map((color) => (
                <span key={color} className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${avatarColorThemes[color].chip}`}>
                  {avatarOptionLabels.outfitColors[color]}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Species</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {AVATAR_SPECIES.map((species) => (
                  <ToggleChip key={species} active={avatar.species === species} label={avatarOptionLabels.species[species]} onClick={() => onChange({ ...avatar, species })} />
                ))}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Accessories</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {AVATAR_ACCESSORIES.map((accessory) => (
                  <ToggleChip key={accessory} active={avatar.accessories.includes(accessory)} label={avatarOptionLabels.accessories[accessory]} onClick={() => toggleAccessory(accessory)} />
                ))}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Outfit color</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {AVATAR_OUTFIT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onChange({ ...avatar, outfitColor: color })}
                    className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                      avatar.outfitColor === color
                        ? 'border-fuchsia-300/45 bg-fuchsia-300/12 text-fuchsia-50 shadow-[0_0_18px_rgba(192,132,252,0.16)]'
                        : 'border-white/10 bg-white/5 text-white/72'
                    }`}
                  >
                    {avatarOptionLabels.outfitColors[color]}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Badge</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {AVATAR_BADGES.map((badge) => (
                  <ToggleChip key={badge} active={avatar.badge === badge} label={avatarOptionLabels.badges[badge]} onClick={() => onChange({ ...avatar, badge })} />
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white/78 transition hover:bg-white/10">
            Annuler
          </button>
          <button type="button" onClick={onSave} disabled={submitting} className="rounded-full border border-cyan-300/25 bg-cyan-300/12 px-5 py-3 font-semibold text-cyan-50 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Sauvegarde…' : 'Sauver mon avatar'}
          </button>
        </div>
      </div>
    </div>
  );
}
