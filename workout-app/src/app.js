import { appState } from './state.js';
import { RoutinesView } from './views/routines_view.js';
import { ExerciseLibraryView } from './views/exercise_library_view.js';
import { HistoryView } from './views/history_view.js';
import { SettingsView } from './views/settings_view.js';
import { WorkoutView } from './views/workout_view.js';

class App {
  constructor() {
    this.currentTab = 'routines';
    this.isWorkoutActive = false;

    this.mainContent = document.getElementById('main-content');
    this.bottomNav = document.getElementById('bottom-nav');

    this.initViews();
    this.initNav();
    this.initServiceWorker();

    // Render initial tab
    this.switchTab('routines');
  }

  initViews() {
    this.routinesView = new RoutinesView(this.mainContent, (progId) => this.startWorkout(progId));
    this.exerciseLibraryView = new ExerciseLibraryView(this.mainContent);
    this.historyView = new HistoryView(this.mainContent);
    this.settingsView = new SettingsView(this.mainContent);
    this.workoutView = new WorkoutView(this.mainContent, () => this.exitWorkout());
  }

  initNav() {
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  switchTab(tab) {
    if (this.isWorkoutActive) return;

    this.currentTab = tab;
    this.updateNavUi();

    window.scrollTo({ top: 0, behavior: 'instant' });

    switch (tab) {
      case 'routines':
        this.routinesView.render();
        break;
      case 'exercises':
        this.exerciseLibraryView.render();
        break;
      case 'history':
        this.historyView.render();
        break;
      case 'settings':
        this.settingsView.render();
        break;
    }
  }

  updateNavUi() {
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    navButtons.forEach(btn => {
      const isCurrent = btn.dataset.tab === this.currentTab;
      btn.className = `nav-tab-btn flex flex-col items-center justify-center py-2 flex-1 transition-all ${
        isCurrent ? 'text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'
      }`;
    });
  }

  startWorkout(programId) {
    this.isWorkoutActive = true;
    this.bottomNav.classList.add('hidden');
    this.workoutView.start(programId);
  }

  exitWorkout() {
    this.isWorkoutActive = false;
    this.bottomNav.classList.remove('hidden');
    this.switchTab('routines');
  }

  initServiceWorker() {
    if (window.location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
          console.log('Service Worker registration note:', err);
        });
      });
    }
  }
}

// Start app on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
