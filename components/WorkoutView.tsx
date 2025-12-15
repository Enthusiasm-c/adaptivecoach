
import React, { useState, useEffect, useRef } from 'react';
import { WorkoutSession, CompletedExercise, WorkoutLog, OnboardingProfile, Exercise, ReadinessData } from '../types';
import FeedbackModal from './FeedbackModal';
import { ChevronLeft, ChevronRight, Timer, Replace, AlertTriangle, Info, Calculator, History, CheckCircle2, ExternalLink, Video, ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';
import CoachFeedbackModal from './CoachFeedbackModal';
import ExerciseSwapModal from './ExerciseSwapModal';
import PlateCalculatorModal from './PlateCalculatorModal';
import RestTimer from './RestTimer';
import Stopwatch from './Stopwatch';
import { hapticFeedback } from '../utils/hapticUtils';
import { getCoachFeedback } from '../services/geminiService';
import { generateWarmupSets, getLastPerformance, getExerciseHistory } from '../utils/progressUtils';
import { apiService } from '../services/apiService';

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
  const [midWorkoutPainLocation, setMidWorkoutPainLocation] = useState<string>('');

  // Pain location options (same as FeedbackModal)
  const PAIN_LOCATIONS = [
    'Поясница', 'Колени', 'Плечи', 'Шея',
    'Локти', 'Запястья', 'Спина (верх)', 'Другое'
  ];

  // GIF technique state
  const [exerciseGifUrl, setExerciseGifUrl] = useState<string | null>(null);
  const [showTechniqueGif, setShowTechniqueGif] = useState(false);
  const [isLoadingGif, setIsLoadingGif] = useState(false);

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

    // 2. Insert Warmups for first exercise
    if (adjustedExercises.length > 0 && adjustedExercises[0].weight && adjustedExercises[0].weight > 20) {
      const firstExercise = adjustedExercises[0];
      const warmups = generateWarmupSets(firstExercise.weight!, firstExercise.name);
      adjustedExercises = [...warmups, ...adjustedExercises];
    }

    setCurrentSession({ ...session, exercises: adjustedExercises });

    setCompletedExercises(
      adjustedExercises.map(ex => ({
        ...ex,
        completedSets: Array.from({ length: ex.sets }, () => ({ reps: 0, weight: 0, rir: undefined, isCompleted: false })),
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

  // Fetch GIF URL on exercise change
  useEffect(() => {
    const currentEx = completedExercises[currentExerciseIndex];
    if (!currentEx || currentEx.isWarmup) {
      setExerciseGifUrl(null);
      setShowTechniqueGif(false);
      return;
    }

    const fetchGif = async () => {
      setIsLoadingGif(true);
      try {
        const response = await apiService.exercises.getGif(currentEx.name);
        setExerciseGifUrl(response.found ? response.gifUrl : null);
      } catch (e) {
        console.error('Failed to fetch GIF:', e);
        setExerciseGifUrl(null);
      } finally {
        setIsLoadingGif(false);
      }
    };

    fetchGif();
    setShowTechniqueGif(false); // Reset on exercise change
  }, [currentExerciseIndex, completedExercises.length]);

  const handleValueChange = (exIndex: number, setIndex: number, field: 'reps' | 'weight' | 'rir', value: number) => {
    const newExercises = [...completedExercises];
    if (isNaN(value)) {
      (newExercises[exIndex].completedSets[setIndex] as any)[field] = undefined;
    } else {
      (newExercises[exIndex].completedSets[setIndex] as any)[field] = value;

      // Auto-fill logic: Copy weight from first set to ALL empty subsequent sets
      if (field === 'weight' && setIndex === 0) {
        // When changing weight in first set, copy to all empty subsequent sets
        for (let i = 1; i < newExercises[exIndex].completedSets.length; i++) {
          const set = newExercises[exIndex].completedSets[i];
          if (!set.weight || set.weight === 0) {
            (set as any).weight = value;
          }
        }
      } else if (field === 'weight' || field === 'reps') {
        // For other sets, copy to next empty set only
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
  const ISOMETRIC_KEYWORDS = ['удержан', 'статик', 'вис ', 'стойка', 'планка', 'планк', 'птица-собака', 'bird-dog'];

  // Patterns for SINGLE dumbbell exercises (show "кг", not "кг×2")
  const SINGLE_DUMBBELL_PATTERNS = [
    'с гантелью',      // instrumental singular: "присед с гантелью"
    'гантели ',        // genitive singular: "тяга гантели в наклоне"
    'гантель ',        // nominative singular
    'одной рукой',     // "подъём одной рукой"
    'single arm',
    'single-arm',
    'one-arm',
  ];

  // Patterns for PAIRED dumbbell exercises (show "кг×2")
  const PAIRED_DUMBBELL_PATTERNS = [
    'гантелей',        // genitive plural: "жим гантелей"
    'с гантелями',     // instrumental plural: "сгибание рук с гантелями"
    'гантелями',       // instrumental plural
    'dumbbells',       // English plural
  ];

  // Helper: check if exercise uses PAIRED dumbbells (need to show "× 2")
  const isPairedDumbbellExercise = (ex: typeof completedExercises[0]): boolean => {
    // Explicit equipment count overrides name detection
    if (ex.equipmentCount === 1) return false;
    if (ex.equipmentCount === 2) return true;

    const nameLower = ex.name.toLowerCase();

    // First check for single dumbbell patterns (higher priority)
    if (SINGLE_DUMBBELL_PATTERNS.some(p => nameLower.includes(p))) {
      return false;
    }

    // Then check for paired dumbbell patterns
    return PAIRED_DUMBBELL_PATTERNS.some(p => nameLower.includes(p));
  };

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

  // Helper: check if exercise is cardio (no technique needed, no weight history)
  const isCardioExercise = (ex: typeof completedExercises[0]): boolean => {
    if (ex.exerciseType === 'cardio') return true;
    const nameLower = ex.name.toLowerCase();
    return CARDIO_KEYWORDS.some(k => nameLower.includes(k));
  };

  // Helper: check if exercise is isometric (plank, hold, etc.)
  const isIsometricExercise = (ex: typeof completedExercises[0]): boolean => {
    if (ex.exerciseType === 'isometric') return true;
    const nameLower = ex.name.toLowerCase();
    return ISOMETRIC_KEYWORDS.some(k => nameLower.includes(k));
  };

  // Helper: get weight step for exercise (dumbbells = 2kg, barbell = 5kg)
  const getWeightStep = (ex: typeof completedExercises[0]): number => {
    const nameLower = ex.name.toLowerCase();
    // Dumbbells: 2kg step
    if (PAIRED_DUMBBELL_PATTERNS.some(p => nameLower.includes(p)) ||
        SINGLE_DUMBBELL_PATTERNS.some(p => nameLower.includes(p))) {
      return 2;
    }
    // Default (barbell, machines): 5kg step
    return 5;
  };

  // Helper: shorten long rep descriptions
  // "30 секунд на каждую сторону" → "30 сек × 2"
  // "по 15 повторений на каждую ногу" → "15 × 2"
  const formatReps = (reps: string): string => {
    if (reps.includes('на каждую сторону') || reps.includes('на каждую ногу') || reps.includes('на каждую руку')) {
      const match = reps.match(/(\d+)\s*(секунд|сек|повторений|раз)?/i);
      if (match) {
        const num = match[1];
        const hasSeconds = reps.toLowerCase().includes('секунд') || reps.toLowerCase().includes('сек');
        const unit = hasSeconds ? ' сек' : '';
        return `${num}${unit} × 2`;
      }
    }
    // Shorten "секунд" to "сек" for long strings
    if (reps.length > 15 && reps.includes('секунд')) {
      return reps.replace('секунд', 'сек');
    }
    return reps;
  };

  // Stepper handlers for weight and reps
  const adjustValue = (exIndex: number, setIndex: number, field: 'weight' | 'reps', delta: number) => {
    const newExercises = [...completedExercises];
    const currentValue = newExercises[exIndex].completedSets[setIndex][field] || 0;
    const step = field === 'weight' ? getWeightStep(newExercises[exIndex]) : 1;
    const newValue = Math.max(0, currentValue + delta * step);

    handleValueChange(exIndex, setIndex, field, newValue);
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
      // Loop forward: from last exercise to first
      setCurrentExerciseIndex(0);
    }
  };

  const goPrev = () => {
    hapticFeedback.impactOccurred('light');
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(i => i - 1);
    } else {
      // Loop back: from first exercise to last
      setCurrentExerciseIndex(completedExercises.length - 1);
    }
  };

  // Check if all exercises are complete (uses helper that respects exerciseType)
  // Also require at least one set to be filled (prevent finishing empty workout)
  const hasAtLeastOneFilledSet = completedExercises.some(ex =>
    ex.completedSets.some(s => s.reps > 0)
  );
  const canFinish = hasAtLeastOneFilledSet && completedExercises.every(isExerciseComplete);

  const finishWorkout = () => {
    if (!canFinish) {
      hapticFeedback.notificationOccurred('warning');
      setAttemptedFinish(true);

      // Find all incomplete exercises
      const incompleteExercises = completedExercises
        .map((ex, idx) => ({ ex, idx }))
        .filter(({ ex }) => !isExerciseComplete(ex));

      const incompleteCount = incompleteExercises.length;
      const firstIncomplete = incompleteExercises[0]?.idx ?? -1;

      // Navigate to first incomplete exercise
      if (firstIncomplete !== -1) {
        setCurrentExerciseIndex(firstIncomplete);
      }

      // Show informative toast with count
      if (incompleteCount === 1) {
        setToastMessage(`Заполни поля в упражнении #${firstIncomplete + 1}`);
      } else {
        setToastMessage(`Осталось заполнить ${incompleteCount} упражнений`);
      }
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    setIsFeedbackModalOpen(true);
  };

  const handleFeedbackSubmit = async (feedback: WorkoutLog['feedback']) => {
    setIsFeedbackModalOpen(false);
    setIsCoachModalOpen(true);
    setIsCoachFeedbackLoading(true);

    const mainExercises = completedExercises.filter(ex => !ex.isWarmup);

    // Merge mid-workout pain with feedback pain data
    const hasMidWorkoutPain = !!midWorkoutPainLocation || !!midWorkoutPain.trim();
    const mergedPain = {
      hasPain: feedback.pain.hasPain || hasMidWorkoutPain,
      location: feedback.pain.location || midWorkoutPainLocation || undefined,
      details: [
        feedback.pain.details,
        hasMidWorkoutPain && midWorkoutPain.trim() ? `[Во время тренировки: ${midWorkoutPain.trim()}]` : null
      ].filter(Boolean).join(' ') || undefined,
    };

    const log: WorkoutLog = {
      sessionId: session.name,
      date: new Date().toLocaleDateString('sv-SE'), // YYYY-MM-DD format in local timezone
      startTime: startTimeRef.current,
      duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
      feedback: { ...feedback, pain: mergedPain, readiness },
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
          completedSets: Array.from({ length: ex.sets }, () => ({ reps: 0, weight: 0, rir: undefined, isCompleted: false })),
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 hover:bg-red-500/20 transition"
            title="Сообщить о боли"
          >
            <AlertTriangle size={14} />
            <span className="text-xs font-medium">Болит?</span>
          </button>
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Упражнение {currentExerciseIndex + 1} из {completedExercises.length}</span>
            <div className="flex gap-1 mt-1">
              {completedExercises.map((ex, idx) => {
                const isIncomplete = attemptedFinish && !isExerciseComplete(ex);
                const isCurrent = idx === currentExerciseIndex;
                const isPast = idx < currentExerciseIndex;

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentExerciseIndex(idx)}
                    className={`h-1.5 w-4 rounded-full transition-all ${
                      isIncomplete
                        ? 'bg-red-500 animate-pulse'
                        : isCurrent
                          ? 'bg-indigo-500'
                          : isPast
                            ? 'bg-indigo-900'
                            : 'bg-neutral-800'
                    } ${isCurrent ? 'scale-110' : 'hover:scale-105'}`}
                  />
                );
              })}
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
                    <p className="text-xs text-gray-400 mt-0.5">{currentExercise.sets} подхода × {formatReps(currentExercise.reps)}</p>
                  </div>
                </div>
                <button
                  onClick={() => openSwapModal(currentExercise)}
                  className="p-2 rounded-lg bg-neutral-800 text-gray-400 hover:text-white transition"
                >
                  <Replace size={18} />
                </button>
              </div>

              {/* Technique GIF Section - hidden for cardio and isometric exercises */}
              {!currentExercise.isWarmup && !isCardioExercise(currentExercise) && !isIsometricExercise(currentExercise) && (
                <div className="mb-4">
                  {isLoadingGif ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      Загрузка техники...
                    </div>
                  ) : exerciseGifUrl ? (
                    <div>
                      <button
                        onClick={() => setShowTechniqueGif(!showTechniqueGif)}
                        className="flex items-center gap-2 text-xs font-bold text-indigo-400 bg-indigo-500/10 px-3 py-2 rounded-lg hover:bg-indigo-500/20 transition"
                      >
                        <Video size={14} />
                        {showTechniqueGif ? 'Скрыть технику' : 'Показать технику'}
                        {showTechniqueGif ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {showTechniqueGif && (
                        <div className="mt-3 rounded-xl overflow-hidden bg-black animate-slide-up">
                          <img
                            src={exerciseGifUrl}
                            alt={`Техника: ${currentExercise.name}`}
                            className="w-full h-auto"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => openYouTubeSearch()}
                      className="flex items-center gap-2 text-xs font-bold text-red-400 bg-red-500/10 px-3 py-2 rounded-lg hover:bg-red-500/20 transition"
                    >
                      <Video size={14} /> Смотреть технику (YouTube)
                    </button>
                  )}
                </div>
              )}

              {/* Description - moved below technique button */}
              {currentExercise.description && (
                <p className="text-sm text-gray-400 mt-2 leading-relaxed mb-4">
                  {currentExercise.description}
                </p>
              )}

              {/* Contextual History Section - hidden for cardio and isometric (bodyweight) exercises */}
              {showHistory && !currentExercise.isWarmup && !isCardioExercise(currentExercise) && !isIsometricExercise(currentExercise) && (
                <div className="mt-4 bg-neutral-900 rounded-xl border border-indigo-500/30 p-4 animate-slide-up mb-4">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase mb-3 flex items-center gap-2">
                    <History size={12} /> Прошлые тренировки
                  </h4>
                  <div className="space-y-3">
                    {exerciseHistory.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">
                        Нет данных. После выполнения появится прогресс.
                      </p>
                    ) : (
                      exerciseHistory.map((h, i) => (
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
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Sets */}
              <div className="space-y-3">
                {currentExercise.completedSets.map((set, setIndex) => (
                  <div key={setIndex} className={`flex items-center gap-2 p-3 rounded-xl transition-all ${set.isCompleted
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-neutral-900/50 border border-white/5'
                    }`}>
                    <div className="w-6 text-center font-mono text-gray-500 text-sm">#{setIndex + 1}</div>

                    {exerciseNeedsWeight(currentExercise) && (
                      <div className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1 px-1 ${
                        attemptedFinish && getSetErrors(currentExercise, set).weight
                          ? 'bg-red-500/10 border border-red-500/30'
                          : 'bg-neutral-800/50'
                      }`}>
                        <button
                          onClick={() => adjustValue(currentExerciseIndex, setIndex, 'weight', -1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white transition active:scale-95"
                        >
                          <Minus size={16} />
                        </button>
                        <div className="flex flex-col items-center min-w-[40px]">
                          <span className="font-mono font-bold text-white text-sm">
                            {set.weight || currentExercise.weight || '—'}
                          </span>
                          <span className="text-[9px] text-gray-500">
                            {isPairedDumbbellExercise(currentExercise) ? 'кг×2' : 'кг'}
                          </span>
                        </div>
                        <button
                          onClick={() => adjustValue(currentExerciseIndex, setIndex, 'weight', 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white transition active:scale-95"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}

                    <div className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1 px-1 ${
                        attemptedFinish && getSetErrors(currentExercise, set).reps
                          ? 'bg-red-500/10 border border-red-500/30'
                          : 'bg-neutral-800/50'
                      }`}>
                        <button
                          onClick={() => adjustValue(currentExerciseIndex, setIndex, 'reps', -1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white transition active:scale-95"
                        >
                          <Minus size={16} />
                        </button>
                        <div className="flex flex-col items-center min-w-[32px]">
                          <span className="font-mono font-bold text-white text-sm">
                            {set.reps || currentExercise.reps.split('-')[0] || '—'}
                          </span>
                          <span className="text-[9px] text-gray-500">повт</span>
                        </div>
                        <button
                          onClick={() => adjustValue(currentExerciseIndex, setIndex, 'reps', 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white transition active:scale-95"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                    {/* RIR - Hidden for now to fix layout */}
                    {/* TODO: Re-enable RIR when we have better mobile layout */}

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
            className="px-6 py-4 bg-neutral-900 rounded-2xl font-bold text-gray-400 hover:text-white border border-white/10 transition"
          >
            <ChevronLeft size={24} />
          </button>

          {canFinish ? (
            <button onClick={finishWorkout} className="flex-grow py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-400 transition shadow-[0_0_20px_rgba(16,185,129,0.4)] text-lg">
              Закончить
            </button>
          ) : (
            <button
              onClick={() => {
                // On last exercise - go to first incomplete, otherwise just next
                if (currentExerciseIndex >= completedExercises.length - 1) {
                  const firstIncomplete = completedExercises.findIndex(ex => !isExerciseComplete(ex));
                  if (firstIncomplete !== -1) {
                    setAttemptedFinish(true);
                    setCurrentExerciseIndex(firstIncomplete);
                    hapticFeedback.impactOccurred('medium');
                  } else {
                    goNext();
                  }
                } else {
                  goNext();
                }
              }}
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
          initialPain={midWorkoutPainLocation ? {
            hasPain: true,
            location: midWorkoutPainLocation,
            details: midWorkoutPain
          } : undefined}
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
              Отметь место и опиши ощущения — мы адаптируем программу с учётом этого.
            </p>

            {/* Pain location chips */}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Где именно?</label>
              <div className="flex flex-wrap gap-2">
                {PAIN_LOCATIONS.map(loc => (
                  <button
                    key={loc}
                    onClick={() => setMidWorkoutPainLocation(loc)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      midWorkoutPainLocation === loc
                        ? 'bg-red-500 text-white'
                        : 'bg-neutral-700 text-gray-300 hover:bg-neutral-600'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={midWorkoutPain}
              onChange={e => setMidWorkoutPain(e.target.value)}
              placeholder="Опиши подробнее (необязательно)..."
              className="w-full bg-neutral-800 rounded-xl p-4 text-white mb-4 min-h-[80px] border border-white/5 focus:border-indigo-500 outline-none transition"
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
                  if (midWorkoutPainLocation) {
                    hapticFeedback.notificationOccurred('success');
                    setToastMessage('Запомнил! Учту это при завершении');
                    setTimeout(() => setToastMessage(null), 3000);
                    setShowPainModal(false);
                  }
                }}
                disabled={!midWorkoutPainLocation}
                className={`flex-1 py-3 rounded-xl font-bold transition ${
                  midWorkoutPainLocation
                    ? 'bg-red-500 text-white hover:bg-red-400'
                    : 'bg-neutral-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {midWorkoutPainLocation ? 'Сохранить' : 'Выбери зону'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default WorkoutView;