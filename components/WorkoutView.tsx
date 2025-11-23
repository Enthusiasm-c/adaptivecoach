
import React, { useState, useEffect, useRef } from 'react';
import { WorkoutSession, CompletedExercise, WorkoutLog, OnboardingProfile, Exercise, ReadinessData } from '../types';
import FeedbackModal from './FeedbackModal';
import { ChevronLeft, Timer, Replace, AlertTriangle, Info, Calculator, History, CheckCircle2, ExternalLink, Video, ChevronDown, ChevronUp } from 'lucide-react';
import CoachFeedbackModal from './CoachFeedbackModal';
import ExerciseSwapModal from './ExerciseSwapModal';
import PlateCalculatorModal from './PlateCalculatorModal';
import RestTimer from './RestTimer';
import { getCoachFeedback } from '../services/geminiService';
import { generateWarmupSets, getLastPerformance, getExerciseHistory } from '../utils/progressUtils';

interface WorkoutViewProps {
  session: WorkoutSession;
  profile: OnboardingProfile;
  readiness: ReadinessData | null;
  onFinish: (log: WorkoutLog) => void;
  onBack: () => void;
}

const WorkoutView: React.FC<WorkoutViewProps> = ({ session, profile, readiness, onFinish, onBack }) => {
  const [currentSession, setCurrentSession] = useState<WorkoutSession>(session);
  const [completedExercises, setCompletedExercises] = useState<CompletedExercise[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null);
  const [isCoachFeedbackLoading, setIsCoachFeedbackLoading] = useState(false);
  const [finalLog, setFinalLog] = useState<WorkoutLog | null>(null);

  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [exerciseToSwap, setExerciseToSwap] = useState<Exercise | null>(null);

  // New Features State
  const [plateCalcWeight, setPlateCalcWeight] = useState<number | null>(null);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  
  // History State
  const [exerciseHistory, setExerciseHistory] = useState<{ date: string, sets: { weight: number, reps: number }[] }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let adjustedExercises = [...session.exercises];
    
    // 1. Auto-Regulation Logic
    if (readiness) {
        if (readiness.status === 'Red') {
            adjustedExercises = adjustedExercises.map(ex => ({
                ...ex,
                sets: Math.max(2, ex.sets - 1),
                weight: ex.weight ? Math.round(ex.weight * 0.9) : undefined
            }));
        } else if (readiness.status === 'Yellow') {
            adjustedExercises = adjustedExercises.map(ex => ({
                ...ex,
                weight: ex.weight ? Math.round(ex.weight * 0.95) : undefined
            }));
        }
    }

    // 2. Insert Warmups
    if (adjustedExercises.length > 0 && adjustedExercises[0].weight && adjustedExercises[0].weight > 20) {
        const warmups = generateWarmupSets(adjustedExercises[0].weight);
        adjustedExercises = [...warmups, ...adjustedExercises];
    }

    setCurrentSession({ ...session, exercises: adjustedExercises });
    
    setCompletedExercises(
      adjustedExercises.map(ex => ({
        ...ex,
        completedSets: Array.from({ length: ex.sets }, () => ({ reps: parseInt(ex.reps.split('-')[0] || '0'), weight: ex.weight || 0, rir: undefined })),
      }))
    );
    
    setCurrentExerciseIndex(0);

  }, [session, readiness]);

  // Fetch history on exercise change
  useEffect(() => {
      const currentEx = completedExercises[currentExerciseIndex];
      setShowHistory(false); // Reset history view
      
      if (currentEx) {
          try {
              const storedLogs = localStorage.getItem('workoutLogs');
              if (storedLogs) {
                  const logs: WorkoutLog[] = JSON.parse(storedLogs);
                  const history = getExerciseHistory(currentEx.name, logs, 3); // Last 3 sessions
                  setExerciseHistory(history);
              }
          } catch (e) {
              console.error(e);
          }
      }
      // Scroll top on exercise change
      if(scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [currentExerciseIndex, completedExercises.length]); // Depend on length to ensure init triggers

  const handleValueChange = (exIndex: number, setIndex: number, field: 'reps' | 'weight' | 'rir', value: number) => {
    const newExercises = [...completedExercises];
    if (isNaN(value)) {
        (newExercises[exIndex].completedSets[setIndex] as any)[field] = undefined;
    } else {
        (newExercises[exIndex].completedSets[setIndex] as any)[field] = value;
    }
    setCompletedExercises(newExercises);
  };

  const handleSetComplete = (restTime: number) => {
      setTimerSeconds(restTime);
      setShowRestTimer(true);
  }
  
  const finishWorkout = () => {
    setIsFeedbackModalOpen(true);
  };

  const handleFeedbackSubmit = async (feedback: WorkoutLog['feedback']) => {
    setIsFeedbackModalOpen(false);
    setIsCoachModalOpen(true);
    setIsCoachFeedbackLoading(true);

    const mainExercises = completedExercises.filter(ex => !ex.isWarmup);

    const log: WorkoutLog = {
      sessionId: session.name,
      date: new Date().toISOString(),
      feedback: { ...feedback, readiness },
      completedExercises: mainExercises,
    };
    setFinalLog(log); 

    try {
      const coachResponse = await getCoachFeedback(profile, log);
      setCoachFeedback(coachResponse);
    } catch (e) {
      console.error("Failed to get coach feedback", e);
      setCoachFeedback("Отличная работа! Продолжай в том же духе и не забывай пить воду.");
    } finally {
      setIsCoachFeedbackLoading(false);
    }
  };

  const handleFinishFlow = () => {
    if (finalLog) {
      onFinish(finalLog);
    }
    setIsCoachModalOpen(false);
  };

  const openSwapModal = (exercise: Exercise) => {
    setExerciseToSwap(exercise);
    setIsSwapModalOpen(true);
  };

  const handleExerciseSwap = (newExercise: Exercise) => {
    if (!exerciseToSwap) return;

    const newSessionExercises = currentSession.exercises.map(ex => 
      ex.name === exerciseToSwap.name ? newExercise : ex
    );
    
    setCurrentSession({ ...currentSession, exercises: newSessionExercises });
    
    const newCompleted = newSessionExercises.map((ex, i) => {
        if (ex.name === newExercise.name) {
            return {
                ...ex,
                completedSets: Array.from({ length: ex.sets }, () => ({ reps: parseInt(ex.reps.split('-')[0] || '0'), weight: ex.weight || 0, rir: undefined })),
            }
        }
        return completedExercises[i];
    });

    setCompletedExercises(newCompleted);
    setIsSwapModalOpen(false);
    setExerciseToSwap(null);
  };

  const openYouTubeSearch = () => {
    if (!currentExercise) return;
    const query = encodeURIComponent(`${currentExercise.name} техника выполнения`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
  };


  const currentExercise = completedExercises[currentExerciseIndex];

  if (!currentExercise) {
    return <div className="min-h-[100dvh] bg-neutral-950"></div>;
  }

  return (
    <div className="w-full max-w-md mx-auto h-[100dvh] bg-neutral-950 text-white font-sans flex flex-col overflow-hidden">
      
      {/* Header */}
      <header className="pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 px-4 flex items-center justify-between bg-neutral-950 z-10">
        <button onClick={onBack} className="p-2 bg-neutral-900 border border-white/10 rounded-full text-gray-400 hover:text-white hover:border-white/30 transition">
            <ChevronLeft size={20} />
        </button>
        <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Упражнение {currentExerciseIndex + 1} из {completedExercises.length}</span>
            <div className="flex gap-1 mt-1">
                {completedExercises.map((_, idx) => (
                    <div key={idx} className={`h-1 w-4 rounded-full ${idx === currentExerciseIndex ? 'bg-indigo-500' : idx < currentExerciseIndex ? 'bg-indigo-900' : 'bg-neutral-800'}`}></div>
                ))}
            </div>
        </div>
      </header>

      {readiness?.status === 'Red' && (
        <div className="mx-4 mb-4 bg-red-500/10 border border-red-500/20 p-3 rounded-2xl flex items-start gap-3 text-sm text-red-300">
            <AlertTriangle size={18} className="mt-0.5 shrink-0"/>
            <p>Высокая усталость: Веса и подходы снижены автоматически.</p>
        </div>
      )}

      {/* Main Scroll Area */}
      <div ref={scrollRef} className="flex-grow overflow-y-auto px-4 pb-32 no-scrollbar overscroll-contain">
          
        {/* Exercise Title Card */}
        <div className="mb-6">
             {currentExercise.isWarmup && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2">
                    <Info size={12}/> Разминка
                </span>
            )}
            <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h2 className={`text-2xl font-black leading-tight ${currentExercise.isWarmup ? 'text-gray-400' : 'text-white'}`}>
                            {currentExercise.name}
                        </h2>
                        {!currentExercise.isWarmup && exerciseHistory.length > 0 && (
                             <button 
                                onClick={() => setShowHistory(!showHistory)}
                                className={`p-2 rounded-full transition-colors ${showHistory ? 'bg-indigo-600 text-white' : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'}`}
                             >
                                 <History size={18} />
                             </button>
                        )}
                    </div>
                    
                    {currentExercise.description && (
                        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                            {currentExercise.description}
                        </p>
                    )}
                    
                    {!currentExercise.isWarmup && (
                        <button 
                            onClick={openYouTubeSearch}
                            className="mt-3 flex items-center gap-2 text-xs font-bold text-red-400 bg-red-500/10 px-3 py-2 rounded-lg hover:bg-red-500/20 transition"
                        >
                            <Video size={14} /> Смотреть технику (YouTube)
                        </button>
                    )}
                </div>

                 {!currentExercise.isWarmup && (
                     <button onClick={() => openSwapModal(currentExercise)} className="shrink-0 text-gray-500 hover:text-indigo-400 transition p-2 bg-neutral-900 rounded-xl border border-white/5">
                        <Replace size={20} />
                     </button>
                 )}
            </div>
            
            {/* Contextual History Section */}
            {showHistory && !currentExercise.isWarmup && (
                <div className="mt-4 bg-neutral-900 rounded-xl border border-indigo-500/30 p-4 animate-slide-up">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase mb-3 flex items-center gap-2">
                        <History size={12}/> Прошлые тренировки
                    </h4>
                    <div className="space-y-3">
                        {exerciseHistory.map((h, i) => (
                            <div key={i} className="text-sm">
                                <div className="flex justify-between text-gray-500 text-xs mb-1">
                                    <span>{new Date(h.date).toLocaleDateString('ru-RU', {day:'numeric', month:'long'})}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {h.sets.map((s, idx) => (
                                        <span key={idx} className="px-2 py-1 bg-neutral-800 rounded text-white font-mono text-xs border border-white/5">
                                            {s.weight}кг x {s.reps}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Sets Container */}
        <div className="space-y-3">
            {currentExercise.completedSets.map((set, setIndex) => (
                <div key={setIndex} className="bg-neutral-900/50 border border-white/5 p-4 rounded-3xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center justify-center w-8">
                            <span className="text-xs text-gray-500 font-bold uppercase">Подход</span>
                            <span className="text-lg font-bold text-white">{setIndex + 1}</span>
                        </div>
                        
                        {/* Weight Input */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">Вес (кг)</span>
                            <div className="relative w-24">
                                <input 
                                    type="number"
                                    value={set.weight}
                                    onChange={(e) => handleValueChange(currentExerciseIndex, setIndex, 'weight', parseInt(e.target.value))}
                                    className="w-full bg-neutral-800 text-white text-xl font-bold p-3 rounded-xl text-center focus:bg-indigo-900/20 focus:text-indigo-400 outline-none transition-colors"
                                />
                                {!currentExercise.isWarmup && set.weight > 20 && (
                                    <button 
                                        onClick={() => setPlateCalcWeight(set.weight)}
                                        className="absolute -top-2 -right-2 bg-neutral-700 text-white rounded-full p-1 hover:bg-indigo-600 transition shadow-md border border-neutral-600"
                                    >
                                        <Calculator size={10} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Reps Input */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">Повт.</span>
                            <input 
                                type="number"
                                value={set.reps}
                                onChange={(e) => handleValueChange(currentExerciseIndex, setIndex, 'reps', parseInt(e.target.value))}
                                className="w-full w-20 bg-neutral-800 text-white text-xl font-bold p-3 rounded-xl text-center focus:bg-indigo-900/20 focus:text-indigo-400 outline-none transition-colors"
                            />
                        </div>
                    </div>

                    {/* Action / RIR */}
                    <div className="flex items-center">
                        {!currentExercise.isWarmup ? (
                           <div className="flex flex-col gap-1 w-16">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1 text-center">Запас</span>
                                <input 
                                    type="number"
                                    value={set.rir ?? ''}
                                    placeholder="-"
                                    onChange={(e) => handleValueChange(currentExerciseIndex, setIndex, 'rir', parseInt(e.target.value))}
                                    className="w-full bg-neutral-800 text-gray-300 text-xl font-bold p-3 rounded-xl text-center focus:bg-indigo-900/20 focus:text-indigo-400 outline-none transition-colors placeholder-gray-600"
                                />
                           </div>
                        ) : (
                           <button onClick={() => handleSetComplete(currentExercise.rest)} className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center text-green-500 hover:bg-green-500 hover:text-white transition-colors">
                                <CheckCircle2 size={24} />
                           </button>
                        )}
                    </div>
                </div>
            ))}
        </div>

        {/* Timer Trigger */}
         <div className="mt-6 flex justify-center">
            <button 
                onClick={() => handleSetComplete(currentExercise.rest)}
                className="flex items-center gap-3 px-6 py-3 bg-neutral-800 rounded-full border border-white/10 hover:bg-neutral-700 transition text-sm font-bold text-indigo-300"
            >
                <Timer size={18} /> 
                Отдых ({currentExercise.rest}с)
            </button>
         </div>

      </div>
      
      {/* Bottom Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black to-transparent pt-10 z-20 pb-[max(1rem,env(safe-area-inset-bottom))]">
         <div className="max-w-lg mx-auto flex gap-4">
            <button 
              onClick={() => setCurrentExerciseIndex(i => Math.max(0, i-1))}
              disabled={currentExerciseIndex === 0}
              className="px-6 py-4 bg-neutral-900 rounded-2xl font-bold disabled:opacity-30 text-gray-400 hover:text-white border border-white/10 transition"
            >
              <ChevronLeft size={24}/>
            </button>
            
             {currentExerciseIndex < completedExercises.length - 1 ? (
                <button 
                  onClick={() => setCurrentExerciseIndex(i => Math.min(completedExercises.length - 1, i+1))}
                  className="flex-grow py-4 bg-white text-black rounded-2xl font-bold hover:bg-gray-200 transition shadow-[0_0_20px_rgba(255,255,255,0.2)] text-lg"
                >
                  Дальше
                </button>
             ) : (
                <button onClick={finishWorkout} className="flex-grow py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-400 transition shadow-[0_0_20px_rgba(16,185,129,0.4)] text-lg">
                  Закончить
                </button>
             )}
         </div>
      </div>
      
      {isFeedbackModalOpen && (
        <FeedbackModal 
          onSubmit={handleFeedbackSubmit}
          onClose={() => setIsFeedbackModalOpen(false)}
        />
      )}

      {isCoachModalOpen && (
        <CoachFeedbackModal
            isLoading={isCoachFeedbackLoading}
            feedback={coachFeedback}
            onClose={handleFinishFlow}
        />
      )}

      {isSwapModalOpen && exerciseToSwap && (
        <ExerciseSwapModal
            exercise={exerciseToSwap}
            session={currentSession}
            profile={profile}
            onSwap={handleExerciseSwap}
            onClose={() => setIsSwapModalOpen(false)}
        />
      )}

      {plateCalcWeight && (
          <PlateCalculatorModal 
              targetWeight={plateCalcWeight}
              onClose={() => setPlateCalcWeight(null)}
          />
      )}

      <RestTimer 
        isOpen={showRestTimer} 
        initialSeconds={timerSeconds} 
        onClose={() => setShowRestTimer(false)}
      />

    </div>
  );
};

export default WorkoutView;