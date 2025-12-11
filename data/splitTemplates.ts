/**
 * Split Templates
 *
 * Evidence-based split structures based on:
 * - Schoenfeld et al. (2016) - Training frequency 2x/week per muscle is optimal
 * - Research consensus on training frequency and volume distribution
 * - Practical gym programming (RP, Jeff Nippard, etc.)
 *
 * Each template defines:
 * - Workout structure with exercise slots
 * - Expected frequency per muscle group
 * - Weekly volume distribution
 */

import {
  SplitTemplate,
  WorkoutTemplate,
  ExerciseSlot,
  MovementPattern,
  ExperienceLevel,
  Goal,
} from '../types/training';

// ==========================================
// EXERCISE SLOT BUILDERS (DRY helpers)
// ==========================================

let slotIdCounter = 0;

function createSlot(
  muscleGroup: string,
  movementPattern: MovementPattern,
  isCompound: boolean,
  sets: number,
  reps: string,
  rest: number,
  priority: number = 5,
  isWarmup: boolean = false
): ExerciseSlot {
  return {
    id: `slot_${++slotIdCounter}`,
    muscleGroup,
    movementPattern,
    isCompound,
    sets,
    reps,
    rest,
    priority,
    isWarmup,
  };
}

// ==========================================
// FULL BODY SPLIT (2-3 days/week)
// ==========================================

const FULL_BODY_A: WorkoutTemplate = {
  id: 'full_body_a',
  name: 'Full Body A',
  nameRu: 'Всё тело A',
  estimatedDuration: 60,
  focus: 'full_body',
  targetMuscles: {
    chest: 3,
    back: 3,
    quads: 3,
    shoulders: 2,
    biceps: 2,
    triceps: 2,
    hamstrings: 2,
    core: 2,
  },
  slots: [
    // Compound Push - Chest
    createSlot('chest', 'horizontal_push', true, 3, '8-12', 120, 10),
    // Compound Pull - Back
    createSlot('back', 'horizontal_pull', true, 3, '8-12', 120, 10),
    // Compound Legs - Quads
    createSlot('quads', 'squat', true, 3, '8-12', 120, 10),
    // Shoulders
    createSlot('shoulders', 'vertical_push', true, 2, '10-12', 90, 7),
    // Isolation - Biceps
    createSlot('biceps', 'isolation', false, 2, '10-15', 60, 5),
    // Isolation - Triceps
    createSlot('triceps', 'isolation', false, 2, '10-15', 60, 5),
    // Hinge - Hamstrings
    createSlot('hamstrings', 'hinge', true, 2, '10-12', 90, 6),
    // Core
    createSlot('core', 'isolation', false, 2, '15-20', 60, 4),
  ],
};

const FULL_BODY_B: WorkoutTemplate = {
  id: 'full_body_b',
  name: 'Full Body B',
  nameRu: 'Всё тело B',
  estimatedDuration: 60,
  focus: 'full_body',
  targetMuscles: {
    chest: 3,
    back: 3,
    quads: 3,
    glutes: 2,
    shoulders: 2,
    biceps: 2,
    triceps: 2,
    calves: 2,
  },
  slots: [
    // Compound Push - Chest (variation)
    createSlot('chest', 'horizontal_push', true, 3, '8-12', 120, 10),
    // Compound Pull - Back (vertical)
    createSlot('back', 'vertical_pull', true, 3, '8-12', 120, 10),
    // Compound Legs - Quads
    createSlot('quads', 'lunge', true, 3, '10-12', 90, 8),
    // Glutes emphasis
    createSlot('glutes', 'hinge', true, 2, '10-12', 90, 7),
    // Shoulders (lateral)
    createSlot('shoulders', 'isolation', false, 2, '12-15', 60, 6),
    // Biceps
    createSlot('biceps', 'isolation', false, 2, '10-15', 60, 5),
    // Triceps
    createSlot('triceps', 'isolation', false, 2, '10-15', 60, 5),
    // Calves
    createSlot('calves', 'isolation', false, 2, '15-20', 60, 4),
  ],
};

