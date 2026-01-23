
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { OnboardingProfile, TrainingProgram, WorkoutLog, ChatMessage, TelegramUser, ChatAction } from './types';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import FitCubeWelcome from './components/FitCubeWelcome';
import ExerciseCardTest from './components/ExerciseCardTest';
import { generateInitialPlan, adaptPlan, getChatbotResponse, currentApiKey, adjustProgramForPain, adaptProgramForLocation, modifyPlanWithInstructions } from './services/geminiService';
import { apiService } from './services/apiService';
import { AlertTriangle, RefreshCw, Copy, Settings, Globe, Brain, Dumbbell, Activity, CalendarCheck } from 'lucide-react';
import { useSessionTracking } from './utils/useSessionTracking';
import {
  MesocycleState,
  MesocycleCompletionData,
  createInitialMesocycleState,
  loadMesocycleState,
  saveMesocycleState,
  clearMesocycleState,
  checkWeekProgression,
  advanceMesocycleWeek,
  createNewMesocycle,
  recordWorkoutInMesocycle,
  getProgramForCurrentPhase,
  checkMesocycleEvents,
  getEventNotificationMessage,
  getMesocycleSummary,
  syncMesocycleWithLogs,
  calculateMesocycleCompletionData,
} from './services/mesocycleService';
import MesocycleCompletionScreen from './components/MesocycleCompletionScreen';
import { runAutoMigration } from './services/migrationService';
import { applyAutoregulationToProgram, AutoregulationRecommendation } from './services/autoregulation';
import { syncWeightsFromLogs } from './utils/weightSync';
import { getOrchestrator, AIPriority } from './services/aiOrchestrator';
import { createReactTransaction } from './services/stateTransaction';

declare global {
  interface Window {
    Telegram?: any;
  }
}

