// Screen Wake Lock API manager to keep phone screen awake during workouts

class WakeLockManager {
  constructor() {
    this.wakeLock = null;
    this.isEnabled = true;
    this.initVisibilityListener();
  }

  async request() {
    if (!this.isEnabled) return;
    if ('wakeLock' in navigator) {
      try {
        if (!this.wakeLock) {
          this.wakeLock = await navigator.wakeLock.request('screen');
          this.wakeLock.addEventListener('release', () => {
            this.wakeLock = null;
          });
        }
      } catch (err) {
        console.warn(`Wake Lock error: ${err.name}, ${err.message}`);
      }
    }
  }

  release() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch (e) {
        // Ignored
      }
      this.wakeLock = null;
    }
  }

  initVisibilityListener() {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && this.wakeLock === null && this.isEnabled) {
        await this.request();
      }
    });
  }
}

export const wakeLock = new WakeLockManager();
