
import React, { useState, useEffect, useRef } from 'react';
import { WorkoutSession, CompletedExercise, WorkoutLog, OnboardingProfile, Exercise, ReadinessData } from '../types';
import FeedbackModal from './FeedbackModal';
import { ChevronLeft, ChevronRight, Timer, Replace, AlertTriangle, Info, Calculator, History, CheckCircle2, ExternalLink, Video, ChevronDown, ChevronUp } from 'lucide-react';
import CoachFeedbackModal from './CoachFeedbackModal';
import ExerciseSwapModal from './ExerciseSwapModal';
import PlateCalculatorModal from './PlateCalculatorModal';
import RestTimer from './RestTimer';
import Stopwatch from './Stopwatch';
import { hapticFeedback } from '../utils/hapticUtils';
import { getCoachFeedback } from '../services/geminiService';
import { generateWarmupSets, getLastPerformance, getExerciseHistory } from '../utils/progressUtils';

interface WorkoutViewProps {
  session: WorkoutSession;
  profile: OnboardingProfile;
  readiness: ReadinessData | null;
  logs: WorkoutLog[];
  initialState?: { completedExercises: CompletedExercise[], startTime: number };
  onFinish: (log: WorkoutLog) => void;
  onBack: () => void;
  onProgress?: (state: { completedExercises: CompletedExercise[], startTime: number }) => void;
}

