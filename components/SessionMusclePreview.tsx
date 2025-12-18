/**
 * SessionMusclePreview Component
 *
 * Shows target muscle groups for a workout session
 * with optional weekly volume progress bars.
 */

import React, { useMemo } from 'react';
import { WorkoutSession, WorkoutLog } from '../types';
import { ExperienceLevel } from '../types/training';
import {
  getSessionMuscles,
  calculateVolumeProgress,
  getShortMuscleName,
} from '../utils/workoutMuscleUtils';
import MuscleChip from './MuscleChip';
import { Target } from 'lucide-react';

interface SessionMusclePreviewProps {
  session: WorkoutSession;
  logs?: WorkoutLog[];
  experienceLevel?: ExperienceLevel;
  showProgress?: boolean;
  compact?: boolean;
}

const SessionMusclePreview: React.FC<SessionMusclePreviewProps> = ({
  session,
  logs = [],
  experienceLevel = ExperienceLevel.Intermediate,
  showProgress = true,
  compact = false,
}) => {
  const sessionMuscles = useMemo(() => getSessionMuscles(session), [session]);

  const volumeProgress = useMemo(() => {
    if (!showProgress || logs.length === 0) return [];
    return calculateVolumeProgress(session, logs, experienceLevel);
  }, [session, logs, experienceLevel, showProgress]);

  // Get top 4 primary muscles for display
  const topPrimary = sessionMuscles.primary.slice(0, 4);
  const topSecondary = sessionMuscles.secondary.slice(0, 2);

  if (topPrimary.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {topPrimary.map(muscle => (
          <MuscleChip
            key={muscle.muscleId}
            name={getShortMuscleName(muscle.muscleId)}
            isPrimary={true}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-neutral-800/50 rounded-xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Target size={14} className="text-indigo-400" />
        <span>Целевые мышцы</span>
      </div>

      {/* Muscle Chips */}
      <div className="flex flex-wrap gap-1.5">
        {topPrimary.map(muscle => (
          <MuscleChip
            key={muscle.muscleId}
            name={getShortMuscleName(muscle.muscleId)}
            isPrimary={true}
            sets={muscle.setsInSession}
          />
        ))}
        {topSecondary.map(muscle => (
          <MuscleChip
            key={muscle.muscleId}
            name={getShortMuscleName(muscle.muscleId)}
            isPrimary={false}
          />
        ))}
      </div>

      {/* Volume Progress Bars */}
      {showProgress && volumeProgress.length > 0 && (
        <div className="pt-2 border-t border-neutral-700/50 space-y-2">
          <p className="text-xs text-gray-500">После тренировки:</p>
          {volumeProgress.slice(0, 3).map(progress => (
            <VolumeProgressBar key={progress.muscleId} progress={progress} />
          ))}
        </div>
      )}
    </div>
  );
};

interface VolumeProgressBarProps {
  progress: {
    muscleId: string;
    muscleNameRu: string;
    afterSessionSets: number;
    optimalSets: number;
    percentAfter: number;
  };
}

const VolumeProgressBar: React.FC<VolumeProgressBarProps> = ({ progress }) => {
  const percent = Math.min(progress.percentAfter, 150);
  const isOver = progress.percentAfter > 100;
  const isUnder = progress.percentAfter < 70;

  const barColor = isOver
    ? 'bg-amber-500'
    : isUnder
    ? 'bg-yellow-500'
    : 'bg-green-500';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-20 truncate">
        {getShortMuscleName(progress.muscleId)}
      </span>
      <div className="flex-1 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-14 text-right">
        {progress.afterSessionSets}/{progress.optimalSets}
      </span>
    </div>
  );
};

export default SessionMusclePreview;
