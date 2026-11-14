import { appState } from '../state.js';

export class HistoryView {
  constructor(container) {
    this.container = container;
  }

  render() {
    const history = appState.history;

    const html = `
      <div class="p-5 pb-24 space-y-4 max-w-lg mx-auto">
        <!-- Header -->
        <div class="pt-1">
          <span class="text-[11px] font-mono uppercase tracking-widest text-zinc-400">Activity Log</span>
          <h1 class="text-2xl font-bold tracking-tight text-white mt-0.5">History (${history.length})</h1>
        </div>

        ${history.length === 0 ? `
          <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-8 text-center text-zinc-400 space-y-2">
            <div class="text-sm font-semibold text-zinc-200">No logged workouts yet</div>
            <p class="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">Complete your first session from the Routines tab to track your sets, reps, and volume progression.</p>
          </div>
        ` : `
          <div class="space-y-3">
            ${history.map(session => {
              const date = new Date(session.date);
              const formattedDate = date.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              });
              const formattedTime = date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
              });
              const durationMin = Math.round(session.totalDurationSeconds / 60);
              const totalVolume = session.completedSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
              const totalReps = session.completedSets.reduce((sum, s) => sum + s.reps, 0);

              return `
                <div class="bg-[#18181b] border border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
                  <div class="flex items-start justify-between">
                    <div>
                      <span class="text-[10px] font-mono uppercase text-zinc-400 font-semibold">${formattedDate} • ${formattedTime}</span>
                      <h3 class="text-base font-bold text-white mt-0.5">${session.programName}</h3>
                    </div>
                    <div class="text-right font-mono text-xs">
                      <span class="px-2 py-0.5 rounded-lg bg-[#202024] border border-zinc-700/60 text-zinc-300 font-medium">${durationMin}m</span>
                    </div>
                  </div>

                  <!-- Quick metrics -->
                  <div class="grid grid-cols-3 gap-2 py-2 border-y border-zinc-800/80 text-center font-mono text-xs">
                    <div>
                      <span class="text-zinc-500 block text-[10px] uppercase">Sets</span>
                      <span class="text-white font-semibold">${session.completedSets.length}</span>
                    </div>
                    <div>
                      <span class="text-zinc-500 block text-[10px] uppercase">Reps / Sec</span>
                      <span class="text-white font-semibold">${totalReps}</span>
                    </div>
                    <div>
                      <span class="text-zinc-500 block text-[10px] uppercase">Volume</span>
                      <span class="text-white font-semibold">${totalVolume} ${appState.settings.weightUnit}</span>
                    </div>
                  </div>

                  <!-- Completed sets list preview -->
                  <div class="space-y-1 pt-1 max-h-32 overflow-y-auto pr-1">
                    ${session.completedSets.map(s => `
                      <div class="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[#202024]/70">
                        <span class="text-zinc-300 truncate max-w-[170px]">${s.exerciseName} (Set ${s.setIndex}${s.side ? ` • ${s.side}` : ''})</span>
                        <span class="font-mono text-zinc-400 font-medium">${s.reps} reps ${s.weight > 0 ? `@ ${s.weight}${appState.settings.weightUnit || 'kg'}` : ''}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    this.container.innerHTML = html;
  }
}
