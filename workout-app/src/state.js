import { DEFAULT_EXERCISES, DEFAULT_PROGRAMS, DEFAULT_GROUPS } from './default_data.js';

const STORAGE_KEY = 'titan_calisthenics_state_v1';

class AppState {
  constructor() {
    this.listeners = [];
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.groups = parsed.groups || DEFAULT_GROUPS;
        this.exercises = parsed.exercises || DEFAULT_EXERCISES;
        this.programs = parsed.programs || DEFAULT_PROGRAMS;
        this.history = parsed.history || [];
        this.settings = Object.assign({
          weightUnit: 'kg',
          soundEnabled: true,
          vibrateEnabled: true,
          wakeLockEnabled: true,
          defaultRepDuration: 3.5
        }, parsed.settings || {});

        // Merge any new default exercises if not present
        let stateUpdated = false;
        for (const defEx of DEFAULT_EXERCISES) {
          if (!this.exercises.some(e => e.id === defEx.id)) {
            this.exercises.push(defEx);
            stateUpdated = true;
          }
        }
        // Merge any new default programs if not present
        for (const defProg of DEFAULT_PROGRAMS) {
          if (!this.programs.some(p => p.id === defProg.id)) {
            this.programs.push(defProg);
            stateUpdated = true;
          }
        }
        if (stateUpdated) {
          this.save();
        }
      } else {
        this.resetToDefaults();
      }
    } catch (e) {
      console.error("Failed to load state from localStorage:", e);
      this.resetToDefaults();
    }
  }

  save() {
    try {
      const data = {
        groups: this.groups,
        exercises: this.exercises,
        programs: this.programs,
        history: this.history,
        settings: this.settings,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.notify();
    } catch (e) {
      console.error("Failed to save state:", e);
    }
  }

  resetToDefaults() {
    this.groups = JSON.parse(JSON.stringify(DEFAULT_GROUPS));
    this.exercises = JSON.parse(JSON.stringify(DEFAULT_EXERCISES));
    this.programs = JSON.parse(JSON.stringify(DEFAULT_PROGRAMS));
    this.history = [];
    this.settings = {
      weightUnit: 'kg',
      soundEnabled: true,
      vibrateEnabled: true,
      wakeLockEnabled: true,
      defaultRepDuration: 3.5
    };
    this.save();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this);
    }
  }

  getExercise(id) {
    return this.exercises.find(e => e.id === Number(id));
  }

  getProgram(id) {
    return this.programs.find(p => p.id === Number(id));
  }

  saveExercise(exerciseData) {
    const idx = this.exercises.findIndex(e => e.id === exerciseData.id);
    if (idx >= 0) {
      this.exercises[idx] = { ...this.exercises[idx], ...exerciseData };
    } else {
      const nextId = this.exercises.reduce((max, e) => Math.max(max, e.id), 0) + 1;
      this.exercises.push({ ...exerciseData, id: nextId });
    }
    this.save();
  }

  deleteExercise(id) {
    this.exercises = this.exercises.filter(e => e.id !== id);
    // Also remove from programs
    this.programs.forEach(p => {
      p.exerciseIds = p.exerciseIds.filter(eId => eId !== id);
    });
    this.save();
  }

  saveProgram(progData) {
    const idx = this.programs.findIndex(p => p.id === progData.id);
    if (idx >= 0) {
      this.programs[idx] = { ...this.programs[idx], ...progData };
    } else {
      const nextId = this.programs.reduce((max, p) => Math.max(max, p.id), 0) + 1;
      this.programs.push({ ...progData, id: nextId });
    }
    this.save();
  }

  logWorkoutSession(session) {
    const record = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      programId: session.programId,
      programName: session.programName,
      totalDurationSeconds: session.totalDurationSeconds || 0,
      completedSets: session.completedSets || [], // array of { exerciseId, exerciseName, setIndex, reps, weight, duration }
      notes: session.notes || ''
    };
    this.history.unshift(record);
    this.save();
  }

  exportJson() {
    return JSON.stringify({
      version: 1,
      app: "TitanWorkoutApp",
      exportDate: new Date().toISOString(),
      groups: this.groups,
      exercises: this.exercises,
      programs: this.programs,
      history: this.history,
      settings: this.settings
    }, null, 2);
  }

  importJson(jsonString) {
    const data = JSON.parse(jsonString);
    
    // Check if it's CalisthenicsMemory backup format
    if (data.app === 'CalisthenicsMemory' && Array.isArray(data.exercises)) {
      this.importCalisthenicsMemoryBackup(data);
      return;
    }

    if (Array.isArray(data.exercises)) {
      this.exercises = data.exercises;
    }
    if (Array.isArray(data.programs)) {
      this.programs = data.programs;
    }
    if (Array.isArray(data.groups)) {
      this.groups = data.groups;
    }
    if (Array.isArray(data.history)) {
      this.history = data.history;
    }
    if (data.settings) {
      this.settings = { ...this.settings, ...data.settings };
    }
    this.save();
  }

  importCalisthenicsMemoryBackup(cmData) {
    // Map exercises
    this.exercises = cmData.exercises.map(ex => {
      // Find matching default exercise to retain cues
      const match = DEFAULT_EXERCISES.find(d => d.name.toLowerCase() === ex.name.toLowerCase());
      return {
        id: ex.id,
        name: ex.name,
        type: ex.type || (ex.name.toLowerCase().includes('hold') || ex.name.toLowerCase().includes('plank') ? 'Isometric' : 'Dynamic'),
        group: ex.group || 'Upper Body',
        laterality: ex.laterality || 'Bilateral',
        targetSets: ex.targetSets || 3,
        targetValue: ex.targetValue || 10,
        restInterval: ex.restInterval || 60,
        repDuration: ex.repDuration || (ex.type === 'Isometric' ? null : 3.5),
        weightTrackingEnabled: ex.weightTrackingEnabled !== undefined ? ex.weightTrackingEnabled : true,
        weight: match ? match.weight : 0,
        cue: match ? match.cue : (ex.description || "")
      };
    });

    // Map programs
    if (Array.isArray(cmData.programs) && Array.isArray(cmData.programExercises)) {
      this.programs = cmData.programs.map(prog => {
        const progExs = cmData.programExercises
          .filter(pe => pe.programId === prog.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        
        const defaultProg = DEFAULT_PROGRAMS.find(dp => dp.id === prog.id);

        return {
          id: prog.id,
          name: prog.name,
          subtitle: defaultProg ? defaultProg.subtitle : "",
          warmup: defaultProg ? defaultProg.warmup : [],
          exerciseIds: progExs.map(pe => pe.exerciseId)
        };
      });
    }

    this.save();
  }
}

export const appState = new AppState();
