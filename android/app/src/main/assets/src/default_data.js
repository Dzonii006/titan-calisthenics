// Default data preloaded from CalisthenicsMemory & Calisthenics_Rings_Program.md
export const DEFAULT_GROUPS = [
  { id: 1, name: "Upper Body", displayOrder: 0 },
  { id: 2, name: "Lower Body", displayOrder: 1 },
  { id: 3, name: "Core & Posture", displayOrder: 2 }
];

export const DEFAULT_EXERCISES = [
  {
    id: 1,
    name: "Ring Support Hold",
    type: "Isometric",
    group: "Upper Body",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 20, // seconds
    restInterval: 60,
    repDuration: null,
    weightTrackingEnabled: false,
    weight: 0,
    cue: "Elbows fully locked, rings turned slightly outward (RTO), shoulders depressed."
  },
  {
    id: 2,
    name: "Ring Inverted Rows",
    type: "Dynamic",
    group: "Upper Body",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 10, // reps
    restInterval: 90,
    repDuration: 3.5, // seconds per rep
    weightTrackingEnabled: true,
    weight: 0,
    cue: "Body in straight plank, pull chest to rings, 1s pause at top."
  },
  {
    id: 3,
    name: "Ring Push-ups",
    type: "Dynamic",
    group: "Upper Body",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 10,
    restInterval: 90,
    repDuration: 3.5,
    weightTrackingEnabled: true,
    weight: 0,
    cue: "Turn rings outward at top of lockout. Core braced, full range of motion."
  },
  {
    id: 4,
    name: "Parallel Dip Bar Dips",
    type: "Dynamic",
    group: "Upper Body",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 8,
    restInterval: 90,
    repDuration: 3.5,
    weightTrackingEnabled: true,
    weight: 0,
    cue: "Bar rests on heel of palms; lean torso slightly forward, full depth."
  },
  {
    id: 5,
    name: "DB Lateral Raises",
    type: "Dynamic",
    group: "Upper Body",
    laterality: "Bilateral",
    targetSets: 4,
    targetValue: 12,
    restInterval: 60,
    repDuration: 3.0,
    weightTrackingEnabled: true,
    weight: 6.0,
    cue: "Strict form, lead with elbows, 1s pause at shoulder height."
  },
  {
    id: 6,
    name: "DB Hammer Curls",
    type: "Dynamic",
    group: "Upper Body",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 10,
    restInterval: 60,
    repDuration: 3.0,
    weightTrackingEnabled: true,
    weight: 10.0,
    cue: "Neutral grip (palms facing each other), controlled 2s lowering."
  },
  {
    id: 7,
    name: "Strict Pull-ups / Chin-ups",
    type: "Dynamic",
    group: "Upper Body",
    laterality: "Bilateral",
    targetSets: 4,
    targetValue: 6,
    restInterval: 120,
    repDuration: 4.0,
    weightTrackingEnabled: true,
    weight: 0,
    cue: "Full deadhang at bottom, chin clearly clears the bar, zero kicking/kipping."
  },
  {
    id: 8,
    name: "Ring Dips",
    type: "Dynamic",
    group: "Upper Body",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 6,
    restInterval: 90,
    repDuration: 4.0,
    weightTrackingEnabled: true,
    weight: 0,
    cue: "Stabilize rings close to body, turn rings outward at top lockout."
  },
  {
    id: 9,
    name: "Pike Push-ups",
    type: "Dynamic",
    group: "Upper Body",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 8,
    restInterval: 90,
    repDuration: 3.5,
    weightTrackingEnabled: false,
    weight: 0,
    cue: "Head travels forward creating a tripod; push through shoulders to top."
  },
  {
    id: 10,
    name: "Ring Archer / Wide Push-ups",
    type: "Dynamic",
    group: "Upper Body",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 8,
    restInterval: 90,
    repDuration: 4.0,
    weightTrackingEnabled: false,
    weight: 0,
    cue: "Straight working arm descends with ring turned out; straight opposing arm."
  },
  {
    id: 11,
    name: "DB Rear Delt Flyes",
    type: "Dynamic",
    group: "Upper Body",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 12,
    restInterval: 60,
    repDuration: 3.0,
    weightTrackingEnabled: true,
    weight: 6.0,
    cue: "Hinge at hips with flat back; sweep elbows wide squeeze rear delts."
  },
  {
    id: 12,
    name: "Ring Triceps Extensions",
    type: "Dynamic",
    group: "Upper Body",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 10,
    restInterval: 60,
    repDuration: 3.5,
    weightTrackingEnabled: false,
    weight: 0,
    cue: "Elbows held high and in front; hinge only at the elbows, squeeze triceps."
  },
  {
    id: 13,
    name: "DB Romanian Deadlifts (RDLs)",
    type: "Dynamic",
    group: "Lower Body",
    laterality: "Bilateral",
    targetSets: 4,
    targetValue: 10,
    restInterval: 90,
    repDuration: 4.0,
    weightTrackingEnabled: true,
    weight: 16.0,
    cue: "Hips drive back, soft knees, shins vertical, hard glute squeeze at top."
  },
  {
    id: 14,
    name: "DB Bulgarian Split Squats",
    type: "Dynamic",
    group: "Lower Body",
    laterality: "Unilateral",
    targetSets: 3,
    targetValue: 8,
    restInterval: 90,
    repDuration: 3.5,
    weightTrackingEnabled: true,
    weight: 10.0,
    cue: "Rear foot elevated; lower until front thigh is parallel, push through front heel."
  },
  {
    id: 15,
    name: "DB Standing Calf Raises",
    type: "Dynamic",
    group: "Lower Body",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 15,
    restInterval: 45,
    repDuration: 3.0,
    weightTrackingEnabled: true,
    weight: 12.0,
    cue: "Full stretch at bottom, 2s peak hold on tiptoes, slow descent."
  },
  {
    id: 16,
    name: "DB Goblet Squats",
    type: "Dynamic",
    group: "Lower Body",
    laterality: "Bilateral",
    targetSets: 4,
    targetValue: 10,
    restInterval: 90,
    repDuration: 3.5,
    weightTrackingEnabled: true,
    weight: 16.0,
    cue: "Hold dumbbell against chest, knees track over toes, full depth below parallel."
  },
  {
    id: 17,
    name: "Single-Leg DB Glute Bridges",
    type: "Dynamic",
    group: "Lower Body",
    laterality: "Unilateral",
    targetSets: 3,
    targetValue: 12,
    restInterval: 60,
    repDuration: 3.5,
    weightTrackingEnabled: true,
    weight: 8.0,
    cue: "Drive through heel, tuck pelvis into PPT, 2s pause at top squeeze."
  },
  {
    id: 18,
    name: "DB Walking Lunges",
    type: "Dynamic",
    group: "Lower Body",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 12,
    restInterval: 60,
    repDuration: 3.5,
    weightTrackingEnabled: true,
    weight: 10.0,
    cue: "Torso upright, back knee gently kisses ground, drive up through front mid-foot."
  },
  {
    id: 19,
    name: "Hanging Knee/Leg Raises",
    type: "Dynamic",
    group: "Core & Posture",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 10,
    restInterval: 60,
    repDuration: 3.5,
    weightTrackingEnabled: false,
    weight: 0,
    cue: "Strict—no swinging. Curl pelvis upward toward ribs with posterior pelvic tilt."
  },
  {
    id: 20,
    name: "Hollow Body Hold",
    type: "Isometric",
    group: "Core & Posture",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 30, // seconds
    restInterval: 45,
    repDuration: null,
    weightTrackingEnabled: false,
    weight: 0,
    cue: "Lower back pressed flat into floor; engage core tight, toes pointed."
  },
  {
    id: 21,
    name: "Dip Bar Tuck L-Sit Hold",
    type: "Isometric",
    group: "Core & Posture",
    laterality: "Bilateral",
    targetSets: 4,
    targetValue: 12, // seconds
    restInterval: 60,
    repDuration: null,
    weightTrackingEnabled: false,
    weight: 0,
    cue: "Depress shoulders hard (tall neck), pull knees tight to chest, breathe."
  },
  {
    id: 22,
    name: "Plank (Posterior Pelvic Tilt)",
    type: "Isometric",
    group: "Core & Posture",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 45, // seconds
    restInterval: 45,
    repDuration: null,
    weightTrackingEnabled: false,
    weight: 0,
    cue: "Squeeze glutes rock-hard, tuck tailbone under, pull elbows toward toes."
  },
  {
    id: 23,
    name: "Half-Kneeling Hip Flexor Stretch",
    type: "Isometric",
    group: "Core & Posture",
    laterality: "Unilateral",
    targetSets: 2,
    targetValue: 60, // seconds per side
    restInterval: 30,
    repDuration: null,
    weightTrackingEnabled: false,
    weight: 0,
    cue: "Tuck tailbone under into posterior tilt and squeeze rear glute tightly. Do not arch lower back."
  },
  {
    id: 24,
    name: "Glute Bridges with Pelvic Tuck",
    type: "Dynamic",
    group: "Core & Posture",
    laterality: "Bilateral",
    targetSets: 2,
    targetValue: 15, // reps
    restInterval: 45,
    repDuration: 3.5,
    weightTrackingEnabled: false,
    weight: 0,
    cue: "Flatten lower back against the floor first, drive through heels, 2s glute pause at top."
  },
  {
    id: 25,
    name: "Deadbug (Flat Lumbar Spine)",
    type: "Dynamic",
    group: "Core & Posture",
    laterality: "Bilateral",
    targetSets: 2,
    targetValue: 20, // 10 reps / side = 20 total
    restInterval: 45,
    repDuration: 3.5,
    weightTrackingEnabled: false,
    weight: 0,
    cue: "Lower back must remain glued flat to the floor at all times. Controlled breathing."
  },
  {
    id: 26,
    name: "Stomach Vacuum (TVA Bracing)",
    type: "Isometric",
    group: "Core & Posture",
    laterality: "Bilateral",
    targetSets: 3,
    targetValue: 20, // seconds
    restInterval: 30,
    repDuration: null,
    weightTrackingEnabled: false,
    weight: 0,
    cue: "Fully exhale all air, suck navel inward toward spine, hold 20s."
  }
];

