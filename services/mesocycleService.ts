/**
 * Mesocycle Service
 *
 * Manages mesocycle lifecycle:
 * - Phase tracking (intro → accumulation → overreaching → deload)
 * - Volume multipliers per phase
 * - Week progression
 * - Deload detection and new mesocycle creation
 *
 * Based on RP Hypertrophy methodology and scientific periodization.
 */

import { WorkoutSession, WorkoutLog, OnboardingProfile, TrainingProgram } from '../types';
import {
  Mesocycle,
  MesocyclePhase,
  VOLUME_MULTIPLIERS,
  PHASE_WEEKS,
  SplitTemplate,
} from '../types/training';
import { createNextMesocycle, generateProgram, convertToLegacyFormat } from './programGenerator';
import { getSplitByDaysPerWeek } from '../data/splitTemplates';

// ==========================================
// PHASE DESCRIPTIONS (for UI)
// ==========================================

export const PHASE_DESCRIPTIONS: { [key in MesocyclePhase]: { title: string; description: string; color: string } } = {
  intro: {
    title: 'Вводная неделя',
    description: 'Адаптация к новым упражнениям. Фокус на технике, умеренные веса.',
    color: 'blue',
  },
  accumulation: {
    title: 'Накопление',
    description: 'Основная фаза роста. Постепенное увеличение нагрузки.',
    color: 'green',
  },
  overreaching: {
    title: 'Интенсификация',
    description: 'Пиковая нагрузка. Максимальный объём для стимула роста.',
    color: 'orange',
  },
  deload: {
    title: 'Разгрузка',
    description: 'Восстановление. Сниженный объём для суперкомпенсации.',
    color: 'purple',
  },
};

// ==========================================
// MESOCYCLE STATE MANAGEMENT
// ==========================================

export interface MesocycleState {
  mesocycle: Mesocycle;
  currentWeekStartDate: string;
  workoutsThisWeek: number;
  lastWorkoutDate?: string;
}

/**
 * Create initial mesocycle state for a new user
 */
export function createInitialMesocycleState(profile: OnboardingProfile): MesocycleState {
  const split = getSplitByDaysPerWeek(profile.daysPerWeek);
  const now = new Date();
  const weekStart = getWeekStartDate(now);

  return {
    mesocycle: {
      id: `meso_${Date.now()}`,
      weekNumber: 1,
      totalWeeks: 6,
      phase: 'intro',
      splitId: split.id,
      volumeMultiplier: VOLUME_MULTIPLIERS.intro,
      startDate: weekStart.toISOString(),
      exerciseSelections: {},
      exerciseRotationPercent: 0,
    },
    currentWeekStartDate: weekStart.toISOString(),
    workoutsThisWeek: 0,
  };
}

/**
 * Get the start date of the current week (Monday)
 */
function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate current week number from mesocycle start
 */
export function calculateCurrentWeek(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.min(6, Math.max(1, Math.ceil(diffDays / 7)));
}

/**
 * Calculate current week based on first workout in logs (more reliable)
 * Falls back to startDate if no logs exist
 */
export function calculateCurrentWeekFromLogs(logs: WorkoutLog[], startDate: string): number {
  if (!logs || logs.length === 0) {
    return calculateCurrentWeek(startDate);
  }

  // Find the earliest workout date
  const sortedDates = logs
    .map(l => new Date(l.date).getTime())
    .sort((a, b) => a - b);

  const firstWorkoutDate = new Date(sortedDates[0]);
  const weekStart = getWeekStartDate(firstWorkoutDate);

  const now = new Date();
  const diffTime = now.getTime() - weekStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7) + 1;

  return Math.min(6, Math.max(1, weekNumber));
}

/**
 * Sync mesocycle state with workout logs
 * Call this when loading state to ensure consistency
 */
export function syncMesocycleWithLogs(state: MesocycleState, logs: WorkoutLog[]): MesocycleState {
  if (!logs || logs.length === 0) {
    return state;
  }

  // Calculate week based on first workout
  const calculatedWeek = calculateCurrentWeekFromLogs(logs, state.mesocycle.startDate);
  const phase = getPhaseForWeek(calculatedWeek);

  // If week differs, update state
  if (calculatedWeek !== state.mesocycle.weekNumber || phase !== state.mesocycle.phase) {
    return {
      ...state,
      mesocycle: {
        ...state.mesocycle,
        weekNumber: calculatedWeek,
        phase,
        volumeMultiplier: VOLUME_MULTIPLIERS[phase],
      },
    };
  }

  return state;
}

/**
 * Get phase for a given week number
 */
