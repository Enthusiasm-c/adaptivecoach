import React, { useState, useEffect, useCallback } from 'react';
import { OnboardingProfile, TrainingProgram, WorkoutLog, ChatMessage } from './types';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import SettingsView from './components/SettingsView';
import { generateInitialPlan, adaptPlan, getChatbotResponse, currentApiKey } from './services/geminiService';
import Chatbot from './components/Chatbot';
import { AlertTriangle, RefreshCw, Globe, Copy, Settings } from 'lucide-react';

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

  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatbotLoading, setIsChatbotLoading] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);

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
          // Use the resolved key from service to determine status
          const key = currentApiKey;
          const isKeyMissing = !key || key.includes('UNUSED');

          if (isKeyMissing) {
             // SCENARIO 1: Key is genuinely missing or default UNUSED
             setError('Ключ не настроен (UNUSED)');
             setErrorDetails(`
                Cloud Run > Edit & Deploy > Variables
                
                Добавьте переменную:
                Name: VITE_API_KEY
                Value: (Ваш AIza... ключ)
                
                Затем нажмите Deploy.
             `);
          } else {
             // SCENARIO 2: Key exists (works in Chrome) but blocked in Telegram
             setError('Google блокирует Telegram');
             setErrorDetails(`
                Ваш ключ (${key.substring(0,6)}...) работает в браузере, но блокирует Telegram WebApp.
                
                РЕШЕНИЕ (В Google Cloud Console):
                1. Нажмите "EDIT API KEY" (или иконку карандаша).
                2. Найдите "Application restrictions".
                3. Переключите на "None".
                4. Нажмите "Save".
                
                Telegram скрывает источник запроса, поэтому ограничение "Websites" блокирует его.
             `);
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

    // Adapt plan every 3 workouts
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
      } catch (e) {
        console.error(e);
        // Non-critical error, we just don't adapt yet
      } finally {
        setIsLoading(false);
      }
    }
  }, [workoutLogs, trainingProgram]);
  
  const handleChatbotSend = async (message: string) => {
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', text: message }];
    setChatMessages(newMessages);
    setIsChatbotLoading(true);
    try {
      const response = await getChatbotResponse(newMessages);
      setChatMessages([...newMessages, { role: 'assistant', text: response }]);
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
    setShowSettings(false);
    setError(null);
  };

  // Error Screen
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
        {/* Background Glows */}
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
       {/* Global Ambient Background */}
       <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-900/10 rounded-full blur-[100px]"></div>
       </div>

       <div className="relative z-10 h-full">
        {onboardingProfile && trainingProgram ? (
            showSettings ? (
                <SettingsView 
                    profile={onboardingProfile} 
                    onBack={() => setShowSettings(false)}
                    onUpdateProfile={handleUpdateProfile}
                    onResetAccount={resetOnboarding}
                />
            ) : (
                <>
                <Dashboard 
                    profile={onboardingProfile}
                    program={trainingProgram} 
                    logs={workoutLogs}
                    onWorkoutComplete={handleWorkoutComplete}
                    onOpenSettings={() => setShowSettings(true)}
                />
                <Chatbot 
                    isOpen={isChatbotOpen}
                    onToggle={() => setIsChatbotOpen(!isChatbotOpen)}
                    messages={chatMessages}
                    onSendMessage={handleChatbotSend}
                    isLoading={isChatbotLoading}
                />
                </>
            )
        ) : (
            <Onboarding onComplete={handleOnboardingComplete} isLoading={isLoading} error={error} />
        )}
       </div>
    </div>
  );
};

export default App;