const App: React.FC = () => {
  // Check for test mode in URL
  const isTestMode = new URLSearchParams(window.location.search).get('test') === 'ui';

  // Initialize state synchronously from localStorage to avoid flash
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile | null>(() => {
    try {
      const stored = localStorage.getItem('onboardingProfile');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [trainingProgram, setTrainingProgram] = useState<TrainingProgram | null>(() => {
    try {
      const stored = localStorage.getItem('trainingProgram');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>(() => {
    try {
      const stored = localStorage.getItem('workoutLogs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  // isLoading is now only for async operations (program generation), not initial load
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);

  // Mesocycle state (Phase 3)
  const [mesocycleState, setMesocycleState] = useState<MesocycleState | null>(() => {
    const savedState = loadMesocycleState();
    if (savedState) {
      // Try to sync with logs on init
      try {
        const savedLogs = localStorage.getItem('workoutLogs');
        const logs = savedLogs ? JSON.parse(savedLogs) : [];
        if (logs.length > 0) {
          const synced = syncMesocycleWithLogs(savedState, logs);
          if (synced !== savedState) {
            saveMesocycleState(synced);
          }
          return synced;
        }
      } catch {
        // Ignore errors, use saved state
      }
    }
    return savedState;
  });

  // Mesocycle completion screen data
  const [mesocycleCompletionData, setMesocycleCompletionData] = useState<MesocycleCompletionData | null>(null);

  // Partner/Collaboration tracking (e.g., FitCube)
  const [partnerSource, setPartnerSource] = useState<'fitcube' | null>(() => {
    try {
      const saved = localStorage.getItem('partnerSource');
      return saved === 'fitcube' ? 'fitcube' : null;
    } catch {
      return null;
    }
  });
  // Инициализируем синхронно из localStorage чтобы избежать мелькания
  const [showFitCubeWelcome, setShowFitCubeWelcome] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('partnerSource');
      const hasProfile = localStorage.getItem('onboardingProfile');
      // Показываем FitCube welcome если партнер = fitcube И нет профиля
      return saved === 'fitcube' && !hasProfile;
    } catch {
      return false;
    }
  });

  // Session tracking for analytics
  const { trackPageView, trackFeature } = useSessionTracking();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    // Load chat history from localStorage
    try {
      const saved = localStorage.getItem('chatMessages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isChatbotLoading, setIsChatbotLoading] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | undefined>(undefined);

  // Persist chat messages to localStorage
  useEffect(() => {
    if (chatMessages.length > 0) {
      localStorage.setItem('chatMessages', JSON.stringify(chatMessages));
    }
  }, [chatMessages]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Loading State Animation
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingMessages = [
    { text: "Анализируем биомеханику...", icon: <Activity size={32} className="text-indigo-400" /> },
    { text: "Подбираем оптимальный сплит...", icon: <CalendarCheck size={32} className="text-violet-400" /> },
    { text: "Рассчитываем рабочие веса...", icon: <Dumbbell size={32} className="text-emerald-400" /> },
    { text: "Проверяем на совместимость травм...", icon: <Activity size={32} className="text-amber-400" /> },
    { text: "Финальная сборка программы...", icon: <Brain size={32} className="text-blue-400" /> }
  ];

  useEffect(() => {
    // Fix: Only run interval if loading. Removed the check that prevented it from running during onboarding.
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % loadingMessages.length);
    }, 3000); // Speed up slightly to 3s to ensure user sees progress

    return () => clearInterval(interval);
  }, [isLoading]);


  useEffect(() => {
    // Initialize Telegram Web App if available
    if (window.Telegram?.WebApp) {
      const webapp = window.Telegram.WebApp;
      webapp.ready();
      webapp.expand();

      // Функция обновления viewport и детекции клавиатуры
      const updateViewport = () => {
        const vh = webapp.viewportHeight;
        document.documentElement.style.setProperty('--tg-viewport-height', `${vh}px`);
        // Детектим клавиатуру: если viewport значительно уменьшился
        const keyboardVisible = webapp.isExpanded && vh < window.innerHeight * 0.7;
        document.documentElement.style.setProperty('--keyboard-visible', keyboardVisible ? '1' : '0');
      };

      // Начальная установка viewport
      updateViewport();

      // Слушаем изменения viewport (появление/скрытие клавиатуры)
      webapp.onEvent('viewportChanged', updateViewport);

      // Set header color (pure black for WHOOP-style contrast)
      webapp.setHeaderColor('#000000');
      webapp.setBackgroundColor('#000000');

      // Extract User Data
      if (window.Telegram.WebApp.initDataUnsafe?.user) {
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        setTelegramUser(user);

        // VIP users with free yearly subscription
        const VIP_USERNAMES = ['domashenkod', 'starsio'];
        if (user.username && VIP_USERNAMES.includes(user.username.toLowerCase())) {
          // Set Pro status for VIP users (1 year from now)
          const oneYearFromNow = new Date();
          oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

          const storedProfile = localStorage.getItem('onboardingProfile');
          if (storedProfile) {
            const profile = JSON.parse(storedProfile);
            if (!profile.isPro) {
              profile.isPro = true;
              profile.trialEndsAt = oneYearFromNow.toISOString();
              localStorage.setItem('onboardingProfile', JSON.stringify(profile));
              setOnboardingProfile(profile);
              console.log(`[VIP] ${user.username} granted Pro until ${oneYearFromNow.toISOString()}`);
            }
          }
        }
      }

      // Register user in backend database and check for partner source
      if (window.Telegram.WebApp.initData) {
        apiService.auth.validate().then(response => {
          if (response?.success && response?.user) {
            console.log('[FitCube] API returned partnerSource:', response.user.partnerSource);
            // If user came from FitCube partner (via /start fitcube command)
            if (response.user.partnerSource === 'fitcube') {
              setPartnerSource('fitcube');
              localStorage.setItem('partnerSource', 'fitcube');
              // Show FitCube welcome only if no profile exists yet
              if (!localStorage.getItem('onboardingProfile')) {
                setShowFitCubeWelcome(true);
              }
            }
          }
        }).catch(err => {
          console.warn('Auth validation failed:', err);
        });
      }
    }

    // Run migrations if we have existing data (state was loaded synchronously above)
    // Note: We access localStorage here to get raw data for migration checks
    const storedProgram = localStorage.getItem('trainingProgram');
    const storedProfile = localStorage.getItem('onboardingProfile');

    // Migrate exercise names and descriptions if needed
    if (storedProgram) {
      const parsedProgram = JSON.parse(storedProgram);
      import('./utils/exerciseMigration').then(({ migrateExerciseNamesAndDescriptions, needsMigration }) => {
        if (needsMigration(parsedProgram)) {
          console.log('[App] Running exercise migration...');
          const migratedProgram = migrateExerciseNamesAndDescriptions(parsedProgram);
          setTrainingProgram(migratedProgram);
          localStorage.setItem('trainingProgram', JSON.stringify(migratedProgram));
        }
      }).catch(console.error);
    }

    // Run automatic migration for existing users (silent, no UI)
    if (storedProfile && storedProgram) {
      runAutoMigration().then(result => {
        if (result.migrated && result.program && result.mesocycleState) {
          console.log('[App] Migration completed successfully');
          setTrainingProgram(result.program);
          setMesocycleState(result.mesocycleState);
        } else if (result.error) {
          console.warn('[App] Migration failed:', result.error);
        }
      }).catch(console.error);
    }
  }, []);

  // Toast timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Mesocycle phase progression check (runs on app load and periodically)
  useEffect(() => {
    if (!mesocycleState || !onboardingProfile) return;
    if (mesocycleCompletionData) return; // Don't re-trigger while summary is shown

    const checkProgression = () => {
      const oldState = mesocycleState;
      const progression = checkWeekProgression(oldState);

      if (progression.isMesocycleComplete) {
        // Calculate summary data and show completion screen
        const completionData = calculateMesocycleCompletionData(
          oldState,
          workoutLogs,
          workoutLogs
        );
        setMesocycleCompletionData(completionData);
      } else if (progression.shouldAdvance) {
        // Advance to next week/phase
        const newState = advanceMesocycleWeek(oldState);
        setMesocycleState(newState);
        saveMesocycleState(newState);

        // Check for events and show notifications
        const events = checkMesocycleEvents(oldState, newState);
        events.forEach(event => {
          const message = getEventNotificationMessage(event);
          if (message) setToastMessage(message);
        });
      }
    };

    // Check on mount
    checkProgression();

    // Check periodically (every hour)
    const interval = setInterval(checkProgression, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mesocycleState, onboardingProfile, mesocycleCompletionData, workoutLogs]);

  // Track notification opens
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');

    if (ref && ref.startsWith('notif_')) {
      // Track this open in the backend
      apiService.notifications.trackOpen(ref).catch(err => {
        console.warn('Failed to track notification open:', err);
      });

      // Handle specific notification types
      if (ref.includes('_summary')) {
        // User clicked from weekly summary - could navigate to progress tab
        const tab = urlParams.get('tab');
        if (tab === 'progress') {
          // Progress tab will be shown via Dashboard's default behavior
          console.log('[Notif] User opened from weekly summary');
        }
      }

      // Clean up URL without reloading
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // Check for partner parameter from multiple sources:
    // 1. URL params: ?startapp=fitcube or tgWebAppStartParam=fitcube
    // 2. Telegram WebApp: window.Telegram.WebApp.initDataUnsafe.start_param
    const urlStartapp = urlParams.get('startapp') || urlParams.get('tgWebAppStartParam');
    const tgStartapp = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    const startapp = urlStartapp || tgStartapp;

    console.log('[FitCube] Checking startapp:', { urlStartapp, tgStartapp, startapp });

    if (startapp === 'fitcube') {
      setPartnerSource('fitcube');
      localStorage.setItem('partnerSource', 'fitcube');
      // Show FitCube welcome only if no profile exists yet
      if (!localStorage.getItem('onboardingProfile')) {
        setShowFitCubeWelcome(true);
      }
      // Track partner entry event
      apiService.analytics.track('partner_entry', {
        partner: 'fitcube',
        source: 'qr_code',
        timestamp: new Date().toISOString()
      }).catch(console.warn);
    }
  }, []);

  const handleOnboardingComplete = useCallback(async (profile: OnboardingProfile) => {
    setIsLoading(true);
    setLoadingStep(0); // Reset animation to start
    setError(null);
    setErrorDetails(null);
    try {
      const program = await generateInitialPlan(profile);
      setOnboardingProfile(profile);
      setTrainingProgram(program);

      // Create initial mesocycle state
      const initialMesocycle = createInitialMesocycleState(profile);
      setMesocycleState(initialMesocycle);
      saveMesocycleState(initialMesocycle);

      try {
        localStorage.setItem('onboardingProfile', JSON.stringify(profile));
        localStorage.setItem('trainingProgram', JSON.stringify(program));
        localStorage.setItem('workoutLogs', JSON.stringify([]));
        // Mark first login to show tutorial later
        localStorage.setItem('isFirstLogin', 'true');
      } catch (storageError) {
        console.warn("Could not save to localStorage", storageError);
      }
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.toString().toLowerCase();

      // Check specifically for location/region errors common with Google AI
      const isLocationError = errorMsg.includes('location') || errorMsg.includes('region') || errorMsg.includes('supported');

      if (isLocationError) {
        setError('Доступ ограничен регионом');
        setErrorDetails('Google Gemini не работает в вашей стране (РФ). Пожалуйста, включите VPN (США/Европа) и попробуйте снова.');
      } else if (errorMsg.includes('400') || errorMsg.includes('api key') || e.message?.includes('API key')) {
        const key = currentApiKey;
        const isKeyMissing = !key || key.includes('UNUSED');

        if (isKeyMissing) {
          setError('API Ключ не найден');
          setErrorDetails(`Платформа не видит ключ (VITE_API_KEY).`);
        } else {
          // General API error, likely VPN or Key restriction
          setError('Ошибка соединения с AI');
          setErrorDetails(`Не удается связаться с Google. Если вы в РФ - включите VPN.`);
        }
      } else {
        setError('Ошибка генерации');
        setErrorDetails('Проверьте интернет или повторите позже.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Helper to format autoregulation message for user understanding
  const formatAutoregulationMessage = (rec: AutoregulationRecommendation): string | null => {
    if (rec.volumeAdjustment.type === 'maintain') return null;

    const direction = rec.volumeAdjustment.type === 'increase' ? 'Увеличил' : 'Снизил';
    const weightPercent = Math.abs(rec.volumeAdjustment.weightChange);
    const setsChange = Math.abs(rec.volumeAdjustment.setsChange);

    let adjustmentText = '';
    if (weightPercent > 0 && setsChange > 0) {
      adjustmentText = `вес на ${weightPercent}% и ${setsChange > 0 ? '+' : '-'}${setsChange} подход${setsChange === 1 ? '' : 'а'}`;
    } else if (weightPercent > 0) {
      adjustmentText = `вес на ${weightPercent}%`;
    } else if (setsChange > 0) {
      adjustmentText = `${setsChange} подход${setsChange === 1 ? '' : 'а'}`;
    } else {
      adjustmentText = 'нагрузку';
    }

    // Use the reason from volumeAdjustment or fallback
    let reason = rec.volumeAdjustment.reason;
    if (!reason && rec.warnings.length > 0) {
      reason = rec.warnings[0];
    } else if (!reason && rec.volumeAdjustment.type === 'decrease') {
      reason = 'Обнаружены признаки накопленной усталости';
    } else if (!reason) {
      reason = 'Ты готов к большей нагрузке!';
    }

    return `${direction} ${adjustmentText}. ${reason}`;
  };

  const handleWorkoutComplete = useCallback(async (log: WorkoutLog) => {
    // Create transaction for atomic state updates
    const tx = createReactTransaction('workout_complete', {
      setTrainingProgram,
      setWorkoutLogs,
      setMesocycleState,
    });

    const updatedLogs = [...workoutLogs, log];

    // Stage all changes to transaction first
    tx.set('workoutLogs', updatedLogs, workoutLogs);

    // Update mesocycle state with workout
    if (mesocycleState) {
      const newMesoState = recordWorkoutInMesocycle(mesocycleState, log);
      tx.set('mesocycleState', newMesoState, mesocycleState);
    }

    // Step 1: Sync weights from logs to program (ensures program reflects actual weights used)
    let currentProgram = trainingProgram;
    if (currentProgram) {
      const syncedProgram = syncWeightsFromLogs(currentProgram, updatedLogs);
      if (JSON.stringify(syncedProgram) !== JSON.stringify(currentProgram)) {
        currentProgram = syncedProgram;
        tx.set('trainingProgram', syncedProgram, trainingProgram);
      }
    }

    // Commit base changes atomically before AI operations
    const baseCommit = await tx.commit();
    if (!baseCommit.success) {
      console.error('[handleWorkoutComplete] Base commit failed:', baseCommit.error);
      setError('Не удалось сохранить тренировку');
      return;
    }

    // Sync workout to server (for social features) - non-critical, don't block
    apiService.workouts.sync({
      sessionId: log.sessionId,
      date: log.date,
      startTime: log.startTime ? new Date(log.startTime).toISOString() : undefined,
      duration: log.duration,
      completedExercises: log.completedExercises,
      feedback: log.feedback,
    }).then(syncResult => {
      if (syncResult.newBadges && syncResult.newBadges.length > 0) {
        const badgeNames = syncResult.newBadges.map(b => `${b.icon} ${b.name_ru}`).join(', ');
        setToastMessage(`Новые достижения: ${badgeNames}`);
      }
    }).catch(e => console.warn("Could not sync workout to server", e));

    // Get orchestrator for AI operations
    const orchestrator = getOrchestrator();

    // Store current valid program as fallback
    if (currentProgram) {
      orchestrator.setLastValidProgram(currentProgram);
    }

    // Step 2: Immediate pain-based program adjustment (CRITICAL priority)
    if (log.feedback.pain.hasPain && currentProgram) {
      const painDetails = log.feedback.pain.details || log.feedback.pain.location || 'не указано';

      const painResult = await orchestrator.execute(
        'adjustForPain',
        AIPriority.CRITICAL,
        { program: currentProgram, painDetails, exercises: log.completedExercises },
        async (data) => {
          const adjusted = await adjustProgramForPain(
            data.program,
            data.painDetails,
            data.exercises
          );
          return adjusted;
        }
      );

      if (painResult.success && painResult.data) {
        const adjustedProgram = painResult.data as TrainingProgram;
        setTrainingProgram(adjustedProgram);
        try {
          localStorage.setItem('trainingProgram', JSON.stringify(adjustedProgram));
        } catch (e) {
          console.warn("Could not save adjusted program to localStorage", e);
        }
        const painLocation = painDetails !== 'не указано' ? ` (${painDetails})` : '';
        setToastMessage(`Понял тебя${painLocation}! Снизил веса и адаптировал упражнения 💪`);
        return; // Skip regular adaptation since we just adjusted
      } else if (!painResult.success) {
        console.warn('[handleWorkoutComplete] Pain adjustment failed:', painResult.error);
      }
    }

    // Step 3: Autoregulation - analyze recovery signals and adjust volume/weights
    // Uses readiness data (sleep, stress, soreness) for smarter adjustments
    if (currentProgram && updatedLogs.length >= 2) {
      const { program: autoregulatedProgram, recommendation } =
        applyAutoregulationToProgram(currentProgram, updatedLogs);

      if (recommendation.volumeAdjustment.type !== 'maintain') {
        currentProgram = autoregulatedProgram;
        setTrainingProgram(autoregulatedProgram);
        try {
          localStorage.setItem('trainingProgram', JSON.stringify(autoregulatedProgram));
        } catch (e) {
          console.warn("Could not save autoregulated program to localStorage", e);
        }

        const adjustmentMessage = formatAutoregulationMessage(recommendation);
        if (adjustmentMessage) {
          setToastMessage(adjustmentMessage);
        }
      }

      // Show warnings even if no volume adjustment (e.g. low readiness suggestions)
      if (recommendation.warnings.length > 0 || recommendation.suggestions.length > 0) {
        const message = recommendation.warnings[0] || recommendation.suggestions[0];
        if (message && !toastMessage) {
          setToastMessage(message);
        }
      }
    }

    // Step 4: AI adaptation every 3 workouts (HIGH priority, uses orchestrator)
    if (updatedLogs.length > 0 && updatedLogs.length % 3 === 0 && currentProgram) {
      setIsLoading(true);
      setError(null);

      const adaptResult = await orchestrator.execute(
        'adaptPlan',
        AIPriority.HIGH,
        { program: currentProgram, logs: updatedLogs, profile: onboardingProfile },
        async (data) => {
          const syncedProgram = syncWeightsFromLogs(data.program, data.logs);
          const adapted = await adaptPlan(syncedProgram, data.logs, data.profile || undefined);
          return adapted;
        }
      );

      setIsLoading(false);

      if (adaptResult.success && adaptResult.data) {
        const adaptedProgram = adaptResult.data as TrainingProgram;
        setTrainingProgram(adaptedProgram);
        try {
          localStorage.setItem('trainingProgram', JSON.stringify(adaptedProgram));
        } catch (e) {
          console.warn("Could not save adapted program to localStorage", e);
        }
        setToastMessage("Программа адаптирована под твой прогресс!");
      } else if (!adaptResult.success) {
        console.warn('[handleWorkoutComplete] AI adaptation failed:', adaptResult.error);
        // Don't show error to user - program remains unchanged (fallback worked)
      }
    }
  }, [workoutLogs, trainingProgram, mesocycleState, onboardingProfile]);

  const handleChatbotSend = async (message: string) => {
    if (!trainingProgram) return;

    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', text: message }];
    setChatMessages(newMessages);
    setIsChatbotLoading(true);
    try {
      const response = await getChatbotResponse(newMessages, trainingProgram);

      if (response.proposedAction) {
        // Add message with action button - user must click to apply
        setChatMessages([...newMessages, {
          role: 'assistant',
          text: response.text,
          action: response.proposedAction
        }]);
      } else if (response.updatedProgram) {
        // Legacy: auto-update (for backward compatibility)
        setChatMessages([...newMessages, { role: 'assistant', text: response.text }]);
        setTrainingProgram(response.updatedProgram);
        localStorage.setItem('trainingProgram', JSON.stringify(response.updatedProgram));
        setToastMessage("План обновлен тренером!");
      } else {
        // Regular text response
        setChatMessages([...newMessages, { role: 'assistant', text: response.text }]);
      }

    } catch (e) {
      console.error(e);
      setChatMessages([...newMessages, { role: 'assistant', text: "Ошибка сети. Проверь VPN (если ты в РФ) или соединение." }]);
    } finally {
      setIsChatbotLoading(false);
    }
  };

  // Execute action from chat when user clicks the button
  const executeAction = async (action: ChatAction) => {
    if (!trainingProgram) return;

    console.log('[ExecuteAction] Starting:', action);
    setExecutingActionId(action.id);

    try {
      // Apply the changes to the program
      console.log('[ExecuteAction] Calling modifyPlanWithInstructions...');
      const updatedProgram = await modifyPlanWithInstructions(
        trainingProgram,
        action.reason,
        action.instructions
      );
      console.log('[ExecuteAction] Got updated program, sessions:', updatedProgram?.sessions?.length);

      // Update program state
      setTrainingProgram(updatedProgram);
      localStorage.setItem('trainingProgram', JSON.stringify(updatedProgram));

      // Update action status in chat history
      setChatMessages(prev => prev.map(msg =>
        msg.action?.id === action.id
          ? { ...msg, action: { ...msg.action, status: 'completed' as const } }
          : msg
      ));

      setToastMessage("Программа обновлена!");

    } catch (error) {
      console.error('Failed to execute action:', error);

      // Update action status to failed
      setChatMessages(prev => prev.map(msg =>
        msg.action?.id === action.id
          ? { ...msg, action: { ...msg.action, status: 'failed' as const } }
          : msg
      ));

      setToastMessage("Ошибка при обновлении программы");
    } finally {
      setExecutingActionId(undefined);
    }
  };

  const handleUpdateProfile = async (newProfile: OnboardingProfile) => {
    const locationChanged = onboardingProfile && newProfile.location !== onboardingProfile.location;

    setOnboardingProfile(newProfile);
    localStorage.setItem('onboardingProfile', JSON.stringify(newProfile));

    // If location changed, adapt the program
    if (locationChanged && trainingProgram) {
      setToastMessage("Адаптируем программу...");
      try {
        const adaptedProgram = await adaptProgramForLocation(
          trainingProgram,
          newProfile.location,
          newProfile
        );
        setTrainingProgram(adaptedProgram);
        localStorage.setItem('trainingProgram', JSON.stringify(adaptedProgram));
        setToastMessage("Программа адаптирована под новое место!");
      } catch (error) {
        console.error('Failed to adapt program for new location:', error);
        setToastMessage("Профиль обновлен (адаптация программы не удалась)");
      }
    } else {
      setToastMessage("Профиль обновлен");
    }
  };

  const resetOnboarding = () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn("Could not clear localStorage", e);
    }
    setOnboardingProfile(null);
    setTrainingProgram(null);
    setWorkoutLogs([]);
    setChatMessages([]);
    setMesocycleState(null);
    setError(null);
    // Clear chat messages and mesocycle from localStorage explicitly
    localStorage.removeItem('chatMessages');
    clearMesocycleState();
  };

  const handleStartNewMesocycle = useCallback(() => {
    if (!mesocycleState || !onboardingProfile) return;
    const newState = createNewMesocycle(mesocycleState.mesocycle, onboardingProfile);
    setMesocycleState(newState);
    saveMesocycleState(newState);
    setMesocycleCompletionData(null);
    setToastMessage('Новый мезоцикл начался!');
  }, [mesocycleState, onboardingProfile]);

  // Apply mesocycle volume multiplier to program for display
  // This ensures UI shows adjusted sets based on current mesocycle phase
  const displayProgram = useMemo(() => {
    if (!trainingProgram || !mesocycleState) return trainingProgram;
    return getProgramForCurrentPhase(trainingProgram, mesocycleState);
  }, [trainingProgram, mesocycleState]);

  if (error && !trainingProgram) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-amber-900/10 z-0 pointer-events-none"></div>

        <div className="relative z-10 bg-neutral-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl max-w-md w-full animate-scale-in">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            {error.includes('регионом') || error.includes('VPN') ? (
              <Globe className="text-amber-500" size={32} />
            ) : (
              <AlertTriangle className="text-amber-500" size={32} />
            )}
          </div>

          <h2 className="text-2xl font-black text-white mb-2">{error}</h2>

          <div className="bg-black/40 rounded-xl p-4 mb-6 text-left overflow-hidden border border-white/5">
            <p className="text-xs font-mono text-amber-300 whitespace-pre-wrap break-words leading-relaxed">
              {errorDetails}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition active:scale-95"
            >
              <RefreshCw size={18} /> Попробовать снова
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(errorDetails || "");
                  alert("Текст ошибки скопирован");
                }}
                className="flex-1 py-3 bg-neutral-800 text-gray-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-neutral-700"
              >
                <Copy size={14} /> Копия
              </button>
              <button
                onClick={resetOnboarding}
                className="flex-1 py-3 bg-neutral-800 text-amber-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-neutral-700"
              >
                <Settings size={14} /> Сброс
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced Loading Screen
  if (isLoading && !onboardingProfile) {
    const currentMsg = loadingMessages[loadingStep % loadingMessages.length];

    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-background relative overflow-hidden px-6">
        <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px]"></div>

        <div className="text-center relative z-10 w-full max-w-sm">
          {/* Main Spinner */}
          <div className="relative w-24 h-24 mx-auto mb-10">
            <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-indigo-500 border-r-indigo-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center animate-pulse">
              {currentMsg.icon}
            </div>
          </div>

          <h3 className="text-2xl font-bold text-white mb-2 animate-fade-in" key={currentMsg.text}>
            {currentMsg.text}
          </h3>
          <p className="text-gray-500 text-sm mb-8 animate-pulse">
            Это может занять до 30 секунд...
          </p>

          {/* Progress Steps Visualizer */}
          <div className="flex justify-between items-center gap-2 px-4">
            {loadingMessages.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${idx <= loadingStep ? 'bg-indigo-500' : 'bg-neutral-800'
                  }`}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Test mode - show ExerciseCardTest component
  if (isTestMode) {
    return <ExerciseCardTest />;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-gray-100 font-sans relative selection:bg-indigo-500/30 overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-900/10 rounded-full blur-[100px]"></div>
      </div>

      {toastMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-neutral-800/90 backdrop-blur border border-green-500/30 text-green-400 px-6 py-3 rounded-full shadow-2xl font-bold text-sm animate-slide-up flex items-center gap-3">
          <div className="bg-green-500/20 p-1 rounded-full"><RefreshCw size={14} className="animate-spin-slow" /></div>
          {toastMessage}
        </div>
      )}

      {mesocycleCompletionData && (
        <MesocycleCompletionScreen
          data={mesocycleCompletionData}
          onStartNewMesocycle={handleStartNewMesocycle}
        />
      )}

      <div className="relative z-10 h-full">
        {onboardingProfile && trainingProgram ? (
          <Dashboard
            profile={onboardingProfile}
            program={displayProgram}
            logs={workoutLogs}
            telegramUser={telegramUser}
            mesocycleState={mesocycleState}
            onWorkoutComplete={handleWorkoutComplete}
            onUpdateProfile={handleUpdateProfile}
            onResetAccount={resetOnboarding}
            chatMessages={chatMessages}
            onSendMessage={handleChatbotSend}
            onActionClick={executeAction}
            isChatLoading={isChatbotLoading}
            executingActionId={executingActionId}
          />
        ) : showFitCubeWelcome ? (
          <FitCubeWelcome onComplete={() => setShowFitCubeWelcome(false)} />
        ) : (
          <Onboarding
            onComplete={handleOnboardingComplete}
            isLoading={isLoading}
            error={error}
            partnerSource={partnerSource}
          />
        )}
      </div>
    </div>
  );
};

export default App;
