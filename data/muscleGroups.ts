/**
 * Muscle Groups Database
 *
 * Volume recommendations based on:
 * - Schoenfeld et al. (2017) - Dose-response relationship between weekly RT volume and increases in muscle mass
 * - RP Strength - Training Volume Landmarks for Muscle Growth
 * - ACSM Position Stand - Progression Models in Resistance Training
 *
 * MEV = Minimum Effective Volume (sets/week to maintain or start seeing gains)
 * MRV = Maximum Recoverable Volume (sets/week before recovery is compromised)
 */

import { MuscleGroup, MuscleGroupVolume, ExperienceLevel } from '../types/training';

// Volume recommendations by experience level (sets per week)
export const MUSCLE_VOLUME_BY_EXPERIENCE: { [muscleId: string]: MuscleGroupVolume } = {
  chest: {
    [ExperienceLevel.Beginner]: { min: 6, optimal: 10, max: 12 },
    [ExperienceLevel.Intermediate]: { min: 10, optimal: 14, max: 18 },
    [ExperienceLevel.Advanced]: { min: 12, optimal: 18, max: 22 },
  },
  back: {
    [ExperienceLevel.Beginner]: { min: 8, optimal: 12, max: 14 },
    [ExperienceLevel.Intermediate]: { min: 12, optimal: 16, max: 20 },
    [ExperienceLevel.Advanced]: { min: 14, optimal: 20, max: 25 },
  },
  shoulders: {
    [ExperienceLevel.Beginner]: { min: 6, optimal: 10, max: 12 },
    [ExperienceLevel.Intermediate]: { min: 10, optimal: 14, max: 18 },
    [ExperienceLevel.Advanced]: { min: 12, optimal: 16, max: 22 },
  },
  rear_delts: {
    [ExperienceLevel.Beginner]: { min: 4, optimal: 6, max: 8 },
    [ExperienceLevel.Intermediate]: { min: 6, optimal: 10, max: 14 },
    [ExperienceLevel.Advanced]: { min: 8, optimal: 12, max: 16 },
  },
  biceps: {
    [ExperienceLevel.Beginner]: { min: 4, optimal: 8, max: 10 },
    [ExperienceLevel.Intermediate]: { min: 8, optimal: 12, max: 16 },
    [ExperienceLevel.Advanced]: { min: 10, optimal: 16, max: 20 },
  },
  triceps: {
    [ExperienceLevel.Beginner]: { min: 4, optimal: 8, max: 10 },
    [ExperienceLevel.Intermediate]: { min: 8, optimal: 12, max: 16 },
    [ExperienceLevel.Advanced]: { min: 10, optimal: 16, max: 20 },
  },
  quads: {
    [ExperienceLevel.Beginner]: { min: 6, optimal: 10, max: 12 },
    [ExperienceLevel.Intermediate]: { min: 10, optimal: 14, max: 18 },
    [ExperienceLevel.Advanced]: { min: 12, optimal: 18, max: 22 },
  },
  hamstrings: {
    [ExperienceLevel.Beginner]: { min: 4, optimal: 8, max: 10 },
    [ExperienceLevel.Intermediate]: { min: 8, optimal: 12, max: 14 },
    [ExperienceLevel.Advanced]: { min: 10, optimal: 14, max: 18 },
  },
  glutes: {
    [ExperienceLevel.Beginner]: { min: 4, optimal: 8, max: 10 },
    [ExperienceLevel.Intermediate]: { min: 8, optimal: 12, max: 16 },
    [ExperienceLevel.Advanced]: { min: 10, optimal: 14, max: 20 },
  },
  calves: {
    [ExperienceLevel.Beginner]: { min: 4, optimal: 8, max: 10 },
    [ExperienceLevel.Intermediate]: { min: 8, optimal: 12, max: 16 },
    [ExperienceLevel.Advanced]: { min: 10, optimal: 16, max: 20 },
  },
  core: {
    [ExperienceLevel.Beginner]: { min: 4, optimal: 6, max: 10 },
    [ExperienceLevel.Intermediate]: { min: 6, optimal: 10, max: 14 },
    [ExperienceLevel.Advanced]: { min: 8, optimal: 12, max: 16 },
  },
  forearms: {
    [ExperienceLevel.Beginner]: { min: 2, optimal: 4, max: 6 },
    [ExperienceLevel.Intermediate]: { min: 4, optimal: 8, max: 10 },
    [ExperienceLevel.Advanced]: { min: 6, optimal: 10, max: 14 },
  },
};

