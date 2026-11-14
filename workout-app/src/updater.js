/**
 * Titan Calisthenics In-App Auto-Updater
 * Connects to GitHub Releases API and handles in-app update checks,
 * download progress, and triggering the native Android package installer.
 */

export class AppUpdater {
  constructor() {
    this.currentVersion = 'v1.4.1';
    this.latestRelease = null;
    this.isChecking = false;
    this.isDownloading = false;
    this.statusListeners = [];

    this.initNativeCallbacks();
  }

  getCurrentVersion() {
    if (typeof window !== 'undefined' && window.TitanNative && typeof window.TitanNative.getVersionName === 'function') {
      try {
        const v = window.TitanNative.getVersionName();
        if (v) return v.startsWith('v') ? v : `v${v}`;
      } catch (e) {
        console.warn('Native getVersionName error:', e);
      }
    }
    return this.currentVersion;
  }

  compareVersions(v1, v2) {
    const parse = (v) => (v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const p1 = parse(v1);
    const p2 = parse(v2);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const a = p1[i] || 0;
      const b = p2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  initNativeCallbacks() {
    if (typeof window === 'undefined') return;

    // 1. Result from Java update check
    window.onUpdateCheckResult = (result) => {
      this.isChecking = false;
      this.handleReleaseResult(result);
    };

    // 2. Error from Java update check
    window.onUpdateCheckError = (errMsg, isManual) => {
      this.isChecking = false;
      this.notifyListeners({ status: 'error', message: errMsg, isManual });
      if (isManual) {
        this.showToast(`Check failed: ${errMsg}`);
      }
    };

    // 3. Download progress from Java
    window.onUpdateDownloadProgress = (percent) => {
      this.isDownloading = true;
      this.updateProgressUi(percent);
    };

    // 4. Download error from Java
    window.onUpdateDownloadError = (errMsg) => {
      this.isDownloading = false;
      this.showToast(`Download failed: ${errMsg}`);
      this.closeUpdateModal();
    };

    // 5. Permission prompted
    window.onUpdatePermissionPrompted = () => {
      this.showToast("Enable 'Allow from this source', then tap Update.");
    };
  }

  onStatusChange(fn) {
    this.statusListeners.push(fn);
  }

  notifyListeners(data) {
    this.statusListeners.forEach(fn => {
      try { fn(data); } catch (e) { console.error(e); }
    });
  }

  checkForUpdates(isManual = false) {
    if (this.isChecking || this.isDownloading) return;
    this.isChecking = true;
    this.notifyListeners({ status: 'checking', isManual });

    if (typeof window !== 'undefined' && window.TitanNative && typeof window.TitanNative.checkForUpdates === 'function') {
      window.TitanNative.checkForUpdates(isManual);
    } else {
      // Browser fallback (for testing in desktop or PWA mode)
      fetch('https://api.github.com/repos/Dzonii006/titan-calisthenics/releases/latest', {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        let downloadUrl = '';
        if (Array.isArray(data.assets)) {
          const apk = data.assets.find(a => a.name && a.name.endsWith('.apk'));
          if (apk) downloadUrl = apk.browser_download_url;
        }
        this.isChecking = false;
        this.handleReleaseResult({
          tagName: data.tag_name || '',
          releaseNotes: data.body || '',
          downloadUrl,
          isManual
        });
      })
      .catch(err => {
        this.isChecking = false;
        this.notifyListeners({ status: 'error', message: err.message, isManual });
        if (isManual) {
          this.showToast(`Check failed: ${err.message}`);
        }
      });
    }
  }

  handleReleaseResult(release) {
    this.latestRelease = release;
    const cur = this.getCurrentVersion();
    const hasUpdate = release.tagName && this.compareVersions(release.tagName, cur) > 0;

    this.notifyListeners({
      status: 'result',
      hasUpdate,
      currentVersion: cur,
      latestVersion: release.tagName,
      release,
      isManual: release.isManual
    });

    if (hasUpdate) {
      this.showUpdateModal(release, cur);
    } else if (release.isManual) {
      this.showToast(`Titan Calisthenics is up to date (${cur})`);
    }
  }

  startDownload(apkUrl) {
    if (!apkUrl) {
      this.showToast('No APK download link found in release.');
      return;
    }
    this.isDownloading = true;

    if (typeof window !== 'undefined' && window.TitanNative && typeof window.TitanNative.startUpdateDownload === 'function') {
      window.TitanNative.startUpdateDownload(apkUrl);
    } else {
      // Browser fallback
      window.open(apkUrl, '_blank');
      this.closeUpdateModal();
    }
  }

  showUpdateModal(release, cur) {
    if (document.getElementById('update-modal')) return;

    const modalRoot = document.getElementById('modal-root') || document.body;
    const modalEl = document.createElement('div');
    modalEl.id = 'update-modal';
    modalEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm select-none';

    // Parse clean release notes
    const rawNotes = (release.releaseNotes || '').trim();
    const cleanNotes = rawNotes ? rawNotes.replace(/###/g, '').replace(/##/g, '') : 'Performance improvements and bug fixes.';

    modalEl.innerHTML = `
      <div class="bg-[#18181b] border border-zinc-700/80 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
        <!-- Header -->
        <div class="flex items-start justify-between border-b border-zinc-800 pb-3">
          <div>
            <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold tracking-wider">
              Update Available
            </span>
            <h2 class="text-lg font-bold text-white tracking-tight mt-1.5">${release.tagName}</h2>
            <div class="text-[11px] font-mono text-zinc-400 mt-0.5">
              Current: <span class="text-zinc-300 font-semibold">${cur}</span> ➔ New: <span class="text-white font-bold">${release.tagName}</span>
            </div>
          </div>
          <button id="btn-close-update-modal" class="text-zinc-400 hover:text-white p-1 text-sm">✕</button>
        </div>

        <!-- Release Notes -->
        <div class="space-y-1.5">
          <div class="text-[10px] font-mono uppercase text-zinc-400 tracking-wider font-semibold">What's New:</div>
          <div class="bg-[#121214] border border-zinc-800 rounded-xl p-3 max-h-36 overflow-y-auto text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-mono">
${cleanNotes}
          </div>
        </div>

        <!-- Progress Container (Hidden initially) -->
        <div id="update-progress-container" class="hidden space-y-2 pt-1">
          <div class="flex items-center justify-between text-xs font-mono text-zinc-300">
            <span id="update-progress-label">Downloading update...</span>
            <span id="update-progress-digits" class="font-bold text-white">0%</span>
          </div>
          <div class="w-full bg-zinc-900 border border-zinc-800 h-2.5 rounded-full overflow-hidden">
            <div id="update-progress-bar" class="bg-white h-full transition-all duration-150 rounded-full" style="width: 0%;"></div>
          </div>
        </div>

        <!-- Buttons -->
        <div id="update-modal-buttons" class="flex items-center gap-2.5 pt-1">
          <button id="btn-update-later" class="w-1/3 py-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-mono font-medium active:scale-95 transition">
            Later
          </button>
          <button id="btn-update-now" class="flex-1 py-3.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold uppercase tracking-wider active:scale-98 transition shadow-lg flex items-center justify-center gap-1.5">
            <span>Update Now</span>
            <span>➔</span>
          </button>
        </div>
      </div>
    `;

    modalRoot.appendChild(modalEl);

    const closeBtn = modalEl.querySelector('#btn-close-update-modal');
    if (closeBtn) closeBtn.onclick = () => this.closeUpdateModal();
    const laterBtn = modalEl.querySelector('#btn-update-later');
    if (laterBtn) laterBtn.onclick = () => this.closeUpdateModal();

    const nowBtn = modalEl.querySelector('#btn-update-now');
    if (nowBtn) {
      nowBtn.onclick = () => {
        const btnNow = modalEl.querySelector('#btn-update-now');
        const btnLater = modalEl.querySelector('#btn-update-later');
        const progressContainer = modalEl.querySelector('#update-progress-container');

        if (btnNow) btnNow.classList.add('hidden');
        if (btnLater) btnLater.classList.add('hidden');
        if (progressContainer) progressContainer.classList.remove('hidden');

        this.startDownload(release.downloadUrl);
      };
    }
  }

  updateProgressUi(percent) {
    const modal = document.getElementById('update-modal');
    if (!modal) return;

    const digits = modal.querySelector('#update-progress-digits');
    const bar = modal.querySelector('#update-progress-bar');
    const label = modal.querySelector('#update-progress-label');

    if (digits) digits.innerText = `${percent}%`;
    if (bar) bar.style.width = `${percent}%`;
    if (label && percent >= 100) {
      label.innerText = 'Opening installer...';
    }
  }

  closeUpdateModal() {
    const modal = document.getElementById('update-modal');
    if (modal) modal.remove();
  }

  showToast(msg) {
    const existing = document.getElementById('titan-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'titan-toast';
    toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#202024] border border-zinc-700 text-zinc-100 text-xs font-mono px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 pointer-events-none transition-all';
    toast.innerText = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast) toast.remove();
    }, 3500);
  }
}

export const appUpdater = new AppUpdater();
