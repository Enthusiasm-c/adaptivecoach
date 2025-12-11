/**
 * Scientific Training System Types
 * Based on research from:
 * - Schoenfeld et al. (2016) - Training frequency and hypertrophy
 * - ACSM Position Stand - Progression models in resistance training
 * - RP Hypertrophy methodology - Mesocycles and autoregulation
 */

import { ExperienceLevel, Goal, Location } from '../types';

// Re-export for convenience
export { ExperienceLevel, Goal, Location };

// ==========================================
// MESOCYCLE PHASES
// ==========================================

export type MesocyclePhase = 'intro' | 'accumulation' | 'overreaching' | 'deload';

// ==========================================
// MUSCLE GROUPS
// ==========================================

export interface MuscleGroup {
  id: string;
  nameRu: string;
  nameEn: string;
  // Volume recommendations (sets per week)
  weeklyMinSets: number; // MEV - Minimum Effective Volume
  weeklyMaxSets: number; // MRV - Maximum Recoverable Volume
  // Recovery time in hours
  recoveryHours: number;
  // Related muscle groups (for compound exercises)
  synergists?: string[];
}

export interface MuscleGroupVolume {
  [experienceLevel: string]: {
    min: number; // MEV
    optimal: number;
    max: number; // MRV
  };
}

// ==========================================
// MOVEMENT PATTERNS
// ==========================================

export type MovementPattern =
  | 'horizontal_push'   // Bench press, push-ups
  | 'vertical_push'     // Overhead press
  | 'horizontal_pull'   // Rows
  | 'vertical_pull'     // Pull-ups, pulldowns
  | 'squat'            // Squats, leg press
  | 'hinge'            // Deadlifts, RDL
  | 'lunge'            // Lunges, split squats
  | 'isolation'        // Curls, extensions, raises
  | 'carry'            // Farmers walks
  | 'rotation';        // Core rotation

export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'kettlebell'
  | 'resistance_band'
  | 'ez_bar';

export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced';

// ==========================================
// EXERCISE DATABASE
// ==========================================

export interface ExerciseDefinition {
  id: string;
  name: string;
  nameEn: string;
  primaryMuscle: string; // MuscleGroup id
  secondaryMuscles: string[]; // MuscleGroup ids
  movementPattern: MovementPattern;
  isCompound: boolean;
  equipment: EquipmentType[];
  difficulty: ExerciseDifficulty;
  // Optimal rep ranges for this exercise
  repRanges: {
    strength: string;    // e.g., "3-5"
    hypertrophy: string; // e.g., "8-12"
    endurance: string;   // e.g., "15-20"
  };
  // Exercise-specific notes
  notes?: string;
  // Contraindications (injury types that exclude this exercise)
  contraindications?: string[];
}

// ==========================================
// EXERCISE SLOTS (Template-based)
// ==========================================

export interface ExerciseSlot {
  id: string;
  muscleGroup: string; // MuscleGroup id
  movementPattern: MovementPattern;
  isCompound: boolean;
  // Optional: specific exercise already assigned
  exercise?: ExerciseDefinition;
  // Number of sets for this slot
  sets: number;
  // Rep range
  reps: string;
  // Rest in seconds
  rest: number;
  // Is this a warmup slot?
  isWarmup?: boolean;
  // Priority (higher = more important to keep)
  priority: number;
}

// ==========================================
// WORKOUT TEMPLATES
// ==========================================

export interface WorkoutTemplate {
  id: string;
  name: string; // e.g., "Upper A", "Push", "Full Body A"
  nameRu: string;
  slots: ExerciseSlot[];
  // Target muscle groups with expected volume contribution
  targetMuscles: {
    [muscleId: string]: number; // sets per workout
  };
  // Estimated duration in minutes
  estimatedDuration: number;
  // Focus of this workout
  focus?: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body';
}

// ==========================================
// SPLIT TEMPLATES
// ==========================================

