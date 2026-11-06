import { appState } from '../state.js';
import { sounds } from '../sound.js';
import { wakeLock } from '../wakelock.js';

export class WorkoutView {
  constructor(container, onExit) {
    this.container = container;
    this.onExit = onExit;

    this.program = null;
    this.exerciseList = [];
    this.currentExIndex = 0;
    this.currentSet = 1;
    this.totalSetsForCurrentEx = 3;

    // Phases: 'WARMUP' | 'COUNTDOWN_5S' | 'ACTIVE' | 'REST' | 'SUMMARY'
    this.phase = 'WARMUP';

    // Timers & intervals
    this.activeTimer = null;
    this.workoutStartTime = null;
    this.setStartTime = null;

    // Countdown / Rest timers
    this.countdownSeconds = 5;
    this.restRemainingSeconds = 60;
    this.restTotalSeconds = 60;

    // Active exercise state
    this.activeDuration = 0; // seconds elapsed in set
    this.currentRep = 0;
    this.repDuration = 3.5; // seconds per rep
    this.repElapsed = 0; // seconds into current rep
    this.isPaused = false;
    this.currentWeight = 0; // kg

    // Completed sets log for this session
    this.completedSets = [];
  }

  start(programId) {
    this.program = appState.getProgram(programId);
    if (!this.program) {
      alert("Workout program not found.");
      this.onExit();
      return;
    }

    this.exerciseList = this.program.exerciseIds
      .map(id => appState.getExercise(id))
      .filter(Boolean);

    if (this.exerciseList.length === 0) {
      alert("No exercises in this workout routine.");
      this.onExit();
      return;
    }

    this.currentExIndex = 0;
    this.currentSet = 1;
    this.completedSets = [];
    this.workoutStartTime = Date.now();
    this.phase = (this.program.warmup && this.program.warmup.length > 0) ? 'WARMUP' : 'COUNTDOWN_5S';

    wakeLock.request();
    sounds.init();

    if (this.phase === 'COUNTDOWN_5S') {
      this.start5sCountdown();
    } else {
      this.render();
    }
  }

  cleanup() {
    if (this.activeTimer) {
      clearInterval(this.activeTimer);
      this.activeTimer = null;
    }
    wakeLock.release();
  }

  getCurrentExercise() {
    return this.exerciseList[this.currentExIndex];
  }

  // --- PHASE TRANSITIONS ---

  start5sCountdown() {
    this.cleanup();
    this.phase = 'COUNTDOWN_5S';
    this.countdownSeconds = 5;
    this.render();
    sounds.playCountdownTick();

    this.activeTimer = setInterval(() => {
      this.countdownSeconds--;
      if (this.countdownSeconds > 0) {
        sounds.playCountdownTick();
        this.render();
      } else {
        clearInterval(this.activeTimer);
        this.activeTimer = null;
        sounds.playGoTone();
        this.startActiveExercise();
      }
    }, 1000);
  }

  startActiveExercise() {
    this.cleanup();
    this.phase = 'ACTIVE';
    const ex = this.getCurrentExercise();
    this.totalSetsForCurrentEx = ex.targetSets || 3;
    this.currentWeight = ex.weight || 0;
    this.setStartTime = Date.now();
    this.activeDuration = 0;
    this.isPaused = false;

    if (ex.type === 'Isometric') {
      // Isometric hold countdown
      this.holdRemainingSeconds = ex.targetValue || 20;
      this.holdTotalSeconds = ex.targetValue || 20;
      this.render();

      this.activeTimer = setInterval(() => {
        if (this.isPaused) return;
        this.activeDuration += 0.2;
        this.holdRemainingSeconds = Math.max(0, this.holdTotalSeconds - this.activeDuration);

        // Sound cues for last 3 seconds
        if (Math.ceil(this.holdRemainingSeconds) <= 3 && Math.ceil(this.holdRemainingSeconds) > 0) {
          const sec = Math.ceil(this.holdRemainingSeconds);
          if (Math.abs(this.holdRemainingSeconds - sec) < 0.2) {
            sounds.playCountdownTick();
          }
        }

        if (this.holdRemainingSeconds <= 0) {
          this.completeSet();
        } else {
          this.updateActiveDisplay();
        }
      }, 200);
    } else {
      // Dynamic exercise with auto-pacer
      this.currentRep = 0;
      this.repDuration = ex.repDuration || 3.5;
      this.repElapsed = 0;
      this.targetReps = ex.targetValue || 10;
      this.render();

      this.activeTimer = setInterval(() => {
        if (this.isPaused) return;
        this.activeDuration += 0.1;
        this.repElapsed += 0.1;

        if (this.repElapsed >= this.repDuration) {
          this.currentRep++;
          this.repElapsed = 0;
          sounds.playRepTick();

          if (this.currentRep >= this.targetReps) {
            // Target reached!
            this.completeSet();
            return;
          }
        }
        this.updateActiveDisplay();
      }, 100);
    }
  }

