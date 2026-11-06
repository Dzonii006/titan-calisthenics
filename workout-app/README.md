# Titan Calisthenics Mobile PWA

Minimalist, pitch-black OLED mobile Progressive Web App (PWA) designed for your 4-Day Calisthenics & Gymnastic Rings Program.

## 📱 How to Run and Install on Your Android Phone

1. **Start the local server** (already running as background daemon on port 8080):
   ```bash
   deno run --allow-net --allow-read server.ts
   ```

2. **Open on your phone**:
   - Ensure your Android phone is on the same local Wi-Fi.
   - Open Chrome on your phone and navigate to:
     ```
     http://192.168.1.136:8080
     ```

3. **Install to Home Screen**:
   - Tap the three dots menu (⋮) in Chrome on Android.
   - Tap **"Add to Home screen"** or **"Install app"**.
   - The app installs as a standalone fullscreen app with an OLED dark gymnastics ring icon. It works 100% offline at the gym!

---

## ✨ Features Built Exactly to Your Instructions

- ⏱️ **Big Rest Timer**: Massive countdown timer between sets (with quick `-15s`, `+15s`, `+30s`, and `Skip Rest` buttons) just like CalisthenicsMemory.
- ⚡ **5-Second Get Ready Countdown**: Automatic 5... 4... 3... 2... 1... countdown with high-pitched audio ticks and tactile vibration before each set begins.
- 🔄 **Live Rep Counter with Rep Duration Pacer**:
  - Dynamically counts reps (1, 2, 3...) with an animated visual ring and pacing indicator (e.g. 3.5s per rep tempo).
  - Web Audio tick sound and subtle vibration on every rep completed.
  - Manual `+1` / `-1` tap buttons to easily adjust reps if you hit failure early or push for extra reps.
- ⏳ **Isometric Hold Timers**: Full-screen countdown timers for holds like Ring Support Hold, Tuck L-Sit, and Planks.
- ⚖️ **Weight Tracking (kg)**:
  - Built-in tracking for added weight (e.g. dip belt, weighted vest) and dumbbell exercises.
  - Quick `-2.5kg` / `+2.5kg` buttons or manual keypad input.
  - Remembers your weights from previous sets.
- 🔔 **Synthesized Gym Beeps & Haptics**: Web Audio API generates crisp gym countdown beeps and completion chimes—no external audio files required. Device vibrations fire on Android.
- 💡 **Screen Wake Lock**: Automatically prevents your phone screen from dimming or turning off during an active workout session.
- 📚 **Full Exercise Library & Routine Editor**:
  - All 22 exercises preloaded from your `calisthenics_memory_backup.json`.
  - Filter by Upper Body, Lower Body, Core & Posture.
  - Tap any exercise to customize sets, target reps, rest interval, rep pacing cadence, and technique cues.
- 📋 **Workout History**: Logs completed workouts with date, total duration, completed sets, reps, and total kg volume moved.
- 💾 **1-Click Backup / Restore**:
  - Export state to JSON anytime.
  - Import JSON backups (with native support for your existing `calisthenics_memory_backup.json` format).
