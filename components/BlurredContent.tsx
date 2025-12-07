import React, { useEffect, useRef } from 'react';
import { Lock, Crown, Sparkles } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';
import { apiService } from '../services/apiService';

interface BlurredContentProps {
    title: string;
    description: string;
    onUnlock: () => void;
    children: React.ReactNode;
    isPro?: boolean;
    ctaText?: string;
    featureName?: string;
}

const BlurredContent: React.FC<BlurredContentProps> = ({
    title,
    description,
    onUnlock,
    children,
    isPro = false,
    ctaText = 'Разблокировать с Pro',
    featureName
}) => {
    const trackedRef = useRef(false);

    // Track premium feature blocked (only once)
    useEffect(() => {
        if (!isPro && !trackedRef.current) {
            trackedRef.current = true;
            apiService.analytics.track('premium_feature_blocked', {
                feature: featureName || title,
                title
            }).catch(() => {});
        }
    }, [isPro, featureName, title]);

    // If user is Pro, show content without blur
    if (isPro) {
        return <>{children}</>;
    }

    const handleUnlock = () => {
        apiService.analytics.track('paywall_cta_click', {
            source: 'blurred_content',
            feature: featureName || title
        }).catch(() => {});
        hapticFeedback.impactOccurred('medium');
        onUnlock();
    };

    return (
        <div className="relative">
            {/* Blurred Content */}
            <div className="blur-md opacity-60 pointer-events-none select-none">
                {children}
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl">
                <div className="text-center p-6 max-w-xs">
                    {/* Lock Icon */}
                    <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-full flex items-center justify-center border border-indigo-500/30">
                        <Lock size={24} className="text-indigo-400" />
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-white mb-1">
                        {title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-gray-400 mb-4">
                        {description}
                    </p>

                    {/* Unlock Button */}
                    <button
                        onClick={handleUnlock}
                        className="w-full py-3 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl font-bold text-white text-sm shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    >
                        <Crown size={16} className="text-yellow-300" />
                        {ctaText}
                    </button>

                    {/* Trial Hint */}
                    <p className="text-[10px] text-gray-500 mt-2">
                        Попробуй 14 дней бесплатно
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BlurredContent;
