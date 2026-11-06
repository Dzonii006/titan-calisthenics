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

    // Phases: 'WARMUP' | 'COUNTDOWN_5S' | 'ACTIVE' | 'CONFIRM_SET' | 'REST' | 'SUMMARY'
    this.phase = 'WARMUP';

    // Timers & intervals
    this.activeTimer = null;
    this.workoutStartTime = null;
    this.warmupTimer = null;
    this.warmupElapsedSeconds = 0;
    this.isWarmupPaused = false;

    // Countdown / Rest timers
    this.countdownSeconds = 5;
    this.is5sPaused = false;
    this.restRemainingSeconds = 60;
    this.restTotalSeconds = 60;
    this.isRestPaused = false;

    // Active exercise state
    this.activeDuration = 0; // seconds elapsed in set
    this.currentRep = 0;
    this.repDuration = 3.5; // seconds per rep
    this.repElapsed = 0;
    this.isPaused = false;
    this.currentWeight = 0; // kg

    // Confirmation state
    this.confirmedReps = 0;
    this.confirmedWeight = 0;

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
    this.warmupElapsedSeconds = 0;
    this.isWarmupPaused = false;
    this.is5sPaused = false;
    this.isRestPaused = false;
    this.isPaused = false;

    this.phase = (this.program.warmup && this.program.warmup.length > 0) ? 'WARMUP' : 'COUNTDOWN_5S';

    wakeLock.request();
    sounds.init();

    if (this.phase === 'WARMUP') {
      this.startWarmupTimer();
    } else {
      this.start5sCountdown();
    }
  }

  cleanup() {
    if (this.activeTimer) {
      clearInterval(this.activeTimer);
      this.activeTimer = null;
    }
    if (this.warmupTimer) {
      clearInterval(this.warmupTimer);
      this.warmupTimer = null;
    }
    wakeLock.release();
  }

  getCurrentExercise() {
    return this.exerciseList[this.currentExIndex];
  }

  // --- WARMUP ---
  startWarmupTimer() {
    this.cleanup();
    this.phase = 'WARMUP';
    this.warmupTimer = setInterval(() => {
      if (!this.isWarmupPaused) {
        this.warmupElapsedSeconds++;
        const el = this.container.querySelector('#warmup-timer-display');
        if (el) el.innerText = this.formatTime(this.warmupElapsedSeconds);
      }
    }, 1000);
    this.render();
  }

  // --- 5S COUNTDOWN ---
  start5sCountdown() {
    this.cleanup();
    this.phase = 'COUNTDOWN_5S';
    this.countdownSeconds = 5;
    this.is5sPaused = false;
    this.render();
    sounds.playCountdownTick();

    this.activeTimer = setInterval(() => {
      if (this.is5sPaused) return;

      this.countdownSeconds--;
      if (this.countdownSeconds > 0) {
        sounds.playCountdownTick();
        const digitEl = this.container.querySelector('#countdown-digit');
        if (digitEl) digitEl.innerText = this.countdownSeconds;
      } else {
        clearInterval(this.activeTimer);
        this.activeTimer = null;
        sounds.playGoTone();
        this.startActiveExercise();
      }
    }, 1000);
  }

  // --- ACTIVE EXERCISE ---
  startActiveExercise() {
    this.cleanup();
    this.phase = 'ACTIVE';
    const ex = this.getCurrentExercise();
    this.totalSetsForCurrentEx = ex.targetSets || 3;
    this.currentWeight = ex.weight || 0;
    this.activeDuration = 0;
    this.isPaused = false;

    if (ex.type === 'Isometric') {
      this.holdRemainingSeconds = ex.targetValue || 20;
      this.holdTotalSeconds = ex.targetValue || 20;
      this.render();

      this.activeTimer = setInterval(() => {
        if (this.isPaused) return;
        this.activeDuration += 0.2;
        this.holdRemainingSeconds = Math.max(0, this.holdTotalSeconds - this.activeDuration);

        if (Math.ceil(this.holdRemainingSeconds) <= 3 && Math.ceil(this.holdRemainingSeconds) > 0) {
          const sec = Math.ceil(this.holdRemainingSeconds);
          if (Math.abs(this.holdRemainingSeconds - sec) < 0.2) {
            sounds.playCountdownTick();
          }
        }

        if (this.holdRemainingSeconds <= 0) {
          this.promptSetConfirmation();
        } else {
          this.updateActiveDisplay();
        }
      }, 200);
    } else {
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
            this.promptSetConfirmation();
            return;
          }
        }
        this.updateActiveDisplay();
      }, 100);
    }
  }

  // --- PROMPT SET CONFIRMATION ---
  promptSetConfirmation() {
    this.cleanup();
    this.phase = 'CONFIRM_SET';
    const ex = this.getCurrentExercise();

    this.confirmedReps = ex.type === 'Isometric' ? Math.round(this.activeDuration) : this.currentRep;
    this.confirmedWeight = this.currentWeight;

    this.render();
  }

  confirmAndFinishSet() {
    const ex = this.getCurrentExercise();

    // Log this set
    this.completedSets.push({
      exerciseId: ex.id,
      exerciseName: ex.name,
      setIndex: this.currentSet,
      reps: this.confirmedReps,
      weight: ex.weightTrackingEnabled ? this.confirmedWeight : 0,
      duration: Math.round(this.activeDuration)
    });

    sounds.playSetLogged();

    // Update weight memory
    if (ex.weightTrackingEnabled) {
      ex.weight = this.confirmedWeight;
      this.currentWeight = this.confirmedWeight;
      appState.saveExercise(ex);
    }

    // Check if more sets or more exercises
    if (this.currentSet < this.totalSetsForCurrentEx) {
      this.currentSet++;
      this.startRestTimer(ex.restInterval || 60);
    } else {
      if (this.currentExIndex < this.exerciseList.length - 1) {
        this.currentExIndex++;
        this.currentSet = 1;
        this.startRestTimer(ex.restInterval || 90);
      } else {
        this.finishWorkout();
      }
    }
  }

  // --- REST TIMER ---
  startRestTimer(seconds) {
    this.cleanup();
    this.phase = 'REST';
    this.restRemainingSeconds = seconds;
    this.restTotalSeconds = seconds;
    this.isRestPaused = false;
    this.render();

    this.activeTimer = setInterval(() => {
      if (this.isRestPaused) return;

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

    appState.logWorkoutSession({
      programId: this.program.id,
      programName: this.program.name,
      totalDurationSeconds,
      completedSets: this.completedSets
    });

    this.render();
  }

  // --- RENDERING VIEWS ---

  render() {
    this.container.innerHTML = '';

    if (this.phase === 'WARMUP') {
      this.renderWarmup();
    } else if (this.phase === 'COUNTDOWN_5S') {
      this.render5sCountdown();
    } else if (this.phase === 'ACTIVE') {
      this.renderActive();
    } else if (this.phase === 'CONFIRM_SET') {
      this.renderConfirmSet();
    } else if (this.phase === 'REST') {
      this.renderRest();
    } else if (this.phase === 'SUMMARY') {
      this.renderSummary();
    }
  }

  renderWarmup() {
    const ex = this.getCurrentExercise();
    const html = `
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-6 justify-between select-none animate-fadeIn">
        <!-- Top bar -->
        <div class="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div>
            <span class="text-[11px] font-mono uppercase tracking-widest text-zinc-400">Pre-Workout Warmup</span>
            <h1 class="text-xl font-bold tracking-tight text-white mt-0.5">${this.program.name}</h1>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-pause-warmup" class="px-3 py-1.5 rounded-lg text-xs font-mono font-medium ${this.isWarmupPaused ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'}">
              ${this.isWarmupPaused ? 'Resume' : 'Pause'}
            </button>
            <button id="btn-quit" class="px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-400 hover:text-white bg-zinc-800/60 border border-zinc-700/60">
              Exit
            </button>
          </div>
        </div>

        <!-- Timer & Warmup list -->
        <div class="my-auto py-4 space-y-4 max-w-md mx-auto w-full">
          <!-- Stopwatch header -->
          <div class="text-center py-2">
            <span id="warmup-timer-display" class="text-4xl font-mono font-bold tracking-tight text-zinc-200">
              ${this.formatTime(this.warmupElapsedSeconds)}
            </span>
            <div class="text-[11px] font-mono text-zinc-400 mt-1 uppercase tracking-wider">
              ${this.isWarmupPaused ? 'Warmup Paused' : 'Elapsed Warmup Time'}
            </div>
          </div>

          <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div class="text-xs font-semibold text-zinc-300 uppercase tracking-wider pb-1 border-b border-zinc-800/60">
              Target Movements (3–4 min)
            </div>
            <ul class="space-y-3 pt-1">
              ${this.program.warmup.map((item, idx) => `
                <li class="flex items-start gap-3 text-sm text-zinc-200">
                  <span class="font-mono text-xs font-bold text-zinc-400 mt-0.5">${idx + 1}.</span>
                  <span>${item}</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <div class="text-center text-xs text-zinc-400">
            First up: <span class="text-zinc-200 font-semibold">${ex.name}</span> (${ex.targetSets} sets × ${ex.targetValue}${ex.type === 'Isometric' ? 's' : ' reps'})
          </div>
        </div>

        <!-- Action: Start Workout -->
        <div class="pt-4 max-w-md mx-auto w-full">
          <button id="btn-warmup-done" class="w-full py-4 rounded-xl bg-white hover:bg-zinc-200 active:scale-98 transition text-black font-bold text-base tracking-wide uppercase">
            Start First Exercise
          </button>
        </div>
      </div>
    `;
    this.container.innerHTML = html;

    this.container.querySelector('#btn-quit').onclick = () => {
      if (confirm("Exit workout?")) {
        this.cleanup();
        this.onExit();
      }
    };

    this.container.querySelector('#btn-pause-warmup').onclick = () => {
      this.isWarmupPaused = !this.isWarmupPaused;
      this.render();
    };

    this.container.querySelector('#btn-warmup-done').onclick = () => {
      if (this.warmupTimer) clearInterval(this.warmupTimer);
      this.start5sCountdown();
    };
  }

  render5sCountdown() {
    const ex = this.getCurrentExercise();
    const html = `
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-6 justify-between items-center text-center select-none animate-fadeIn">
        <!-- Top bar with Pause & Cancel -->
        <div class="w-full flex justify-between items-center border-b border-zinc-800/80 pb-3">
          <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400">Get Ready</span>
          <div class="flex items-center gap-2">
            <button id="btn-pause-5s" class="text-xs font-mono py-1 px-3 rounded-lg ${this.is5sPaused ? 'bg-white text-black font-semibold' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'}">
              ${this.is5sPaused ? 'Resume' : 'Pause'}
            </button>
            <button id="btn-quit" class="text-xs font-mono text-zinc-400 hover:text-white py-1 px-3 bg-zinc-800/60 border border-zinc-700/60 rounded-lg">
              Exit
            </button>
          </div>
        </div>

        <!-- Center 5-4-3-2-1 -->
        <div class="my-auto flex flex-col items-center justify-center">
          <div class="text-zinc-400 text-xs font-medium tracking-wider uppercase mb-2">
            Set ${this.currentSet} of ${this.totalSetsForCurrentEx}
          </div>
          <h2 class="text-2xl font-bold text-white mb-8 px-4 tracking-tight">${ex.name}</h2>
          
          <div class="relative flex items-center justify-center w-52 h-52 rounded-full border border-zinc-700 bg-[#18181b] shadow-inner">
            <span id="countdown-digit" class="text-8xl font-mono font-bold text-white tracking-tighter">
              ${this.countdownSeconds}
            </span>
          </div>

          ${this.is5sPaused ? `
            <div class="mt-4 text-xs font-mono uppercase tracking-wider text-zinc-400">
              Countdown Paused
            </div>
          ` : ''}

          <p class="text-xs text-zinc-400 mt-6 max-w-xs leading-relaxed italic">
            "${ex.cue || 'Stay tight, brace core and control your reps.'}"
          </p>
        </div>

        <!-- Quick Skip -->
        <div class="w-full max-w-xs">
          <button id="btn-skip-5s" class="w-full py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-medium text-xs tracking-wider uppercase transition">
            Skip Countdown & Begin
          </button>
        </div>
      </div>
    `;
    this.container.innerHTML = html;

    this.container.querySelector('#btn-quit').onclick = () => {
      this.cleanup();
      this.onExit();
    };

    this.container.querySelector('#btn-pause-5s').onclick = () => {
      this.is5sPaused = !this.is5sPaused;
      this.render();
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
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-5 justify-between select-none animate-fadeIn">
        <!-- Top bar -->
        <div class="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/80 font-medium">
                ${ex.group}
              </span>
              <span class="text-[11px] font-mono text-zinc-400">
                Exercise ${this.currentExIndex + 1}/${this.exerciseList.length}
              </span>
            </div>
            <h1 class="text-xl font-bold tracking-tight text-white mt-1">${ex.name}</h1>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-pause" class="px-3 py-1.5 rounded-lg ${this.isPaused ? 'bg-white text-black font-semibold' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'} text-xs font-mono">
              ${this.isPaused ? 'Resume' : 'Pause'}
            </button>
            <button id="btn-quit" class="p-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-zinc-400 hover:text-white text-xs">
              ✕
            </button>
          </div>
        </div>

        <!-- Center Counter Display -->
        <div class="my-auto flex flex-col items-center justify-center py-2 max-w-md mx-auto w-full">
          <div class="text-zinc-400 text-xs font-medium tracking-wider uppercase mb-3">
            Set <span class="text-white font-bold">${this.currentSet}</span> of ${this.totalSetsForCurrentEx}
          </div>

          ${isIsometric ? `
            <!-- Isometric Hold Timer -->
            <div class="relative w-64 h-64 flex flex-col items-center justify-center rounded-full border border-zinc-700 bg-[#18181b] shadow-sm">
              <span id="active-hold-digits" class="text-7xl font-mono font-bold text-white tracking-tight">
                ${Math.ceil(this.holdRemainingSeconds)}s
              </span>
              <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400 mt-2">Target Hold: ${ex.targetValue}s</span>
            </div>
          ` : `
            <!-- Dynamic Auto-Paced Rep Counter -->
            <div class="w-full flex flex-col items-center">
              <div class="relative w-64 h-64 flex flex-col items-center justify-center rounded-full border border-zinc-700 bg-[#18181b] shadow-sm overflow-hidden">
                <!-- Rep duration fill bar -->
                <div id="rep-progress-fill" class="absolute inset-x-0 bottom-0 bg-zinc-700/30 transition-all duration-100" style="height: 0%;"></div>

                <div class="relative z-10 flex flex-col items-center">
                  <span id="active-rep-count" class="text-8xl font-mono font-bold tracking-tight text-white">
                    ${this.currentRep}
                  </span>
                  <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400 mt-1">
                    Target: <span class="text-zinc-200 font-semibold">${this.targetReps} reps</span>
                  </span>
                  <div class="mt-2 text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full ${this.isPaused ? 'bg-zinc-600' : 'bg-white animate-pulse'}"></span>
                    <span id="rep-pace-indicator">${this.isPaused ? 'Paused' : `Tempo: ${this.repDuration}s / rep`}</span>
                  </div>
                </div>
              </div>

              <!-- Manual Rep Adjustment Buttons -->
              <div class="flex items-center gap-3 mt-4">
                <button id="btn-rep-minus" class="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xl font-bold active:scale-95 transition">
                  -1
                </button>
                <span class="text-xs font-mono uppercase text-zinc-400 px-2">Adjust Reps</span>
                <button id="btn-rep-plus" class="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xl font-bold active:scale-95 transition">
                  +1
                </button>
              </div>
            </div>
          `}

          <!-- Weight Input Bar -->
          <div class="mt-5 w-full bg-[#18181b] border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div class="text-xs font-medium uppercase tracking-wider text-zinc-300">Weight (${appState.settings.weightUnit})</div>
              <div class="text-[11px] text-zinc-500">${ex.weightTrackingEnabled ? 'Added / Dumbbell' : 'Bodyweight'}</div>
            </div>

            <div class="flex items-center gap-2">
              <button id="btn-weight-minus" class="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold active:scale-95 text-xs">-2.5</button>
              <input id="input-weight" type="number" step="0.5" min="0" value="${this.currentWeight}" class="w-16 bg-[#121214] border border-zinc-700 text-center font-mono font-semibold text-white text-sm py-1 rounded-lg focus:outline-none focus:border-zinc-500" />
              <button id="btn-weight-plus" class="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold active:scale-95 text-xs">+2.5</button>
            </div>
          </div>

          <!-- Form cue reminder -->
          ${ex.cue ? `
            <div class="mt-3 text-center text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-3 py-2 w-full leading-relaxed">
              <span class="text-zinc-300 font-medium">Form Cue:</span> <span>${ex.cue}</span>
            </div>
          ` : ''}
        </div>

        <!-- Bottom Action: Finish Set -->
        <div class="pt-2 max-w-md mx-auto w-full">
          <button id="btn-complete-set" class="w-full py-4 rounded-xl bg-white hover:bg-zinc-200 active:scale-98 transition text-black font-bold text-base tracking-wide uppercase">
            Complete Set
          </button>
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    this.container.querySelector('#btn-quit').onclick = () => {
      if (confirm("Exit workout?")) {
        this.cleanup();
        this.onExit();
      }
    };

    const btnPause = this.container.querySelector('#btn-pause');
    btnPause.onclick = () => {
      this.isPaused = !this.isPaused;
      this.render();
    };

    this.container.querySelector('#btn-complete-set').onclick = () => {
      this.promptSetConfirmation();
    };

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

  // --- CONFIRM SET DIALOG (Clean, focused) ---
  renderConfirmSet() {
    const ex = this.getCurrentExercise();
    const isIsometric = ex.type === 'Isometric';

    const html = `
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-6 justify-between select-none animate-fadeIn">
        <!-- Top bar -->
        <div class="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400">Confirm Results</span>
          <button id="btn-cancel-confirm" class="text-xs font-mono text-zinc-400 hover:text-white py-1 px-3 bg-zinc-800 border border-zinc-700 rounded-lg">
            Resume Set
          </button>
        </div>

        <!-- Center Confirm Card -->
        <div class="my-auto max-w-sm mx-auto w-full space-y-6">
          <div class="text-center">
            <span class="text-xs font-mono uppercase tracking-wider text-zinc-400">Set ${this.currentSet} of ${this.totalSetsForCurrentEx} Completed</span>
            <h2 class="text-2xl font-bold text-white mt-1">${ex.name}</h2>
          </div>

          <!-- Reps / Hold Seconds Confirm -->
          <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-5 text-center space-y-3">
            <div class="text-xs font-mono uppercase tracking-wider text-zinc-400">
              ${isIsometric ? 'Hold Duration (seconds)' : 'Completed Reps'}
            </div>

            <div class="flex items-center justify-center gap-4">
              <button id="btn-confirm-minus" class="w-14 h-14 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-2xl font-bold active:scale-95 transition">
                -
              </button>
              <div class="w-28 text-center">
                <span id="confirm-rep-val" class="text-5xl font-mono font-bold text-white tracking-tight">
                  ${this.confirmedReps}
                </span>
                <span class="block text-xs font-mono text-zinc-400 mt-1">
                  Target: ${ex.targetValue}${isIsometric ? 's' : ''}
                </span>
              </div>
              <button id="btn-confirm-plus" class="w-14 h-14 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-2xl font-bold active:scale-95 transition">
                +
              </button>
            </div>
          </div>

          <!-- Weight Confirm (if enabled) -->
          <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div class="text-xs font-medium text-zinc-300 uppercase tracking-wider">Weight Used</div>
              <div class="text-[11px] text-zinc-500">${appState.settings.weightUnit}</div>
            </div>

            <div class="flex items-center gap-2">
              <button id="btn-confirm-weight-minus" class="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-xs active:scale-95">-2.5</button>
              <input id="input-confirm-weight" type="number" step="0.5" min="0" value="${this.confirmedWeight}" class="w-16 bg-[#121214] border border-zinc-700 text-center font-mono font-semibold text-white text-sm py-1.5 rounded-lg focus:outline-none" />
              <button id="btn-confirm-weight-plus" class="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-xs active:scale-95">+2.5</button>
            </div>
          </div>
        </div>

        <!-- Action Button -->
        <div class="pt-4 max-w-sm mx-auto w-full">
          <button id="btn-confirm-save" class="w-full py-4 rounded-xl bg-white hover:bg-zinc-200 active:scale-98 transition text-black font-bold text-base tracking-wide uppercase">
            Confirm & Start Rest (${ex.restInterval || 60}s)
          </button>
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    const repValEl = this.container.querySelector('#confirm-rep-val');
    this.container.querySelector('#btn-confirm-minus').onclick = () => {
      this.confirmedReps = Math.max(0, this.confirmedReps - 1);
      repValEl.innerText = this.confirmedReps;
    };
    this.container.querySelector('#btn-confirm-plus').onclick = () => {
      this.confirmedReps++;
      repValEl.innerText = this.confirmedReps;
    };

    const inputWeight = this.container.querySelector('#input-confirm-weight');
    inputWeight.onchange = (e) => {
      this.confirmedWeight = Math.max(0, parseFloat(e.target.value) || 0);
    };
    this.container.querySelector('#btn-confirm-weight-minus').onclick = () => {
      this.confirmedWeight = Math.max(0, this.confirmedWeight - 2.5);
      inputWeight.value = this.confirmedWeight;
    };
    this.container.querySelector('#btn-confirm-weight-plus').onclick = () => {
      this.confirmedWeight = this.confirmedWeight + 2.5;
      inputWeight.value = this.confirmedWeight;
    };

    this.container.querySelector('#btn-cancel-confirm').onclick = () => {
      this.phase = 'ACTIVE';
      this.render();
    };

    this.container.querySelector('#btn-confirm-save').onclick = () => {
      this.confirmAndFinishSet();
    };
  }

  // --- REST VIEW ---
  renderRest() {
    const nextEx = this.getCurrentExercise();
    const isNewExercise = this.currentSet === 1;

    const html = `
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-6 justify-between select-none animate-fadeIn">
        <!-- Top bar with Pause & Quit -->
        <div class="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400">Rest Period</span>
          <div class="flex items-center gap-2">
            <button id="btn-pause-rest" class="text-xs font-mono py-1 px-3 rounded-lg ${this.isRestPaused ? 'bg-white text-black font-semibold' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'}">
              ${this.isRestPaused ? 'Resume' : 'Pause'}
            </button>
            <button id="btn-quit" class="text-xs font-mono text-zinc-400 hover:text-white py-1 px-3 bg-zinc-800/60 border border-zinc-700/60 rounded-lg">
              Exit
            </button>
          </div>
        </div>

        <!-- Big Rest Timer -->
        <div class="my-auto flex flex-col items-center justify-center py-4">
          <div class="relative w-72 h-72 flex flex-col items-center justify-center rounded-full border border-zinc-700 bg-[#18181b] shadow-sm">
            <span id="rest-digits" class="text-8xl font-mono font-bold tracking-tighter text-white">
              ${this.formatTime(this.restRemainingSeconds)}
            </span>
            <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400 mt-2">
              ${this.isRestPaused ? 'Rest Paused' : 'Recovery Timer'}
            </span>
          </div>

          <!-- Adjust buttons -->
          <div class="flex items-center gap-2.5 mt-6">
            <button id="btn-rest-minus" class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono font-medium active:scale-95">
              -15s
            </button>
            <button id="btn-rest-plus" class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono font-medium active:scale-95">
              +15s
            </button>
            <button id="btn-rest-plus30" class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono font-medium active:scale-95">
              +30s
            </button>
          </div>

          <!-- Up Next card -->
          <div class="mt-8 bg-[#18181b] border border-zinc-800 rounded-2xl p-4 w-full max-w-sm text-left">
            <div class="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              ${isNewExercise ? 'Next Exercise' : 'Next Set'}
            </div>
            <div class="text-base font-bold text-white mt-1">${nextEx.name}</div>
            <div class="text-xs text-zinc-400 mt-0.5 font-mono">
              Set ${this.currentSet} of ${this.totalSetsForCurrentEx} • Target: ${nextEx.targetValue}${nextEx.type === 'Isometric' ? 's' : ' reps'}
              ${nextEx.weightTrackingEnabled && nextEx.weight > 0 ? `• ${nextEx.weight} ${appState.settings.weightUnit}` : ''}
            </div>
          </div>
        </div>

        <!-- Action: Skip Rest -->
        <div class="pt-2 max-w-md mx-auto w-full">
          <button id="btn-skip-rest" class="w-full py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-bold text-sm tracking-wide uppercase active:scale-98 transition">
            Skip Rest ➔ Start 5s
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
    this.container.querySelector('#btn-pause-rest').onclick = () => {
      this.isRestPaused = !this.isRestPaused;
      this.render();
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

  // --- SUMMARY VIEW ---
  renderSummary() {
    const totalDurationSeconds = Math.round((Date.now() - this.workoutStartTime) / 1000);
    const totalVolume = this.completedSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
    const totalReps = this.completedSets.reduce((sum, s) => sum + s.reps, 0);

    const html = `
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-6 justify-between select-none animate-fadeIn">
        <div class="text-center pt-6">
          <span class="text-[11px] font-mono uppercase tracking-widest text-zinc-400">Workout Completed</span>
          <h1 class="text-2xl font-bold tracking-tight text-white mt-1">${this.program.name}</h1>
          <p class="text-xs text-zinc-500 mt-1">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </div>

        <!-- Stats Grid -->
        <div class="my-auto grid grid-cols-2 gap-3 max-w-sm mx-auto w-full py-4">
          <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-4 text-center">
            <div class="text-[11px] font-mono uppercase text-zinc-400">Duration</div>
            <div class="text-2xl font-mono font-bold text-white mt-1">${this.formatMinutes(totalDurationSeconds)}</div>
          </div>
          <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-4 text-center">
            <div class="text-[11px] font-mono uppercase text-zinc-400">Completed Sets</div>
            <div class="text-2xl font-mono font-bold text-white mt-1">${this.completedSets.length}</div>
          </div>
          <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-4 text-center">
            <div class="text-[11px] font-mono uppercase text-zinc-400">Total Reps</div>
            <div class="text-2xl font-mono font-bold text-white mt-1">${totalReps}</div>
          </div>
          <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-4 text-center">
            <div class="text-[11px] font-mono uppercase text-zinc-400">Volume Moved</div>
            <div class="text-2xl font-mono font-bold text-white mt-1">${totalVolume} ${appState.settings.weightUnit}</div>
          </div>
        </div>

        <!-- Sets list -->
        <div class="max-w-sm mx-auto w-full max-h-40 overflow-y-auto space-y-1.5 pr-1">
          ${this.completedSets.map((s) => `
            <div class="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-[#18181b] border border-zinc-800/80">
              <span class="text-zinc-200 font-medium truncate max-w-[180px]">${s.exerciseName} (Set ${s.setIndex})</span>
              <span class="font-mono text-zinc-400">${s.reps} reps ${s.weight > 0 ? `@ ${s.weight}kg` : ''}</span>
            </div>
          `).join('')}
        </div>

        <!-- Done Button -->
        <div class="pt-4 max-w-sm mx-auto w-full">
          <button id="btn-finish-summary" class="w-full py-4 rounded-xl bg-white hover:bg-zinc-200 active:scale-98 transition text-black font-bold text-base tracking-wide uppercase">
            Finish & Return to Routines
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