const WorkoutView: React.FC<WorkoutViewProps> = ({ session, profile, readiness, logs, initialState, onFinish, onBack, onProgress }) => {
  const [currentSession, setCurrentSession] = useState<WorkoutSession>(session);
  const [completedExercises, setCompletedExercises] = useState<CompletedExercise[]>([]);
  const startTimeRef = useRef<number>(initialState?.startTime || Date.now());
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
  const [showHistory, setShowHistory] = useState(true);

  // RIR Info Modal
  const [showRirInfo, setShowRirInfo] = useState(false);

  // Bug fix: track attempted finish to highlight incomplete fields
  const [attemptedFinish, setAttemptedFinish] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Bug fix: mid-workout pain reporting
  const [showPainModal, setShowPainModal] = useState(false);
  const [midWorkoutPain, setMidWorkoutPain] = useState<string>('');

  useEffect(() => {
    if (initialState) {
      setCurrentSession({ ...session }); // Keep original session structure
      setCompletedExercises(initialState.completedExercises);
      return;
    }

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

  }, [session, readiness, initialState]);

  // Persistence Effect
  useEffect(() => {
    if (completedExercises.length > 0 && onProgress) {
      onProgress({
        completedExercises,
        startTime: startTimeRef.current
      });
    }
  }, [completedExercises, onProgress]);

  // Fetch history on exercise change
  useEffect(() => {
    const currentEx = completedExercises[currentExerciseIndex];

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
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [currentExerciseIndex, completedExercises.length]); // Depend on length to ensure init triggers

  const handleValueChange = (exIndex: number, setIndex: number, field: 'reps' | 'weight' | 'rir', value: number) => {
    const newExercises = [...completedExercises];
    if (isNaN(value)) {
      (newExercises[exIndex].completedSets[setIndex] as any)[field] = undefined;
    } else {
      (newExercises[exIndex].completedSets[setIndex] as any)[field] = value;

      // Auto-fill logic: Copy weight or reps to next empty set
      if (field === 'weight' || field === 'reps') {
        const nextSetIndex = setIndex + 1;
        if (nextSetIndex < newExercises[exIndex].completedSets.length) {
          const nextSet = newExercises[exIndex].completedSets[nextSetIndex];
          if (!nextSet[field] || nextSet[field] === 0) {
            (nextSet as any)[field] = value;
          }
        }
      }
    }
    setCompletedExercises(newExercises);
  };

  const toggleSetComplete = (exIndex: number, setIndex: number) => {
    const newExercises = [...completedExercises];
    const set = newExercises[exIndex].completedSets[setIndex];
    set.isCompleted = !set.isCompleted;

    if (set.isCompleted) {
      hapticFeedback.impactOccurred('light');
    }

    setCompletedExercises(newExercises);
  };

  const handleSetComplete = (restTime: number) => {
    setTimerSeconds(restTime);
    setShowRestTimer(true);
  }

  // Keywords for auto-detecting exercise type when AI doesn't set it correctly
  const CARDIO_KEYWORDS = ['кардио', 'бег', 'ходьба', 'велосипед', 'сайкл', 'эллипс', 'скакалк', 'прыжк', 'дорожк', 'степпер', 'гребля', 'велотренажёр'];
  const BODYWEIGHT_KEYWORDS = ['планка', 'отжиман', 'подтягив', 'пресс', 'скручиван', 'в висе', 'подъём ног', 'подъем ног', 'берпи', 'выпрыгив', 'присед без', 'гиперэкстензия без'];
  const ISOMETRIC_KEYWORDS = ['удержан', 'статик', 'вис ', 'стойка'];

  // Helper: check if exercise requires weight input
  const exerciseNeedsWeight = (ex: typeof completedExercises[0]): boolean => {
    // If explicitly marked as non-strength, no weight needed
    if (['cardio', 'bodyweight', 'isometric'].includes(ex.exerciseType || '')) {
      return false;
    }

    // Fallback: check exercise name for keywords (double protection if AI forgot to set type)
    const nameLower = ex.name.toLowerCase();
    if (CARDIO_KEYWORDS.some(k => nameLower.includes(k))) return false;
    if (BODYWEIGHT_KEYWORDS.some(k => nameLower.includes(k))) return false;
    if (ISOMETRIC_KEYWORDS.some(k => nameLower.includes(k))) return false;

    // Default: strength exercise needs weight
    return true;
  };

  // Helper: check if all sets are complete for an exercise
  const isExerciseComplete = (ex: typeof completedExercises[0]): boolean => {
    const needsWeight = exerciseNeedsWeight(ex);
    return ex.completedSets.every(s =>
      s.reps > 0 && (needsWeight ? s.weight > 0 : true)
    );
  };

  // Helper: check which fields are incomplete for a specific set (for red highlighting)
  const getSetErrors = (ex: typeof completedExercises[0], set: typeof ex.completedSets[0]): { weight: boolean, reps: boolean } => {
    const needsWeight = exerciseNeedsWeight(ex);
    return {
      weight: needsWeight && (!set.weight || set.weight <= 0),
      reps: !set.reps || set.reps <= 0
    };
  };

  // Navigation functions
  const findNextIncomplete = (fromIndex: number): number => {
    const total = completedExercises.length;
    for (let i = 1; i <= total; i++) {
      const idx = (fromIndex + i) % total;
      const ex = completedExercises[idx];
      if (!isExerciseComplete(ex)) return idx;
    }
    return -1; // all complete
  };

  const goNext = () => {
    hapticFeedback.impactOccurred('light');
    if (currentExerciseIndex < completedExercises.length - 1) {
      setCurrentExerciseIndex(i => i + 1);
    } else {
      // Loop to next incomplete
      const next = findNextIncomplete(currentExerciseIndex);
      if (next !== -1) setCurrentExerciseIndex(next);
    }
  };

  const goPrev = () => {
    hapticFeedback.impactOccurred('light');
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(i => i - 1);
    }
  };

  // Check if all exercises are complete (uses helper that respects exerciseType)
  const canFinish = completedExercises.every(isExerciseComplete);

  const finishWorkout = () => {
    if (!canFinish) {
      hapticFeedback.notificationOccurred('warning');
      setAttemptedFinish(true);
      // Navigate to first incomplete exercise
      const firstIncomplete = completedExercises.findIndex(ex => !isExerciseComplete(ex));
      if (firstIncomplete !== -1) {
        setCurrentExerciseIndex(firstIncomplete);
      }
      setToastMessage('Заполни все поля, отмеченные красным');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    setIsFeedbackModalOpen(true);
  };

  const handleFeedbackSubmit = async (feedback: WorkoutLog['feedback']) => {
    setIsFeedbackModalOpen(false);
    setIsCoachModalOpen(true);
    setIsCoachFeedbackLoading(true);

    const mainExercises = completedExercises.filter(ex => !ex.isWarmup);

    const log: WorkoutLog = {
      sessionId: session.name,
      date: new Date().toLocaleDateString('sv-SE'), // YYYY-MM-DD format in local timezone
      startTime: startTimeRef.current,
      duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
      feedback: { ...feedback, readiness },
      completedExercises: mainExercises,
    };
    setFinalLog(log);

    try {
      const coachResponse = await getCoachFeedback(profile, log, logs);
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

      {/* Toast Message */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-red-500/20 backdrop-blur border border-red-500/30 text-red-300 px-6 py-3 rounded-full shadow-2xl font-bold text-sm animate-slide-up flex items-center gap-2">
          <AlertTriangle size={16} />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 px-4 flex items-center justify-between bg-neutral-950 z-10">
        <button onClick={onBack} className="p-2 bg-neutral-900 border border-white/10 rounded-full text-gray-400 hover:text-white hover:border-white/30 transition">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          {/* Pain Report Button */}
          <button
            onClick={() => setShowPainModal(true)}
            className="p-2 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 hover:bg-red-500/20 transition"
            title="Сообщить о боли"
          >
            <AlertTriangle size={18} />
          </button>
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Упражнение {currentExerciseIndex + 1} из {completedExercises.length}</span>
            <div className="flex gap-1 mt-1">
              {completedExercises.map((_, idx) => (
                <div key={idx} className={`h-1 w-4 rounded-full ${idx === currentExerciseIndex ? 'bg-indigo-500' : idx < currentExerciseIndex ? 'bg-indigo-900' : 'bg-neutral-800'}`}></div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {readiness?.status === 'Red' && (
        <div className="mx-4 mb-4 bg-red-500/10 border border-red-500/20 p-3 rounded-2xl flex items-start gap-3 text-sm text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>Высокая усталость: Веса и подходы снижены автоматически.</p>
        </div>
      )}

      {/* Main Scroll Area */}
      <div ref={scrollRef} className="flex-grow overflow-y-auto px-4 pb-32 no-scrollbar overscroll-contain">



        {/* Sets Container */}
        <div className="space-y-3">
          <div className="mb-6 bg-neutral-900/50 border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-5">
              {/* Navigation Arrows */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={goPrev}
                  disabled={currentExerciseIndex === 0}
                  className="p-2 rounded-lg bg-neutral-800 text-gray-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-xs text-gray-500 font-bold">
                  {currentExerciseIndex + 1} / {completedExercises.length}
                </span>
                <button
                  onClick={goNext}
                  className="p-2 rounded-lg bg-neutral-800 text-gray-400 hover:text-white transition"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                    {currentExerciseIndex + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white leading-tight">{currentExercise.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{currentExercise.sets} подхода × {currentExercise.reps}</p>
                  </div>
                </div>
                <button
                  onClick={() => openSwapModal(currentExercise)}
                  className="p-2 rounded-lg bg-neutral-800 text-gray-400 hover:text-white transition"
                >
                  <Replace size={18} />
                </button>
              </div>

              {/* Description and YouTube button */}
              {currentExercise.description && (
                <p className="text-sm text-gray-400 mt-2 leading-relaxed mb-4">
                  {currentExercise.description}
                </p>
              )}
              {!currentExercise.isWarmup && (
                <button
                  onClick={() => openYouTubeSearch()}
                  className="mt-3 flex items-center gap-2 text-xs font-bold text-red-400 bg-red-500/10 px-3 py-2 rounded-lg hover:bg-red-500/20 transition mb-4"
                >
                  <Video size={14} /> Смотреть технику (YouTube)
                </button>
              )}

              {/* Contextual History Section (if applicable for this exercise) */}
              {showHistory && !currentExercise.isWarmup && (
                <div className="mt-4 bg-neutral-900 rounded-xl border border-indigo-500/30 p-4 animate-slide-up mb-4">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase mb-3 flex items-center gap-2">
                    <History size={12} /> Прошлые тренировки
                  </h4>
                  <div className="space-y-3">
                    {exerciseHistory.map((h, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex justify-between text-gray-500 text-xs mb-1">
                          <span>{new Date(h.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
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

              {/* Sets */}
              <div className="space-y-3">
                {currentExercise.completedSets.map((set, setIndex) => (
                  <div key={setIndex} className={`grid ${exerciseNeedsWeight(currentExercise) ? 'grid-cols-[auto_1fr_1fr_0.7fr_auto]' : 'grid-cols-[auto_1fr_0.7fr_auto]'} gap-2 items-center p-3 rounded-xl transition-all ${set.isCompleted
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-neutral-900/50 border border-white/5'
                    }`}>
                    <div className="w-6 text-center font-mono text-gray-500 text-sm">#{setIndex + 1}</div>

                    {exerciseNeedsWeight(currentExercise) && (
                      <div className="relative">
                        <input
                          type="number"
                          value={set.weight || ''}
                          onChange={(e) => handleValueChange(currentExerciseIndex, setIndex, 'weight', parseInt(e.target.value))}
                          placeholder={currentExercise.weight?.toString() || "кг"}
                          className={`w-full bg-transparent text-center font-mono font-bold text-white outline-none border-b transition py-1 ${
                            attemptedFinish && getSetErrors(currentExercise, set).weight
                              ? 'border-red-500 bg-red-500/10'
                              : 'border-gray-700 focus:border-indigo-500'
                          }`}
                        />
                        <span className={`absolute right-0 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none ${
                          attemptedFinish && getSetErrors(currentExercise, set).weight ? 'text-red-400' : 'text-gray-600'
                        }`}>кг</span>
                      </div>
                    )}

                    <div className="relative">
                      <input
                        type="number"
                        value={set.reps || ''}
                        onChange={(e) => handleValueChange(currentExerciseIndex, setIndex, 'reps', parseInt(e.target.value))}
                        placeholder={currentExercise.reps.split('-')[0]}
                        className={`w-full bg-transparent text-center font-mono font-bold text-white outline-none border-b transition py-1 ${
                          attemptedFinish && getSetErrors(currentExercise, set).reps
                            ? 'border-red-500 bg-red-500/10'
                            : 'border-gray-700 focus:border-indigo-500'
                        }`}
                      />
                      <span className={`absolute right-0 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none ${
                        attemptedFinish && getSetErrors(currentExercise, set).reps ? 'text-red-400' : 'text-gray-600'
                      }`}>повт</span>
                    </div>

                    {/* RIR - Reps In Reserve */}
                    <div className="relative flex items-center gap-1">
                      <select
                        value={set.rir ?? ''}
                        onChange={(e) => handleValueChange(currentExerciseIndex, setIndex, 'rir', parseInt(e.target.value))}
                        className="w-full bg-transparent text-center font-mono font-bold text-white outline-none border-b border-gray-700 focus:border-indigo-500 transition py-1 appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-neutral-900">-</option>
                        <option value="0" className="bg-neutral-900">0</option>
                        <option value="1" className="bg-neutral-900">1</option>
                        <option value="2" className="bg-neutral-900">2</option>
                        <option value="3" className="bg-neutral-900">3+</option>
                      </select>
                      <button
                        onClick={() => setShowRirInfo(true)}
                        className="text-gray-500 hover:text-indigo-400 transition p-0.5"
                      >
                        <Info size={14} />
                      </button>
                    </div>

                    <button
                      onClick={() => toggleSetComplete(currentExerciseIndex, setIndex)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 ${set.isCompleted
                        ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                        : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'
                        }`}
                    >
                      <CheckCircle2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
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

        {/* Stopwatch for Time-based exercises */}
        {(currentExercise.name.toLowerCase().includes('планка') || currentExercise.reps.includes('с') || currentExercise.reps.includes('sec')) && (
          <div className="mt-4 flex justify-center">
            <Stopwatch />
          </div>
        )}

      </div>

      {/* Bottom Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black to-transparent pt-10 z-20 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto flex gap-4">
          <button
            onClick={goPrev}
            disabled={currentExerciseIndex === 0}
            className="px-6 py-4 bg-neutral-900 rounded-2xl font-bold disabled:opacity-30 text-gray-400 hover:text-white border border-white/10 transition"
          >
            <ChevronLeft size={24} />
          </button>

          {canFinish ? (
            <button onClick={finishWorkout} className="flex-grow py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-400 transition shadow-[0_0_20px_rgba(16,185,129,0.4)] text-lg">
              Закончить
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex-grow py-4 bg-white text-black rounded-2xl font-bold hover:bg-gray-200 transition shadow-[0_0_20px_rgba(255,255,255,0.2)] text-lg"
            >
              {currentExerciseIndex < completedExercises.length - 1 ? 'Дальше' : 'К незаполненным'}
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

      {/* RIR Info Modal */}
      {showRirInfo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowRirInfo(false)}>
          <div className="bg-neutral-900 rounded-2xl p-6 max-w-sm w-full border border-white/10 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Что такое RIR?</h3>
              <button onClick={() => setShowRirInfo(false)} className="text-gray-500 hover:text-white">
                <ChevronDown size={20} />
              </button>
            </div>

            <p className="text-gray-400 text-sm">
              <strong className="text-indigo-400">RIR (Reps In Reserve)</strong> — сколько повторений ты мог бы ещё сделать после завершения подхода.
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3 bg-red-500/10 p-3 rounded-xl">
                <span className="text-red-500 font-bold w-8">0</span>
                <span className="text-gray-300">Отказ — не мог сделать ни одного повтора</span>
              </div>
              <div className="flex items-center gap-3 bg-orange-500/10 p-3 rounded-xl">
                <span className="text-orange-500 font-bold w-8">1</span>
                <span className="text-gray-300">Мог бы сделать ещё 1 повтор</span>
              </div>
              <div className="flex items-center gap-3 bg-yellow-500/10 p-3 rounded-xl">
                <span className="text-yellow-500 font-bold w-8">2</span>
                <span className="text-gray-300">Мог бы сделать ещё 2 повтора</span>
              </div>
              <div className="flex items-center gap-3 bg-emerald-500/10 p-3 rounded-xl">
                <span className="text-emerald-500 font-bold w-8">3+</span>
                <span className="text-gray-300">Легко — мог бы сделать 3+ повтора</span>
              </div>
            </div>

            <p className="text-gray-500 text-xs">
              💡 RIR помогает тренеру понять насколько тяжело тебе было и адаптировать программу — повысить или снизить вес на следующей тренировке.
            </p>
          </div>
        </div>
      )}

      {/* Mid-Workout Pain Modal */}
      {showPainModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end" onClick={() => setShowPainModal(false)}>
          <div className="bg-neutral-900 rounded-t-3xl p-6 w-full max-w-md mx-auto border-t border-white/10 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-400" />
                Где болит?
              </h3>
              <button onClick={() => setShowPainModal(false)} className="text-gray-500 hover:text-white">
                <ChevronDown size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Опиши ощущения — мы адаптируем программу с учётом этого.
            </p>

            <textarea
              value={midWorkoutPain}
              onChange={e => setMidWorkoutPain(e.target.value)}
              placeholder="Например: Тянет в пояснице, дискомфорт в левом плече..."
              className="w-full bg-neutral-800 rounded-xl p-4 text-white mb-4 min-h-[100px] border border-white/5 focus:border-indigo-500 outline-none transition"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowPainModal(false)}
                className="flex-1 py-3 bg-neutral-800 text-gray-400 rounded-xl font-bold hover:bg-neutral-700 transition"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (midWorkoutPain.trim()) {
                    hapticFeedback.notificationOccurred('success');
                    setToastMessage('Запомнил! Учту это при завершении');
                    setTimeout(() => setToastMessage(null), 3000);
                  }
                  setShowPainModal(false);
                }}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-400 transition"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default WorkoutView;