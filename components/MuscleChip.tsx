/**
 * MuscleChip Component
 *
 * A small badge/chip displaying muscle group name.
 * Primary muscles get indigo color, secondary get gray.
 */

import React from 'react';

interface MuscleChipProps {
  name: string;
  isPrimary?: boolean;
  sets?: number;
  className?: string;
}

const MuscleChip: React.FC<MuscleChipProps> = ({
  name,
  isPrimary = true,
  sets,
  className = '',
}) => {
  const baseClasses = 'px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1';

  const colorClasses = isPrimary
    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
    : 'bg-neutral-700/50 text-gray-400 border border-neutral-600/30';

  return (
    <span className={`${baseClasses} ${colorClasses} ${className}`}>
      {name}
      {sets !== undefined && sets > 0 && (
        <span className={isPrimary ? 'text-indigo-400' : 'text-gray-500'}>
          {sets}
        </span>
      )}
    </span>
  );
};

export default MuscleChip;
