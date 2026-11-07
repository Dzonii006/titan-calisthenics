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

    // Phases: 'WARMUP' | 'COUNTDOWN_5S' | 'ACTIVE' | 'CONFIRM_SET' | 'REST' | 'OVERVIEW' | 'SUMMARY'
    this.phase = 'WARMUP';
    this.previousPhase = 'ACTIVE';

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
      console.warn("Workout program not found.");
      this.onExit();
      return;
    }

    this.exerciseList = this.program.exerciseIds
      .map(id => appState.getExercise(id))
      .filter(Boolean);

    if (this.exerciseList.length === 0) {
      console.warn("No exercises in this workout routine.");
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
          sounds.playSetFinished();
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
            sounds.playSetFinished();
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

    this.completedSets.push({
      exerciseId: ex.id,
      exerciseName: ex.name,
      setIndex: this.currentSet,
      reps: this.confirmedReps,
      weight: ex.weightTrackingEnabled ? this.confirmedWeight : 0,
      duration: Math.round(this.activeDuration)
    });

    sounds.playSetLogged();

    if (ex.weightTrackingEnabled) {
      ex.weight = this.confirmedWeight;
      this.currentWeight = this.confirmedWeight;
      appState.saveExercise(ex);
    }

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
    // Avoid innerHTML = '' to eliminate black flash
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
    } else if (this.phase === 'OVERVIEW') {
      this.renderOverview();
    } else if (this.phase === 'SUMMARY') {
      this.renderSummary();
    }
  }

  renderWarmup() {
    const ex = this.getCurrentExercise();
    const html = `
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-6 justify-between select-none">
        <!-- Top bar -->
        <div class="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div>
            <span class="text-[11px] font-mono uppercase tracking-widest text-zinc-400">Pre-Workout Warmup</span>
            <h1 class="text-xl font-bold tracking-tight text-white mt-0.5">${this.program.name}</h1>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-workout-overview" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono active:scale-95 transition">
              <svg class="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
              <span>Overview</span>
            </button>
            <button id="btn-quit" class="px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-400 hover:text-white bg-zinc-800/60 border border-zinc-700/60">
              Exit
            </button>
          </div>
        </div>

        <!-- Timer & Warmup list -->
        <div class="my-auto py-4 space-y-4 max-w-md mx-auto w-full">
          <!-- Stopwatch header (clickable to pause) -->
          <div id="warmup-timer-card" class="text-center py-2 cursor-pointer active:scale-98 transition">
            <span id="warmup-timer-display" class="text-4xl font-mono font-bold tracking-tight text-zinc-200">
              ${this.formatTime(this.warmupElapsedSeconds)}
            </span>
            <div class="text-[11px] font-mono text-zinc-400 mt-1 uppercase tracking-wider">
              ${this.isWarmupPaused ? 'Paused • Tap to Resume' : 'Warmup Elapsed • Tap to Pause'}
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
      this.showExitModal();
    };

    const btnOverview = this.container.querySelector('#btn-workout-overview');
    if (btnOverview) {
      btnOverview.onclick = () => this.openOverview();
    }

    const toggleWarmupPause = () => {
      this.isWarmupPaused = !this.isWarmupPaused;
      this.render();
    };
    this.container.querySelector('#warmup-timer-card').onclick = toggleWarmupPause;

    this.container.querySelector('#btn-warmup-done').onclick = () => {
      if (this.warmupTimer) clearInterval(this.warmupTimer);
      this.start5sCountdown();
    };
  }

  render5sCountdown() {
    const ex = this.getCurrentExercise();
    const html = `
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-6 justify-between items-center text-center select-none">
        <!-- Top bar with Cancel -->
        <div class="w-full flex justify-between items-center border-b border-zinc-800/80 pb-3">
          <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400">Get Ready</span>
          <div class="flex items-center gap-2">
            <button id="btn-workout-overview" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono active:scale-95 transition">
              <svg class="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
              <span>Overview</span>
            </button>
            <button id="btn-quit" class="text-xs font-mono text-zinc-400 hover:text-white py-1 px-3 bg-zinc-800/60 border border-zinc-700/60 rounded-lg">
              Exit
            </button>
          </div>
        </div>

        <!-- Center 5-4-3-2-1 (Clickable to pause/resume) -->
        <div class="my-auto flex flex-col items-center justify-center">
          <div class="text-zinc-400 text-xs font-medium tracking-wider uppercase mb-2">
            Set ${this.currentSet} of ${this.totalSetsForCurrentEx}
          </div>
          <h2 class="text-2xl font-bold text-white mb-6 px-4 tracking-tight">${ex.name}</h2>
          
          <!-- Tap on timer to pause/resume -->
          <div id="timer-circle-5s" class="relative flex flex-col items-center justify-center w-56 h-56 rounded-full border-2 ${this.is5sPaused ? 'border-zinc-500 bg-[#202024]' : 'border-zinc-700 bg-[#18181b]'} cursor-pointer active:scale-95 transition shadow-lg">
            <span id="countdown-digit" class="text-8xl font-mono font-bold text-white tracking-tighter">
              ${this.countdownSeconds}
            </span>
            <span class="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mt-1">
              ${this.is5sPaused ? 'Paused • Tap to resume' : 'Tap to pause'}
            </span>
          </div>

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
      this.showExitModal();
    };

    const btnOverview = this.container.querySelector('#btn-workout-overview');
    if (btnOverview) {
      btnOverview.onclick = () => this.openOverview();
    }

    const toggle5sPause = () => {
      this.is5sPaused = !this.is5sPaused;
      this.render();
    };
    this.container.querySelector('#timer-circle-5s').onclick = toggle5sPause;

    this.container.querySelector('#btn-skip-5s').onclick = () => {
      sounds.playGoTone();
      this.startActiveExercise();
    };
  }

  renderActive() {
    const ex = this.getCurrentExercise();
    const isIsometric = ex.type === 'Isometric';

    const html = `
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-5 justify-between select-none">
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
            <button id="btn-workout-overview" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono active:scale-95 transition">
              <svg class="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
              <span>Overview</span>
            </button>
            <button id="btn-quit" class="p-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-zinc-400 hover:text-white text-xs">
              ✕
            </button>
          </div>
        </div>

        <!-- Center Counter Display -->
        <div class="my-auto flex flex-col items-center justify-center py-2 max-w-md mx-auto w-full">
          <div class="text-zinc-400 text-xs font-medium tracking-wider uppercase mb-2">
            Set <span class="text-white font-bold">${this.currentSet}</span> of ${this.totalSetsForCurrentEx}
          </div>

          ${isIsometric ? `
            <!-- Isometric Hold Timer (Tap to Pause) -->
            <div id="timer-circle-active" class="relative w-64 h-64 flex flex-col items-center justify-center rounded-full border-2 ${this.isPaused ? 'border-zinc-500 bg-[#202024]' : 'border-zinc-700 bg-[#18181b]'} cursor-pointer active:scale-95 transition shadow-sm">
              <svg class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 256 256">
                <circle cx="128" cy="128" r="114" stroke="#27272a" stroke-width="8" fill="none" />
                <circle id="hold-progress-svg" cx="128" cy="128" r="114" stroke="#ffffff" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="716.28" stroke-dashoffset="0" class="transition-all duration-200" />
              </svg>

              <div class="relative z-10 flex flex-col items-center">
                <span id="active-hold-digits" class="text-7xl font-mono font-bold text-white tracking-tight">
                  ${Math.ceil(this.holdRemainingSeconds)}s
                </span>
                <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400 mt-1">
                  ${this.isPaused ? 'Paused • Tap to resume' : `Target: ${ex.targetValue}s`}
                </span>
              </div>
            </div>
          ` : `
            <!-- Dynamic Auto-Paced Rep Counter with High-Contrast SVG Ring (Tap to Pause) -->
            <div class="w-full flex flex-col items-center">
              <div id="timer-circle-active" class="relative w-64 h-64 flex flex-col items-center justify-center rounded-full bg-[#18181b] cursor-pointer active:scale-95 transition shadow-sm overflow-hidden border border-zinc-800">
                <!-- High Contrast SVG Progress Ring (Issue #5 fix) -->
                <svg class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 256 256">
                  <!-- Track -->
                  <circle cx="128" cy="128" r="114" stroke="#27272a" stroke-width="8" fill="none" />
                  <!-- High-contrast bright white stroke for rep progress -->
                  <circle id="rep-progress-svg" cx="128" cy="128" r="114" stroke="#ffffff" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="716.28" stroke-dashoffset="716.28" class="transition-all duration-100" />
                </svg>

                <div class="relative z-10 flex flex-col items-center">
                  <span id="active-rep-count" class="text-8xl font-mono font-bold tracking-tight text-white">
                    ${this.currentRep}
                  </span>
                  <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400 mt-1">
                    Target: <span class="text-zinc-200 font-semibold">${this.targetReps} reps</span>
                  </span>
                  <div class="mt-2 text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full ${this.isPaused ? 'bg-zinc-500' : 'bg-white animate-pulse'}"></span>
                    <span id="rep-pace-indicator">${this.isPaused ? 'Paused • Tap to resume' : `Tempo: ${this.repDuration}s / rep`}</span>
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
          <div class="mt-4 w-full bg-[#18181b] border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between">
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
            <div class="mt-2.5 text-center text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-3 py-2 w-full leading-relaxed">
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
      this.showExitModal();
    };

    const btnOverview = this.container.querySelector('#btn-workout-overview');
    if (btnOverview) {
      btnOverview.onclick = () => this.openOverview();
    }

    const toggleActivePause = () => {
      this.isPaused = !this.isPaused;
      this.render();
    };

    const timerCircle = this.container.querySelector('#timer-circle-active');
    if (timerCircle) timerCircle.onclick = toggleActivePause;

    this.container.querySelector('#btn-complete-set').onclick = () => {
      sounds.playSetFinished();
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
    const circumference = 716.28;

    if (ex.type === 'Isometric') {
      const el = this.container.querySelector('#active-hold-digits');
      if (el) el.innerText = `${Math.ceil(this.holdRemainingSeconds)}s`;

      const svgCircle = this.container.querySelector('#hold-progress-svg');
      if (svgCircle && this.holdTotalSeconds > 0) {
        const pct = Math.max(0, this.holdRemainingSeconds / this.holdTotalSeconds);
        svgCircle.style.strokeDashoffset = `${(1 - pct) * circumference}`;
      }
    } else {
      const repEl = this.container.querySelector('#active-rep-count');
      if (repEl) repEl.innerText = this.currentRep;

      if (this.repDuration > 0) {
        const pct = Math.min(100, (this.repElapsed / this.repDuration) * 100);

        // High contrast circular progress ring (Issue #5 fix)
        const svgCircle = this.container.querySelector('#rep-progress-svg');
        if (svgCircle) {
          const offset = circumference - (pct / 100) * circumference;
          svgCircle.style.strokeDashoffset = offset;
        }
      }
    }
  }

  // --- CONFIRM SET DIALOG ---
  renderConfirmSet() {
    const ex = this.getCurrentExercise();
    const isIsometric = ex.type === 'Isometric';

    const html = `
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-6 justify-between select-none">
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

          <!-- Weight Confirm -->
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
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-6 justify-between select-none">
        <!-- Top bar with Pause & Quit -->
        <div class="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400">Rest Period</span>
          <div class="flex items-center gap-2">
            <button id="btn-workout-overview" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono active:scale-95 transition">
              <svg class="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
              <span>Overview</span>
            </button>
            <button id="btn-quit" class="text-xs font-mono text-zinc-400 hover:text-white py-1 px-3 bg-zinc-800/60 border border-zinc-700/60 rounded-lg">
              Exit
            </button>
          </div>
        </div>

        <!-- Big Rest Timer (Tap to Pause/Resume - Discussion #2 Idea) -->
        <div class="my-auto flex flex-col items-center justify-center py-4">
          <div id="timer-circle-rest" class="relative w-72 h-72 flex flex-col items-center justify-center rounded-full border-2 ${this.isRestPaused ? 'border-zinc-500 bg-[#202024]' : 'border-zinc-700 bg-[#18181b]'} cursor-pointer active:scale-95 transition shadow-sm">
            <span id="rest-digits" class="text-8xl font-mono font-bold tracking-tighter text-white">
              ${this.formatTime(this.restRemainingSeconds)}
            </span>
            <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400 mt-2">
              ${this.isRestPaused ? 'Paused • Tap to resume' : 'Recovery • Tap to pause'}
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
      this.showExitModal();
    };

    const btnOverview = this.container.querySelector('#btn-workout-overview');
    if (btnOverview) {
      btnOverview.onclick = () => this.openOverview();
    }

    const toggleRestPause = () => {
      this.isRestPaused = !this.isRestPaused;
      this.render();
    };

    this.container.querySelector('#timer-circle-rest').onclick = toggleRestPause;

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
    const ovEl = this.container.querySelector('#overview-rest-digits');
    if (ovEl) {
      ovEl.innerText = this.formatTime(this.restRemainingSeconds);
    }
  }

  // --- WORKOUT PLAN OVERVIEW (Discussion #10) ---
  openOverview() {
    this.previousPhase = this.phase;
    if (this.phase === 'ACTIVE') {
      this.isPaused = true;
    }
    this.phase = 'OVERVIEW';
    this.render();
  }

  closeOverview() {
    this.phase = this.previousPhase || 'ACTIVE';
    this.render();
  }

  renderOverview() {
    const currentEx = this.getCurrentExercise();
    const totalWorkoutSeconds = Math.round((Date.now() - this.workoutStartTime) / 1000);

    const html = `
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-5 select-none overflow-hidden">
        <!-- Top bar -->
        <div class="flex items-center justify-between border-b border-zinc-800/80 pb-3 flex-shrink-0">
          <div>
            <span class="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Workout Plan & Progress</span>
            <h1 class="text-lg font-bold tracking-tight text-white truncate max-w-[200px]">${this.program.name}</h1>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-close-overview" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-mono font-bold active:scale-95 transition">
              <span>Resume</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button id="btn-quit" class="p-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 text-zinc-400 hover:text-white text-xs">
              ✕
            </button>
          </div>
        </div>

        <!-- Sticky Status / Resume Banner -->
        <div id="overview-resume-banner" class="my-3 p-3 bg-[#18181b] border border-zinc-800 rounded-xl flex items-center justify-between cursor-pointer active:scale-98 transition flex-shrink-0">
          <div class="flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
            <div>
              <div class="text-xs font-bold text-white">
                ${this.previousPhase === 'REST' ? 'Rest Period Active' : (this.previousPhase === 'ACTIVE' ? `Current: ${currentEx.name}` : `${this.program.name}`)}
              </div>
              <div class="text-[11px] font-mono text-zinc-400">
                ${this.previousPhase === 'REST' ? `Time Remaining: <span id="overview-rest-digits" class="text-white font-bold">${this.formatTime(this.restRemainingSeconds)}</span>` : `Set ${this.currentSet} of ${this.totalSetsForCurrentEx} • Workout: ${this.formatTime(totalWorkoutSeconds)}`}
              </div>
            </div>
          </div>
          <span class="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-1">
            <span>Back</span>
            <span>➔</span>
          </span>
        </div>

        <!-- Scrollable Exercises List -->
        <div class="flex-1 overflow-y-auto space-y-4 pr-0.5 pb-2">
          ${this.exerciseList.map((ex, exIdx) => {
            const isCurrentEx = exIdx === this.currentExIndex;
            const exCompletedSets = this.completedSets.filter(cs => cs.exerciseId === ex.id);

            return `
              <div class="bg-[#18181b] border ${isCurrentEx ? 'border-zinc-600' : 'border-zinc-800'} rounded-2xl p-4 space-y-3">
                <!-- Exercise Header -->
                <div class="flex items-start justify-between">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">#${exIdx + 1} • ${ex.group}</span>
                      ${isCurrentEx ? `<span class="text-[9px] font-mono uppercase bg-white text-black font-bold px-1.5 py-0.5 rounded">Active</span>` : ''}
                    </div>
                    <h3 class="text-base font-bold text-white mt-0.5">${ex.name}</h3>
                    <div class="text-xs text-zinc-400 font-mono mt-0.5">
                      Target: ${ex.targetSets} sets × ${ex.targetValue}${ex.type === 'Isometric' ? 's' : ' reps'}
                      ${ex.weightTrackingEnabled && ex.weight > 0 ? `• ${ex.weight}kg` : ''}
                      • ${ex.restInterval}s rest
                    </div>
                  </div>

                  ${!isCurrentEx ? `
                    <button class="btn-jump-exercise text-[11px] font-mono text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 active:scale-95" data-ex-idx="${exIdx}">
                      Switch
                    </button>
                  ` : ''}
                </div>

                <!-- Sets List for this Exercise -->
                <div class="space-y-1.5 pt-1">
                  ${Array.from({ length: ex.targetSets || 3 }, (_, sIdx) => {
                    const setNum = sIdx + 1;
                    const logged = exCompletedSets.find(s => s.setIndex === setNum);
                    const isActiveSet = isCurrentEx && setNum === this.currentSet && !logged;

                    if (logged) {
                      return `
                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#202024] border border-zinc-700/80 text-xs">
                          <div class="flex items-center gap-2">
                            <span class="w-5 h-5 rounded-full bg-white text-black font-bold flex items-center justify-center text-[10px]">✓</span>
                            <span class="font-mono text-zinc-200 font-semibold">Set ${setNum}</span>
                          </div>

                          <div class="flex items-center gap-2.5 font-mono">
                            <!-- Edit reps / hold seconds -->
                            <div class="flex items-center gap-1">
                              <button class="btn-adj-rep w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 flex items-center justify-center text-xs" data-ex-id="${ex.id}" data-set-num="${setNum}" data-delta="-1">-</button>
                              <span class="w-7 text-center font-bold text-white">${logged.reps}</span>
                              <button class="btn-adj-rep w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 flex items-center justify-center text-xs" data-ex-id="${ex.id}" data-set-num="${setNum}" data-delta="1">+</button>
                              <span class="text-zinc-500 text-[10px]">${ex.type === 'Isometric' ? 's' : 'r'}</span>
                            </div>

                            <!-- Edit weight if enabled -->
                            ${ex.weightTrackingEnabled ? `
                              <div class="flex items-center gap-1 border-l border-zinc-700 pl-2">
                                <button class="btn-adj-weight w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 flex items-center justify-center text-[10px]" data-ex-id="${ex.id}" data-set-num="${setNum}" data-delta="-2.5">-</button>
                                <span class="w-10 text-center font-bold text-white text-[11px]">${logged.weight}k</span>
                                <button class="btn-adj-weight w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 flex items-center justify-center text-[10px]" data-ex-id="${ex.id}" data-set-num="${setNum}" data-delta="2.5">+</button>
                              </div>
                            ` : ''}
                          </div>
                        </div>
                      `;
                    } else if (isActiveSet) {
                      return `
                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#202024]/70 border border-zinc-500 text-xs font-mono">
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                            <span class="text-white font-bold">Set ${setNum} (Current)</span>
                          </div>
                          <span class="text-zinc-400">Target: ${ex.targetValue}${ex.type === 'Isometric' ? 's' : ' reps'}</span>
                        </div>
                      `;
                    } else {
                      return `
                        <div class="flex items-center justify-between p-2 rounded-xl border border-dashed border-zinc-800 text-zinc-500 text-xs font-mono">
                          <span>Set ${setNum}</span>
                          <span>Upcoming</span>
                        </div>
                      `;
                    }
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Bottom Action: Return to Timer -->
        <div class="pt-3 flex-shrink-0">
          <button id="btn-return-timer-bottom" class="w-full py-4 rounded-xl bg-white hover:bg-zinc-200 active:scale-98 transition text-black font-bold text-sm tracking-wide uppercase flex items-center justify-center gap-2 shadow-lg">
            <span>Return to Timer Screen</span>
            <span>➔</span>
          </button>
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    // Handlers
    const returnToTimer = () => this.closeOverview();
    this.container.querySelector('#btn-close-overview').onclick = returnToTimer;
    this.container.querySelector('#overview-resume-banner').onclick = returnToTimer;
    this.container.querySelector('#btn-return-timer-bottom').onclick = returnToTimer;

    this.container.querySelector('#btn-quit').onclick = () => {
      this.showExitModal();
    };

    // Set editing handlers
    this.container.querySelectorAll('.btn-adj-rep').forEach(btn => {
      btn.onclick = (e) => {
        const exId = Number(e.currentTarget.dataset.exId);
        const setNum = Number(e.currentTarget.dataset.setNum);
        const delta = Number(e.currentTarget.dataset.delta);
        const logged = this.completedSets.find(cs => cs.exerciseId === exId && cs.setIndex === setNum);
        if (logged) {
          logged.reps = Math.max(0, logged.reps + delta);
          this.render();
        }
      };
    });

    this.container.querySelectorAll('.btn-adj-weight').forEach(btn => {
      btn.onclick = (e) => {
        const exId = Number(e.currentTarget.dataset.exId);
        const setNum = Number(e.currentTarget.dataset.setNum);
        const delta = Number(e.currentTarget.dataset.delta);
        const logged = this.completedSets.find(cs => cs.exerciseId === exId && cs.setIndex === setNum);
        if (logged) {
          logged.weight = Math.max(0, logged.weight + delta);
          const ex = appState.getExercise(exId);
          if (ex && ex.weightTrackingEnabled) {
            ex.weight = logged.weight;
            appState.saveExercise(ex);
          }
          this.render();
        }
      };
    });

    // Jump to exercise
    this.container.querySelectorAll('.btn-jump-exercise').forEach(btn => {
      btn.onclick = (e) => {
        const targetIdx = Number(e.currentTarget.dataset.exIdx);
        this.currentExIndex = targetIdx;
        this.currentSet = 1;
        const ex = this.getCurrentExercise();
        this.totalSetsForCurrentEx = ex.targetSets || 3;
        this.currentWeight = ex.weight || 0;
        this.closeOverview();
        this.start5sCountdown();
      };
    });
  }

  // --- CUSTOM EXIT MODAL (Issue #8 Fix - replaces weird browser confirm) ---
  showExitModal() {
    if (document.getElementById('exit-workout-modal')) return;

    const modalRoot = document.getElementById('modal-root') || document.body;
    const modalEl = document.createElement('div');
    modalEl.id = 'exit-workout-modal';
    modalEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none';

    const hasCompletedSets = this.completedSets.length > 0;

    modalEl.innerHTML = `
      <div class="bg-[#18181b] border border-zinc-700/80 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
        <div class="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-300 text-lg font-bold">
          ✕
        </div>
        <div>
          <h3 class="text-lg font-bold text-white tracking-tight">End Workout?</h3>
          <p class="text-xs text-zinc-400 mt-1.5 leading-relaxed">
            ${hasCompletedSets
              ? "Are you sure you want to exit? Your completed sets will be saved to your session history."
              : "Are you sure you want to exit this workout session?"}
          </p>
        </div>
        <div class="space-y-2 pt-2">
          <button id="btn-modal-resume" class="w-full py-3.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm tracking-wide uppercase transition active:scale-98">
            Resume Workout
          </button>
          ${hasCompletedSets ? `
            <button id="btn-modal-finish-early" class="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs tracking-wider uppercase border border-zinc-700 transition active:scale-98">
              End & Save Progress
            </button>
          ` : ''}
          <button id="btn-modal-discard" class="w-full py-2.5 text-zinc-500 hover:text-zinc-300 text-xs font-mono transition">
            Discard Entire Session
          </button>
        </div>
      </div>
    `;

    modalRoot.appendChild(modalEl);

    modalEl.querySelector('#btn-modal-resume').onclick = () => {
      modalEl.remove();
    };

    const btnFinishEarly = modalEl.querySelector('#btn-modal-finish-early');
    if (btnFinishEarly) {
      btnFinishEarly.onclick = () => {
        modalEl.remove();
        this.finishWorkout();
      };
    }

    modalEl.querySelector('#btn-modal-discard').onclick = () => {
      modalEl.remove();
      this.cleanup();
      this.onExit();
    };
  }

  // --- SUMMARY VIEW ---
  renderSummary() {
    const totalDurationSeconds = Math.round((Date.now() - this.workoutStartTime) / 1000);
    const totalVolume = this.completedSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
    const totalReps = this.completedSets.reduce((sum, s) => sum + s.reps, 0);

    const html = `
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-6 justify-between select-none">
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