export const DEFAULT_PROGRAMS = [
  {
    id: 1,
    name: "Workout A - Upper (Push/Pull & Delts)",
    subtitle: "Horizontal Push & Pull + Delts Focus",
    warmup: [
      "Wrist rocks & wrist circles: 45s",
      "Big arm circles & crosses: 30s",
      "Scapular push-ups: 10 reps",
      "Ring support hold (feet on floor): 15s"
    ],
    exerciseIds: [1, 2, 3, 4, 5, 6]
  },
  {
    id: 2,
    name: "Workout B - Lower & Posture A",
    subtitle: "Posterior Chain, Glutes & Compression",
    warmup: [
      "Bodyweight squats: 12 reps",
      "Half-kneeling hip flexor stretch: 45s / side",
      "Glute bridges: 12 reps with 2s squeeze at top"
    ],
    exerciseIds: [13, 14, 15, 19, 20]
  },
  {
    id: 3,
    name: "Workout C - Upper (Vertical & Delts)",
    subtitle: "Vertical Push/Pull & Arms Focus",
    warmup: [
      "Wrist rocks: 30s",
      "Deadhang + Scapular shrugs on bar: 15s hang + 8 shrugs",
      "Push-up to downward dog: 6 reps"
    ],
    exerciseIds: [7, 8, 9, 10, 11, 12]
  },
  {
    id: 4,
    name: "Workout D - Lower & Core B",
    subtitle: "Quads, Glutes & Anti-Extension",
    warmup: [
      "90/90 hip mobility: 45s / side",
      "Lateral lunges: 8 reps / side",
      "Bird-dog with 3s hold: 6 reps / side"
    ],
    exerciseIds: [16, 17, 18, 21, 22]
  },
  {
    id: 5,
    name: "Daily Posture & APT Reset",
    subtitle: "Daily 6-Min Pelvic Alignment & TVA Bracing",
    warmup: [
      "Pelvic tilts on floor: 10 reps to find neutral spine",
      "Diaphragmatic breathing into abdomen: 5 deep breaths"
    ],
    exerciseIds: [23, 24, 25, 26]
  }
];
