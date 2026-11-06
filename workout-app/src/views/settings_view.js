import { appState } from '../state.js';
import { sounds } from '../sound.js';
import { wakeLock } from '../wakelock.js';

export class SettingsView {
  constructor(container) {
    this.container = container;
  }

  render() {
    const s = appState.settings;

    const html = `
      <div class="p-5 pb-24 space-y-6 max-w-lg mx-auto animate-fadeIn">
        <!-- Header -->
        <div>
          <span class="text-xs font-mono uppercase tracking-widest text-emerald-400">Preferences</span>
          <h1 class="text-2xl font-black tracking-tight text-white mt-0.5">Settings</h1>
        </div>

        <!-- Audio & Alerts Section -->
        <div class="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 class="text-xs font-mono uppercase text-zinc-400 font-bold tracking-wider">Audio & Haptics</h2>

          <!-- Sound Toggle -->
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-semibold text-white">Audio Beeps</div>
              <div class="text-xs text-zinc-500">Synthesized 5s countdown & rest chimes</div>
            </div>
            <div class="flex items-center gap-2">
              <button id="btn-test-sound" class="px-2 py-1 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg hover:text-white">
                Test
              </button>
              <input id="toggle-sound" type="checkbox" ${s.soundEnabled ? 'checked' : ''} class="w-5 h-5 accent-emerald-500 rounded" />
            </div>
          </div>

          <!-- Vibration Toggle -->
          <div class="flex items-center justify-between border-t border-zinc-900 pt-3">
            <div>
              <div class="text-sm font-semibold text-white">Haptic Vibration</div>
              <div class="text-xs text-zinc-500">Vibrates phone on 0 and rep triggers</div>
            </div>
            <div class="flex items-center gap-2">
              <button id="btn-test-vibrate" class="px-2 py-1 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg hover:text-white">
                Test
              </button>
              <input id="toggle-vibrate" type="checkbox" ${s.vibrateEnabled ? 'checked' : ''} class="w-5 h-5 accent-emerald-500 rounded" />
            </div>
          </div>

          <!-- Screen Wake Lock Toggle -->
          <div class="flex items-center justify-between border-t border-zinc-900 pt-3">
            <div>
              <div class="text-sm font-semibold text-white">Keep Screen Awake</div>
              <div class="text-xs text-zinc-500">Prevents phone sleep during workout</div>
            </div>
            <input id="toggle-wakelock" type="checkbox" ${s.wakeLockEnabled ? 'checked' : ''} class="w-5 h-5 accent-emerald-500 rounded" />
          </div>
        </div>

        <!-- Workout Preferences -->
        <div class="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 class="text-xs font-mono uppercase text-zinc-400 font-bold tracking-wider">Workout Units</h2>

          <!-- Weight Unit -->
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-semibold text-white">Weight Unit</div>
              <div class="text-xs text-zinc-500">Added weight & dumbbell unit</div>
            </div>
            <select id="select-weight-unit" class="bg-zinc-900 border border-zinc-800 text-white text-xs font-mono px-3 py-1.5 rounded-xl">
              <option value="kg" ${s.weightUnit === 'kg' ? 'selected' : ''}>Kilograms (kg)</option>
              <option value="lbs" ${s.weightUnit === 'lbs' ? 'selected' : ''}>Pounds (lbs)</option>
            </select>
          </div>

          <!-- Default Rep Duration Cadence -->
          <div class="flex items-center justify-between border-t border-zinc-900 pt-3">
            <div>
              <div class="text-sm font-semibold text-white">Default Rep Cadence</div>
              <div class="text-xs text-zinc-500">Seconds per rep for auto-pacing</div>
            </div>
            <div class="flex items-center gap-1 font-mono text-xs">
              <input id="input-default-cadence" type="number" step="0.5" min="1" max="10" value="${s.defaultRepDuration || 3.5}" class="w-16 bg-black border border-zinc-800 text-center text-white py-1 rounded-lg" />
              <span class="text-zinc-500">sec</span>
            </div>
          </div>
        </div>

        <!-- Backup & Restore Data -->
        <div class="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 class="text-xs font-mono uppercase text-zinc-400 font-bold tracking-wider">Data & Backups</h2>
          <p class="text-xs text-zinc-500 leading-relaxed">
            All your workout logs and exercises are stored locally on your device. You can export a JSON backup anytime or import your existing CalisthenicsMemory backup file.
          </p>

          <div class="grid grid-cols-2 gap-3 pt-2">
            <button id="btn-export-json" class="py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-mono font-bold active:scale-95 transition flex items-center justify-center gap-2">
              <span>📥</span>
              <span>Export JSON</span>
            </button>

            <label class="py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-mono font-bold active:scale-95 transition cursor-pointer flex items-center justify-center gap-2">
              <span>📤</span>
              <span>Import JSON</span>
              <input id="file-import-json" type="file" accept=".json" class="hidden" />
            </label>
          </div>

          <div class="border-t border-zinc-900 pt-3">
            <button id="btn-reset-defaults" class="w-full py-2.5 text-xs text-zinc-500 hover:text-rose-400 font-mono transition">
              Reset All Exercises & Routines to Baseline
            </button>
          </div>
        </div>

        <div class="text-center text-[11px] font-mono text-zinc-600">
          Titan Calisthenics PWA • Mobile Edition
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEvents();
  }

  attachEvents() {
    // Sound toggle
    const toggleSound = this.container.querySelector('#toggle-sound');
    if (toggleSound) {
      toggleSound.onchange = (e) => {
        appState.settings.soundEnabled = e.target.checked;
        sounds.soundEnabled = e.target.checked;
        appState.save();
      };
    }
    const btnTestSound = this.container.querySelector('#btn-test-sound');
    if (btnTestSound) {
      btnTestSound.onclick = () => {
        sounds.playCountdownTick();
        setTimeout(() => sounds.playGoTone(), 300);
      };
    }

    // Vibration toggle
    const toggleVibrate = this.container.querySelector('#toggle-vibrate');
    if (toggleVibrate) {
      toggleVibrate.onchange = (e) => {
        appState.settings.vibrateEnabled = e.target.checked;
        sounds.vibrateEnabled = e.target.checked;
        appState.save();
      };
    }
    const btnTestVibrate = this.container.querySelector('#btn-test-vibrate');
    if (btnTestVibrate) {
      btnTestVibrate.onclick = () => {
        sounds.vibrate([100, 50, 100]);
      };
    }

    // WakeLock toggle
    const toggleWakeLock = this.container.querySelector('#toggle-wakelock');
    if (toggleWakeLock) {
      toggleWakeLock.onchange = (e) => {
        appState.settings.wakeLockEnabled = e.target.checked;
        wakeLock.isEnabled = e.target.checked;
        appState.save();
      };
    }

    // Weight unit
    const selectWeightUnit = this.container.querySelector('#select-weight-unit');
    if (selectWeightUnit) {
      selectWeightUnit.onchange = (e) => {
        appState.settings.weightUnit = e.target.value;
        appState.save();
      };
    }

    // Default cadence
    const inputCadence = this.container.querySelector('#input-default-cadence');
    if (inputCadence) {
      inputCadence.onchange = (e) => {
        appState.settings.defaultRepDuration = parseFloat(e.target.value) || 3.5;
        appState.save();
      };
    }

    // Export JSON
    const btnExport = this.container.querySelector('#btn-export-json');
    if (btnExport) {
      btnExport.onclick = () => {
        const jsonStr = appState.exportJson();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `titan_workout_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };
    }

    // Import JSON
    const fileImport = this.container.querySelector('#file-import-json');
    if (fileImport) {
      fileImport.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            appState.importJson(event.target.result);
            alert("Backup imported successfully!");
            this.render();
          } catch (err) {
            alert("Failed to parse JSON backup file: " + err.message);
          }
        };
        reader.readAsText(file);
      };
    }

    // Reset Defaults
    const btnReset = this.container.querySelector('#btn-reset-defaults');
    if (btnReset) {
      btnReset.onclick = () => {
        if (confirm("Reset all routines, exercises and cues to the default CalisthenicsMemory baseline? (Your history will be preserved)")) {
          appState.resetToDefaults();
          alert("Reset complete!");
          this.render();
        }
      };
    }
  }
}