const FULL_BODY_C: WorkoutTemplate = {
  id: 'full_body_c',
  name: 'Full Body C',
  nameRu: 'Всё тело C',
  estimatedDuration: 60,
  focus: 'full_body',
  targetMuscles: {
    chest: 3,
    back: 3,
    quads: 2,
    hamstrings: 3,
    shoulders: 2,
    rear_delts: 2,
    biceps: 2,
    core: 2,
  },
  slots: [
    // Incline Push
    createSlot('chest', 'horizontal_push', true, 3, '8-12', 120, 10),
    // Back - Row
    createSlot('back', 'horizontal_pull', true, 3, '8-12', 120, 10),
    // Romanian Deadlift
    createSlot('hamstrings', 'hinge', true, 3, '8-12', 120, 9),
    // Leg Press / Squat variation
    createSlot('quads', 'squat', true, 2, '10-12', 90, 7),
    // Overhead Press
    createSlot('shoulders', 'vertical_push', true, 2, '8-12', 90, 7),
    // Rear Delts
    createSlot('rear_delts', 'isolation', false, 2, '12-15', 60, 5),
    // Biceps
    createSlot('biceps', 'isolation', false, 2, '10-15', 60, 5),
    // Core
    createSlot('core', 'isolation', false, 2, '15-20', 60, 4),
  ],
};

export const FULL_BODY_SPLIT: SplitTemplate = {
  id: 'full_body',
  name: 'Full Body',
  nameRu: 'Всё тело',
  description: 'Train all major muscle groups every session. Best for beginners and those with 2-3 training days.',
  daysPerWeek: 3,
  workouts: [FULL_BODY_A, FULL_BODY_B, FULL_BODY_C],
  muscleFrequency: {
    chest: 3,
    back: 3,
    shoulders: 3,
    biceps: 3,
    triceps: 2,
    quads: 3,
    hamstrings: 2,
    glutes: 1,
    calves: 1,
    core: 2,
    rear_delts: 1,
  },
  weeklyVolume: {
    chest: 9,
    back: 9,
    shoulders: 6,
    biceps: 6,
    triceps: 4,
    quads: 8,
    hamstrings: 5,
    glutes: 2,
    calves: 2,
    core: 4,
    rear_delts: 2,
  },
  suitableFor: [ExperienceLevel.Beginner, ExperienceLevel.Intermediate],
  bestForGoals: [Goal.GeneralHealth, Goal.BuildMuscle, Goal.GetStronger],
};

// ==========================================
// UPPER/LOWER SPLIT (4 days/week)
// ==========================================

const UPPER_A: WorkoutTemplate = {
  id: 'upper_a',
  name: 'Upper A (Push Focus)',
  nameRu: 'Верх A (Жимы)',
  estimatedDuration: 55,
  focus: 'upper',
  targetMuscles: {
    chest: 4,
    shoulders: 3,
    triceps: 3,
    back: 3,
    biceps: 2,
  },
  slots: [
    // Primary Push - Chest
    createSlot('chest', 'horizontal_push', true, 4, '6-10', 150, 10),
    // Shoulder Press
    createSlot('shoulders', 'vertical_push', true, 3, '8-12', 120, 9),
    // Back - Row
    createSlot('back', 'horizontal_pull', true, 3, '8-12', 120, 8),
    // Chest - Secondary
    createSlot('chest', 'horizontal_push', false, 3, '10-12', 90, 6),
    // Triceps
    createSlot('triceps', 'isolation', false, 3, '10-15', 60, 5),
    // Lateral Raises
    createSlot('shoulders', 'isolation', false, 2, '12-15', 60, 5),
    // Biceps
    createSlot('biceps', 'isolation', false, 2, '10-15', 60, 4),
  ],
};

