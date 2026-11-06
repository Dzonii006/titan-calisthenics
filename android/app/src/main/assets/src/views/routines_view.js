import { appState } from '../state.js';

export class RoutinesView {
  constructor(container, onStartWorkout) {
    this.container = container;
    this.onStartWorkout = onStartWorkout;
    this.expandedRoutineId = null;
  }

  render() {
    const programs = appState.programs;

    const html = `
      <div class="p-5 pb-24 space-y-6 max-w-lg mx-auto animate-fadeIn">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <span class="text-xs font-mono uppercase tracking-widest text-emerald-400">Calisthenics & Rings Split</span>
            <h1 class="text-2xl font-black tracking-tight text-white mt-0.5">Workout Routines</h1>
          </div>
          <div class="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
            4-Day Split
          </div>
        </div>

        <!-- Routine Cards -->
        <div class="space-y-4">
          ${programs.map(prog => {
            const exercises = prog.exerciseIds.map(id => appState.getExercise(id)).filter(Boolean);
            const totalSets = exercises.reduce((sum, e) => sum + (e.targetSets || 3), 0);
            const isExpanded = this.expandedRoutineId === prog.id;

            return `
              <div class="bg-zinc-950 border ${isExpanded ? 'border-emerald-500/50' : 'border-zinc-800/80'} rounded-2xl overflow-hidden transition-all shadow-xl">
                <!-- Card Header -->
                <div class="p-5 cursor-pointer flex items-start justify-between routine-card-toggle" data-prog-id="${prog.id}">
                  <div class="space-y-1">
                    <span class="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                      ${prog.subtitle || 'Routine'}
                    </span>
                    <h3 class="text-lg font-bold text-white tracking-tight">${prog.name}</h3>
                    <div class="flex items-center gap-3 text-xs text-zinc-400 font-mono pt-1">
                      <span>${exercises.length} Exercises</span>
                      <span>•</span>
                      <span>${totalSets} Total Sets</span>
                    </div>
                  </div>

                  <button class="p-2 text-zinc-400 hover:text-white transition transform ${isExpanded ? 'rotate-180' : ''}">
                    ▼
                  </button>
                </div>

                <!-- Expanded Exercise List -->
                ${isExpanded ? `
                  <div class="px-5 pb-5 border-t border-zinc-900 pt-4 space-y-3">
                    ${prog.warmup && prog.warmup.length > 0 ? `
                      <div class="bg-zinc-900/60 rounded-xl p-3 border border-zinc-800/60 text-xs">
                        <span class="text-emerald-400 font-mono font-semibold uppercase">Warm-up:</span>
                        <span class="text-zinc-300 ml-1">${prog.warmup.join(' • ')}</span>
                      </div>
                    ` : ''}

                    <div class="space-y-2">
                      ${exercises.map((ex, idx) => `
                        <div class="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-zinc-900/40 border border-zinc-900">
                          <div class="flex items-center gap-2">
                            <span class="font-mono text-emerald-400 font-bold">${idx + 1}.</span>
                            <span class="text-zinc-200 font-medium">${ex.name}</span>
                          </div>
                          <div class="font-mono text-zinc-400">
                            ${ex.targetSets} × ${ex.targetValue}${ex.type === 'Isometric' ? 's' : ''}
                            <span class="text-zinc-600">(${ex.restInterval}s rest)</span>
                          </div>
                        </div>
                      `).join('')}
                    </div>

                    <!-- Start Button inside expanded -->
                    <button class="btn-start-workout w-full mt-3 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 transition text-black font-black text-sm tracking-wide uppercase shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2" data-prog-id="${prog.id}">
                      <span>Start ${prog.name.split('-')[0].trim()}</span>
                      <span>➔</span>
                    </button>
                  </div>
                ` : `
                  <div class="px-5 pb-4 pt-0">
                    <button class="btn-start-workout w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 active:scale-98 transition text-emerald-400 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2" data-prog-id="${prog.id}">
                      <span>Quick Launch</span>
                      <span>➔</span>
                    </button>
                  </div>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    // Attach card toggles
    this.container.querySelectorAll('.routine-card-toggle').forEach(el => {
      el.onclick = () => {
        const id = Number(el.dataset.progId);
        this.expandedRoutineId = this.expandedRoutineId === id ? null : id;
        this.render();
      };
    });

    // Attach start workout buttons
    this.container.querySelectorAll('.btn-start-workout').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.progId);
        this.onStartWorkout(id);
      };
    });
  }
}
