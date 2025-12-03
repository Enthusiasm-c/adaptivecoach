
import React from 'react';

interface SkeletonLoaderProps {
    className?: string;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ className = "" }) => {
    return (
        <div className={`relative overflow-hidden bg-white/5 rounded-xl ${className}`}>
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        </div>
    );
};

export default SkeletonLoader;