  completeSet() {
    this.cleanup();
    const ex = this.getCurrentExercise();

    // Log this set
    const loggedReps = ex.type === 'Isometric' ? Math.round(this.activeDuration) : this.currentRep;
    this.completedSets.push({
      exerciseId: ex.id,
      exerciseName: ex.name,
      setIndex: this.currentSet,
      reps: loggedReps,
      weight: ex.weightTrackingEnabled ? this.currentWeight : 0,
      duration: Math.round(this.activeDuration)
    });

    sounds.playSetLogged();

    // Update exercise weight memory in appState
    if (ex.weightTrackingEnabled) {
      ex.weight = this.currentWeight;
      appState.saveExercise(ex);
    }

    // Check if more sets or more exercises
    if (this.currentSet < this.totalSetsForCurrentEx) {
      this.currentSet++;
      this.startRestTimer(ex.restInterval || 60);
    } else {
      // Move to next exercise
      if (this.currentExIndex < this.exerciseList.length - 1) {
        this.currentExIndex++;
        this.currentSet = 1;
        const nextEx = this.getCurrentExercise();
        this.startRestTimer(ex.restInterval || 90, nextEx);
      } else {
        // Routine completed!
        this.finishWorkout();
      }
    }
  }

  startRestTimer(seconds, nextEx = null) {
    this.cleanup();
    this.phase = 'REST';
    this.restRemainingSeconds = seconds;
    this.restTotalSeconds = seconds;
    this.render();

    this.activeTimer = setInterval(() => {
      this.restRemainingSeconds--;
      if (this.restRemainingSeconds <= 0) {
        this.cleanup();
        sounds.playRestFinished();
        this.start5sCountdown();
      } else {
        this.updateRestDisplay();
      }
    }, 1000);
  }

  finishWorkout() {
    this.cleanup();
    this.phase = 'SUMMARY';
    const totalDurationSeconds = Math.round((Date.now() - this.workoutStartTime) / 1000);

    // Save session to appState history
    appState.logWorkoutSession({
      programId: this.program.id,
      programName: this.program.name,
      totalDurationSeconds,
      completedSets: this.completedSets
    });

    this.render();
  }

  // --- RENDERING ---

  render() {
    this.container.innerHTML = '';

    if (this.phase === 'WARMUP') {
      this.renderWarmup();
    } else if (this.phase === 'COUNTDOWN_5S') {
      this.render5sCountdown();
    } else if (this.phase === 'ACTIVE') {
      this.renderActive();
    } else if (this.phase === 'REST') {
      this.renderRest();
    } else if (this.phase === 'SUMMARY') {
      this.renderSummary();
    }
  }

