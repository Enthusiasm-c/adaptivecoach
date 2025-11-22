
import React, { useState, useEffect, useCallback } from 'react';
import { OnboardingProfile, TrainingProgram, WorkoutLog, ChatMessage, TelegramUser } from './types';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import { generateInitialPlan, adaptPlan, getChatbotResponse, currentApiKey } from './services/geminiService';
import Chatbot from './components/Chatbot';
import { AlertTriangle, RefreshCw, Copy, Settings } from 'lucide-react';

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
      } catch (storageError) {
        console.warn("Could not save to localStorage", storageError);
      }
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.toString();
      
      if (errorMsg.includes('400') || errorMsg.includes('API key') || e.message?.includes('API key')) {
          const key = currentApiKey;
          const isKeyMissing = !key || key.includes('UNUSED');

          if (isKeyMissing) {
             setError('API Ключ не найден');
             setErrorDetails(`Платформа не видит ключ (VITE_API_KEY).`);
          } else {
             setError('Google блокирует Telegram');
             setErrorDetails(`Ваш ключ работает, но блокирует этот источник (Telegram).`);
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
      setIsLoading(true);
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
      setChatMessages([...newMessages, { role: 'assistant', text: "Извини, возникла ошибка. Возможно, API ключ ограничен." }]);
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
                    <AlertTriangle className="text-red-500" size={32} />
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

  if (isLoading && !onboardingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-neutral-950 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-violet-600/20 rounded-full blur-[120px]"></div>
        
        <div className="text-center relative z-10">
          <div className="relative w-16 h-16 mx-auto mb-6">
             <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-xl font-light tracking-wide text-white">Создаем план тренировок...</p>
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
           <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold text-sm animate-slide-up flex items-center gap-2">
               <RefreshCw size={16} className="animate-spin-slow" />
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