const LOWER_A: WorkoutTemplate = {
  id: 'lower_a',
  name: 'Lower A (Quad Focus)',
  nameRu: 'Низ A (Квадрицепсы)',
  estimatedDuration: 50,
  focus: 'lower',
  targetMuscles: {
    quads: 5,
    hamstrings: 3,
    glutes: 2,
    calves: 2,
    core: 2,
  },
  slots: [
    // Primary Squat
    createSlot('quads', 'squat', true, 4, '6-10', 180, 10),
    // Secondary Quad
    createSlot('quads', 'squat', true, 3, '10-12', 120, 8),
    // RDL
    createSlot('hamstrings', 'hinge', true, 3, '8-12', 120, 8),
    // Hip Thrust
    createSlot('glutes', 'hinge', true, 2, '10-12', 90, 6),
    // Leg Curl
    createSlot('hamstrings', 'isolation', false, 2, '12-15', 60, 5),
    // Calves
    createSlot('calves', 'isolation', false, 3, '12-20', 60, 4),
    // Core
    createSlot('core', 'isolation', false, 2, '15-20', 60, 4),
  ],
};

const UPPER_B: WorkoutTemplate = {
  id: 'upper_b',
  name: 'Upper B (Pull Focus)',
  nameRu: 'Верх B (Тяги)',
  estimatedDuration: 55,
  focus: 'upper',
  targetMuscles: {
    back: 5,
    biceps: 3,
    rear_delts: 2,
    chest: 2,
    triceps: 2,
  },
  slots: [
    // Primary Pull - Back
    createSlot('back', 'vertical_pull', true, 4, '6-10', 150, 10),
    // Secondary Row
    createSlot('back', 'horizontal_pull', true, 3, '8-12', 120, 9),
    // Chest - Isolation
    createSlot('chest', 'horizontal_push', false, 3, '10-12', 90, 6),
    // Rear Delts
    createSlot('rear_delts', 'isolation', false, 3, '12-15', 60, 6),
    // Biceps - Primary
    createSlot('biceps', 'isolation', false, 3, '8-12', 60, 6),
    // Back - Pullover or Shrug
    createSlot('back', 'isolation', false, 2, '10-15', 60, 5),
    // Triceps
    createSlot('triceps', 'isolation', false, 2, '10-15', 60, 4),
  ],
};

const LOWER_B: WorkoutTemplate = {
  id: 'lower_b',
  name: 'Lower B (Hip Focus)',
  nameRu: 'Низ B (Бицепс бедра)',
  estimatedDuration: 50,
  focus: 'lower',
  targetMuscles: {
    hamstrings: 4,
    glutes: 4,
    quads: 3,
    calves: 2,
    core: 2,
  },
  slots: [
    // Deadlift / RDL
    createSlot('hamstrings', 'hinge', true, 4, '6-10', 180, 10),
    // Hip Thrust
    createSlot('glutes', 'hinge', true, 4, '8-12', 120, 9),
    // Leg Press / Split Squat
    createSlot('quads', 'lunge', true, 3, '10-12', 90, 7),
    // Leg Curl
    createSlot('hamstrings', 'isolation', false, 3, '10-15', 60, 6),
    // Glute Isolation
    createSlot('glutes', 'isolation', false, 2, '12-15', 60, 5),
    // Calves
    createSlot('calves', 'isolation', false, 3, '12-20', 60, 4),
    // Core
    createSlot('core', 'isolation', false, 2, '15-20', 60, 4),
  ],
};

export const UPPER_LOWER_SPLIT: SplitTemplate = {
  id: 'upper_lower',
  name: 'Upper/Lower',
  nameRu: 'Верх/Низ',
  description: 'Split training between upper and lower body. Ideal for 4 days per week with good frequency.',
  daysPerWeek: 4,
  workouts: [UPPER_A, LOWER_A, UPPER_B, LOWER_B],
  muscleFrequency: {
    chest: 2,
    back: 2,
    shoulders: 2,
    biceps: 2,
    triceps: 2,
    quads: 2,
    hamstrings: 2,
    glutes: 2,
    calves: 2,
    core: 2,
    rear_delts: 2,
  },
  weeklyVolume: {
    chest: 12,
    back: 14,
    shoulders: 8,
    biceps: 8,
    triceps: 8,
    quads: 13,
    hamstrings: 12,
    glutes: 8,
    calves: 8,
    core: 4,
    rear_delts: 6,
  },
  suitableFor: [ExperienceLevel.Intermediate, ExperienceLevel.Advanced],
  bestForGoals: [Goal.BuildMuscle, Goal.GetStronger],
};