export interface SplitTemplate {
  id: string;
  name: string; // "Upper/Lower", "PPL", "Full Body"
  nameRu: string;
  description: string;
  daysPerWeek: number;
  workouts: WorkoutTemplate[];
  // How often each muscle is trained per week
  muscleFrequency: {
    [muscleId: string]: number;
  };
  // Weekly volume per muscle (total sets)
  weeklyVolume: {
    [muscleId: string]: number;
  };
  // Suitable for which experience levels
  suitableFor: ExperienceLevel[];
  // Suitable for which goals
  bestForGoals: Goal[];
}

// ==========================================
// MESOCYCLE
// ==========================================

export interface Mesocycle {
  id: string;
  // Current week within the mesocycle (1-6)
  weekNumber: number;
  // Total weeks in this mesocycle
  totalWeeks: number;
  // Current phase
  phase: MesocyclePhase;
  // The split being used
  splitId: string;
  // Volume multiplier for this week
  volumeMultiplier: number;
  // Start date of this mesocycle
  startDate: string; // ISO date
  // Exercises selected for this mesocycle
  exerciseSelections: {
    [slotId: string]: string; // slotId -> exerciseId
  };
  // Rotation percentage from previous mesocycle
  exerciseRotationPercent: number;
}

export const VOLUME_MULTIPLIERS: { [phase in MesocyclePhase]: number } = {
  intro: 0.7,
  accumulation: 1.0,
  overreaching: 1.2,
  deload: 0.5,
};

export const PHASE_WEEKS: { [phase in MesocyclePhase]: number[] } = {
  intro: [1],
  accumulation: [2, 3],
  overreaching: [4, 5],
  deload: [6],
};

// ==========================================
// VOLUME TRACKING
// ==========================================

export interface MuscleVolumeTracker {
  muscleGroup: string; // MuscleGroup id
  // Current week stats
  weeklySetsDone: number;
  weeklyTarget: number;
  // Historical data for trend analysis
  weeklyHistory: {
    week: number;
    setsDone: number;
    avgPump: number;
    avgSoreness: number;
  }[];
  // Current feedback metrics
  lastPumpQuality?: 1 | 2 | 3 | 4 | 5;
  lastSoreness?: 1 | 2 | 3 | 4 | 5;
  lastPerformance?: 'improving' | 'stable' | 'declining';
}

export interface WeeklyVolumeReport {
  weekNumber: number;
  startDate: string;
  endDate: string;
  muscleVolumes: {
    [muscleId: string]: {
      target: number;
      actual: number;
      percentage: number;
      status: 'under' | 'optimal' | 'over';
    };
  };
  totalSets: number;
  totalWorkouts: number;
}

// ==========================================
// AUTOREGULATION
// ==========================================

export interface AutoregulationFeedback {
  workoutId: string;
  date: string;
  muscleGroup: string;
  // Pump quality (1 = no pump, 5 = excellent pump)
  pumpQuality: 1 | 2 | 3 | 4 | 5;
  // Soreness 24h later (1 = no soreness, 5 = very sore)
  soreness24h?: 1 | 2 | 3 | 4 | 5;
  // Performance trend (are weights going up?)
  performanceTrend: 'improving' | 'stable' | 'declining';
  // Any pain reported
  hasPain: boolean;
  painLocation?: string;
}

export type VolumeAdjustment =
  | { type: 'increase'; sets: number; reason: string }
  | { type: 'decrease'; sets: number; reason: string }
  | { type: 'maintain'; reason: string }
  | { type: 'substitute'; exerciseId: string; reason: string };

export interface AutoregulationRule {
  condition: {
    pumpQuality?: [number, number]; // min, max
    soreness?: [number, number];
    performance?: 'improving' | 'stable' | 'declining';
    hasPain?: boolean;
  };
  adjustment: VolumeAdjustment;
}

// ==========================================
// PROGRAM GENERATION CONFIG
// ==========================================