// Main muscle groups database
export const MUSCLE_GROUPS: MuscleGroup[] = [
  // === UPPER BODY - PUSH ===
  {
    id: 'chest',
    nameRu: 'Грудные мышцы',
    nameEn: 'Chest',
    weeklyMinSets: 10,
    weeklyMaxSets: 20,
    recoveryHours: 48,
    synergists: ['triceps', 'shoulders'],
  },
  {
    id: 'shoulders',
    nameRu: 'Плечи (передние и средние дельты)',
    nameEn: 'Shoulders (Front & Side Delts)',
    weeklyMinSets: 10,
    weeklyMaxSets: 18,
    recoveryHours: 48,
    synergists: ['triceps', 'chest'],
  },
  {
    id: 'triceps',
    nameRu: 'Трицепс',
    nameEn: 'Triceps',
    weeklyMinSets: 8,
    weeklyMaxSets: 16,
    recoveryHours: 48,
    synergists: ['chest', 'shoulders'],
  },

  // === UPPER BODY - PULL ===
  {
    id: 'back',
    nameRu: 'Спина (широчайшие, ромбовидные)',
    nameEn: 'Back (Lats, Rhomboids)',
    weeklyMinSets: 12,
    weeklyMaxSets: 22,
    recoveryHours: 48,
    synergists: ['biceps', 'rear_delts'],
  },
  {
    id: 'rear_delts',
    nameRu: 'Задние дельты',
    nameEn: 'Rear Delts',
    weeklyMinSets: 6,
    weeklyMaxSets: 14,
    recoveryHours: 48,
    synergists: ['back'],
  },
  {
    id: 'biceps',
    nameRu: 'Бицепс',
    nameEn: 'Biceps',
    weeklyMinSets: 8,
    weeklyMaxSets: 16,
    recoveryHours: 48,
    synergists: ['back'],
  },

  // === LOWER BODY ===
  {
    id: 'quads',
    nameRu: 'Квадрицепсы',
    nameEn: 'Quadriceps',
    weeklyMinSets: 10,
    weeklyMaxSets: 20,
    recoveryHours: 72,
    synergists: ['glutes'],
  },
  {
    id: 'hamstrings',
    nameRu: 'Бицепс бедра',
    nameEn: 'Hamstrings',
    weeklyMinSets: 8,
    weeklyMaxSets: 16,
    recoveryHours: 72,
    synergists: ['glutes'],
  },
  {
    id: 'glutes',
    nameRu: 'Ягодицы',
    nameEn: 'Glutes',
    weeklyMinSets: 8,
    weeklyMaxSets: 18,
    recoveryHours: 72,
    synergists: ['quads', 'hamstrings'],
  },
  {
    id: 'calves',
    nameRu: 'Икры',
    nameEn: 'Calves',
    weeklyMinSets: 8,
    weeklyMaxSets: 16,
    recoveryHours: 48,
  },

  // === CORE ===
  {
    id: 'core',
    nameRu: 'Кор (пресс, косые)',
    nameEn: 'Core (Abs, Obliques)',
    weeklyMinSets: 6,
    weeklyMaxSets: 14,
    recoveryHours: 24,
  },

  // === ACCESSORY ===
  {
    id: 'forearms',
    nameRu: 'Предплечья',
    nameEn: 'Forearms',
    weeklyMinSets: 4,
    weeklyMaxSets: 10,
    recoveryHours: 48,
    synergists: ['biceps'],
  },
];

// Helper functions

/**
 * Get muscle group by ID
 */
export function getMuscleGroup(id: string): MuscleGroup | undefined {
  return MUSCLE_GROUPS.find(m => m.id === id);
}

