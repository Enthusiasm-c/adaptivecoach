
import React from 'react';

interface TechCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

const TechCard: React.FC<TechCardProps> = ({ children, className = "", onClick }) => {
    return (
        <div
            onClick={onClick}
            className={`relative bg-neutral-900/60 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden group ${className}`}
        >
            {/* Corner Brackets */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white/20 rounded-tl-lg"></div>
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white/20 rounded-tr-lg"></div>
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white/20 rounded-bl-lg"></div>
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white/20 rounded-br-lg"></div>

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};

export default TechCard;
