'use client';

import { useGlobalAudioController } from '@/lib/audio-controller';

export function SceneAudioControlBar({
  canControl,
  hasTrack,
  onPlay,
  onNext,
  onStop,
}: {
  canControl: boolean;
  hasTrack: boolean;
  onPlay: () => void;
  onNext: () => void;
  onStop: () => void;
}) {
  const { state, playAll, stopAll, toggleMute } = useGlobalAudioController();
  const disabled = !hasTrack;

  return (
    <div className="rounded-[1.2rem] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(8,12,20,0.96),rgba(5,8,14,0.92))] px-3 py-3 shadow-[0_0_28px_rgba(34,211,238,0.06)]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            playAll();
            if (canControl) {
              onPlay();
            }
          }}
          disabled={disabled || !canControl}
          className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-fuchsia-50 transition hover:bg-fuchsia-300/16 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Play
        </button>
        <button
          type="button"
          onClick={() => {
            stopAll();
            if (canControl) {
              onStop();
            }
          }}
          disabled={disabled || !canControl}
          className="rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-gold transition hover:bg-gold/16 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={() => {
            if (canControl) {
              onNext();
            }
          }}
          disabled={disabled || !canControl}
          className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-50 transition hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
        <button
          type="button"
          onClick={toggleMute}
          disabled={disabled}
          className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-50 ${
            state.muted || state.volume <= 0
              ? 'border-cyan-300/25 bg-cyan-300/14 text-cyan-50'
              : 'border-white/10 bg-white/5 text-white/78 hover:bg-white/8'
          }`}
        >
          {state.muted || state.volume <= 0 ? 'Unmute' : 'Mute'}
        </button>

        <div className="ml-auto flex min-w-[16rem] flex-1 items-center justify-end rounded-[1.1rem] border border-cyan-300/15 bg-cyan-300/8 px-4 py-2.5 text-right text-cyan-50 shadow-[inset_0_0_18px_rgba(34,211,238,0.05)]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-50/92">Son local</p>
            <p className="text-xs text-cyan-50/72">Mute ici. Volume détaillé via le lecteur YouTube.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