export function getPhaseForWeek(weekNumber: number): MesocyclePhase {
  for (const [phase, weeks] of Object.entries(PHASE_WEEKS)) {
    if ((weeks as number[]).includes(weekNumber)) {
      return phase as MesocyclePhase;
    }
  }
  return 'accumulation';
}

/**
 * Check if mesocycle needs to advance to next week
 */
export function checkWeekProgression(state: MesocycleState): {
  shouldAdvance: boolean;
  newWeek: number;
  newPhase: MesocyclePhase;
  isMesocycleComplete: boolean;
} {
  const currentWeek = calculateCurrentWeek(state.mesocycle.startDate);
  const shouldAdvance = currentWeek > state.mesocycle.weekNumber;
  const newWeek = Math.min(currentWeek, 6);
  const newPhase = getPhaseForWeek(newWeek);
  const isMesocycleComplete = newWeek >= 6 && shouldAdvance;

  return {
    shouldAdvance,
    newWeek,
    newPhase,
    isMesocycleComplete,
  };
}

/**
 * Advance mesocycle to next week
 */
export function advanceMesocycleWeek(state: MesocycleState): MesocycleState {
  const { newWeek, newPhase } = checkWeekProgression(state);

  return {
    ...state,
    mesocycle: {
      ...state.mesocycle,
      weekNumber: newWeek,
      phase: newPhase,
      volumeMultiplier: VOLUME_MULTIPLIERS[newPhase],
    },
    workoutsThisWeek: 0, // Reset for new week
  };
}

/**
 * Create a new mesocycle after deload
 */
export function createNewMesocycle(
  previousMesocycle: Mesocycle,
  profile: OnboardingProfile
): MesocycleState {
  const split = getSplitByDaysPerWeek(profile.daysPerWeek);
  const newMeso = createNextMesocycle(previousMesocycle, split, profile);
  const weekStart = getWeekStartDate(new Date());

  return {
    mesocycle: newMeso,
    currentWeekStartDate: weekStart.toISOString(),
    workoutsThisWeek: 0,
  };
}

// ==========================================
// VOLUME APPLICATION
// ==========================================

/**
 * Apply volume multiplier to a workout session
 */
export function applyVolumeMultiplier(
  session: WorkoutSession,
  multiplier: number
): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises.map(exercise => ({
      ...exercise,
      sets: Math.max(1, Math.round(exercise.sets * multiplier)),
    })),
  };
}

/**
 * Apply volume multiplier to entire program
 */
export function applyProgramVolumeMultiplier(
  program: TrainingProgram,
  multiplier: number
): TrainingProgram {
  return {
    ...program,
    sessions: program.sessions.map(session =>
      applyVolumeMultiplier(session, multiplier)
    ),
  };
}

/**
 * Get program with current phase volume applied
 */
export function getProgramForCurrentPhase(
  program: TrainingProgram,
  state: MesocycleState
): TrainingProgram {
  const multiplier = state.mesocycle.volumeMultiplier;

  // Only apply multiplier if not at 1.0
  if (multiplier === 1.0) {
    return program;
  }

  return applyProgramVolumeMultiplier(program, multiplier);
}

// ==========================================
// WORKOUT TRACKING WITHIN MESOCYCLE
// ==========================================

/**
 * Update mesocycle state after completing a workout
 */
export function recordWorkoutInMesocycle(
  state: MesocycleState,
  log: WorkoutLog
): MesocycleState {
  const workoutDate = new Date(log.date);
  const weekStart = getWeekStartDate(new Date(state.currentWeekStartDate));
  const currentWeekStart = getWeekStartDate(new Date());

  // Check if workout is in current week
  const isCurrentWeek = workoutDate >= weekStart && workoutDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  // If we've moved to a new week, reset counter
  if (currentWeekStart.getTime() !== weekStart.getTime()) {
    return {
      ...state,
      currentWeekStartDate: currentWeekStart.toISOString(),
      workoutsThisWeek: 1,
      lastWorkoutDate: log.date,
    };
  }

  return {
    ...state,
    workoutsThisWeek: isCurrentWeek ? state.workoutsThisWeek + 1 : 1,
    lastWorkoutDate: log.date,
  };
}

// ==========================================
// MESOCYCLE SUMMARY & ANALYTICS
// ==========================================

export interface MesocycleSummary {
  weekNumber: number;
  totalWeeks: number;
  phase: MesocyclePhase;
  phaseInfo: { title: string; description: string; color: string };
  volumeMultiplier: number;
  daysUntilNextPhase: number;
  daysUntilDeload: number;
  progressPercent: number; // 0-100
  isDeloadWeek: boolean;
  isLastWeekBeforeDeload: boolean;
}

/**
 * Get summary of current mesocycle state for UI
 */
