// Synthesized offline notification chimes using Web Audio API
export function playNotificationSound(type: 'chime' | 'bell' | 'soft' | 'mute') {
  if (type === 'mute') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number, gainPeak: number, wave: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(gainPeak, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.03);
    };

    if (type === 'chime') {
      playTone(587.33, 0, 0.35, 0.16, 'triangle');
      playTone(880, 0.14, 0.45, 0.14, 'sine');
    } else if (type === 'bell') {
      playTone(783.99, 0, 0.6, 0.18, 'sine');
      playTone(1174.66, 0.18, 0.55, 0.12, 'sine');
    } else if (type === 'soft') {
      playTone(440, 0, 0.3, 0.1, 'sine');
      playTone(554.37, 0.12, 0.35, 0.09, 'sine');
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1200);
  } catch {
    // Ignore audio context blocked before user gesture
  }
}