// ==========================================
// PUSH/PULL/LEGS SPLIT (5-6 days/week)
// ==========================================

const PUSH_A: WorkoutTemplate = {
  id: 'push_a',
  name: 'Push A',
  nameRu: 'Жимы A',
  estimatedDuration: 55,
  focus: 'push',
  targetMuscles: {
    chest: 5,
    shoulders: 4,
    triceps: 3,
  },
  slots: [
    // Bench Press
    createSlot('chest', 'horizontal_push', true, 4, '6-10', 150, 10),
    // Overhead Press
    createSlot('shoulders', 'vertical_push', true, 3, '8-12', 120, 9),
    // Incline DB Press
    createSlot('chest', 'horizontal_push', true, 3, '8-12', 90, 7),
    // Lateral Raises
    createSlot('shoulders', 'isolation', false, 3, '12-15', 60, 6),
    // Chest Flyes
    createSlot('chest', 'isolation', false, 2, '12-15', 60, 5),
    // Triceps Extension
    createSlot('triceps', 'isolation', false, 3, '10-15', 60, 5),
    // Overhead Triceps
    createSlot('triceps', 'isolation', false, 2, '10-15', 60, 4),
  ],
};

const PULL_A: WorkoutTemplate = {
  id: 'pull_a',
  name: 'Pull A',
  nameRu: 'Тяги A',
  estimatedDuration: 55,
  focus: 'pull',
  targetMuscles: {
    back: 6,
    biceps: 4,
    rear_delts: 3,
  },
  slots: [
    // Pull-ups / Lat Pulldown
    createSlot('back', 'vertical_pull', true, 4, '6-10', 150, 10),
    // Barbell Row
    createSlot('back', 'horizontal_pull', true, 4, '8-12', 120, 9),
    // Face Pulls / Rear Delt Flyes
    createSlot('rear_delts', 'isolation', false, 3, '12-15', 60, 7),
    // Cable Row
    createSlot('back', 'horizontal_pull', true, 3, '10-12', 90, 6),
    // Bicep Curls
    createSlot('biceps', 'isolation', false, 3, '8-12', 60, 6),
    // Hammer Curls
    createSlot('biceps', 'isolation', false, 3, '10-12', 60, 5),
    // Shrugs
    createSlot('back', 'isolation', false, 2, '10-15', 60, 4),
  ],
};

const LEGS_A: WorkoutTemplate = {
  id: 'legs_a',
  name: 'Legs A',
  nameRu: 'Ноги A',
  estimatedDuration: 60,
  focus: 'legs',
  targetMuscles: {
    quads: 6,
    hamstrings: 4,
    glutes: 3,
    calves: 3,
    core: 2,
  },
  slots: [
    // Squat
    createSlot('quads', 'squat', true, 4, '6-10', 180, 10),
    // Romanian Deadlift
    createSlot('hamstrings', 'hinge', true, 4, '8-12', 120, 9),
    // Leg Press
    createSlot('quads', 'squat', true, 3, '10-12', 90, 7),
    // Hip Thrust
    createSlot('glutes', 'hinge', true, 3, '10-12', 90, 7),
    // Leg Curl
    createSlot('hamstrings', 'isolation', false, 3, '10-15', 60, 5),
    // Leg Extension
    createSlot('quads', 'isolation', false, 2, '12-15', 60, 5),
    // Calves
    createSlot('calves', 'isolation', false, 4, '12-20', 60, 4),
    // Core
    createSlot('core', 'isolation', false, 2, '15-20', 60, 4),
  ],
};

const PUSH_B: WorkoutTemplate = {
  id: 'push_b',
  name: 'Push B',
  nameRu: 'Жимы B',
  estimatedDuration: 55,
  focus: 'push',
  targetMuscles: {
    chest: 4,
    shoulders: 5,
    triceps: 4,
  },
  slots: [
    // Overhead Press (primary)
    createSlot('shoulders', 'vertical_push', true, 4, '6-10', 150, 10),
    // Incline Bench
    createSlot('chest', 'horizontal_push', true, 3, '8-12', 120, 8),
    // DB Shoulder Press
    createSlot('shoulders', 'vertical_push', true, 3, '10-12', 90, 7),
    // Cable Flyes
    createSlot('chest', 'isolation', false, 3, '12-15', 60, 6),
    // Lateral Raises
    createSlot('shoulders', 'isolation', false, 3, '15-20', 45, 6),
    // Close Grip Bench / Dips
    createSlot('triceps', 'horizontal_push', true, 3, '8-12', 90, 6),
    // Triceps Pushdowns
    createSlot('triceps', 'isolation', false, 3, '12-15', 60, 5),
  ],
};

