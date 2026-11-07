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
    this.playTone(880, 'triangle', 0.1, 0.55);
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

  // Rep completion tick - loud & crisp punch that cuts through phone speakers
  playRepTick() {
    if (!this.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(987.77, now); // B5 crisp athletic chime
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.04); // snap up to E6

      gain.gain.setValueAtTime(0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      console.warn("Audio playback error:", e);
    }
    this.vibrate([60]);
  }

  // Set Finished chime - loud, distinctive ascending double-chime for end of set
  playSetFinished() {
    if (!this.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Note 1: High crisp alert (C6)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1046.50, now);
      gain1.gain.setValueAtTime(0.8, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.16);

      // Note 2: Triumphant higher bell (G6)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1567.98, now + 0.12);
      gain2.gain.setValueAtTime(0.85, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.warn("Audio playback error:", e);
    }
    this.vibrate([150, 70, 250]);
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
