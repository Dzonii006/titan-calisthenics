// Web Audio API Synthesizer for workout cues & haptic feedback

class SoundManager {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.vibrateEnabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play a synthesized tone with attack/decay envelope
  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.3) {
    if (!this.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio playback error:", e);
    }
  }

  // 5... 4... 3... 2... 1... tick
  playCountdownTick() {
    this.playTone(880, 'sine', 0.09, 0.35);
    this.vibrate([60]);
  }

  // "GO!" on 0
  playGoTone() {
    if (!this.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1320, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.25);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn(e);
    }
    this.vibrate([150]);
  }

  // Rep completion tick
  playRepTick() {
    this.playTone(660, 'sine', 0.08, 0.25);
    this.vibrate([40]);
  }

  // Rest timer ended - ready for 5s countdown
  playRestFinished() {
    this.playTone(523.25, 'triangle', 0.15, 0.3); // C5
    setTimeout(() => {
      this.playTone(659.25, 'triangle', 0.15, 0.3); // E5
    }, 120);
    setTimeout(() => {
      this.playTone(783.99, 'triangle', 0.25, 0.35); // G5
    }, 240);
    this.vibrate([100, 50, 100]);
  }

  // Set successfully logged
  playSetLogged() {
    this.playTone(440, 'sine', 0.1, 0.25);
    setTimeout(() => {
      this.playTone(880, 'sine', 0.2, 0.3);
    }, 100);
    this.vibrate([80]);
  }

  vibrate(pattern) {
    if (!this.vibrateEnabled) return;
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Ignored on unsupported browsers
      }
    }
  }
}

export const sounds = new SoundManager();