  renderWarmup() {
    const ex = this.getCurrentExercise();
    const html = `
      <div class="flex flex-col h-full bg-black text-white p-6 justify-between animate-fadeIn">
        <!-- Top bar -->
        <div class="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <span class="text-xs font-mono uppercase tracking-widest text-emerald-400">Pre-Workout Warmup</span>
            <h1 class="text-xl font-bold tracking-tight text-white mt-0.5">${this.program.name}</h1>
          </div>
          <button id="btn-quit" class="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800">
            Exit
          </button>
        </div>

        <!-- Warmup List -->
        <div class="my-auto py-4 space-y-4 max-w-md mx-auto w-full">
          <div class="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 shadow-2xl">
            <h2 class="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Recommended 3–4 Min Warmup
            </h2>
            <ul class="space-y-3">
              ${this.program.warmup.map((item, idx) => `
                <li class="flex items-start gap-3 text-zinc-200 text-base">
                  <span class="text-emerald-400 font-mono font-bold text-sm mt-0.5">${idx + 1}.</span>
                  <span>${item}</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <div class="text-center text-xs text-zinc-500">
            Up First: <span class="text-zinc-300 font-medium">${ex.name}</span> (${ex.targetSets} sets × ${ex.targetValue}${ex.type === 'Isometric' ? 's' : ' reps'})
          </div>
        </div>

        <!-- Bottom Action -->
        <div class="pt-4 max-w-md mx-auto w-full">
          <button id="btn-start-warmup-done" class="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 transition text-black font-black text-lg tracking-wide uppercase shadow-lg shadow-emerald-500/20">
            Start Workout
          </button>
        </div>
      </div>
    `;
    this.container.innerHTML = html;

    this.container.querySelector('#btn-quit').onclick = () => {
      if (confirm("Quit current workout?")) {
        this.cleanup();
        this.onExit();
      }
    };
    this.container.querySelector('#btn-start-warmup-done').onclick = () => {
      this.start5sCountdown();
    };
  }

  render5sCountdown() {
    const ex = this.getCurrentExercise();
    const html = `
      <div class="flex flex-col h-full bg-black text-white p-6 justify-between items-center text-center select-none">
        <!-- Top bar -->
        <div class="w-full flex justify-between items-center border-b border-zinc-900 pb-3">
          <span class="text-xs uppercase font-mono tracking-widest text-emerald-400">Get Ready</span>
          <button id="btn-quit" class="text-xs text-zinc-500 hover:text-zinc-300 py-1 px-2.5 bg-zinc-900 rounded-md">Cancel</button>
        </div>

        <!-- Center 5-4-3-2-1 -->
        <div class="my-auto flex flex-col items-center justify-center">
          <div class="text-zinc-400 text-sm font-medium tracking-wide uppercase mb-2">Set ${this.currentSet} of ${this.totalSetsForCurrentEx}</div>
          <h2 class="text-2xl font-bold text-white mb-8 px-4">${ex.name}</h2>
          
          <div class="relative flex items-center justify-center w-52 h-52 rounded-full border-4 border-zinc-800 bg-zinc-950/70 shadow-2xl">
            <span class="text-8xl font-black font-mono tracking-tighter text-emerald-400 scale-100 transition-all duration-300">
              ${this.countdownSeconds}
            </span>
          </div>

          <p class="text-xs text-zinc-400 mt-8 max-w-xs leading-relaxed italic">
            "${ex.cue || 'Stay tight, brace core and maintain full range of motion.'}"
          </p>
        </div>

        <!-- Quick Skip -->
        <div class="w-full max-w-xs">
          <button id="btn-skip-5s" class="w-full py-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white font-medium text-sm tracking-wider uppercase transition">
            Skip Countdown & Start
          </button>
        </div>
      </div>
    `;
    this.container.innerHTML = html;

    this.container.querySelector('#btn-quit').onclick = () => {
      this.cleanup();
      this.onExit();
    };
    this.container.querySelector('#btn-skip-5s').onclick = () => {
      sounds.playGoTone();
      this.startActiveExercise();
    };
  }

  renderActive() {
    const ex = this.getCurrentExercise();
    const isIsometric = ex.type === 'Isometric';

    const html = `
      <div class="flex flex-col h-full bg-black text-white p-5 justify-between select-none">
        <!-- Top bar info -->
        <div class="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ${ex.group}
              </span>
              <span class="text-xs font-mono text-zinc-400">
                Exercise ${this.currentExIndex + 1}/${this.exerciseList.length}
              </span>
            </div>
            <h1 class="text-xl font-black tracking-tight text-white mt-1">${ex.name}</h1>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-pause" class="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono">
              ${this.isPaused ? 'RESUME' : 'PAUSE'}
            </button>
            <button id="btn-quit" class="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-400 text-xs">
              ✕
            </button>
          </div>
        </div>

        <!-- Center Counter Display -->
        <div class="my-auto flex flex-col items-center justify-center py-2 max-w-md mx-auto w-full">
          <!-- Set badge -->
          <div class="text-zinc-400 text-sm font-semibold tracking-wider uppercase mb-3">
            Set <span class="text-emerald-400 font-bold">${this.currentSet}</span> of ${this.totalSetsForCurrentEx}
          </div>

          ${isIsometric ? `
            <!-- Isometric Hold Timer -->
            <div class="relative w-64 h-64 flex flex-col items-center justify-center rounded-full border-4 border-emerald-500/30 bg-zinc-950 shadow-2xl">
              <span id="active-hold-digits" class="text-7xl font-black font-mono text-emerald-400 tracking-tight">
                ${Math.ceil(this.holdRemainingSeconds)}s
              </span>
              <span class="text-xs uppercase font-mono tracking-widest text-zinc-400 mt-1">HOLD TARGET: ${ex.targetValue}s</span>
            </div>
          ` : `
            <!-- Dynamic Auto-Paced Rep Counter -->
            <div class="w-full flex flex-col items-center">
              <div class="relative w-64 h-64 flex flex-col items-center justify-center rounded-full border-4 border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
                <!-- Rep duration fill ring / pulse -->
                <div id="rep-progress-fill" class="absolute inset-0 bg-emerald-500/10 origin-bottom transition-all duration-100" style="height: 0%;"></div>

                <div class="relative z-10 flex flex-col items-center">
                  <span id="active-rep-count" class="text-8xl font-black font-mono tracking-tight text-white">
                    ${this.currentRep}
                  </span>
                  <span class="text-xs uppercase font-mono tracking-widest text-zinc-400 mt-1">
                    TARGET: <span class="text-zinc-200 font-bold">${this.targetReps} REPS</span>
                  </span>
                  <div class="mt-2 text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span id="rep-pace-indicator">Rep pace: ${this.repDuration}s</span>
                  </div>
                </div>
              </div>

              <!-- Manual Rep Adjustment Buttons -->
              <div class="flex items-center gap-3 mt-4">
                <button id="btn-rep-minus" class="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xl font-bold active:scale-95 transition">
                  -1
                </button>
                <span class="text-xs font-mono uppercase text-zinc-500 px-2">Tap to Adjust Reps</span>
                <button id="btn-rep-plus" class="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xl font-bold active:scale-95 transition">
                  +1
                </button>
              </div>
            </div>
          `}

          <!-- Weight Input Bar (Added weight / Dumbbells) -->
          <div class="mt-5 w-full bg-zinc-950 border border-zinc-800/90 rounded-2xl p-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-lg">⚖️</span>
              <div>
                <div class="text-xs font-semibold uppercase tracking-wider text-zinc-400">Weight (${appState.settings.weightUnit})</div>
                <div class="text-xs text-zinc-500">${ex.weightTrackingEnabled ? 'Added / Dumbbell' : 'Bodyweight'}</div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button id="btn-weight-minus" class="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold active:scale-90">-2.5</button>
              <input id="input-weight" type="number" step="0.5" min="0" value="${this.currentWeight}" class="w-16 bg-black border border-zinc-700 text-center font-mono font-bold text-white text-base py-1 rounded-lg focus:outline-none focus:border-emerald-500" />
              <button id="btn-weight-plus" class="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold active:scale-90">+2.5</button>
            </div>
          </div>

          <!-- Form cue reminder -->
          ${ex.cue ? `
            <div class="mt-3 text-center text-xs text-zinc-400 bg-zinc-900/50 border border-zinc-800/50 rounded-xl px-3 py-2 w-full">
              💡 <span class="italic text-zinc-300">${ex.cue}</span>
            </div>
          ` : ''}
        </div>

        <!-- Bottom Action: Finish Set -->
        <div class="pt-2 max-w-md mx-auto w-full">
          <button id="btn-complete-set" class="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 transition text-black font-black text-lg tracking-wide uppercase shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
            <span>Complete Set</span>
            <span class="text-xs bg-black/20 text-black px-2 py-0.5 rounded-full font-mono">Next ➔</span>
          </button>
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    // Attach listeners
    this.container.querySelector('#btn-quit').onclick = () => {
      if (confirm("Exit workout in progress?")) {
        this.cleanup();
        this.onExit();
      }
    };

    const btnPause = this.container.querySelector('#btn-pause');
    btnPause.onclick = () => {
      this.isPaused = !this.isPaused;
      btnPause.innerText = this.isPaused ? 'RESUME' : 'PAUSE';
      btnPause.className = this.isPaused 
        ? 'p-2 rounded-lg bg-emerald-500 text-black font-bold text-xs font-mono'
        : 'p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono';
    };

    this.container.querySelector('#btn-complete-set').onclick = () => {
      this.completeSet();
    };

    // Weight inputs
    const inputWeight = this.container.querySelector('#input-weight');
    inputWeight.onchange = (e) => {
      this.currentWeight = Math.max(0, parseFloat(e.target.value) || 0);
    };
    this.container.querySelector('#btn-weight-minus').onclick = () => {
      this.currentWeight = Math.max(0, this.currentWeight - 2.5);
      inputWeight.value = this.currentWeight;
    };
    this.container.querySelector('#btn-weight-plus').onclick = () => {
      this.currentWeight = this.currentWeight + 2.5;
      inputWeight.value = this.currentWeight;
    };

    // Dynamic rep adjusters
    if (!isIsometric) {
      this.container.querySelector('#btn-rep-minus').onclick = () => {
        this.currentRep = Math.max(0, this.currentRep - 1);
        const el = this.container.querySelector('#active-rep-count');
        if (el) el.innerText = this.currentRep;
      };
      this.container.querySelector('#btn-rep-plus').onclick = () => {
        this.currentRep++;
        const el = this.container.querySelector('#active-rep-count');
        if (el) el.innerText = this.currentRep;
      };
    }
  }

