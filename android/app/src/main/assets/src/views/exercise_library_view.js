import { appState } from '../state.js';

export class ExerciseLibraryView {
  constructor(container) {
    this.container = container;
    this.selectedGroup = 'All';
    this.searchQuery = '';
    this.editingExercise = null;
  }

  render() {
    let exercises = appState.exercises;

    if (this.selectedGroup !== 'All') {
      exercises = exercises.filter(e => e.group === this.selectedGroup);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      exercises = exercises.filter(e => e.name.toLowerCase().includes(q) || (e.cue && e.cue.toLowerCase().includes(q)));
    }

    const groups = ['All', 'Upper Body', 'Lower Body', 'Core & Posture'];

    const html = `
      <div class="p-5 pb-24 space-y-4 max-w-lg mx-auto animate-fadeIn">
        <!-- Header -->
        <div class="flex items-center justify-between pt-1">
          <div>
            <span class="text-[11px] font-mono uppercase tracking-widest text-zinc-400">Database</span>
            <h1 class="text-2xl font-bold tracking-tight text-white mt-0.5">Exercises (${appState.exercises.length})</h1>
          </div>
          <button id="btn-add-exercise" class="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs font-mono flex items-center gap-1 active:scale-95 transition">
            <span>+</span>
            <span>New</span>
          </button>
        </div>

        <!-- Search Bar -->
        <div class="relative">
          <input id="input-search" type="text" placeholder="Search exercises..." value="${this.searchQuery}" class="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
        </div>

        <!-- Group Pills -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          ${groups.map(g => `
            <button class="btn-group-pill px-3 py-1.5 rounded-lg text-xs font-mono transition ${this.selectedGroup === g ? 'bg-white text-black font-semibold' : 'bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 hover:text-zinc-200'}" data-group="${g}">
              ${g}
            </button>
          `).join('')}
        </div>

        <!-- Exercise Cards -->
        <div class="space-y-2.5">
          ${exercises.length === 0 ? `
            <div class="text-center py-12 text-zinc-500 text-sm">No exercises found.</div>
          ` : exercises.map(ex => `
            <div class="exercise-item-card bg-[#18181b] border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 cursor-pointer active:scale-98 transition shadow-sm" data-ex-id="${ex.id}">
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#202024] text-zinc-300 border border-zinc-700/60 font-medium">
                      ${ex.group}
                    </span>
                    <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                      ${ex.type}
                    </span>
                  </div>
                  <h3 class="text-base font-semibold text-white mt-1.5">${ex.name}</h3>
                </div>

                <div class="text-right font-mono">
                  <div class="text-sm font-semibold text-white">
                    ${ex.targetSets} × ${ex.targetValue}${ex.type === 'Isometric' ? 's' : ''}
                  </div>
                  <div class="text-[11px] text-zinc-400">
                    Rest: ${ex.restInterval}s
                  </div>
                </div>
              </div>

              <div class="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span>Tempo: ${ex.type === 'Isometric' ? 'Hold' : (ex.repDuration ? `${ex.repDuration}s / rep` : 'Manual')}</span>
                <span>${ex.weightTrackingEnabled ? `Weight: ${ex.weight || 0} ${appState.settings.weightUnit}` : 'Bodyweight'}</span>
              </div>

              ${ex.cue ? `
                <div class="mt-2 text-xs text-zinc-400 italic truncate">
                  Cue: ${ex.cue}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <!-- Edit / Create Modal -->
        ${this.editingExercise ? this.renderModal() : ''}
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEvents();
  }

  renderModal() {
    const ex = this.editingExercise;
    const isNew = !ex.id;

    return `
      <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
        <div class="bg-[#18181b] border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
          <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 class="text-base font-bold text-white">${isNew ? 'New Exercise' : 'Edit Exercise'}</h2>
            <button id="modal-close" class="text-zinc-400 hover:text-white text-lg">✕</button>
          </div>

          <form id="exercise-form" class="space-y-4">
            <div>
              <label class="block text-xs font-mono uppercase text-zinc-400 mb-1">Name</label>
              <input id="form-name" type="text" required value="${ex.name || ''}" class="w-full bg-[#121214] border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-mono uppercase text-zinc-400 mb-1">Group</label>
                <select id="form-group" class="w-full bg-[#121214] border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm">
                  <option value="Upper Body" ${ex.group === 'Upper Body' ? 'selected' : ''}>Upper Body</option>
                  <option value="Lower Body" ${ex.group === 'Lower Body' ? 'selected' : ''}>Lower Body</option>
                  <option value="Core & Posture" ${ex.group === 'Core & Posture' ? 'selected' : ''}>Core & Posture</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-mono uppercase text-zinc-400 mb-1">Type</label>
                <select id="form-type" class="w-full bg-[#121214] border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm">
                  <option value="Dynamic" ${ex.type === 'Dynamic' ? 'selected' : ''}>Dynamic (Reps)</option>
                  <option value="Isometric" ${ex.type === 'Isometric' ? 'selected' : ''}>Isometric (Hold / Sec)</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-mono uppercase text-zinc-400 mb-1">Sets</label>
                <input id="form-sets" type="number" min="1" value="${ex.targetSets || 3}" class="w-full bg-[#121214] border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm font-mono" />
              </div>
              <div>
                <label class="block text-xs font-mono uppercase text-zinc-400 mb-1">Target</label>
                <input id="form-target" type="number" min="1" value="${ex.targetValue || 10}" class="w-full bg-[#121214] border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm font-mono" />
              </div>
              <div>
                <label class="block text-xs font-mono uppercase text-zinc-400 mb-1">Rest (s)</label>
                <input id="form-rest" type="number" step="5" min="5" value="${ex.restInterval || 60}" class="w-full bg-[#121214] border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm font-mono" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-mono uppercase text-zinc-400 mb-1">Tempo (s/rep)</label>
                <input id="form-cadence" type="number" step="0.5" min="1" value="${ex.repDuration || 3.5}" class="w-full bg-[#121214] border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm font-mono" />
              </div>
              <div>
                <label class="block text-xs font-mono uppercase text-zinc-400 mb-1">Weight (${appState.settings.weightUnit})</label>
                <input id="form-weight" type="number" step="0.5" min="0" value="${ex.weight || 0}" class="w-full bg-[#121214] border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm font-mono" />
              </div>
            </div>

            <div class="flex items-center gap-2 pt-1">
              <input id="form-weight-toggle" type="checkbox" ${ex.weightTrackingEnabled ? 'checked' : ''} class="w-4 h-4 accent-white rounded" />
              <label for="form-weight-toggle" class="text-xs text-zinc-300 font-mono">Enable weight tracking for this exercise</label>
            </div>

            <div>
              <label class="block text-xs font-mono uppercase text-zinc-400 mb-1">Form Cue</label>
              <textarea id="form-cue" rows="2" class="w-full bg-[#121214] border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-zinc-500">${ex.cue || ''}</textarea>
            </div>

            <div class="flex items-center gap-3 pt-2">
              ${!isNew ? `
                <button type="button" id="btn-delete-exercise" class="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-400 text-xs font-mono font-medium border border-zinc-700">
                  Delete
                </button>
              ` : ''}
              <button type="submit" class="flex-1 py-3.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  attachEvents() {
    const inputSearch = this.container.querySelector('#input-search');
    if (inputSearch) {
      inputSearch.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.render();
        const input = this.container.querySelector('#input-search');
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      };
    }

    this.container.querySelectorAll('.btn-group-pill').forEach(pill => {
      pill.onclick = () => {
        this.selectedGroup = pill.dataset.group;
        this.render();
      };
    });

    const btnAdd = this.container.querySelector('#btn-add-exercise');
    if (btnAdd) {
      btnAdd.onclick = () => {
        this.editingExercise = {
          name: '',
          group: 'Upper Body',
          type: 'Dynamic',
          targetSets: 3,
          targetValue: 10,
          restInterval: 60,
          repDuration: 3.5,
          weightTrackingEnabled: true,
          weight: 0,
          cue: ''
        };
        this.render();
      };
    }

    this.container.querySelectorAll('.exercise-item-card').forEach(card => {
      card.onclick = () => {
        const id = Number(card.dataset.exId);
        const ex = appState.getExercise(id);
        if (ex) {
          this.editingExercise = { ...ex };
          this.render();
        }
      };
    });

    const modalClose = this.container.querySelector('#modal-close');
    if (modalClose) {
      modalClose.onclick = () => {
        this.editingExercise = null;
        this.render();
      };
    }

    const form = this.container.querySelector('#exercise-form');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const name = this.container.querySelector('#form-name').value.trim();
        const group = this.container.querySelector('#form-group').value;
        const type = this.container.querySelector('#form-type').value;
        const targetSets = parseInt(this.container.querySelector('#form-sets').value) || 3;
        const targetValue = parseInt(this.container.querySelector('#form-target').value) || 10;
        const restInterval = parseInt(this.container.querySelector('#form-rest').value) || 60;
        const repDuration = parseFloat(this.container.querySelector('#form-cadence').value) || 3.5;
        const weight = parseFloat(this.container.querySelector('#form-weight').value) || 0;
        const weightTrackingEnabled = this.container.querySelector('#form-weight-toggle').checked;
        const cue = this.container.querySelector('#form-cue').value.trim();

        const updated = {
          ...this.editingExercise,
          name,
          group,
          type,
          targetSets,
          targetValue,
          restInterval,
          repDuration: type === 'Isometric' ? null : repDuration,
          weight,
          weightTrackingEnabled,
          cue
        };

        appState.saveExercise(updated);
        this.editingExercise = null;
        this.render();
      };
    }

    const btnDelete = this.container.querySelector('#btn-delete-exercise');
    if (btnDelete) {
      btnDelete.onclick = () => {
        if (confirm(`Delete "${this.editingExercise.name}"?`)) {
          appState.deleteExercise(this.editingExercise.id);
          this.editingExercise = null;
          this.render();
        }
      };
    }
  }
}