export interface ProgramGenerationConfig {
  profile: {
    experience: ExperienceLevel;
    goal: Goal;
    daysPerWeek: number;
    location: Location;
    injuries?: string;
    timePerWorkout: number;
  };
  // Override default volume targets
  volumeOverrides?: {
    [muscleId: string]: {
      min?: number;
      max?: number;
    };
  };
  // Exercises to exclude
  excludedExercises?: string[];
  // Exercises to prioritize
  prioritizedExercises?: string[];
}

export interface ProgramGenerationResult {
  success: boolean;
  split: SplitTemplate;
  mesocycle: Mesocycle;
  warnings: string[];
  errors: string[];
  // Validation results
  validation: {
    allMusclesCovered: boolean;
    volumeInRange: boolean;
    frequencyMet: boolean;
    equipmentAvailable: boolean;
  };
}

// ==========================================
// EXERCISE ROTATION
// ==========================================

export interface ExerciseRotation {
  previousExerciseId: string;
  newExerciseId: string;
  slotId: string;
  reason: 'scheduled_rotation' | 'user_request' | 'injury' | 'plateau';
  date: string;
}

export interface RotationHistory {
  mesocycleId: string;
  rotations: ExerciseRotation[];
}

// ==========================================
// GOAL-SPECIFIC CONFIGURATIONS
// ==========================================

export interface GoalConfig {
  goal: Goal;
  // Compound vs isolation ratio
  compoundRatio: number; // 0.0 - 1.0
  // Rep range preferences
  primaryRepRange: string;
  secondaryRepRange: string;
  // Rest time preferences (seconds)
  restTimeCompound: number;
  restTimeIsolation: number;
  // Volume multiplier relative to baseline
  volumeMultiplier: number;
  // Include cardio finishers
  includeCardio: boolean;
  cardioType?: 'hiit' | 'liss' | 'circuits';
  // Prioritize certain muscles
  priorityMuscles?: string[];
}

export const GOAL_CONFIGS: { [key in Goal]: GoalConfig } = {
  [Goal.LoseFat]: {
    goal: Goal.LoseFat,
    compoundRatio: 0.6,
    primaryRepRange: '12-15',
    secondaryRepRange: '15-20',
    restTimeCompound: 90,
    restTimeIsolation: 60,
    volumeMultiplier: 0.9,
    includeCardio: true,
    cardioType: 'hiit',
  },
  [Goal.BuildMuscle]: {
    goal: Goal.BuildMuscle,
    compoundRatio: 0.6,
    primaryRepRange: '8-12',
    secondaryRepRange: '10-15',
    restTimeCompound: 120,
    restTimeIsolation: 90,
    volumeMultiplier: 1.0,
    includeCardio: false,
  },
  [Goal.GetStronger]: {
    goal: Goal.GetStronger,
    compoundRatio: 0.8,
    primaryRepRange: '3-6',
    secondaryRepRange: '6-8',
    restTimeCompound: 180,
    restTimeIsolation: 120,
    volumeMultiplier: 0.85,
    includeCardio: false,
    priorityMuscles: ['chest', 'back', 'quads'],
  },
  [Goal.GeneralHealth]: {
    goal: Goal.GeneralHealth,
    compoundRatio: 0.7,
    primaryRepRange: '10-15',
    secondaryRepRange: '12-15',
    restTimeCompound: 90,
    restTimeIsolation: 60,
    volumeMultiplier: 0.8,
    includeCardio: true,
    cardioType: 'liss',
  },
};

// ==========================================
// LOCATION/EQUIPMENT MAPPING
// ==========================================

export const LOCATION_EQUIPMENT: { [key in Location]: EquipmentType[] } = {
  [Location.CommercialGym]: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'ez_bar'],
  [Location.Bodyweight]: ['bodyweight', 'resistance_band'],
  [Location.FitCube]: ['dumbbell', 'kettlebell', 'resistance_band', 'bodyweight'],
};
