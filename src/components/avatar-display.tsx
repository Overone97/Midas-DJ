'use client';

import { avatarColorThemes, avatarOptionLabels, normalizeAvatar, type AvatarConfig } from '@/lib/avatar';

function badgeLabel(badge: AvatarConfig['badge']) {
  return avatarOptionLabels.badges[badge];
}

export function AvatarDisplay({
  avatar,
  label,
  size = 'md',
  showLabel = false,
  badge,
  mood = 'idle',
  raisedHand = false,
}: {
  avatar?: Partial<AvatarConfig> | null;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  badge?: string;
  mood?: 'idle' | 'groove' | 'hype';
  raisedHand?: boolean;
}) {
  const resolved = normalizeAvatar(avatar);
  const theme = avatarColorThemes[resolved.outfitColor];
  const shellScale = size === 'sm' ? 'h-[3.8rem] w-[3.15rem]' : size === 'lg' ? 'h-[6.6rem] w-[5.4rem]' : 'h-[5rem] w-[4.1rem]';
  const glowScale = size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-20 w-20' : 'h-14 w-14';
  const headScale = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-[3.7rem] w-[3.7rem]' : 'h-10 w-10';
  const muzzleScale = size === 'sm' ? 'h-3 w-3.5' : size === 'lg' ? 'h-5 w-6' : 'h-4 w-5';
  const bodyScale = size === 'sm' ? 'h-5 w-5.5' : size === 'lg' ? 'h-10 w-11' : 'h-7 w-8';
  const legHeight = size === 'sm' ? 'h-3' : size === 'lg' ? 'h-5' : 'h-4';
  const earScale = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-6 w-5' : 'h-4 w-4';
  const accessoryTop = size === 'sm' ? 'top-1.5' : size === 'lg' ? 'top-3' : 'top-2';
  const wrapperMotion = mood === 'hype' ? 'avatar-hype' : mood === 'groove' ? 'avatar-groove' : 'avatar-idle';
  const headTone =
    resolved.species === 'panda'
      ? 'bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#ffffff_62%,#0f172a_63%,#0f172a_100%)]'
      : resolved.species === 'bear'
        ? 'bg-[#b98158]'
        : resolved.species === 'dragon'
          ? 'bg-[radial-gradient(circle_at_50%_38%,#bbf7d0_0%,#86efac_58%,#22c55e_100%)]'
          : 'bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.98),rgba(255,255,255,0.9)_72%,rgba(226,232,240,0.95)_100%)]';

  return (
    <div className={`flex items-center gap-3 ${showLabel ? '' : 'justify-center'}`}>
      <div className={`relative ${wrapperMotion}`}>
        <div className={`absolute left-1/2 top-3 -translate-x-1/2 rounded-full blur-2xl ${glowScale} ${theme.glow}`} />
        <div className={`relative ${shellScale}`}>
          <div className="absolute left-1/2 top-1 h-[72%] w-[72%] -translate-x-1/2 rounded-[999px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />

          <div className="absolute inset-x-0 top-0 flex items-start justify-center gap-1">
            {(resolved.species === 'bunny' || resolved.species === 'cat') && (
              <>
                <span className={`${earScale} ${resolved.species === 'bunny' ? 'rounded-t-[999px] rounded-b-[0.5rem]' : 'rotate-[-14deg] rounded-[999px]'} border border-white/10 bg-white/90`} />
                <span className={`${earScale} ${resolved.species === 'bunny' ? 'rounded-t-[999px] rounded-b-[0.5rem]' : 'rotate-[14deg] rounded-[999px]'} border border-white/10 bg-white/90`} />
              </>
            )}
            {resolved.species === 'bear' && (
              <>
                <span className={`${earScale} rounded-full border border-[#8d5a35] bg-[#7c4a26]`} />
                <span className={`${earScale} rounded-full border border-[#8d5a35] bg-[#7c4a26]`} />
              </>
            )}
            {resolved.species === 'panda' && (
              <>
                <span className={`${earScale} rounded-full border border-slate-800/80 bg-slate-950`} />
                <span className={`${earScale} rounded-full border border-slate-800/80 bg-slate-950`} />
              </>
            )}
            {resolved.species === 'dragon' && (
              <>
                <span className={`${earScale} rotate-[-24deg] rounded-[0.45rem] border border-emerald-200/40 bg-emerald-300`} />
                <span className={`${earScale} rotate-[24deg] rounded-[0.45rem] border border-emerald-200/40 bg-emerald-300`} />
              </>
            )}
          </div>

          <div className="absolute left-1/2 top-2 -translate-x-1/2">
            <div className={`${headScale} ${headTone} relative overflow-hidden rounded-full border border-white/12 shadow-[0_10px_24px_rgba(0,0,0,0.32)]`}>
              <div className="absolute inset-x-2 top-2 h-2 rounded-full bg-white/18 blur-sm" />
              {resolved.species === 'panda' ? (
                <>
                  <span className="absolute left-[22%] top-[38%] h-3 w-2.5 -rotate-12 rounded-full bg-slate-900/88" />
                  <span className="absolute right-[22%] top-[38%] h-3 w-2.5 rotate-12 rounded-full bg-slate-900/88" />
                </>
              ) : null}
              <div className="absolute inset-x-0 top-[42%] flex items-center justify-center gap-2">
                <span className="relative h-1.5 w-1.5 rounded-full bg-slate-950"><span className="absolute left-[0.15rem] top-[0.1rem] h-0.5 w-0.5 rounded-full bg-white/90" /></span>
                <span className="relative h-1.5 w-1.5 rounded-full bg-slate-950"><span className="absolute left-[0.15rem] top-[0.1rem] h-0.5 w-0.5 rounded-full bg-white/90" /></span>
              </div>
              <div className={`absolute left-1/2 top-[56%] -translate-x-1/2 rounded-full border border-black/5 bg-white/88 ${muzzleScale}`}>
                <span className="absolute left-1/2 top-[32%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-slate-950" />
                <span className="absolute left-1/2 top-[58%] h-px w-2 -translate-x-1/2 bg-slate-900/65" />
              </div>
              {resolved.species === 'dragon' ? <span className="absolute left-1/2 top-[18%] h-3 w-4 -translate-x-1/2 rounded-b-full bg-emerald-200/60 blur-[1px]" /> : null}
            </div>
          </div>

          <div className="absolute bottom-[0.9rem] left-1/2 z-[1] flex -translate-x-1/2 items-start gap-1">
            <span className={`mt-1 w-1 rounded-full bg-white/18 ${raisedHand ? 'rotate-[-28deg] origin-bottom translate-y-[-0.35rem] translate-x-[-0.15rem]' : ''} ${size === 'sm' ? 'h-3' : size === 'lg' ? 'h-5' : 'h-4'}`} />
            <div className={`relative overflow-hidden rounded-[1rem] border border-white/12 bg-gradient-to-b ${theme.body} ${bodyScale} shadow-[0_12px_24px_rgba(0,0,0,0.32)]`}>
              <div className="absolute inset-x-1 top-1 h-2 rounded-full bg-white/10 blur-sm" />
              <div className="absolute inset-x-2 top-[45%] h-px bg-white/16" />
            </div>
            <span className={`mt-1 w-1 rounded-full bg-white/18 ${size === 'sm' ? 'h-3' : size === 'lg' ? 'h-5' : 'h-4'}`} />
          </div>

          <div className="absolute bottom-0 left-1/2 z-[1] flex -translate-x-1/2 gap-1">
            <span className={`w-1.5 rounded-full bg-slate-950/80 ${legHeight}`} />
            <span className={`w-1.5 rounded-full bg-slate-950/80 ${legHeight}`} />
          </div>

          {resolved.accessories.includes('headphones') && (
            <>
              <div className={`absolute left-1/2 -translate-x-1/2 rounded-full border-2 border-cyan-300/70 ${accessoryTop} ${size === 'sm' ? 'h-4 w-7' : size === 'lg' ? 'h-6 w-12' : 'h-5 w-9'}`} />
              <span className={`absolute left-[17%] rounded-full border border-cyan-200/50 bg-cyan-300/55 ${size === 'sm' ? 'top-[1.6rem] h-2.5 w-1.5' : size === 'lg' ? 'top-[2.45rem] h-4 w-2' : 'top-[2rem] h-3 w-1.5'}`} />
              <span className={`absolute right-[17%] rounded-full border border-cyan-200/50 bg-cyan-300/55 ${size === 'sm' ? 'top-[1.6rem] h-2.5 w-1.5' : size === 'lg' ? 'top-[2.45rem] h-4 w-2' : 'top-[2rem] h-3 w-1.5'}`} />
            </>
          )}
          {resolved.accessories.includes('glasses') && (
            <div className={`absolute inset-x-0 left-1/2 flex -translate-x-1/2 items-center justify-center gap-1 ${size === 'sm' ? 'top-[1.75rem]' : size === 'lg' ? 'top-[2.65rem]' : 'top-[2.15rem]'}`}>
              <span className="h-2.5 w-2.5 rounded-full border border-sky-100/80 bg-sky-100/10" />
              <span className="h-px w-2 bg-sky-100/80" />
              <span className="h-2.5 w-2.5 rounded-full border border-sky-100/80 bg-sky-100/10" />
            </div>
          )}
          {resolved.accessories.includes('hat') && <div className={`absolute left-1/2 -translate-x-1/2 rounded-t-full border border-slate-800 bg-slate-950 ${size === 'sm' ? 'top-1.5 h-2.5 w-6' : size === 'lg' ? 'top-2 h-4 w-10' : 'top-2 h-3 w-8'}`} />}
          {resolved.accessories.includes('crown') && (
            <div className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-[20%] gap-0.5">
              <span className="h-3 w-2 rounded-t-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.32)]" />
              <span className="h-4 w-2 rounded-t-full bg-yellow-200 shadow-[0_0_14px_rgba(253,224,71,0.34)]" />
              <span className="h-3 w-2 rounded-t-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.32)]" />
            </div>
          )}
        </div>

        {(resolved.badge !== 'none' || badge) && (
          <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] whitespace-nowrap ${theme.chip}`}>
            {badge ?? badgeLabel(resolved.badge)}
          </span>
        )}
      </div>

      {showLabel ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white/90">{label}</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">{avatarOptionLabels.species[resolved.species]}</p>
        </div>
      ) : null}
    </div>
  );
}