export function getMesocycleSummary(state: MesocycleState): MesocycleSummary {
  const { mesocycle } = state;
  const weekNumber = calculateCurrentWeek(mesocycle.startDate);
  const phase = getPhaseForWeek(weekNumber);
  const phaseInfo = PHASE_DESCRIPTIONS[phase];

  // Calculate days until next phase
  const startDate = new Date(mesocycle.startDate);
  const weeksElapsed = weekNumber - 1;
  const currentWeekStart = new Date(startDate.getTime() + weeksElapsed * 7 * 24 * 60 * 60 * 1000);
  const nextWeekStart = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const daysUntilNextWeek = Math.max(0, Math.ceil((nextWeekStart.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

  // Days until deload (week 6)
  const deloadStart = new Date(startDate.getTime() + 5 * 7 * 24 * 60 * 60 * 1000);
  const daysUntilDeload = Math.max(0, Math.ceil((deloadStart.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

  return {
    weekNumber,
    totalWeeks: mesocycle.totalWeeks,
    phase,
    phaseInfo,
    volumeMultiplier: VOLUME_MULTIPLIERS[phase],
    daysUntilNextPhase: daysUntilNextWeek,
    daysUntilDeload,
    progressPercent: Math.round((weekNumber / mesocycle.totalWeeks) * 100),
    isDeloadWeek: phase === 'deload',
    isLastWeekBeforeDeload: weekNumber === 5,
  };
}

// ==========================================
// PERSISTENCE HELPERS
// ==========================================

const MESOCYCLE_STORAGE_KEY = 'mesocycleState';

/**
 * Save mesocycle state to localStorage
 */
export function saveMesocycleState(state: MesocycleState): void {
  try {
    localStorage.setItem(MESOCYCLE_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save mesocycle state to localStorage', e);
  }
}

/**
 * Load mesocycle state from localStorage
 */
export function loadMesocycleState(): MesocycleState | null {
  try {
    const saved = localStorage.getItem(MESOCYCLE_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Could not load mesocycle state from localStorage', e);
  }
  return null;
}

/**
 * Clear mesocycle state from localStorage
 */
export function clearMesocycleState(): void {
  try {
    localStorage.removeItem(MESOCYCLE_STORAGE_KEY);
  } catch (e) {
    console.warn('Could not clear mesocycle state from localStorage', e);
  }
}

// ==========================================
// NOTIFICATIONS & EVENTS
// ==========================================

export type MesocycleEvent =
  | { type: 'phase_change'; oldPhase: MesocyclePhase; newPhase: MesocyclePhase }
  | { type: 'deload_start'; weekNumber: number }
  | { type: 'mesocycle_complete'; mesocycleId: string }
  | { type: 'new_mesocycle'; mesocycleId: string; exercisesRotated: number };

/**
 * Check for mesocycle events that should trigger notifications
 */
export function checkMesocycleEvents(
  oldState: MesocycleState | null,
  newState: MesocycleState
): MesocycleEvent[] {
  const events: MesocycleEvent[] = [];

  if (!oldState) {
    return events;
  }

  // Check for phase change
  if (oldState.mesocycle.phase !== newState.mesocycle.phase) {
    events.push({
      type: 'phase_change',
      oldPhase: oldState.mesocycle.phase,
      newPhase: newState.mesocycle.phase,
    });

    // Special event for deload start
    if (newState.mesocycle.phase === 'deload') {
      events.push({
        type: 'deload_start',
        weekNumber: newState.mesocycle.weekNumber,
      });
    }
  }

  // Check for new mesocycle
  if (oldState.mesocycle.id !== newState.mesocycle.id) {
    events.push({
      type: 'new_mesocycle',
      mesocycleId: newState.mesocycle.id,
      exercisesRotated: newState.mesocycle.exerciseRotationPercent,
    });

    // Previous mesocycle completed
    events.push({
      type: 'mesocycle_complete',
      mesocycleId: oldState.mesocycle.id,
    });
  }

  return events;
}

/**
 * Get notification message for mesocycle event
 */
export function getEventNotificationMessage(event: MesocycleEvent): string {
  switch (event.type) {
    case 'phase_change':
      const newPhaseInfo = PHASE_DESCRIPTIONS[event.newPhase];
      return `Новая фаза: ${newPhaseInfo.title}. ${newPhaseInfo.description}`;

    case 'deload_start':
      return 'Неделя разгрузки! Снижаем объём на 50% для восстановления 💆‍♂️';

    case 'mesocycle_complete':
      return 'Мезоцикл завершён! Отличная работа 🎉';

    case 'new_mesocycle':
      return `Новый мезоцикл начался! Обновлено ${event.exercisesRotated}% упражнений 🔄`;

    default:
      return '';
  }
}
