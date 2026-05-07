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
  const scale = size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-20 w-20' : 'h-14 w-14';
  const earScale = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-6 w-6' : 'h-4 w-4';
  const faceScale = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const bodyScale = size === 'sm' ? 'h-5 w-6' : size === 'lg' ? 'h-9 w-11' : 'h-7 w-9';
  const armLift = raisedHand ? (size === 'lg' ? '-top-1 -right-3 h-8 w-2' : '-top-1 -right-2 h-6 w-1.5') : '';
  const wrapperMotion = mood === 'hype' ? 'avatar-hype' : mood === 'groove' ? 'avatar-groove' : 'avatar-idle';

  return (
    <div className={`flex items-center gap-3 ${showLabel ? '' : 'justify-center'}`}>
      <div className={`relative ${wrapperMotion}`}>
        <div className={`absolute inset-0 rounded-full blur-xl ${theme.glow}`} />
        <div className={`relative ${scale} rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(11,14,25,0.95),rgba(5,7,12,0.98))]`}>
          <div className="absolute inset-x-0 -top-1 flex items-start justify-center gap-1">
            {(resolved.species === 'bunny' || resolved.species === 'cat') && (
              <>
                <span className={`${earScale} rounded-full ${resolved.species === 'bunny' ? 'rounded-t-[999px]' : 'rotate-[-12deg]'} bg-white/90`} />
                <span className={`${earScale} rounded-full ${resolved.species === 'bunny' ? 'rounded-t-[999px]' : 'rotate-[12deg]'} bg-white/90`} />
              </>
            )}
            {resolved.species === 'bear' && (
              <>
                <span className={`${earScale} rounded-full bg-[#7c4a26]`} />
                <span className={`${earScale} rounded-full bg-[#7c4a26]`} />
              </>
            )}
            {resolved.species === 'panda' && (
              <>
                <span className={`${earScale} rounded-full bg-slate-900`} />
                <span className={`${earScale} rounded-full bg-slate-900`} />
              </>
            )}
            {resolved.species === 'dragon' && (
              <>
                <span className={`${earScale} rotate-[-24deg] rounded-[0.4rem] bg-emerald-300`} />
                <span className={`${earScale} rotate-[24deg] rounded-[0.4rem] bg-emerald-300`} />
              </>
            )}
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {raisedHand ? <span className={`absolute rounded-full bg-white/85 shadow-[0_0_10px_rgba(255,255,255,0.28)] rotate-[-18deg] ${armLift}`} /> : null}
            <div
              className={`${faceScale} rounded-full ${
                resolved.species === 'panda'
                  ? 'bg-[radial-gradient(circle_at_50%_50%,#ffffff_0%,#ffffff_62%,#0f172a_63%,#0f172a_100%)]'
                  : resolved.species === 'bear'
                    ? 'bg-[#b98158]'
                    : resolved.species === 'dragon'
                      ? 'bg-emerald-200'
                      : 'bg-white/95'
              } flex items-center justify-center border border-white/10`}
            >
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
              </div>
            </div>
            <div className={`-mt-1 rounded-[999px] bg-gradient-to-b ${theme.body} ${bodyScale} border border-white/12`} />
          </div>

          {resolved.accessories.includes('headphones') && (
            <div className="absolute inset-x-1 top-2 h-5 rounded-full border-2 border-cyan-300/70" />
          )}
          {resolved.accessories.includes('glasses') && (
            <div className="absolute inset-x-2 top-[44%] flex -translate-y-1/2 items-center justify-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full border border-sky-100/80" />
              <span className="h-px w-2 bg-sky-100/80" />
              <span className="h-2.5 w-2.5 rounded-full border border-sky-100/80" />
            </div>
          )}
          {resolved.accessories.includes('hat') && <div className="absolute inset-x-2 top-1 h-3 rounded-t-full bg-slate-950" />}
          {resolved.accessories.includes('crown') && (
            <div className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-1/2 gap-0.5">
              <span className="h-3 w-2 rounded-t-full bg-amber-300" />
              <span className="h-4 w-2 rounded-t-full bg-yellow-200" />
              <span className="h-3 w-2 rounded-t-full bg-amber-300" />
            </div>
          )}
        </div>

        {(resolved.badge !== 'none' || badge) && (
          <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] ${theme.chip}`}>
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
