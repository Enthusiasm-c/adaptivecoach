import React, { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
    Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, Target,
    Award, Brain, Zap, Lock, Crown, ChevronUp, ChevronDown, RefreshCw
} from 'lucide-react';
import {
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    ResponsiveContainer
} from 'recharts';

import { OnboardingProfile, WorkoutLog, StrengthInsightsData, StrengthLevel } from '../types';
import { generateStrengthInsights, LEVEL_LABELS } from '../utils/strengthAnalysisUtils';
import { getStrengthInsights } from '../services/geminiService';
import { hapticFeedback } from '../utils/hapticUtils';

interface StrengthAnalysisViewProps {
    profile: OnboardingProfile;
    logs: WorkoutLog[];
    isPro: boolean;
    onUpgrade: () => void;
}

const MIN_WORKOUTS = 5;
const CACHE_KEY_PREFIX = 'strengthInsightsCache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RETRY_ATTEMPTS = 2;

const StrengthAnalysisView: React.FC<StrengthAnalysisViewProps> = ({
    profile,
    logs,
    isPro,
    onUpgrade
}) => {
    const [insights, setInsights] = useState<StrengthInsightsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        strength: true,
        imbalances: true,
        patterns: false,
        ai: true
    });

    const hasEnoughData = logs.length >= MIN_WORKOUTS;

    // Generate cache key with proper invalidation based on data changes
    const getCacheKey = (logsCount: number, weight: number, gender: string) =>
        `${CACHE_KEY_PREFIX}_${logsCount}_${weight}_${gender}`;

    // Generate static analysis
    const staticAnalysis = useMemo(() => {
        if (!hasEnoughData) return null;
        return generateStrengthInsights(logs, profile.weight, profile.gender);
    }, [logs, profile.weight, profile.gender, hasEnoughData]);

    // Load AI insights with retry mechanism
    const loadAIInsights = async (staticData: Omit<StrengthInsightsData, 'aiInsights'>, attempt: number = 0) => {
        setAiLoading(true);
        setError(null);

        try {
            const aiText = await getStrengthInsights(profile, staticData);
            const fullInsights: StrengthInsightsData = {
                ...staticData,
                aiInsights: aiText
            };
            setInsights(fullInsights);
            setRetryCount(0);

            // Cache the result with proper key
            const cacheKey = getCacheKey(logs.length, profile.weight, profile.gender);
            localStorage.setItem(cacheKey, JSON.stringify({
                data: fullInsights,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error('AI insights error:', e);

            // Auto-retry once
            if (attempt < 1) {
                console.log('Retrying AI insights...');
                setTimeout(() => loadAIInsights(staticData, attempt + 1), 1000);
                return;
            }

            setError('Не удалось загрузить AI-анализ');
            setRetryCount(attempt + 1);
        } finally {
            setAiLoading(false);
        }
    };

    // Load cached insights or generate new ones
    useEffect(() => {
        const loadInsights = async () => {
            if (!hasEnoughData || !staticAnalysis) {
                setLoading(false);
                return;
            }

            // Check cache with proper key
            const cacheKey = getCacheKey(logs.length, profile.weight, profile.gender);
            try {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_TTL) {
                        setInsights(data);
                        setLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.error('Cache read error:', e);
            }

            // Set static data first
            setInsights({ ...staticAnalysis, aiInsights: undefined });
            setLoading(false);

            // Then load AI insights if Pro
            if (isPro) {
                await loadAIInsights(staticAnalysis);
            }
        };

        loadInsights();
    }, [hasEnoughData, staticAnalysis, isPro, profile, logs.length]);

    const toggleSection = (key: string) => {
        hapticFeedback.selectionChanged();
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleRetry = () => {
        if (staticAnalysis && retryCount < MAX_RETRY_ATTEMPTS) {
            hapticFeedback.impactOccurred('medium');
            loadAIInsights(staticAnalysis, retryCount);
        }
    };

    // Radar chart data
    const radarData = useMemo(() => {
        if (!insights?.strengthAnalysis) return [];

        return insights.strengthAnalysis.map(s => ({
            subject: s.exerciseNameRu,
            value: s.percentile,
            fullMark: 100
        }));
    }, [insights]);

    // Trend icon
    const TrendIcon = ({ trend }: { trend: 'improving' | 'stable' | 'declining' }) => {
        if (trend === 'improving') return <TrendingUp size={14} className="text-green-400" />;
        if (trend === 'declining') return <TrendingDown size={14} className="text-amber-400" />;
        return <Minus size={14} className="text-gray-400" />;
    };

    // Level badge
    const LevelBadge = ({ level }: { level: StrengthLevel }) => {
        const { ru, color } = LEVEL_LABELS[level];
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${color} bg-white/5`}>
                {ru}
            </span>
        );
    };

    // Section header component
    const SectionHeader = ({ title, icon: Icon, sectionKey, count }: {
        title: string;
        icon: React.ElementType;
        sectionKey: string;
        count?: number;
    }) => (
        <button
            onClick={() => toggleSection(sectionKey)}
            className="w-full flex items-center justify-between p-4 bg-neutral-900 border border-white/5 rounded-2xl"
        >
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                    <Icon size={16} className="text-indigo-400" />
                </div>
                <span className="font-bold text-white">{title}</span>
                {count !== undefined && count > 0 && (
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">
                        {count}
                    </span>
                )}
            </div>
            {expandedSections[sectionKey] ? (
                <ChevronUp size={20} className="text-gray-400" />
            ) : (
                <ChevronDown size={20} className="text-gray-400" />
            )}
        </button>
    );

    // Not enough data screen
    if (!hasEnoughData) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                    <Target size={32} className="text-gray-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Недостаточно данных</h3>
                <p className="text-gray-400 text-sm mb-4">
                    Для анализа силы нужно минимум {MIN_WORKOUTS} тренировок.
                    <br />
                    Сейчас: {logs.length} из {MIN_WORKOUTS}
                </p>
                <div className="w-full max-w-xs bg-neutral-800 rounded-full h-2 overflow-hidden">
                    <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${(logs.length / MIN_WORKOUTS) * 100}%` }}
                    />
                </div>
            </div>
        );
    }

    // Loading screen
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
                <p className="text-gray-400 text-sm">Анализирую твои тренировки...</p>
            </div>
        );
    }

    // Pro gate for non-Pro users
    if (!isPro) {
        return (
            <div className="relative">
                {/* Blurred preview */}
                <div className="blur-sm pointer-events-none opacity-50">
                    <div className="p-4 space-y-4">
                        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-4 h-48" />
                        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-4 h-32" />
                        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-4 h-24" />
                    </div>
                </div>

                {/* Pro CTA overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 max-w-sm mx-4 text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock size={28} className="text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Pro-функция</h3>
                        <p className="text-gray-400 text-sm mb-4">
                            AI-анализ силовых показателей, выявление дисбалансов и персональные рекомендации
                        </p>
                        <button
                            onClick={() => {
                                hapticFeedback.impactOccurred('medium');
                                onUpgrade();
                            }}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl font-bold text-white flex items-center justify-center gap-2"
                        >
                            <Crown size={18} /> Разблокировать Pro
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-4">
            {/* Overall Level Card */}
            {insights && (
                <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-white/10 rounded-3xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-gray-400 text-xs uppercase font-bold mb-1">Общий уровень</p>
                            <div className="flex items-center gap-2">
                                <span className={`text-2xl font-black ${LEVEL_LABELS[insights.overallLevel].color}`}>
                                    {LEVEL_LABELS[insights.overallLevel].ru}
                                </span>
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                            <Award size={24} className="text-indigo-400" />
                        </div>
                    </div>

                    {/* Radar Chart */}
                    {radarData.length >= 3 && (
                        <div className="h-48 -mx-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={radarData}>
                                    <PolarGrid stroke="#333" />
                                    <PolarAngleAxis
                                        dataKey="subject"
                                        tick={{ fill: '#888', fontSize: 10 }}
                                    />
                                    <PolarRadiusAxis
                                        angle={90}
                                        domain={[0, 100]}
                                        tick={{ fill: '#666', fontSize: 8 }}
                                    />
                                    <Radar
                                        name="Сила"
                                        dataKey="value"
                                        stroke="#6366f1"
                                        fill="#6366f1"
                                        fillOpacity={0.4}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* Strength Analysis Section */}
            <div className="space-y-2">
                <SectionHeader
                    title="Силовые показатели"
                    icon={Target}
                    sectionKey="strength"
                />

                {expandedSections.strength && insights?.strengthAnalysis && (
                    <div className="space-y-2 animate-fade-in">
                        {insights.strengthAnalysis.map((s) => (
                            <div
                                key={s.exerciseName}
                                className="bg-neutral-900/50 border border-white/5 rounded-2xl p-4"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white">{s.exerciseNameRu}</span>
                                        <TrendIcon trend={s.trend} />
                                    </div>
                                    <LevelBadge level={s.level} />
                                </div>

                                <div className="flex items-baseline gap-2 mb-3">
                                    <span className="text-2xl font-black text-white">{s.e1rm}</span>
                                    <span className="text-gray-500 text-sm">кг</span>
                                    <span className="text-indigo-400 text-sm font-bold">
                                        ({s.relativeStrength}x BW)
                                    </span>
                                </div>

                                {/* Progress bar */}
                                <div className="mb-2">
                                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                                            style={{ width: `${s.percentile}%` }}
                                        />
                                    </div>
                                </div>

                                {s.level !== 'elite' && (
                                    <p className="text-xs text-gray-500">
                                        До следующего уровня: +{s.nextLevelTarget - s.e1rm} кг
                                    </p>
                                )}
                            </div>
                        ))}

                        {insights.strengthAnalysis.length === 0 && (
                            <div className="text-center py-6 text-gray-500 text-sm">
                                Нет данных о ключевых упражнениях
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Imbalances Section */}
            {insights && (
                <div className="space-y-2">
                    <SectionHeader
                        title="Дисбалансы"
                        icon={AlertTriangle}
                        sectionKey="imbalances"
                        count={insights.imbalances.length}
                    />

                    {expandedSections.imbalances && (
                        <div className="space-y-2 animate-fade-in">
                            {insights.imbalances.length > 0 ? (
                                insights.imbalances.map((imb, idx) => (
                                    <div
                                        key={idx}
                                        className={`border rounded-2xl p-4 ${imb.severity === 'severe'
                                                ? 'bg-amber-900/20 border-amber-500/30'
                                                : imb.severity === 'moderate'
                                                    ? 'bg-amber-900/20 border-amber-500/30'
                                                    : 'bg-neutral-900/50 border-white/5'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${imb.severity === 'severe'
                                                    ? 'bg-amber-500/20'
                                                    : imb.severity === 'moderate'
                                                        ? 'bg-amber-500/20'
                                                        : 'bg-gray-500/20'
                                                }`}>
                                                <AlertTriangle
                                                    size={16}
                                                    className={
                                                        imb.severity === 'severe'
                                                            ? 'text-amber-400'
                                                            : imb.severity === 'moderate'
                                                                ? 'text-amber-400'
                                                                : 'text-gray-400'
                                                    }
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-white text-sm mb-1">
                                                    {imb.description}
                                                </p>
                                                <p className="text-gray-400 text-xs mb-2">
                                                    {imb.recommendation}
                                                </p>
                                                <div className="flex flex-wrap gap-1">
                                                    {imb.relatedExercises.map((ex, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-gray-400"
                                                        >
                                                            {ex}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                                            <span className="text-green-400 text-lg">✓</span>
                                        </div>
                                        <p className="text-green-400 text-sm font-medium">
                                            Мышечные дисбалансы не обнаружены
                                        </p>
                                    </div>
                                    <p className="text-gray-400 text-xs mt-2 ml-11">
                                        Ваши силовые показатели сбалансированы. Продолжайте работать в том же духе!
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Pain & Plateau Patterns */}
            {insights && (
                <div className="space-y-2">
                    <SectionHeader
                        title="Паттерны и застои"
                        icon={Zap}
                        sectionKey="patterns"
                        count={insights.painPatterns.length + insights.plateaus.length}
                    />

                    {expandedSections.patterns && (
                        <div className="space-y-2 animate-fade-in">
                            {insights.painPatterns.length > 0 || insights.plateaus.length > 0 ? (
                                <>
                                    {/* Pain patterns */}
                                    {insights.painPatterns.map((pain, idx) => (
                                        <div
                                            key={`pain-${idx}`}
                                            className="bg-amber-900/20 border border-amber-500/20 rounded-2xl p-4"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-amber-400 font-bold text-sm">
                                                    Боль: {pain.location}
                                                </span>
                                                <span className="text-amber-400/60 text-xs">
                                                    ({pain.frequency}x)
                                                </span>
                                            </div>
                                            <p className="text-gray-400 text-xs">
                                                Связано с {pain.movementPattern} движениями:
                                                {' '}{pain.associatedExercises.slice(0, 3).join(', ')}
                                            </p>
                                        </div>
                                    ))}

                                    {/* Plateaus */}
                                    {insights.plateaus.map((plateau, idx) => (
                                        <div
                                            key={`plateau-${idx}`}
                                            className="bg-amber-900/20 border border-amber-500/20 rounded-2xl p-4"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-amber-400 font-bold text-sm">
                                                    {plateau.exerciseName}
                                                </span>
                                                <span className="text-amber-400/60 text-xs">
                                                    {plateau.weeksStuck} нед. застоя
                                                </span>
                                            </div>
                                            <p className="text-gray-400 text-xs">
                                                Текущий e1RM: {plateau.currentE1rm} кг
                                            </p>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                                            <span className="text-green-400 text-lg">✓</span>
                                        </div>
                                        <p className="text-green-400 text-sm font-medium">
                                            Проблем не обнаружено
                                        </p>
                                    </div>
                                    <p className="text-gray-400 text-xs mt-2 ml-11">
                                        Нет паттернов боли или застоев в прогрессе. Отличная работа!
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* AI Insights Section */}
            <div className="space-y-2">
                <SectionHeader
                    title="AI-тренер"
                    icon={Brain}
                    sectionKey="ai"
                />

                {expandedSections.ai && (
                    <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-500/20 rounded-2xl p-4 animate-fade-in">
                        {aiLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="animate-spin text-indigo-400 mr-3" size={20} />
                                <span className="text-gray-400 text-sm">AI анализирует...</span>
                            </div>
                        ) : error ? (
                            <div className="text-center py-4">
                                <p className="text-amber-400 text-sm mb-3">{error}</p>
                                {retryCount < MAX_RETRY_ATTEMPTS && (
                                    <button
                                        onClick={handleRetry}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm font-medium transition-colors"
                                    >
                                        <RefreshCw size={16} />
                                        Повторить попытку
                                    </button>
                                )}
                                {retryCount >= MAX_RETRY_ATTEMPTS && (
                                    <p className="text-gray-500 text-xs mt-2">
                                        Достигнут лимит попыток. Попробуйте позже.
                                    </p>
                                )}
                            </div>
                        ) : insights?.aiInsights ? (
                            <div className="prose prose-invert prose-sm max-w-none">
                                <div
                                    className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{
                                        __html: DOMPurify.sanitize(
                                            insights.aiInsights.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>'),
                                            { ALLOWED_TAGS: ['strong', 'br', 'p', 'ul', 'ol', 'li'], ALLOWED_ATTR: ['class'] }
                                        )
                                    }}
                                />
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm text-center py-4">
                                Загрузка AI-рекомендаций...
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Readiness Patterns Summary */}
            {insights?.readinessPatterns && (
                <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-4">
                    <p className="text-gray-500 text-xs uppercase font-bold mb-3">Паттерны восстановления</p>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                            <p className={`text-lg font-bold ${insights.readinessPatterns.chronicLowSleep ? 'text-amber-400' : 'text-white'
                                }`}>
                                {insights.readinessPatterns.averageSleep.toFixed(1)}
                            </p>
                            <p className="text-[10px] text-gray-500">Сон</p>
                        </div>
                        <div className="text-center">
                            <p className={`text-lg font-bold ${insights.readinessPatterns.highStress ? 'text-amber-400' : 'text-white'
                                }`}>
                                {insights.readinessPatterns.averageStress.toFixed(1)}
                            </p>
                            <p className="text-[10px] text-gray-500">Стресс</p>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-white">
                                {insights.readinessPatterns.averageSoreness.toFixed(1)}
                            </p>
                            <p className="text-[10px] text-gray-500">Усталость</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StrengthAnalysisView;
