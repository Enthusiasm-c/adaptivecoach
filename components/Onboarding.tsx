
import React, { useState, useEffect } from 'react';
import { OnboardingProfile, Gender, ExperienceLevel, Goal, Location, Intensity, ActivityLevel } from '../types';
import { calculateProjectedOutcome } from '../utils/progressUtils';
import { ChevronLeft, ArrowRight, Check, Dumbbell, User, Heart, MapPin, Target, CalendarDays, Zap, ShieldAlert, Thermometer, Activity, Ruler, Weight, Laptop, Footprints, Flame, Trophy } from 'lucide-react';

interface OnboardingProps {
    onComplete: (profile: OnboardingProfile) => void;
    isLoading: boolean;
    error: string | null;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, isLoading, error }) => {
    const [step, setStep] = useState(0);
    const [profile, setProfile] = useState<Partial<OnboardingProfile>>({
        gender: Gender.Male,
        age: 30,
        weight: 80,
        height: 175,
        targetWeight: 75,
        activityLevel: ActivityLevel.Moderate,
        experience: ExperienceLevel.Beginner,
        hasInjuries: false,
        injuries: '',
        goals: { primary: Goal.LoseFat },
        daysPerWeek: 3,
        location: Location.CommercialGym,
        timePerWorkout: 60,
        intensity: Intensity.Normal,
    });

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisText, setAnalysisText] = useState("Анализ метаболизма...");
    const [showPrediction, setShowPrediction] = useState(false);

    const updateProfile = <K extends keyof OnboardingProfile>(key: K, value: OnboardingProfile[K]) => {
        setProfile(prev => ({ ...prev, [key]: value }));
    };

    const nextStep = () => {
        if (step === 7) {
            // Trigger prediction view logic before "Complete"
            runAnalysis();
        } else {
            setStep(s => s + 1);
        }
    };
    
    const prevStep = () => {
        if (showPrediction) {
            setShowPrediction(false);
            setStep(7); // Back to last input step
        } else {
            setStep(s => s - 1);
        }
    };

    const runAnalysis = () => {
        setShowPrediction(true);
        setIsAnalyzing(true);
        const steps = [
            "Расчет BMI...",
            "Анализ уровня активности...",
            "Подбор оптимального сплита...",
            "Прогноз сроков..."
        ];
        
        let i = 0;
        const interval = setInterval(() => {
            setAnalysisText(steps[i]);
            i++;
            if (i >= steps.length) {
                clearInterval(interval);
                setTimeout(() => setIsAnalyzing(false), 800);
            }
        }, 800);
    };

    const handleSubmit = () => {
        onComplete(profile as OnboardingProfile);
    };

    const renderStep = () => {
        if (showPrediction) return <PredictionStep profile={profile as OnboardingProfile} isAnalyzing={isAnalyzing} analysisText={analysisText} />;

        switch (step) {
            case 0: return <WelcomeStep onNext={nextStep} />;
            case 1: return <GenderStep profile={profile} updateProfile={updateProfile} />;
            case 2: return <BiometricsStep profile={profile} updateProfile={updateProfile} />;
            case 3: return <GoalStep profile={profile} updateProfile={updateProfile} setProfile={setProfile} />;
            case 4: return <ActivityStep profile={profile} updateProfile={updateProfile} />;
            case 5: return <ExperienceStep profile={profile} updateProfile={updateProfile} />;
            case 6: return <LogisticsStep profile={profile} updateProfile={updateProfile} />;
            case 7: return <InjuryStep profile={profile} updateProfile={updateProfile} />;
            default: return null;
        }
    };

    // Calculate progress based on 8 steps (0-7)
    const totalInputSteps = 8; 
    const progress = showPrediction ? 100 : ((step) / (totalInputSteps - 1)) * 100;

    return (
        <div className="min-h-[100dvh] bg-neutral-950 text-white flex flex-col relative overflow-hidden font-sans selection:bg-indigo-500/30">
            
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-900/20 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-violet-900/20 rounded-full blur-[100px]"></div>
            </div>

            {/* Progress Bar */}
            {step > 0 && !showPrediction && (
                <div className="relative z-20 w-full h-1 bg-neutral-900 mt-[env(safe-area-inset-top)]">
                    <div 
                        className="h-full bg-indigo-500 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(99,102,241,0.6)]" 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            )}
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col z-10 w-full max-w-lg mx-auto p-6 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                
                <div className="flex-1 flex flex-col justify-center animate-fade-in">
                     {renderStep()}
                </div>
                
                {error && <p className="text-red-400 text-center mb-4 p-3 bg-red-900/20 rounded-xl border border-red-900/50 animate-slide-up text-sm font-medium">{error}</p>}
                
                {/* Footer Controls */}
                {step > 0 && !isAnalyzing && (
                    <div className="mt-6 pt-4 animate-slide-up">
                        <div className="flex items-center gap-4">
                             <button 
                                onClick={prevStep} 
                                disabled={isLoading} 
                                className="p-4 rounded-2xl bg-neutral-900 border border-white/5 text-gray-400 hover:text-white hover:bg-neutral-800 transition active:scale-95"
                             >
                                <ChevronLeft size={24} />
                            </button>
                            
                            {!showPrediction ? (
                                <button 
                                    onClick={nextStep} 
                                    disabled={isLoading} 
                                    className="flex-1 py-4 bg-white text-black rounded-2xl hover:bg-gray-200 transition disabled:opacity-50 font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-white/10 active:scale-[0.98]"
                                >
                                    Дальше <ArrowRight size={20} />
                                </button>
                            ) : (
                                <button 
                                    onClick={handleSubmit} 
                                    disabled={isLoading} 
                                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 transition font-bold text-lg disabled:opacity-50 shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    {isLoading ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : "Получить план"}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const SelectionCard = ({ selected, onClick, children, className = "" }: any) => (
    <button 
        onClick={onClick}
        className={`w-full text-left p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden active:scale-[0.98] ${
            selected 
            ? 'bg-indigo-600/20 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.15)]' 
            : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700'
        } ${className}`}
    >
        <div className="relative z-10 flex items-center justify-between">
            {children}
            {selected && <div className="bg-indigo-500 p-1 rounded-full shadow-lg shadow-indigo-500/50"><Check size={14} className="text-white" strokeWidth={3} /></div>}
        </div>
    </button>
);


const WelcomeStep = ({ onNext }: { onNext: () => void }) => (
    <div className="flex flex-col justify-end h-full pb-12 space-y-8">
        <div className="space-y-6">
             <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-8">
                <Activity className="text-white" size={40} />
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white leading-[1.1]">
                Твой личный <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">AI Тренер</span>
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed max-w-xs">
                Умный план тренировок, который адаптируется под твою физиологию и цели.
            </p>
        </div>
        
        <button 
            onClick={onNext} 
            className="w-full py-5 bg-white text-black rounded-2xl font-bold text-xl shadow-[0_0_40px_rgba(255,255,255,0.1)] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 group"
        >
            Начать <ArrowRight className="group-hover:translate-x-1 transition-transform" />
        </button>
    </div>
);

const GenderStep = ({ profile, updateProfile }: any) => (
    <div className="space-y-8 animate-slide-up">
        <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight">Кто вы?</h2>
            <p className="text-gray-500">Это нужно для расчета метаболизма.</p>
        </div>
        
        <div className="space-y-4">
             {Object.values(Gender).map(g => (
                <button 
                    key={g} 
                    onClick={() => updateProfile('gender', g)} 
                    className={`w-full p-6 rounded-3xl border flex items-center justify-between transition-all font-bold text-xl ${
                        profile.gender === g 
                        ? 'bg-white text-black border-white shadow-lg shadow-white/10' 
                        : 'bg-neutral-900 text-gray-500 border-neutral-800'
                    }`}
                >
                    <span className="flex items-center gap-4">
                        {g === Gender.Male ? <User size={24}/> : <Heart size={24}/>}
                        {g}
                    </span>
                    {profile.gender === g && <Check size={24} />}
                </button>
            ))}
        </div>
    </div>
);

const BiometricsStep = ({ profile, updateProfile }: any) => (
    <div className="space-y-8 animate-slide-up">
        <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight">Параметры</h2>
            <p className="text-gray-500">Уточним физические данные.</p>
        </div>
        
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block mb-3 text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 flex items-center gap-2"><Ruler size={14}/> Рост (см)</label>
                    <input 
                        type="number" 
                        value={profile.height || ''} 
                        onChange={e => updateProfile('height', parseInt(e.target.value))} 
                        className="w-full p-4 bg-neutral-900 rounded-2xl border border-neutral-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-3xl font-bold text-center"
                        placeholder="175"
                    />
                </div>
                <div>
                    <label className="block mb-3 text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 flex items-center gap-2"><Weight size={14}/> Вес (кг)</label>
                    <input 
                        type="number" 
                        value={profile.weight || ''} 
                        onChange={e => updateProfile('weight', parseInt(e.target.value))} 
                        className="w-full p-4 bg-neutral-900 rounded-2xl border border-neutral-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-3xl font-bold text-center"
                        placeholder="70"
                    />
                </div>
            </div>
            
            <div>
                 <label className="block mb-3 text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Возраст</label>
                 <input 
                    type="number" 
                    value={profile.age || ''} 
                    onChange={e => updateProfile('age', parseInt(e.target.value))} 
                    className="w-full p-4 bg-neutral-900 rounded-2xl border border-neutral-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-3xl font-bold text-center"
                    placeholder="30"
                />
            </div>
        </div>
    </div>
);

const GoalStep = ({ profile, updateProfile, setProfile }: any) => {
    const isWeightGoal = profile.goals.primary === Goal.LoseFat || profile.goals.primary === Goal.BuildMuscle;
    
    return (
    <div className="space-y-6 animate-slide-up">
        <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight">Цель</h2>
            <p className="text-gray-500">К чему будем стремиться?</p>
        </div>
        
        <div className="space-y-3">
            {Object.values(Goal).map(goal => (
                <SelectionCard 
                    key={goal} 
                    selected={profile.goals?.primary === goal} 
                    onClick={() => {
                         // Reset target weight if switching away from weight goals, or set default
                         const newTarget = (goal === Goal.LoseFat) ? (profile.weight - 5) : (goal === Goal.BuildMuscle ? profile.weight + 5 : undefined);
                         setProfile((prev: any) => ({ ...prev, goals: { primary: goal }, targetWeight: newTarget }));
                    }}
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${profile.goals?.primary === goal ? 'bg-indigo-500/20 text-indigo-400' : 'bg-neutral-800 text-gray-600'}`}>
                            <Target size={20} />
                        </div>
                        <span className="font-bold text-lg">{goal}</span>
                    </div>
                </SelectionCard>
            ))}
        </div>

        {isWeightGoal && (
            <div className="animate-fade-in pt-4 border-t border-white/5">
                <label className="block mb-3 text-sm font-bold text-white uppercase tracking-wider ml-1">Желаемый вес (кг)</label>
                <div className="flex items-center gap-4">
                    <div className="flex-1 text-center opacity-50">
                        <p className="text-xs font-bold text-gray-500 uppercase">Сейчас</p>
                        <p className="text-2xl font-black text-gray-400">{profile.weight}</p>
                    </div>
                    <ArrowRight className="text-indigo-500" />
                    <div className="flex-1">
                        <input 
                            type="number" 
                            value={profile.targetWeight || ''} 
                            onChange={e => updateProfile('targetWeight', parseInt(e.target.value))} 
                            className="w-full p-3 bg-indigo-900/20 rounded-xl border border-indigo-500/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-3xl font-black text-white text-center"
                        />
                    </div>
                </div>
            </div>
        )}
    </div>
)};

const ActivityStep = ({ profile, updateProfile }: any) => {
    const activities = [
        { level: ActivityLevel.Sedentary, label: "Сидячий", sub: "Офис / Дом", icon: <Laptop size={20}/> },
        { level: ActivityLevel.Light, label: "Малоактивный", sub: "Прогулки иногда", icon: <Footprints size={20}/> },
        { level: ActivityLevel.Moderate, label: "Средний", sub: "Спорт 1-2 раза", icon: <Activity size={20}/> },
        { level: ActivityLevel.VeryActive, label: "Активный", sub: "Физ. работа / Спорт", icon: <Flame size={20}/> },
    ];

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tight">Активность</h2>
                <p className="text-gray-500">Как проходит ваш обычный день?</p>
            </div>
            <div className="space-y-3">
                {activities.map(act => (
                    <SelectionCard 
                        key={act.level} 
                        selected={profile.activityLevel === act.level} 
                        onClick={() => updateProfile('activityLevel', act.level)}
                    >
                         <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${profile.activityLevel === act.level ? 'bg-indigo-500/20 text-indigo-400' : 'bg-neutral-800 text-gray-600'}`}>
                                {act.icon}
                            </div>
                            <div>
                                <span className="block font-bold text-lg leading-tight">{act.label}</span>
                                <span className="text-sm text-gray-500">{act.sub}</span>
                            </div>
                        </div>
                    </SelectionCard>
                ))}
            </div>
        </div>
    );
}

const ExperienceStep = ({ profile, updateProfile }: any) => (
    <div className="space-y-6 animate-slide-up">
        <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight">Опыт в зале</h2>
            <p className="text-gray-500">Это поможет подобрать правильный объем.</p>
        </div>
        <div className="space-y-3">
            {Object.values(ExperienceLevel).map(level => (
                <SelectionCard 
                    key={level} 
                    selected={profile.experience === level} 
                    onClick={() => updateProfile('experience', level)}
                >
                    <span className="font-bold text-lg">{level}</span>
                </SelectionCard>
            ))}
        </div>
    </div>
);

const LogisticsStep = ({ profile, updateProfile }: any) => (
    <div className="space-y-8 animate-slide-up">
        <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight">График</h2>
            <p className="text-gray-500">Настроим расписание.</p>
        </div>
        
        <div>
            <label className="block mb-3 text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Дней в неделю</label>
            <div className="flex justify-between gap-2 bg-neutral-900 p-1.5 rounded-2xl border border-neutral-800">
                {[2, 3, 4, 5, 6].map(day => (
                    <button 
                        key={day} 
                        onClick={() => updateProfile('daysPerWeek', day)} 
                        className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                            profile.daysPerWeek === day 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
                            : 'text-gray-600 hover:text-white'
                        }`}
                    >
                        {day}
                    </button>
                ))}
            </div>
        </div>

        <div>
            <label className="block mb-3 text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Минут на тренировку</label>
            <div className="grid grid-cols-4 gap-2">
                {[30, 45, 60, 75].map(time => (
                    <button 
                        key={time} 
                        onClick={() => updateProfile('timePerWorkout', time)} 
                        className={`py-3 rounded-xl font-bold text-lg border transition-all ${
                            profile.timePerWorkout === time 
                            ? 'border-indigo-500 bg-indigo-600/10 text-indigo-400' 
                            : 'border-neutral-800 bg-neutral-900 text-gray-600 hover:border-neutral-700'
                        }`}
                    >
                        {time}
                    </button>
                ))}
            </div>
        </div>

        <div>
            <label className="block mb-3 text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Оборудование</label>
             <div className="space-y-2">
                {Object.values(Location).map(loc => (
                    <SelectionCard 
                        key={loc} 
                        selected={profile.location === loc} 
                        onClick={() => updateProfile('location', loc)}
                        className="py-4"
                    >
                        <span className="text-sm font-bold">{loc}</span>
                    </SelectionCard>
                ))}
            </div>
        </div>
    </div>
);

const InjuryStep = ({ profile, updateProfile }: any) => (
    <div className="space-y-6 animate-slide-up">
        <div className="space-y-2 text-center mb-4">
            <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                 <ShieldAlert className="text-red-500" size={32} />
            </div>
            <h2 className="text-3xl font-black tracking-tight">Ограничения?</h2>
            <p className="text-gray-500">Травмы или боли, которые нужно учесть.</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            <button 
                onClick={() => updateProfile('hasInjuries', false)} 
                className={`p-6 rounded-3xl border-2 transition-all duration-200 ${!profile.hasInjuries ? 'border-emerald-500 bg-emerald-500/10' : 'border-neutral-800 bg-neutral-900 grayscale opacity-60 hover:opacity-100'}`}
            >
                <span className={`block text-2xl font-black mb-1 ${!profile.hasInjuries ? 'text-emerald-400' : 'text-gray-400'}`}>Нет</span>
                <span className="text-xs text-gray-500 font-bold uppercase">Здоров</span>
            </button>
            <button 
                onClick={() => updateProfile('hasInjuries', true)} 
                className={`p-6 rounded-3xl border-2 transition-all duration-200 ${profile.hasInjuries ? 'border-red-500 bg-red-500/10' : 'border-neutral-800 bg-neutral-900 grayscale opacity-60 hover:opacity-100'}`}
            >
                <span className={`block text-2xl font-black mb-1 ${profile.hasInjuries ? 'text-red-400' : 'text-gray-400'}`}>Да</span>
                <span className="text-xs text-gray-500 font-bold uppercase">Есть нюансы</span>
            </button>
        </div>

        {profile.hasInjuries && (
            <div className="animate-fade-in">
                <label className="block mb-3 text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Что беспокоит?</label>
                <textarea 
                    value={profile.injuries || ''} 
                    onChange={e => updateProfile('injuries', e.target.value)} 
                    className="w-full p-4 bg-neutral-900 rounded-2xl border border-neutral-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none min-h-[120px] text-white text-lg placeholder-gray-700"
                    placeholder="Например: болит поясница при приседаниях..."
                />
            </div>
        )}
    </div>
);

// --- Prediction Step ---
const PredictionStep = ({ profile, isAnalyzing, analysisText }: { profile: OnboardingProfile, isAnalyzing: boolean, analysisText: string }) => {
    const outcome = calculateProjectedOutcome(profile.weight, profile.targetWeight || profile.weight);
    const diff = Math.abs(profile.weight - (profile.targetWeight || profile.weight));
    const isLoss = (profile.targetWeight || profile.weight) < profile.weight;

    if (isAnalyzing) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-8 animate-fade-in">
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-neutral-800 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-24 h-24 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Zap className="text-indigo-400 animate-pulse" size={32} />
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-white">Создаем план</h3>
                    <p className="text-gray-400 font-mono text-sm">{analysisText}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-scale-in">
            <div className="text-center space-y-2 mb-8">
                <h2 className="text-3xl font-black tracking-tight text-white">План готов!</h2>
                <p className="text-gray-400">Мы рассчитали твой путь к цели.</p>
            </div>

            {/* Prediction Card */}
            {outcome ? (
                <div className="bg-gradient-to-br from-indigo-900/40 to-violet-900/40 border border-indigo-500/30 rounded-3xl p-6 text-center relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                     
                     <p className="text-gray-400 font-bold uppercase text-xs tracking-wider mb-2">Прогноз результата</p>
                     
                     <div className="flex items-center justify-center gap-4 mb-4">
                        <div className="text-right">
                             <p className="text-sm text-gray-500 line-through font-bold">{profile.weight} кг</p>
                        </div>
                        <ArrowRight className="text-indigo-400" />
                        <div className="text-left">
                            <p className="text-4xl font-black text-white">{profile.targetWeight} кг</p>
                        </div>
                     </div>

                     <div className="inline-block bg-indigo-500 px-4 py-2 rounded-xl text-white font-bold text-sm mb-4 shadow-lg shadow-indigo-500/30">
                        {outcome.completionDate}
                     </div>

                     <p className="text-xs text-indigo-200/70 leading-relaxed max-w-xs mx-auto">
                        При соблюдении режима и питания ты сможешь {isLoss ? 'сбросить' : 'набрать'} {diff.toFixed(1)} кг примерно за {outcome.months} {outcome.months === 1 ? 'месяц' : (outcome.months < 5 ? 'месяца' : 'месяцев')}.
                     </p>
                </div>
            ) : (
                <div className="bg-neutral-900 border border-white/5 rounded-3xl p-6 text-center">
                    <Trophy size={48} className="mx-auto text-yellow-500 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Отличный старт!</h3>
                    <p className="text-gray-400 text-sm">Твоя программа направлена на {profile.goals.primary.toLowerCase()}.</p>
                </div>
            )}

            {/* Program Summary */}
            <div className="bg-neutral-900/50 border border-white/5 rounded-3xl p-4 space-y-3">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-neutral-800 rounded-lg text-gray-400"><CalendarDays size={18}/></div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">График</p>
                        <p className="font-bold text-white">{profile.daysPerWeek} тренировки в неделю</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-neutral-800 rounded-lg text-gray-400"><Dumbbell size={18}/></div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Интенсивность</p>
                        <p className="font-bold text-white">Адаптированная под {profile.experience}</p>
                    </div>
                 </div>
            </div>

            <p className="text-center text-[10px] text-gray-600 px-4">
                *Прогноз является приблизительным и зависит от питания, сна и индивидуальных особенностей организма.
            </p>
        </div>
    );
};

export default Onboarding;
