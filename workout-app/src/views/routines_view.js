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
      <div class="p-5 pb-24 space-y-5 max-w-lg mx-auto">
        <!-- Header -->
        <div class="flex items-center justify-between pt-1">
          <div>
            <span class="text-[11px] font-mono uppercase tracking-widest text-zinc-400">Workout Plan</span>
            <h1 class="text-2xl font-bold tracking-tight text-white mt-0.5">Routines</h1>
          </div>
          <div class="px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs font-mono text-zinc-300">
            ${programs.length} Routines
          </div>
        </div>

        <!-- Routine Cards -->
        <div class="space-y-3.5">
          ${programs.map(prog => {
            const exercises = prog.exerciseIds.map(id => appState.getExercise(id)).filter(Boolean);
            const totalSets = exercises.reduce((sum, e) => sum + (e.laterality === 'Unilateral' ? (e.targetSets || 3) * 2 : (e.targetSets || 3)), 0);
            const isExpanded = this.expandedRoutineId === prog.id;

            return `
              <div class="bg-[#18181b] border ${isExpanded ? 'border-zinc-600' : 'border-zinc-800'} rounded-2xl overflow-hidden transition-all shadow-sm">
                <!-- Card Header -->
                <div class="p-5 cursor-pointer flex items-start justify-between routine-card-toggle" data-prog-id="${prog.id}">
                  <div class="space-y-1">
                    <span class="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                      ${prog.subtitle || 'Routine'}
                    </span>
                    <h3 class="text-lg font-bold text-white tracking-tight">${prog.name}</h3>
                    <div class="flex items-center gap-2 text-xs text-zinc-400 font-mono pt-1">
                      <span>${exercises.length} Exercises</span>
                      <span>•</span>
                      <span>${totalSets} Sets</span>
                    </div>
                  </div>

                  <button class="p-1.5 text-zinc-400 hover:text-white transition transform ${isExpanded ? 'rotate-180' : ''}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <!-- Expanded Exercise List -->
                ${isExpanded ? `
                  <div class="px-5 pb-5 border-t border-zinc-800/80 pt-4 space-y-3">
                    ${prog.warmup && prog.warmup.length > 0 ? `
                      <div class="bg-[#202024] rounded-xl p-3 border border-zinc-700/50 text-xs">
                        <span class="text-zinc-200 font-mono font-semibold uppercase">Warm-up:</span>
                        <span class="text-zinc-400 ml-1 leading-relaxed">${prog.warmup.join(' • ')}</span>
                      </div>
                    ` : ''}

                    <div class="space-y-1.5">
                      ${exercises.map((ex, idx) => `
                        <div class="flex items-center justify-between text-xs py-2.5 px-3 rounded-xl bg-[#202024]/70 border border-zinc-800">
                          <div class="flex items-center gap-2.5">
                            <span class="font-mono text-zinc-400 font-semibold text-xs">${idx + 1}.</span>
                            <span class="text-zinc-200 font-medium">${ex.name}</span>
                          </div>
                          <div class="font-mono text-zinc-400 text-[11px]">
                            ${ex.targetSets} × ${ex.targetValue}${ex.type === 'Isometric' ? 's' : ''}${ex.laterality === 'Unilateral' ? ' / side' : ''}
                            <span class="text-zinc-500">(${ex.laterality === 'Unilateral' ? (ex.targetSets || 3) * 2 : (ex.targetSets || 3)} sets • ${ex.restInterval}s)</span>
                          </div>
                        </div>
                      `).join('')}
                    </div>

                    <!-- Start Button inside expanded -->
                    <button class="btn-start-workout w-full mt-3 py-3.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-98 transition text-black font-bold text-sm tracking-wide uppercase flex items-center justify-center gap-2" data-prog-id="${prog.id}">
                      <span>Start Workout</span>
                      <span>➔</span>
                    </button>
                  </div>
                ` : `
                  <div class="px-5 pb-4 pt-0">
                    <button class="btn-start-workout w-full py-2.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700/80 active:scale-98 transition text-zinc-200 font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2" data-prog-id="${prog.id}">
                      <span>Start Routine</span>
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

    this.container.querySelectorAll('.routine-card-toggle').forEach(el => {
      el.onclick = () => {
        const id = Number(el.dataset.progId);
        this.expandedRoutineId = this.expandedRoutineId === id ? null : id;
        this.render();
      };
    });

    this.container.querySelectorAll('.btn-start-workout').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.progId);
        this.onStartWorkout(id);
      };
    });
  }
}