const PULL_B: WorkoutTemplate = {
  id: 'pull_b',
  name: 'Pull B',
  nameRu: 'Тяги B',
  estimatedDuration: 55,
  focus: 'pull',
  targetMuscles: {
    back: 5,
    biceps: 4,
    rear_delts: 4,
  },
  slots: [
    // Barbell Row (primary)
    createSlot('back', 'horizontal_pull', true, 4, '6-10', 150, 10),
    // Lat Pulldown
    createSlot('back', 'vertical_pull', true, 3, '8-12', 120, 8),
    // Rear Delt Focus
    createSlot('rear_delts', 'isolation', false, 4, '12-15', 60, 7),
    // One Arm DB Row
    createSlot('back', 'horizontal_pull', true, 3, '10-12', 90, 6),
    // Preacher Curls
    createSlot('biceps', 'isolation', false, 3, '8-12', 60, 6),
    // Incline Curls
    createSlot('biceps', 'isolation', false, 3, '10-15', 60, 5),
    // Reverse Flyes
    createSlot('rear_delts', 'isolation', false, 2, '15-20', 45, 4),
  ],
};

const LEGS_B: WorkoutTemplate = {
  id: 'legs_b',
  name: 'Legs B',
  nameRu: 'Ноги B',
  estimatedDuration: 60,
  focus: 'legs',
  targetMuscles: {
    quads: 4,
    hamstrings: 5,
    glutes: 5,
    calves: 3,
    core: 2,
  },
  slots: [
    // Romanian / Stiff Leg Deadlift
    createSlot('hamstrings', 'hinge', true, 4, '6-10', 180, 10),
    // Hip Thrust (primary)
    createSlot('glutes', 'hinge', true, 4, '8-12', 120, 9),
    // Bulgarian Split Squat
    createSlot('quads', 'lunge', true, 3, '10-12', 90, 7),
    // Glute Kickbacks / Cable Pull Through
    createSlot('glutes', 'isolation', false, 3, '12-15', 60, 6),
    // Lying Leg Curl
    createSlot('hamstrings', 'isolation', false, 3, '10-15', 60, 6),
    // Leg Press (feet high)
    createSlot('hamstrings', 'squat', true, 3, '12-15', 90, 5),
    // Seated Calves
    createSlot('calves', 'isolation', false, 4, '15-25', 45, 4),
    // Core
    createSlot('core', 'isolation', false, 2, '15-20', 60, 4),
  ],
};

export const PPL_SPLIT: SplitTemplate = {
  id: 'ppl',
  name: 'Push/Pull/Legs',
  nameRu: 'Тяни/Толкай/Ноги',
  description: 'Classic 6-day split hitting each muscle group twice per week with high volume.',
  daysPerWeek: 6,
  workouts: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B],
  muscleFrequency: {
    chest: 2,
    back: 2,
    shoulders: 2,
    biceps: 2,
    triceps: 2,
    quads: 2,
    hamstrings: 2,
    glutes: 2,
    calves: 2,
    core: 2,
    rear_delts: 2,
  },
  weeklyVolume: {
    chest: 17,
    back: 22,
    shoulders: 16,
    biceps: 14,
    triceps: 14,
    quads: 18,
    hamstrings: 16,
    glutes: 14,
    calves: 14,
    core: 4,
    rear_delts: 14,
  },
  suitableFor: [ExperienceLevel.Intermediate, ExperienceLevel.Advanced],
  bestForGoals: [Goal.BuildMuscle],
};

// ==========================================
// 5-DAY UPPER/LOWER/PUSH/PULL/LEGS
// ==========================================