  updateActiveDisplay() {
    const ex = this.getCurrentExercise();
    if (ex.type === 'Isometric') {
      const el = this.container.querySelector('#active-hold-digits');
      if (el) el.innerText = `${Math.ceil(this.holdRemainingSeconds)}s`;
    } else {
      const repEl = this.container.querySelector('#active-rep-count');
      if (repEl) repEl.innerText = this.currentRep;

      const fillEl = this.container.querySelector('#rep-progress-fill');
      if (fillEl && this.repDuration > 0) {
        const pct = Math.min(100, (this.repElapsed / this.repDuration) * 100);
        fillEl.style.height = `${pct}%`;
      }
    }
  }

  renderRest() {
    const nextEx = this.getCurrentExercise();
    const isNewExercise = this.currentSet === 1;

    const html = `
      <div class="flex flex-col h-full bg-black text-white p-6 justify-between select-none">
        <!-- Top bar -->
        <div class="flex items-center justify-between border-b border-zinc-900 pb-3">
          <span class="text-xs uppercase font-mono tracking-widest text-emerald-400">Rest Interval</span>
          <button id="btn-quit" class="text-xs text-zinc-500 hover:text-zinc-300 py-1 px-2.5 bg-zinc-900 rounded-md">Quit</button>
        </div>

        <!-- Center: Big Rest Timer from CalisthenicsMemory -->
        <div class="my-auto flex flex-col items-center justify-center py-4">
          <!-- Big Circular Rest Timer -->
          <div class="relative w-72 h-72 flex flex-col items-center justify-center rounded-full border-4 border-zinc-800 bg-zinc-950 shadow-2xl">
            <span id="rest-digits" class="text-8xl font-black font-mono tracking-tighter text-white">
              ${this.formatTime(this.restRemainingSeconds)}
            </span>
            <span class="text-xs uppercase font-mono tracking-widest text-zinc-500 mt-2">REST & RECOVER</span>
          </div>

          <!-- Quick time adjust buttons -->
          <div class="flex items-center gap-3 mt-6">
            <button id="btn-rest-minus" class="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono font-bold active:scale-95">
              -15s
            </button>
            <button id="btn-rest-plus" class="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono font-bold active:scale-95">
              +15s
            </button>
            <button id="btn-rest-plus30" class="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono font-bold active:scale-95">
              +30s
            </button>
          </div>

          <!-- Up Next preview card -->
          <div class="mt-8 bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 w-full max-w-sm text-left">
            <div class="text-xs font-mono uppercase tracking-wider text-emerald-400">
              ${isNewExercise ? 'Next Exercise' : 'Next Set'}
            </div>
            <div class="text-base font-bold text-white mt-1">${nextEx.name}</div>
            <div class="text-xs text-zinc-400 mt-0.5">
              Set ${this.currentSet} of ${this.totalSetsForCurrentEx} • Target: ${nextEx.targetValue} ${nextEx.type === 'Isometric' ? 'seconds' : 'reps'}
              ${nextEx.weightTrackingEnabled && nextEx.weight > 0 ? `• ${nextEx.weight} ${appState.settings.weightUnit}` : ''}
            </div>
          </div>
        </div>

        <!-- Bottom Action: Skip Rest -->
        <div class="pt-2 max-w-md mx-auto w-full">
          <button id="btn-skip-rest" class="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-98 transition text-white font-bold text-base tracking-wide uppercase">
            Skip Rest (Start 5s Countdown)
          </button>
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    this.container.querySelector('#btn-quit').onclick = () => {
      if (confirm("Quit workout?")) {
        this.cleanup();
        this.onExit();
      }
    };
    this.container.querySelector('#btn-skip-rest').onclick = () => {
      this.cleanup();
      sounds.playRestFinished();
      this.start5sCountdown();
    };
    this.container.querySelector('#btn-rest-minus').onclick = () => {
      this.restRemainingSeconds = Math.max(5, this.restRemainingSeconds - 15);
      this.updateRestDisplay();
    };
    this.container.querySelector('#btn-rest-plus').onclick = () => {
      this.restRemainingSeconds += 15;
      this.updateRestDisplay();
    };
    this.container.querySelector('#btn-rest-plus30').onclick = () => {
      this.restRemainingSeconds += 30;
      this.updateRestDisplay();
    };
  }

  updateRestDisplay() {
    const el = this.container.querySelector('#rest-digits');
    if (el) {
      el.innerText = this.formatTime(this.restRemainingSeconds);
    }
  }

  renderSummary() {
    const totalDurationSeconds = Math.round((Date.now() - this.workoutStartTime) / 1000);
    const totalVolume = this.completedSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
    const totalReps = this.completedSets.reduce((sum, s) => sum + s.reps, 0);

    const html = `
      <div class="flex flex-col h-full bg-black text-white p-6 justify-between select-none animate-fadeIn">
        <div class="text-center pt-6">
          <div class="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <span class="text-4xl">🏆</span>
          </div>
          <span class="text-xs font-mono uppercase tracking-widest text-emerald-400">Workout Completed</span>
          <h1 class="text-2xl font-black text-white mt-1">${this.program.name}</h1>
          <p class="text-xs text-zinc-500 mt-1">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </div>

        <!-- Stats Grid -->
        <div class="my-auto grid grid-cols-2 gap-3 max-w-sm mx-auto w-full py-4">
          <div class="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 text-center">
            <div class="text-xs font-mono uppercase text-zinc-500">Duration</div>
            <div class="text-2xl font-black font-mono text-white mt-1">${this.formatMinutes(totalDurationSeconds)}</div>
          </div>
          <div class="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 text-center">
            <div class="text-xs font-mono uppercase text-zinc-500">Sets Finished</div>
            <div class="text-2xl font-black font-mono text-emerald-400 mt-1">${this.completedSets.length}</div>
          </div>
          <div class="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 text-center">
            <div class="text-xs font-mono uppercase text-zinc-500">Total Reps / Sec</div>
            <div class="text-2xl font-black font-mono text-white mt-1">${totalReps}</div>
          </div>
          <div class="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 text-center">
            <div class="text-xs font-mono uppercase text-zinc-500">Volume Moved</div>
            <div class="text-2xl font-black font-mono text-white mt-1">${totalVolume} ${appState.settings.weightUnit}</div>
          </div>
        </div>

        <!-- Completed Sets Breakdown -->
        <div class="max-w-sm mx-auto w-full max-h-40 overflow-y-auto space-y-1.5 pr-1">
          ${this.completedSets.map((s, idx) => `
            <div class="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-zinc-950 border border-zinc-900">
              <span class="text-zinc-300 font-medium truncate max-w-[180px]">${s.exerciseName} (Set ${s.setIndex})</span>
              <span class="font-mono text-zinc-400 font-semibold">${s.reps} reps ${s.weight > 0 ? `@ ${s.weight}kg` : ''}</span>
            </div>
          `).join('')}
        </div>

        <!-- Done Button -->
        <div class="pt-4 max-w-sm mx-auto w-full">
          <button id="btn-finish-summary" class="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 transition text-black font-black text-lg tracking-wide uppercase shadow-lg shadow-emerald-500/20">
            Done & Return to Routines
          </button>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.container.querySelector('#btn-finish-summary').onclick = () => {
      this.onExit();
    };
  }

  // --- HELPERS ---

  formatTime(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatMinutes(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${secs}s`;
  }
}
