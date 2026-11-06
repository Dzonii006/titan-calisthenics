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
      <div class="p-5 pb-24 space-y-4 max-w-lg mx-auto animate-fadeIn">
        <!-- Header -->
        <div class="pt-1">
          <span class="text-[11px] font-mono uppercase tracking-widest text-zinc-400">Configuration</span>
          <h1 class="text-2xl font-bold tracking-tight text-white mt-0.5">Settings</h1>
        </div>

        <!-- Audio & Alerts Section -->
        <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
          <h2 class="text-[11px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">Audio & Haptics</h2>

          <!-- Sound Toggle -->
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-white">Audio Cues</div>
              <div class="text-xs text-zinc-500">Synthesized countdown ticks & chimes</div>
            </div>
            <div class="flex items-center gap-2">
              <button id="btn-test-sound" class="px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 rounded-lg hover:text-white">
                Test
              </button>
              <input id="toggle-sound" type="checkbox" ${s.soundEnabled ? 'checked' : ''} class="w-5 h-5 accent-white rounded" />
            </div>
          </div>

          <!-- Vibration Toggle -->
          <div class="flex items-center justify-between border-t border-zinc-800/80 pt-3">
            <div>
              <div class="text-sm font-medium text-white">Haptic Vibration</div>
              <div class="text-xs text-zinc-500">Vibration feedback on timer completion</div>
            </div>
            <div class="flex items-center gap-2">
              <button id="btn-test-vibrate" class="px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 rounded-lg hover:text-white">
                Test
              </button>
              <input id="toggle-vibrate" type="checkbox" ${s.vibrateEnabled ? 'checked' : ''} class="w-5 h-5 accent-white rounded" />
            </div>
          </div>

          <!-- Screen Wake Lock Toggle -->
          <div class="flex items-center justify-between border-t border-zinc-800/80 pt-3">
            <div>
              <div class="text-sm font-medium text-white">Keep Screen Awake</div>
              <div class="text-xs text-zinc-500">Prevents phone sleep during workouts</div>
            </div>
            <input id="toggle-wakelock" type="checkbox" ${s.wakeLockEnabled ? 'checked' : ''} class="w-5 h-5 accent-white rounded" />
          </div>
        </div>

        <!-- Workout Preferences -->
        <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
          <h2 class="text-[11px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">Workout Units</h2>

          <!-- Weight Unit -->
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-white">Weight Unit</div>
              <div class="text-xs text-zinc-500">Added weight & dumbbell unit</div>
            </div>
            <select id="select-weight-unit" class="bg-[#202024] border border-zinc-700 text-white text-xs font-mono px-3 py-1.5 rounded-xl focus:outline-none">
              <option value="kg" ${s.weightUnit === 'kg' ? 'selected' : ''}>Kilograms (kg)</option>
              <option value="lbs" ${s.weightUnit === 'lbs' ? 'selected' : ''}>Pounds (lbs)</option>
            </select>
          </div>

          <!-- Default Rep Duration Cadence -->
          <div class="flex items-center justify-between border-t border-zinc-800/80 pt-3">
            <div>
              <div class="text-sm font-medium text-white">Default Rep Cadence</div>
              <div class="text-xs text-zinc-500">Seconds per rep for auto-pacing</div>
            </div>
            <div class="flex items-center gap-1 font-mono text-xs">
              <input id="input-default-cadence" type="number" step="0.5" min="1" max="10" value="${s.defaultRepDuration || 3.5}" class="w-16 bg-[#121214] border border-zinc-700 text-center text-white py-1 rounded-lg" />
              <span class="text-zinc-500">sec</span>
            </div>
          </div>
        </div>

        <!-- Backup & Restore Data -->
        <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
          <h2 class="text-[11px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">Data & Backups</h2>
          <p class="text-xs text-zinc-400 leading-relaxed">
            All your workout logs and routines are stored locally on your device. Export JSON backups anytime or import your existing CalisthenicsMemory backup file.
          </p>

          <div class="grid grid-cols-2 gap-2.5 pt-1">
            <button id="btn-export-json" class="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono font-medium active:scale-95 transition">
              Export Backup
            </button>

            <label class="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono font-medium active:scale-95 transition cursor-pointer text-center">
              Import Backup
              <input id="file-import-json" type="file" accept=".json" class="hidden" />
            </label>
          </div>

          <div class="border-t border-zinc-800/80 pt-3">
            <button id="btn-reset-defaults" class="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 font-mono transition text-center">
              Reset Routines to Baseline
            </button>
          </div>
        </div>

        <div class="text-center text-[11px] font-mono text-zinc-600 pt-2">
          Titan Calisthenics • Standalone Edition
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEvents();
  }

  attachEvents() {
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

    const toggleWakeLock = this.container.querySelector('#toggle-wakelock');
    if (toggleWakeLock) {
      toggleWakeLock.onchange = (e) => {
        appState.settings.wakeLockEnabled = e.target.checked;
        wakeLock.isEnabled = e.target.checked;
        appState.save();
      };
    }

    const selectWeightUnit = this.container.querySelector('#select-weight-unit');
    if (selectWeightUnit) {
      selectWeightUnit.onchange = (e) => {
        appState.settings.weightUnit = e.target.value;
        appState.save();
      };
    }

    const inputCadence = this.container.querySelector('#input-default-cadence');
    if (inputCadence) {
      inputCadence.onchange = (e) => {
        appState.settings.defaultRepDuration = parseFloat(e.target.value) || 3.5;
        appState.save();
      };
    }

    const btnExport = this.container.querySelector('#btn-export-json');
    if (btnExport) {
      btnExport.onclick = () => {
        const jsonStr = appState.exportJson();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `titan_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };
    }

    const fileImport = this.container.querySelector('#file-import-json');
    if (fileImport) {
      fileImport.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            appState.importJson(event.target.result);
            alert("Backup imported successfully.");
            this.render();
          } catch (err) {
            alert("Failed to parse backup: " + err.message);
          }
        };
        reader.readAsText(file);
      };
    }

    const btnReset = this.container.querySelector('#btn-reset-defaults');
    if (btnReset) {
      btnReset.onclick = () => {
        if (confirm("Reset all routines and exercises to the baseline? (Your history will be preserved)")) {
          appState.resetToDefaults();
          alert("Reset complete.");
          this.render();
        }
      };
    }
  }
}
