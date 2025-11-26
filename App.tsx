
import React, { useState, useEffect, useCallback } from 'react';
import { OnboardingProfile, TrainingProgram, WorkoutLog, ChatMessage, TelegramUser } from './types';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import { generateInitialPlan, adaptPlan, getChatbotResponse, currentApiKey } from './services/geminiService';
import Chatbot from './components/Chatbot';
import { AlertTriangle, RefreshCw, Copy, Settings, Globe, Brain, Dumbbell, Activity, CalendarCheck } from 'lucide-react';

declare global {
  interface Window {
    Telegram?: any;
  }
}

const App: React.FC = () => {
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile | null>(null);
  const [trainingProgram, setTrainingProgram] = useState<TrainingProgram | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);

  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatbotLoading, setIsChatbotLoading] = useState(false);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Loading State Animation
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingMessages = [
      { text: "Анализируем биомеханику...", icon: <Activity size={32} className="text-indigo-400" /> },
      { text: "Подбираем оптимальный сплит...", icon: <CalendarCheck size={32} className="text-violet-400" /> },
      { text: "Рассчитываем рабочие веса...", icon: <Dumbbell size={32} className="text-emerald-400" /> },
      { text: "Проверяем на совместимость травм...", icon: <Activity size={32} className="text-red-400" /> },
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
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        // Ensure proper viewport height for Telegram
        document.documentElement.style.setProperty('--tg-viewport-height', window.Telegram.WebApp.viewportHeight + 'px');
        
        // Set header color
        window.Telegram.WebApp.setHeaderColor('#0a0a0a');
        window.Telegram.WebApp.setBackgroundColor('#0a0a0a');

        // Extract User Data
        if (window.Telegram.WebApp.initDataUnsafe?.user) {
            setTelegramUser(window.Telegram.WebApp.initDataUnsafe.user);
        }
    }

    try {
      const storedProfile = localStorage.getItem('onboardingProfile');
      const storedProgram = localStorage.getItem('trainingProgram');
      const storedLogs = localStorage.getItem('workoutLogs');
      
      if (storedProfile) setOnboardingProfile(JSON.parse(storedProfile));
      if (storedProgram) setTrainingProgram(JSON.parse(storedProgram));
      if (storedLogs) setWorkoutLogs(JSON.parse(storedLogs));
    } catch (e) {
      console.error("Failed to access or parse from localStorage", e);
      try {
        localStorage.clear();
      } catch (clearError) {
        console.error("Could not clear localStorage", clearError);
      }
    } finally {
        setIsLoading(false);
    }
  }, []);

  // Toast timer
  useEffect(() => {
      if (toastMessage) {
          const timer = setTimeout(() => setToastMessage(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [toastMessage]);

  const handleOnboardingComplete = useCallback(async (profile: OnboardingProfile) => {
    setIsLoading(true);
    setLoadingStep(0); // Reset animation to start
    setError(null);
    setErrorDetails(null);
    try {
      const program = await generateInitialPlan(profile);
      setOnboardingProfile(profile);
      setTrainingProgram(program);
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

  const handleWorkoutComplete = useCallback(async (log: WorkoutLog) => {
    const updatedLogs = [...workoutLogs, log];
    setWorkoutLogs(updatedLogs);
    try {
      localStorage.setItem('workoutLogs', JSON.stringify(updatedLogs));
    } catch (e) {
        console.warn("Could not save workout logs to localStorage", e);
    }

    if (updatedLogs.length > 0 && updatedLogs.length % 3 === 0 && trainingProgram) {
      setIsLoading(true); // Short loading for adaptation
      setError(null);
      try {
        const adaptedProgram = await adaptPlan(trainingProgram, updatedLogs);
        setTrainingProgram(adaptedProgram);
        try {
            localStorage.setItem('trainingProgram', JSON.stringify(adaptedProgram));
        } catch (e) {
            console.warn("Could not save adapted program to localStorage", e);
        }
        setToastMessage("Программа адаптирована под твой прогресс!");
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
  }, [workoutLogs, trainingProgram]);
  
  const handleChatbotSend = async (message: string) => {
    if (!trainingProgram) return;
    
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', text: message }];
    setChatMessages(newMessages);
    setIsChatbotLoading(true);
    try {
      const response = await getChatbotResponse(newMessages, trainingProgram);
      setChatMessages([...newMessages, { role: 'assistant', text: response.text }]);
      
      if (response.updatedProgram) {
          setTrainingProgram(response.updatedProgram);
          localStorage.setItem('trainingProgram', JSON.stringify(response.updatedProgram));
          setToastMessage("План обновлен тренером!");
      }

    } catch (e) {
      console.error(e);
      setChatMessages([...newMessages, { role: 'assistant', text: "Ошибка сети. Проверь VPN (если ты в РФ) или соединение." }]);
    } finally {
      setIsChatbotLoading(false);
    }
  };

  const handleUpdateProfile = (newProfile: OnboardingProfile) => {
      setOnboardingProfile(newProfile);
      localStorage.setItem('onboardingProfile', JSON.stringify(newProfile));
      setToastMessage("Профиль обновлен");
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
    setError(null);
  };

  if (error && !trainingProgram) {
      return (
        <div className="min-h-[100dvh] bg-neutral-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full bg-red-900/10 z-0 pointer-events-none"></div>
             
             <div className="relative z-10 bg-neutral-900 border border-red-500/30 rounded-3xl p-6 shadow-2xl max-w-md w-full animate-scale-in">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    {error.includes('регионом') || error.includes('VPN') ? (
                        <Globe className="text-red-500" size={32} />
                    ) : (
                        <AlertTriangle className="text-red-500" size={32} />
                    )}
                </div>
                
                <h2 className="text-2xl font-black text-white mb-2">{error}</h2>
                
                <div className="bg-black/40 rounded-xl p-4 mb-6 text-left overflow-hidden border border-white/5">
                    <p className="text-xs font-mono text-red-300 whitespace-pre-wrap break-words leading-relaxed">
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
                            className="flex-1 py-3 bg-neutral-800 text-red-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-neutral-700"
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
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-neutral-950 relative overflow-hidden px-6">
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
                    className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                        idx <= loadingStep ? 'bg-indigo-500' : 'bg-neutral-800'
                    }`}
                  ></div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-950 text-gray-100 font-sans relative selection:bg-indigo-500/30 overflow-x-hidden">
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

       <div className="relative z-10 h-full">
        {onboardingProfile && trainingProgram ? (
            <>
            <Dashboard 
                profile={onboardingProfile}
                program={trainingProgram} 
                logs={workoutLogs}
                telegramUser={telegramUser}
                onWorkoutComplete={handleWorkoutComplete}
                onUpdateProfile={handleUpdateProfile}
                onResetAccount={resetOnboarding}
                onOpenChat={() => setIsChatbotOpen(true)}
            />
            <Chatbot 
                isOpen={isChatbotOpen}
                onToggle={() => setIsChatbotOpen(!isChatbotOpen)}
                messages={chatMessages}
                onSendMessage={handleChatbotSend}
                isLoading={isChatbotLoading}
            />
            </>
        ) : (
            <Onboarding onComplete={handleOnboardingComplete} isLoading={isLoading} error={error} />
        )}
       </div>
    </div>
  );
};

export default App;
