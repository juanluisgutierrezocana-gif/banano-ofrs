// Hook para manejar el sonido de toque en recepción
// Usa un AudioContext compartido y lo reanuda antes de reproducir

let sharedCtx = null;

function getAudioContext() {
  if (!sharedCtx) {
    sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return sharedCtx;
}

async function resumeContext(ctx) {
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

function playTone(ctx, freq, startOffset, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
  gain.gain.setValueAtTime(0.35, ctx.currentTime + startOffset);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
  osc.start(ctx.currentTime + startOffset);
  osc.stop(ctx.currentTime + startOffset + duration);
}

export function useTapSound() {
  const isEnabled = () => localStorage.getItem("tap_sound_enabled") === "true";

  const play = async () => {
    if (!isEnabled()) return;
    try {
      const ctx = getAudioContext();
      await resumeContext(ctx);
      playTone(ctx, 880, 0, 0.12);
    } catch (_) {}
  };

  return { play, isEnabled };
}

export function useSaveSound() {
  const isEnabled = () => localStorage.getItem("save_sound_enabled") === "true";

  const play = async () => {
    if (!isEnabled()) return;
    try {
      const ctx = getAudioContext();
      await resumeContext(ctx);
      const notes = [523, 659, 784]; // Do, Mi, Sol
      notes.forEach((freq, i) => {
        playTone(ctx, freq, i * 0.13, 0.15);
      });
    } catch (_) {}
  };

  return { play, isEnabled };
}