export const ULPPL_SPLIT: SplitTemplate = {
  id: 'ulppl',
  name: 'Upper/Lower + PPL',
  nameRu: 'Верх/Низ + PPL',
  description: '5-day hybrid split combining Upper/Lower with Push/Pull/Legs rotation.',
  daysPerWeek: 5,
  workouts: [UPPER_A, LOWER_A, PUSH_A, PULL_A, LEGS_A],
  muscleFrequency: {
    chest: 2,
    back: 2,
    shoulders: 2,
    biceps: 2,
    triceps: 2,
    quads: 2,
    hamstrings: 2,
    glutes: 2,
    calves: 2,
    core: 2,
    rear_delts: 2,
  },
  weeklyVolume: {
    chest: 15,
    back: 17,
    shoulders: 12,
    biceps: 10,
    triceps: 10,
    quads: 16,
    hamstrings: 12,
    glutes: 8,
    calves: 8,
    core: 4,
    rear_delts: 8,
  },
  suitableFor: [ExperienceLevel.Intermediate, ExperienceLevel.Advanced],
  bestForGoals: [Goal.BuildMuscle, Goal.GetStronger],
};

// ==========================================
// ALL SPLITS COLLECTION
// ==========================================

export const ALL_SPLITS: SplitTemplate[] = [
  FULL_BODY_SPLIT,
  UPPER_LOWER_SPLIT,
  ULPPL_SPLIT,
  PPL_SPLIT,
];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get the recommended split based on days per week
 */
export function getSplitByDaysPerWeek(daysPerWeek: number): SplitTemplate {
  if (daysPerWeek <= 3) {
    return FULL_BODY_SPLIT;
  } else if (daysPerWeek === 4) {
    return UPPER_LOWER_SPLIT;
  } else if (daysPerWeek === 5) {
    return ULPPL_SPLIT;
  } else {
    return PPL_SPLIT;
  }
}

/**
 * Get splits suitable for a given experience level
 */
export function getSplitsForExperience(experience: ExperienceLevel): SplitTemplate[] {
  return ALL_SPLITS.filter(split => split.suitableFor.includes(experience));
}

/**
 * Get splits suitable for a given goal
 */
export function getSplitsForGoal(goal: Goal): SplitTemplate[] {
  return ALL_SPLITS.filter(split => split.bestForGoals.includes(goal));
}

/**
 * Get split by ID
 */
export function getSplitById(id: string): SplitTemplate | undefined {
  return ALL_SPLITS.find(split => split.id === id);
}

/**
 * Calculate total weekly sets from a split
 */
export function calculateTotalWeeklySets(split: SplitTemplate): number {
  return Object.values(split.weeklyVolume).reduce((sum, sets) => sum + sets, 0);
}

/**
 * Get workouts for a specific day of the week
 * Distributes workouts across preferred training days
 */
export function getWorkoutSchedule(
  split: SplitTemplate,
  preferredDays: number[] // 0 = Sunday, 1 = Monday, etc.
): Array<{ day: number; workout: WorkoutTemplate }> {
  const schedule: Array<{ day: number; workout: WorkoutTemplate }> = [];

  // Ensure we have enough days
  const daysToUse = preferredDays.slice(0, split.daysPerWeek);

  for (let i = 0; i < split.workouts.length && i < daysToUse.length; i++) {
    schedule.push({
      day: daysToUse[i],
      workout: split.workouts[i],
    });
  }

  return schedule;
}

/**
 * Adjust split volume based on mesocycle phase
 */
export function adjustSplitForPhase(
  split: SplitTemplate,
  volumeMultiplier: number
): SplitTemplate {
  return {
    ...split,
    workouts: split.workouts.map(workout => ({
      ...workout,
      slots: workout.slots.map(slot => ({
        ...slot,
        sets: Math.max(1, Math.round(slot.sets * volumeMultiplier)),
      })),
    })),
    weeklyVolume: Object.fromEntries(
      Object.entries(split.weeklyVolume).map(([muscle, sets]) => [
        muscle,
        Math.round(sets * volumeMultiplier),
      ])
    ),
  };
}
