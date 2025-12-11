/**
 * Workout count thresholds for unlocking different analytics features
 *
 * This is the single source of truth for all unlock thresholds.
 * Adjust these values during beta testing if needed.
 */
export const WORKOUT_THRESHOLDS = {
  /** Basic stats (level, streak, total volume) - always shown */
  BASIC_STATS: 0,

  /** Weekly volume chart - needs 2+ data points for trend */
  WEEKLY_VOLUME: 2,

  /** Personal records (e1RM) - needs variation for calculation */
  PERSONAL_RECORDS: 3,

  /** Volume tracking by muscle groups - minimum 1 week of data */
  VOLUME_TRACKING: 3,

  /** Volume distribution pie chart - muscle balance */
  VOLUME_DISTRIBUTION: 3,

  /** Weight progression tracking - needs progression in exercises */
  WEIGHT_PROGRESSION: 4,

  /** Strength progression line chart (e1RM trend) */
  STRENGTH_CHART: 4,

  /** Calibration card radar chart - comprehensive muscle coverage */
  CALIBRATION: 5,

  /** AI strength analysis - needs substantial data for patterns */
  STRENGTH_ANALYSIS: 5,
} as const;

export type ThresholdKey = keyof typeof WORKOUT_THRESHOLDS;
