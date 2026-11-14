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

    // Phases: 'WARMUP' | 'COUNTDOWN_5S' | 'ACTIVE' | 'CONFIRM_SET' | 'REST' | 'OVERVIEW' | 'REVIEW' | 'SUMMARY'
    this.phase = 'WARMUP';
    this.previousPhase = 'ACTIVE';
    this.workoutEndTime = null;

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
    const firstEx = this.exerciseList[0];
    this.totalSetsForCurrentEx = this.getTotalSets(firstEx);
    this.workoutStartTime = Date.now();
    this.workoutEndTime = null;
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

  getTotalSets(ex) {
    if (!ex) return 3;
    const base = ex.targetSets || 3;
    return ex.laterality === 'Unilateral' ? base * 2 : base;
  }

  getSetSideLabel(ex, setIndex) {
    if (!ex || ex.laterality !== 'Unilateral') return '';
    const isOdd = (setIndex % 2 === 1);
    const side = isOdd ? 'Left' : 'Right';
    if (ex.group === 'Lower Body') return `${side} Leg`;
    if (ex.group === 'Upper Body') return `${side} Arm`;
    return `${side} Side`;
  }

  formatPreviousLog(log, ex) {
    if (!log) return '—';
    const unit = (appState && appState.settings && appState.settings.weightUnit) || 'kg';
    const hasWeight = typeof log.weight === 'number' && log.weight > 0;

    if (ex && ex.type === 'Isometric') {
      const sec = log.duration || log.reps || 0;
      if (hasWeight) {
        return `${sec}s @ ${log.weight}${unit}`;
      }
      return `${sec}s`;
    }
    const reps = log.reps || 0;
    if (hasWeight) {
      return `${reps}r @ ${log.weight}${unit}`;
    }
    return `${reps}r`;
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
    const ex = this.getCurrentExercise();
    this.totalSetsForCurrentEx = this.getTotalSets(ex);
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
    this.totalSetsForCurrentEx = this.getTotalSets(ex);
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
    const weightToLog = this.confirmedWeight || 0;
    const sideLabel = this.getSetSideLabel(ex, this.currentSet);

    this.completedSets.push({
      exerciseId: ex.id,
      exerciseName: ex.name,
      setIndex: this.currentSet,
      reps: this.confirmedReps,
      weight: weightToLog,
      duration: Math.round(this.activeDuration),
      side: sideLabel || null
    });

    sounds.playSetLogged();

    if (weightToLog > 0 || ex.weightTrackingEnabled) {
      ex.weight = weightToLog;
      this.currentWeight = weightToLog;
      if (weightToLog > 0) ex.weightTrackingEnabled = true;
      appState.saveExercise(ex);
    }

    if (this.currentSet < this.totalSetsForCurrentEx) {
      this.currentSet++;
      this.startRestTimer(ex.restInterval || 60);
    } else {
      if (this.currentExIndex < this.exerciseList.length - 1) {
        this.currentExIndex++;
        this.currentSet = 1;
        const nextEx = this.getCurrentExercise();
        this.totalSetsForCurrentEx = this.getTotalSets(nextEx);
        this.startRestTimer(ex.restInterval || 90);
      } else {
        this.promptWorkoutReview();
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

  promptWorkoutReview() {
    this.cleanup();
    this.phase = 'REVIEW';
    if (!this.workoutEndTime) {
      this.workoutEndTime = Date.now();
    }
    this.render();
  }

  finishAndSaveWorkout() {
    const totalDurationSeconds = Math.round(((this.workoutEndTime || Date.now()) - this.workoutStartTime) / 1000);

    appState.logWorkoutSession({
      programId: this.program.id,
      programName: this.program.name,
      totalDurationSeconds,
      completedSets: this.completedSets
    });

    sounds.playSetLogged();
    this.phase = 'SUMMARY';
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
    } else if (this.phase === 'REVIEW') {
      this.renderReview();
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
            First up: <span class="text-zinc-200 font-semibold">${ex.name}</span> (${ex.targetSets} sets × ${ex.targetValue}${ex.type === 'Isometric' ? 's' : ' reps'}${ex.laterality === 'Unilateral' ? ' / side' : ''})
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
    const prevLog = appState.getLastExerciseLog(ex.id, this.currentSet);
    const prevText = this.formatPreviousLog(prevLog, ex);

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
          <div class="text-zinc-400 text-xs font-medium tracking-wider uppercase mb-1">
            Set ${this.currentSet} of ${this.totalSetsForCurrentEx}${this.getSetSideLabel(ex, this.currentSet) ? ` • <span class="text-white font-bold">${this.getSetSideLabel(ex, this.currentSet)}</span>` : ''}
          </div>
          <h2 class="text-2xl font-bold text-white mb-2 px-4 tracking-tight">${ex.name}</h2>
          
          <!-- Benchmark & Target -->
          <div class="flex items-center justify-center gap-2 text-xs font-mono text-zinc-400 mb-6 bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-3.5 py-1.5">
            <span>Target: <strong class="text-zinc-200">${ex.targetValue}${ex.type === 'Isometric' ? 's' : 'r'}</strong></span>
            <span class="text-zinc-600">•</span>
            <span>Prev: <strong class="text-zinc-200">${prevText}</strong></span>
          </div>

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
    const prevLog = appState.getLastExerciseLog(ex.id, this.currentSet);
    const prevText = this.formatPreviousLog(prevLog, ex);

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
            Set <span class="text-white font-bold">${this.currentSet}</span> of ${this.totalSetsForCurrentEx}${this.getSetSideLabel(ex, this.currentSet) ? ` • <span class="text-white font-bold">${this.getSetSideLabel(ex, this.currentSet)}</span>` : ''}
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
                <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400 mt-1 text-center px-2">
                  ${this.isPaused ? 'Paused • Tap to resume' : `Target: ${ex.targetValue}s • Prev: ${prevText}`}
                </span>
              </div>
            </div>
          ` : `
            <!-- Dynamic Auto-Paced Rep Counter with High-Contrast SVG Ring (Tap to Pause) -->
            <div class="w-full flex flex-col items-center">
              <div id="timer-circle-active" class="relative w-64 h-64 flex flex-col items-center justify-center rounded-full bg-[#18181b] cursor-pointer active:scale-95 transition shadow-sm overflow-hidden border border-zinc-800">
                <!-- High Contrast SVG Progress Ring -->
                <svg class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 256 256">
                  <circle cx="128" cy="128" r="114" stroke="#27272a" stroke-width="8" fill="none" />
                  <circle id="rep-progress-svg" cx="128" cy="128" r="114" stroke="#ffffff" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="716.28" stroke-dashoffset="716.28" class="transition-all duration-100" />
                </svg>

                <div class="relative z-10 flex flex-col items-center">
                  <span id="active-rep-count" class="text-8xl font-mono font-bold tracking-tight text-white">
                    ${this.currentRep}
                  </span>
                  <span class="text-[11px] uppercase font-mono tracking-widest text-zinc-400 mt-1 text-center px-4">
                    Target: <span class="text-zinc-200 font-semibold">${this.targetReps}r</span> • Prev: <span class="text-zinc-200 font-semibold">${prevText}</span>
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

          <!-- Weight Input Bar (±0.5kg + direct keyboard typing) -->
          <div class="mt-4 w-full bg-[#18181b] border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div class="text-xs font-medium uppercase tracking-wider text-zinc-300">Weight (${appState.settings.weightUnit})</div>
              <div class="text-[11px] text-zinc-500">${ex.weightTrackingEnabled ? 'Added / Dumbbell' : 'Bodyweight'}</div>
            </div>

            <div class="flex items-center gap-1.5">
              <button id="btn-weight-minus" class="px-2.5 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 text-xs font-mono">-0.5</button>
              <input id="input-weight" type="number" step="0.5" min="0" value="${this.currentWeight}" class="w-20 bg-[#121214] border border-zinc-700 text-center font-mono font-bold text-white text-sm py-1.5 rounded-lg focus:outline-none focus:border-zinc-400" />
              <button id="btn-weight-plus" class="px-2.5 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 text-xs font-mono">+0.5</button>
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
    const updateWeight = (val) => {
      this.currentWeight = Math.max(0, Math.round(val * 10) / 10);
      inputWeight.value = this.currentWeight;
      if (ex.weightTrackingEnabled) {
        ex.weight = this.currentWeight;
        appState.saveExercise(ex);
      }
    };

    inputWeight.oninput = (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        this.currentWeight = Math.max(0, Math.round(val * 10) / 10);
        if (ex.weightTrackingEnabled) {
          ex.weight = this.currentWeight;
          appState.saveExercise(ex);
        }
      }
    };
    inputWeight.onchange = (e) => {
      const val = parseFloat(e.target.value) || 0;
      updateWeight(val);
    };

    this.container.querySelector('#btn-weight-minus').onclick = () => {
      updateWeight(this.currentWeight - 0.5);
    };
    this.container.querySelector('#btn-weight-plus').onclick = () => {
      updateWeight(this.currentWeight + 0.5);
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
    const prevLog = appState.getLastExerciseLog(ex.id, this.currentSet);
    const prevText = this.formatPreviousLog(prevLog, ex);

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
            <span class="text-xs font-mono uppercase tracking-wider text-zinc-400">Set ${this.currentSet} of ${this.totalSetsForCurrentEx}${this.getSetSideLabel(ex, this.currentSet) ? ` (${this.getSetSideLabel(ex, this.currentSet)})` : ''} Completed</span>
            <h2 class="text-2xl font-bold text-white mt-1">${ex.name}</h2>
          </div>

          <!-- Reps / Hold Seconds Confirm with direct keyboard typing and - / + -->
          <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-5 text-center space-y-3">
            <div class="text-xs font-mono uppercase tracking-wider text-zinc-400">
              ${isIsometric ? 'Hold Duration (seconds)' : 'Completed Reps'}
            </div>

            <div class="flex items-center justify-center gap-3">
              <button id="btn-confirm-minus" class="w-12 h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-2xl font-bold active:scale-95 transition">
                -
              </button>
              <div class="w-32 text-center">
                <input id="input-confirm-reps" type="number" min="0" value="${this.confirmedReps}" class="w-24 bg-transparent text-center text-5xl font-mono font-bold text-white tracking-tight border-b border-zinc-700 focus:outline-none focus:border-zinc-400 pb-0.5" />
                <span class="block text-xs font-mono text-zinc-400 mt-2">
                  Target: ${ex.targetValue}${isIsometric ? 's' : 'r'} • Prev: ${prevText}
                </span>
              </div>
              <button id="btn-confirm-plus" class="w-12 h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-2xl font-bold active:scale-95 transition">
                +
              </button>
            </div>
          </div>

          <!-- Weight Confirm with ±0.5kg and direct keyboard typing -->
          <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div class="text-xs font-medium text-zinc-300 uppercase tracking-wider">Weight Used</div>
              <div class="text-[11px] text-zinc-500">${appState.settings.weightUnit}</div>
            </div>

            <div class="flex items-center gap-1.5">
              <button id="btn-confirm-weight-minus" class="px-2.5 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold text-xs font-mono active:scale-95">-0.5</button>
              <input id="input-confirm-weight" type="number" step="0.5" min="0" value="${this.confirmedWeight}" class="w-20 bg-[#121214] border border-zinc-700 text-center font-mono font-bold text-white text-sm py-1.5 rounded-lg focus:outline-none focus:border-zinc-400" />
              <button id="btn-confirm-weight-plus" class="px-2.5 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold text-xs font-mono active:scale-95">+0.5</button>
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

    const inputReps = this.container.querySelector('#input-confirm-reps');
    inputReps.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val)) {
        this.confirmedReps = Math.max(0, val);
      }
    };
    inputReps.onchange = (e) => {
      this.confirmedReps = Math.max(0, parseInt(e.target.value, 10) || 0);
      inputReps.value = this.confirmedReps;
    };
    this.container.querySelector('#btn-confirm-minus').onclick = () => {
      this.confirmedReps = Math.max(0, this.confirmedReps - 1);
      inputReps.value = this.confirmedReps;
    };
    this.container.querySelector('#btn-confirm-plus').onclick = () => {
      this.confirmedReps++;
      inputReps.value = this.confirmedReps;
    };

    const inputWeight = this.container.querySelector('#input-confirm-weight');
    const updateConfirmWeight = (val) => {
      this.confirmedWeight = Math.max(0, Math.round(val * 10) / 10);
      inputWeight.value = this.confirmedWeight;
    };
    inputWeight.oninput = (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        this.confirmedWeight = Math.max(0, Math.round(val * 10) / 10);
      }
    };
    inputWeight.onchange = (e) => {
      const val = parseFloat(e.target.value) || 0;
      updateConfirmWeight(val);
    };
    this.container.querySelector('#btn-confirm-weight-minus').onclick = () => {
      updateConfirmWeight(this.confirmedWeight - 0.5);
    };
    this.container.querySelector('#btn-confirm-weight-plus').onclick = () => {
      updateConfirmWeight(this.confirmedWeight + 0.5);
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
    const prevLog = appState.getLastExerciseLog(nextEx.id, this.currentSet);
    const prevLogText = this.formatPreviousLog(prevLog, nextEx);

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

        <!-- Big Rest Timer (Tap to Pause/Resume) -->
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
            <div class="text-xs text-zinc-400 mt-1 font-mono flex flex-wrap gap-x-2 gap-y-0.5">
              <span>Set ${this.currentSet} of ${this.totalSetsForCurrentEx}${this.getSetSideLabel(nextEx, this.currentSet) ? ` (${this.getSetSideLabel(nextEx, this.currentSet)})` : ''}</span>
              <span>•</span>
              <span>Target: ${nextEx.targetValue}${nextEx.type === 'Isometric' ? 's' : ' reps'}</span>
              ${nextEx.weightTrackingEnabled && nextEx.weight > 0 ? `<span>•</span><span>${nextEx.weight} ${appState.settings.weightUnit}</span>` : ''}
            </div>
            <div class="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono">
              <span class="text-zinc-500">Previous Performance:</span>
              <span class="text-zinc-200 font-semibold">${prevLogText}</span>
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
    const existingScrollEl = this.container.querySelector('#overview-scroll-container');
    const savedScrollTop = existingScrollEl ? existingScrollEl.scrollTop : 0;

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
                ${this.previousPhase === 'REST' ? `Time Remaining: <span id="overview-rest-digits" class="text-white font-bold">${this.formatTime(this.restRemainingSeconds)}</span>` : `Set ${this.currentSet} of ${this.totalSetsForCurrentEx}${this.getSetSideLabel(currentEx, this.currentSet) ? ` (${this.getSetSideLabel(currentEx, this.currentSet)})` : ''} • Workout: ${this.formatTime(totalWorkoutSeconds)}`}
              </div>
            </div>
          </div>
          <span class="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-1">
            <span>Back</span>
            <span>➔</span>
          </span>
        </div>

        <!-- Scrollable Exercises List -->
        <div id="overview-scroll-container" class="flex-1 overflow-y-auto space-y-4 pr-0.5 pb-2">
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
                      Target: ${ex.targetSets} sets × ${ex.targetValue}${ex.type === 'Isometric' ? 's' : ' reps'}${ex.laterality === 'Unilateral' ? ' / side' : ''} (${this.getTotalSets(ex)} sets)
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

                <!-- Sets Table for this Exercise (Idea #4 Column Labels) -->
                <div class="space-y-1.5 pt-1">
                  <!-- Column Header Labels -->
                  <div class="grid grid-cols-12 gap-1 px-2.5 pb-1 text-[10px] font-mono uppercase text-zinc-500 font-semibold border-b border-zinc-800/80">
                    <span class="col-span-2">SET</span>
                    <span class="col-span-3">PREVIOUS</span>
                    <span class="col-span-4 text-center">${ex.type === 'Isometric' ? 'HOLD (S)' : 'REPS'}</span>
                    <span class="col-span-3 text-right">WEIGHT (${(appState.settings.weightUnit || 'kg').toUpperCase()})</span>
                  </div>

                  ${Array.from({ length: this.getTotalSets(ex) }, (_, sIdx) => {
                    const setNum = sIdx + 1;
                    const sideLabel = this.getSetSideLabel(ex, setNum);
                    const sideShort = sideLabel ? (sideLabel.startsWith('Left') ? ' L' : ' R') : '';
                    const logged = exCompletedSets.find(s => s.setIndex === setNum);
                    const isActiveSet = isCurrentEx && setNum === this.currentSet && !logged;
                    const prevLog = appState.getLastExerciseLog(ex.id, setNum);
                    const prevText = this.formatPreviousLog(prevLog, ex);

                    if (logged) {
                      return `
                        <div class="grid grid-cols-12 gap-1 items-center p-2 rounded-xl bg-[#202024] border border-zinc-700/80 text-xs">
                          <div class="col-span-2 flex items-center gap-1 font-mono font-semibold text-zinc-200">
                            <span class="w-4 h-4 rounded-full bg-white text-black font-bold flex items-center justify-center text-[9px]">✓</span>
                            <span class="text-xs">#${setNum}${sideShort}</span>
                          </div>

                          <div class="col-span-3 font-mono text-[11px] text-zinc-400 truncate" title="${prevText}">
                            ${prevText}
                          </div>

                          <div class="col-span-4 flex items-center justify-center gap-1">
                            <button class="btn-adj-rep w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 flex items-center justify-center text-xs" data-ex-id="${ex.id}" data-set-num="${setNum}" data-delta="-1">-</button>
                            <input type="number" min="0" value="${logged.reps}" class="input-adj-rep w-9 bg-[#121214] border border-zinc-700 text-center font-mono font-bold text-white text-xs py-0.5 rounded focus:outline-none focus:border-zinc-400" data-ex-id="${ex.id}" data-set-num="${setNum}" />
                            <button class="btn-adj-rep w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 flex items-center justify-center text-xs" data-ex-id="${ex.id}" data-set-num="${setNum}" data-delta="1">+</button>
                          </div>

                          <div class="col-span-3 flex items-center justify-end gap-1">
                            ${(ex.weightTrackingEnabled || (logged.weight && logged.weight > 0)) ? `
                              <button class="btn-adj-weight w-5 h-6 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 flex items-center justify-center text-[9px]" data-ex-id="${ex.id}" data-set-num="${setNum}" data-delta="-0.5">-</button>
                              <input type="number" step="0.5" min="0" value="${logged.weight || 0}" class="input-adj-weight w-10 bg-[#121214] border border-zinc-700 text-center font-mono font-bold text-white text-[11px] py-0.5 rounded focus:outline-none focus:border-zinc-400" data-ex-id="${ex.id}" data-set-num="${setNum}" />
                              <button class="btn-adj-weight w-5 h-6 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 flex items-center justify-center text-[9px]" data-ex-id="${ex.id}" data-set-num="${setNum}" data-delta="0.5">+</button>
                            ` : `
                              <span class="text-zinc-500 font-mono text-[11px] pr-2">BW</span>
                            `}
                          </div>
                        </div>
                      `;
                    } else if (isActiveSet) {
                      return `
                        <div class="grid grid-cols-12 gap-1 items-center p-2 rounded-xl bg-[#202024]/70 border border-zinc-500 text-xs font-mono">
                          <div class="col-span-2 flex items-center gap-1.5 text-white font-bold">
                            <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                            <span>#${setNum}${sideShort}</span>
                          </div>
                          <div class="col-span-3 text-zinc-400 truncate">
                            ${prevText}
                          </div>
                          <div class="col-span-7 text-right text-zinc-300 pr-1">
                            Active${sideLabel ? ` (${sideLabel})` : ` (Target: ${ex.targetValue}${ex.type === 'Isometric' ? 's' : 'r'})`}
                          </div>
                        </div>
                      `;
                    } else {
                      return `
                        <div class="grid grid-cols-12 gap-1 items-center p-2 rounded-xl border border-dashed border-zinc-800 text-zinc-500 text-xs font-mono">
                          <div class="col-span-2">#${setNum}${sideShort}</div>
                          <div class="col-span-3 truncate">${prevText}</div>
                          <div class="col-span-7 text-right pr-1">Upcoming${sideLabel ? ` (${sideLabel})` : ` (${ex.targetValue}${ex.type === 'Isometric' ? 's' : 'r'})`}</div>
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

    const scrollEl = this.container.querySelector('#overview-scroll-container');
    if (scrollEl && savedScrollTop > 0) {
      scrollEl.scrollTop = savedScrollTop;
    }

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
          const parent = btn.closest('.col-span-4') || btn.parentElement;
          const input = parent ? parent.querySelector('.input-adj-rep') : null;
          if (input) input.value = logged.reps;
        }
      };
    });

    this.container.querySelectorAll('.input-adj-rep').forEach(input => {
      input.oninput = (e) => {
        const exId = Number(e.currentTarget.dataset.exId);
        const setNum = Number(e.currentTarget.dataset.setNum);
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
          const logged = this.completedSets.find(cs => cs.exerciseId === exId && cs.setIndex === setNum);
          if (logged) logged.reps = Math.max(0, val);
        }
      };
      input.onchange = (e) => {
        const exId = Number(e.currentTarget.dataset.exId);
        const setNum = Number(e.currentTarget.dataset.setNum);
        const val = parseInt(e.target.value, 10) || 0;
        const logged = this.completedSets.find(cs => cs.exerciseId === exId && cs.setIndex === setNum);
        if (logged) {
          logged.reps = Math.max(0, val);
          input.value = logged.reps;
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
          logged.weight = Math.max(0, Math.round(((logged.weight || 0) + delta) * 10) / 10);
          const ex = appState.getExercise(exId);
          if (ex && ex.weightTrackingEnabled) {
            ex.weight = logged.weight;
            appState.saveExercise(ex);
          }
          const parent = btn.closest('.col-span-3') || btn.parentElement;
          const input = parent ? parent.querySelector('.input-adj-weight') : null;
          if (input) input.value = logged.weight;
        }
      };
    });

    this.container.querySelectorAll('.input-adj-weight').forEach(input => {
      input.oninput = (e) => {
        const exId = Number(e.currentTarget.dataset.exId);
        const setNum = Number(e.currentTarget.dataset.setNum);
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          const logged = this.completedSets.find(cs => cs.exerciseId === exId && cs.setIndex === setNum);
          if (logged) {
            logged.weight = Math.max(0, Math.round(val * 10) / 10);
            const ex = appState.getExercise(exId);
            if (ex && ex.weightTrackingEnabled) {
              ex.weight = logged.weight;
              appState.saveExercise(ex);
            }
          }
        }
      };
      input.onchange = (e) => {
        const exId = Number(e.currentTarget.dataset.exId);
        const setNum = Number(e.currentTarget.dataset.setNum);
        const val = parseFloat(e.target.value) || 0;
        const logged = this.completedSets.find(cs => cs.exerciseId === exId && cs.setIndex === setNum);
        if (logged) {
          logged.weight = Math.max(0, Math.round(val * 10) / 10);
          input.value = logged.weight;
          const ex = appState.getExercise(exId);
          if (ex && ex.weightTrackingEnabled) {
            ex.weight = logged.weight;
            appState.saveExercise(ex);
          }
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
        this.totalSetsForCurrentEx = this.getTotalSets(ex);
        this.currentWeight = ex.weight || 0;
        this.closeOverview();
        this.start5sCountdown();
      };
    });
  }

  // --- PRE-SAVE WORKOUT REVIEW (Discussion #11 Idea) ---
  renderReview() {
    const totalWorkoutSeconds = Math.round(((this.workoutEndTime || Date.now()) - this.workoutStartTime) / 1000);
    const totalVolume = this.completedSets.reduce((sum, s) => sum + ((s.weight || 0) * (s.reps || 0)), 0);
    const totalReps = this.completedSets.reduce((sum, s) => sum + (s.reps || 0), 0);
    const existingScrollEl = this.container.querySelector('#review-scroll-container');
    const savedScrollTop = existingScrollEl ? existingScrollEl.scrollTop : 0;

    const html = `
      <div class="flex flex-col h-full bg-[#121214] text-zinc-100 p-5 select-none overflow-hidden">
        <!-- Top bar -->
        <div class="flex items-center justify-between border-b border-zinc-800/80 pb-3 flex-shrink-0">
          <div>
            <span class="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Workout Complete • Review & Edit</span>
            <h1 class="text-lg font-bold tracking-tight text-white truncate max-w-[220px]">${this.program.name}</h1>
          </div>
          <button id="btn-review-discard" class="text-xs font-mono text-zinc-400 hover:text-white py-1 px-3 bg-zinc-800/60 border border-zinc-700/60 rounded-lg">
            Discard
          </button>
        </div>

        <!-- Mini Stats Summary -->
        <div class="grid grid-cols-3 gap-2 my-3 flex-shrink-0 text-center font-mono">
          <div class="bg-[#18181b] border border-zinc-800 rounded-xl p-2.5">
            <div class="text-[10px] uppercase text-zinc-500">Duration</div>
            <div class="text-base font-bold text-white mt-0.5">${this.formatMinutes(totalWorkoutSeconds)}</div>
          </div>
          <div class="bg-[#18181b] border border-zinc-800 rounded-xl p-2.5">
            <div class="text-[10px] uppercase text-zinc-500">Sets / Reps</div>
            <div id="review-stat-reps" class="text-base font-bold text-white mt-0.5">${this.completedSets.length} / ${totalReps}</div>
          </div>
          <div class="bg-[#18181b] border border-zinc-800 rounded-xl p-2.5">
            <div class="text-[10px] uppercase text-zinc-500">Volume</div>
            <div id="review-stat-volume" class="text-base font-bold text-white mt-0.5">${totalVolume} ${appState.settings.weightUnit}</div>
          </div>
        </div>

        <!-- Prompt message & Add Set Button -->
        <div class="px-1 pb-2 text-xs text-zinc-400 flex items-center justify-between flex-shrink-0">
          <span>Review your logged sets below:</span>
          <button id="btn-review-add-set" class="flex items-center gap-1 text-[11px] font-mono text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2.5 py-1 rounded-lg active:scale-95 transition">
            <span>+</span>
            <span>Add Set</span>
          </button>
        </div>

        <!-- Sets List Scrollable -->
        <div id="review-scroll-container" class="flex-1 overflow-y-auto space-y-2 pr-0.5 pb-2">
          ${this.completedSets.length === 0 ? `
            <div class="text-center py-12 text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-2xl p-6">
              No completed sets in this session.<br>
              Tap "+ Add Set" above to log a set manually.
            </div>
          ` : this.completedSets.map((s, idx) => {
            const ex = appState.getExercise(s.exerciseId) || { weightTrackingEnabled: (s.weight > 0), type: 'Reps' };
            const isIsometric = ex.type === 'Isometric';
            const sideLabel = s.side || (ex.laterality === 'Unilateral' ? this.getSetSideLabel(ex, s.setIndex) : '');

            return `
              <div class="bg-[#18181b] border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-2" data-set-index="${idx}">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-mono font-bold text-zinc-400">#${idx + 1}</span>
                    <span class="text-xs font-bold text-white truncate">${s.exerciseName}</span>
                  </div>
                  <div class="text-[11px] font-mono text-zinc-400 mt-0.5">
                    Set ${s.setIndex}${sideLabel ? ` • ${sideLabel}` : ''} ${isIsometric ? '• Hold' : '• Reps'}
                  </div>
                </div>

                <!-- Reps Stepper & Keyboard input -->
                <div class="flex items-center gap-1">
                  <button class="btn-review-rep-minus w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 flex items-center justify-center text-xs" data-idx="${idx}">-</button>
                  <input type="number" min="0" value="${s.reps}" class="input-review-rep w-10 bg-[#121214] border border-zinc-700 text-center font-mono font-bold text-white text-xs py-1 rounded-lg focus:outline-none focus:border-zinc-400" data-idx="${idx}" />
                  <button class="btn-review-rep-plus w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 flex items-center justify-center text-xs" data-idx="${idx}">+</button>
                </div>

                <!-- Weight Stepper & Keyboard input -->
                <div class="flex items-center gap-1">
                  <button class="btn-review-weight-minus w-6 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 flex items-center justify-center text-[9px]" data-idx="${idx}">-</button>
                  <input type="number" step="0.5" min="0" value="${s.weight || 0}" class="input-review-weight w-12 bg-[#121214] border border-zinc-700 text-center font-mono font-bold text-white text-xs py-1 rounded-lg focus:outline-none focus:border-zinc-400" data-idx="${idx}" />
                  <button class="btn-review-weight-plus w-6 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold active:scale-95 flex items-center justify-center text-[9px]" data-idx="${idx}">+</button>
                </div>

                <!-- Delete set button (✕) -->
                <button class="btn-review-delete-set w-7 h-7 rounded-lg bg-zinc-800/60 hover:bg-red-950/60 border border-zinc-700/60 hover:border-red-800 text-zinc-400 hover:text-red-400 active:scale-95 flex items-center justify-center text-xs transition" data-idx="${idx}" title="Delete Set">
                  ✕
                </button>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Bottom Actions -->
        <div class="pt-3 flex-shrink-0 space-y-2">
          <button id="btn-review-confirm-save" class="w-full py-4 rounded-xl bg-white hover:bg-zinc-200 active:scale-98 transition text-black font-bold text-base tracking-wide uppercase flex items-center justify-center gap-2 shadow-lg">
            <span>Confirm & Save Workout</span>
            <span>✓</span>
          </button>
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    const scrollEl = this.container.querySelector('#review-scroll-container');
    if (scrollEl && savedScrollTop > 0) {
      scrollEl.scrollTop = savedScrollTop;
    }

    // Discard workout handler
    this.container.querySelector('#btn-review-discard').onclick = () => {
      this.showExitModal();
    };

    // Add set button
    this.container.querySelector('#btn-review-add-set').onclick = () => {
      this.showReviewAddSetModal();
    };

    // Confirm & Save
    this.container.querySelector('#btn-review-confirm-save').onclick = () => {
      this.finishAndSaveWorkout();
    };

    const updateReviewStats = () => {
      const curReps = this.completedSets.reduce((sum, s) => sum + (s.reps || 0), 0);
      const curVol = this.completedSets.reduce((sum, s) => sum + ((s.weight || 0) * (s.reps || 0)), 0);
      const repsEl = this.container.querySelector('#review-stat-reps');
      if (repsEl) repsEl.innerText = `${this.completedSets.length} / ${curReps}`;
      const volEl = this.container.querySelector('#review-stat-volume');
      if (volEl) volEl.innerText = `${curVol} ${appState.settings.weightUnit}`;
    };

    // Rep adjustments
    this.container.querySelectorAll('.btn-review-rep-minus').forEach(btn => {
      btn.onclick = (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        if (this.completedSets[idx]) {
          this.completedSets[idx].reps = Math.max(0, (this.completedSets[idx].reps || 0) - 1);
          const parent = btn.parentElement;
          const input = parent ? parent.querySelector('.input-review-rep') : null;
          if (input) input.value = this.completedSets[idx].reps;
          updateReviewStats();
        }
      };
    });
    this.container.querySelectorAll('.btn-review-rep-plus').forEach(btn => {
      btn.onclick = (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        if (this.completedSets[idx]) {
          this.completedSets[idx].reps = (this.completedSets[idx].reps || 0) + 1;
          const parent = btn.parentElement;
          const input = parent ? parent.querySelector('.input-review-rep') : null;
          if (input) input.value = this.completedSets[idx].reps;
          updateReviewStats();
        }
      };
    });
    this.container.querySelectorAll('.input-review-rep').forEach(input => {
      input.oninput = (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && this.completedSets[idx]) {
          this.completedSets[idx].reps = Math.max(0, val);
          updateReviewStats();
        }
      };
      input.onchange = (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        const val = parseInt(e.target.value, 10) || 0;
        if (this.completedSets[idx]) {
          this.completedSets[idx].reps = Math.max(0, val);
          input.value = this.completedSets[idx].reps;
          updateReviewStats();
        }
      };
    });

    // Weight adjustments
    this.container.querySelectorAll('.btn-review-weight-minus').forEach(btn => {
      btn.onclick = (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        if (this.completedSets[idx]) {
          this.completedSets[idx].weight = Math.max(0, Math.round(((this.completedSets[idx].weight || 0) - 0.5) * 10) / 10);
          const parent = btn.parentElement;
          const input = parent ? parent.querySelector('.input-review-weight') : null;
          if (input) input.value = this.completedSets[idx].weight;
          updateReviewStats();
        }
      };
    });
    this.container.querySelectorAll('.btn-review-weight-plus').forEach(btn => {
      btn.onclick = (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        if (this.completedSets[idx]) {
          this.completedSets[idx].weight = Math.max(0, Math.round(((this.completedSets[idx].weight || 0) + 0.5) * 10) / 10);
          const parent = btn.parentElement;
          const input = parent ? parent.querySelector('.input-review-weight') : null;
          if (input) input.value = this.completedSets[idx].weight;
          updateReviewStats();
        }
      };
    });
    this.container.querySelectorAll('.input-review-weight').forEach(input => {
      input.oninput = (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && this.completedSets[idx]) {
          this.completedSets[idx].weight = Math.max(0, Math.round(val * 10) / 10);
          updateReviewStats();
        }
      };
      input.onchange = (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        const val = parseFloat(e.target.value) || 0;
        if (this.completedSets[idx]) {
          this.completedSets[idx].weight = Math.max(0, Math.round(val * 10) / 10);
          input.value = this.completedSets[idx].weight;
          updateReviewStats();
        }
      };
    });

    // Delete set
    this.container.querySelectorAll('.btn-review-delete-set').forEach(btn => {
      btn.onclick = (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        if (this.completedSets[idx]) {
          this.completedSets.splice(idx, 1);
          this.render();
        }
      };
    });
  }

  showReviewAddSetModal() {
    if (document.getElementById('review-add-set-modal')) return;

    const modalRoot = document.getElementById('modal-root') || document.body;
    const modalEl = document.createElement('div');
    modalEl.id = 'review-add-set-modal';
    modalEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none';

    modalEl.innerHTML = `
      <div class="bg-[#18181b] border border-zinc-700/80 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 class="text-sm font-bold text-white tracking-tight">Add Set to Workout</h3>
          <button id="btn-close-add-modal" class="text-zinc-400 hover:text-white p-1 text-xs">✕</button>
        </div>

        <div class="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          ${this.exerciseList.map((ex) => `
            <button class="btn-pick-add-exercise w-full text-left p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 active:scale-98 transition flex items-center justify-between" data-ex-id="${ex.id}">
              <div>
                <div class="text-xs font-semibold text-white">${ex.name}</div>
                <div class="text-[10px] font-mono text-zinc-400">${ex.group} • Target: ${ex.targetValue}${ex.type === 'Isometric' ? 's' : 'r'}</div>
              </div>
              <span class="text-xs text-zinc-400 font-mono">+ Add</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    modalRoot.appendChild(modalEl);

    modalEl.querySelector('#btn-close-add-modal').onclick = () => {
      modalEl.remove();
    };

    modalEl.querySelectorAll('.btn-pick-add-exercise').forEach(btn => {
      btn.onclick = (e) => {
        const exId = Number(e.currentTarget.dataset.exId);
        const ex = this.exerciseList.find(item => item.id === exId);
        if (ex) {
          const count = this.completedSets.filter(s => s.exerciseId === ex.id).length;
          const setIndex = count + 1;
          const sideLabel = this.getSetSideLabel(ex, setIndex);
          this.completedSets.push({
            exerciseId: ex.id,
            exerciseName: ex.name,
            setIndex: setIndex,
            reps: ex.targetValue || 10,
            weight: ex.weight || 0,
            duration: ex.type === 'Isometric' ? (ex.targetValue || 30) : 0,
            side: sideLabel || null
          });
        }
        modalEl.remove();
        this.render();
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
              ? "Are you sure you want to exit? You can review and save your completed sets or discard the session."
              : "Are you sure you want to exit this workout session?"}
          </p>
        </div>
        <div class="space-y-2 pt-2">
          <button id="btn-modal-resume" class="w-full py-3.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm tracking-wide uppercase transition active:scale-98">
            Resume Workout
          </button>
          ${hasCompletedSets ? `
            <button id="btn-modal-finish-early" class="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs tracking-wider uppercase border border-zinc-700 transition active:scale-98">
              Review & Save Progress
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
        this.promptWorkoutReview();
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
