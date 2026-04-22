let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => { /* ignore */ });
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Toca um beep único. Usa Web Audio API (nao precisa de arquivo).
 */
function beep(options: {
  freq: number;
  duration: number;     // em ms
  volume?: number;      // 0 a 1
  startAt?: number;     // offset em ms
  type?: OscillatorType;
}) {
  const ctx = getCtx();
  if (!ctx) return;

  const { freq, duration, volume = 0.25, startAt = 0, type = 'sine' } = options;
  const startTime = ctx.currentTime + startAt / 1000;
  const endTime = startTime + duration / 1000;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  const gain = ctx.createGain();
  // Envelope curto (attack/release) para evitar clique
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.setValueAtTime(volume, endTime - 0.02);
  gain.gain.linearRampToValueAtTime(0, endTime);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(endTime + 0.01);
}

/**
 * Padroes de alerta:
 *  - critical: 3 beeps rapidos agudos (alarme urgente)
 *  - warning:  2 beeps medios (aviso)
 *  - info:     1 beep curto
 */
export function playAlertSound(severity: 'critical' | 'warning' | 'info' = 'warning') {
  if (severity === 'critical') {
    const freq = 1200;
    const dur = 130;
    const gap = 90;
    beep({ freq, duration: dur, volume: 0.3, startAt: 0, type: 'square' });
    beep({ freq, duration: dur, volume: 0.3, startAt: dur + gap, type: 'square' });
    beep({ freq, duration: dur, volume: 0.3, startAt: 2 * (dur + gap), type: 'square' });
  } else if (severity === 'warning') {
    const freq = 800;
    const dur = 180;
    const gap = 110;
    beep({ freq, duration: dur, volume: 0.25, startAt: 0, type: 'sine' });
    beep({ freq, duration: dur, volume: 0.25, startAt: dur + gap, type: 'sine' });
  } else {
    beep({ freq: 600, duration: 150, volume: 0.2, startAt: 0, type: 'sine' });
  }
}

/**
 * Permite "desbloquear" o audio context a partir de uma interacao do usuario.
 * Alguns navegadores bloqueiam audio ate o primeiro clique.
 */
export function unlockAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  // Beep silencioso so pra destravar o contexto
  beep({ freq: 440, duration: 1, volume: 0.0001 });
}

export function isAudioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
}