/**
 * Get volume recommendations for a muscle group and experience level
 */
export function getVolumeRecommendation(
  muscleId: string,
  experience: ExperienceLevel
): { min: number; optimal: number; max: number } {
  const volumeData = MUSCLE_VOLUME_BY_EXPERIENCE[muscleId];
  if (!volumeData || !volumeData[experience]) {
    // Default values if not found
    return { min: 8, optimal: 12, max: 16 };
  }
  return volumeData[experience];
}

/**
 * Get all primary muscles that MUST be covered in a program
 */
export function getPrimaryMuscles(): MuscleGroup[] {
  const primaryIds = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes'];
  return MUSCLE_GROUPS.filter(m => primaryIds.includes(m.id));
}

/**
 * Get secondary muscles (important but can have lower volume)
 */
export function getSecondaryMuscles(): MuscleGroup[] {
  const secondaryIds = ['rear_delts', 'calves', 'core', 'forearms'];
  return MUSCLE_GROUPS.filter(m => secondaryIds.includes(m.id));
}

/**
 * Calculate total weekly volume needed for all muscles
 */
export function calculateTotalWeeklyVolume(
  experience: ExperienceLevel,
  targetLevel: 'min' | 'optimal' | 'max' = 'optimal'
): number {
  let total = 0;
  for (const muscle of getPrimaryMuscles()) {
    const vol = getVolumeRecommendation(muscle.id, experience);
    total += vol[targetLevel];
  }
  return total;
}

/**
 * Check if a muscle group is a synergist of another
 */
export function isSynergist(primaryMuscleId: string, secondaryMuscleId: string): boolean {
  const primary = getMuscleGroup(primaryMuscleId);
  return primary?.synergists?.includes(secondaryMuscleId) ?? false;
}

/**
 * Get muscles that work together (for supersets)
 */
export function getAntagonistPairs(): Array<[string, string]> {
  return [
    ['chest', 'back'],
    ['biceps', 'triceps'],
    ['quads', 'hamstrings'],
    ['shoulders', 'rear_delts'],
  ];
}

/**
 * Calculate indirect volume contribution
 * e.g., bench press gives indirect volume to triceps
 */
export function getIndirectVolumeMultiplier(primaryMuscle: string, synergistMuscle: string): number {
  const primary = getMuscleGroup(primaryMuscle);
  if (!primary?.synergists?.includes(synergistMuscle)) {
    return 0;
  }

  // Indirect volume is typically 30-50% of direct work
  // Based on EMG studies and RP methodology
  const multipliers: { [key: string]: number } = {
    // Pressing movements give triceps work
    'chest-triceps': 0.4,
    'shoulders-triceps': 0.5,

    // Pulling movements give biceps work
    'back-biceps': 0.4,
    'back-rear_delts': 0.3,

    // Compound leg movements
    'quads-glutes': 0.3,
    'hamstrings-glutes': 0.4,

    // General pressing gives shoulder work
    'chest-shoulders': 0.2,
  };

  const key = `${primaryMuscle}-${synergistMuscle}`;
  return multipliers[key] ?? 0.3;
}

/**
 * Group muscles by push/pull/legs for split planning
 */
export const MUSCLE_GROUPINGS = {
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'rear_delts', 'biceps'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  core: ['core'],
  upper: ['chest', 'back', 'shoulders', 'rear_delts', 'biceps', 'triceps'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves'],
};

/**
 * Recovery check - can a muscle be trained again?
 */
export function canTrainMuscle(
  muscleId: string,
  hoursSinceLastTraining: number
): { canTrain: boolean; hoursRemaining: number } {
  const muscle = getMuscleGroup(muscleId);
  if (!muscle) {
    return { canTrain: true, hoursRemaining: 0 };
  }

  const hoursRemaining = Math.max(0, muscle.recoveryHours - hoursSinceLastTraining);
  return {
    canTrain: hoursSinceLastTraining >= muscle.recoveryHours,
    hoursRemaining,
  };
}
