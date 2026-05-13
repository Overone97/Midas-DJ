'use client';

function clampVolume(volume: number) {
  return Math.max(0, Math.min(100, Math.round(volume)));
}

export class StandbyAudioLoop {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private pulseInterval: number | null = null;
  private playing = false;
  private volume = 18;
  private muted = false;

  private ensureContext() {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    if (!this.context) {
      this.context = new AudioContextCtor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.context.destination);
      this.applyVolume();
    }

    return this.context;
  }

  private applyVolume() {
    if (!this.masterGain) {
      return;
    }

    const safeVolume = this.muted ? 0 : clampVolume(this.volume);
    this.masterGain.gain.setTargetAtTime(safeVolume / 500, this.context?.currentTime ?? 0, 0.08);
  }

  private schedulePulse(rootFrequency: number, startAt: number, duration = 1.35) {
    if (!this.context || !this.masterGain) {
      return;
    }

    const ctx = this.context;
    const masterGain = this.masterGain;
    if (!masterGain) {
      return;
    }

    const frequencies = [rootFrequency, rootFrequency * 1.25, rootFrequency * 1.5];
    const oscillators = frequencies.map((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(index === 0 ? 0.12 : 0.07, startAt + 0.22 + index * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.08);
      return osc;
    });

    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(rootFrequency * 2, startAt + 0.4);
    shimmerGain.gain.setValueAtTime(0.0001, startAt + 0.35);
    shimmerGain.gain.linearRampToValueAtTime(0.03, startAt + 0.55);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration + 0.1);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(masterGain);
    shimmer.start(startAt + 0.35);
    shimmer.stop(startAt + duration + 0.12);

    return [...oscillators, shimmer];
  }

  private startLoop() {
    if (!this.context || this.pulseInterval !== null) {
      return;
    }

    const playPhrase = () => {
      if (!this.context) {
        return;
      }

      const base = this.context.currentTime + 0.02;
      this.schedulePulse(261.63, base, 1.45);
      this.schedulePulse(329.63, base + 1.55, 1.35);
      this.schedulePulse(392, base + 3.1, 1.5);
    };

    playPhrase();
    this.pulseInterval = window.setInterval(playPhrase, 5200);
  }

  async play() {
    const ctx = this.ensureContext();
    if (!ctx || this.playing) {
      return;
    }

    await ctx.resume();
    this.playing = true;
    this.applyVolume();
    this.startLoop();
  }

  stop() {
    this.playing = false;
    if (this.pulseInterval !== null) {
      window.clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }

    if (this.context && this.context.state === 'running') {
      void this.context.suspend();
    }
  }

  setVolume(volume: number) {
    this.volume = volume;
    this.applyVolume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyVolume();
  }

  destroy() {
    this.stop();
    if (this.context) {
      void this.context.close();
      this.context = null;
      this.masterGain = null;
    }
  }
}
