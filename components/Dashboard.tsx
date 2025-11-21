import React, { useState } from 'react';
import { OnboardingProfile, TrainingProgram, WorkoutLog, WorkoutSession, ReadinessData } from '../types';
import WorkoutView from './WorkoutView';
import ProgressView from './ProgressView';
import { Calendar, BarChart2, Dumbbell, Play, Flame, Activity, Zap, LayoutGrid } from 'lucide-react';
import WorkoutPreviewModal from './WorkoutPreviewModal';
import ReadinessModal from './ReadinessModal';
import { calculateStreaks, calculateWorkoutVolume } from '../utils/progressUtils';


interface DashboardProps {
  profile: OnboardingProfile;
  program: TrainingProgram;
  logs: WorkoutLog[];
  onWorkoutComplete: (log: WorkoutLog) => void;
  onOpenSettings: () => void;
}

type View = 'today' | 'plan' | 'progress';

const Dashboard: React.FC<DashboardProps> = ({ profile, program, logs, onWorkoutComplete, onOpenSettings }) => {
  const [activeView, setActiveView] = useState<View>('today');
  const [activeWorkout, setActiveWorkout] = useState<string | null>(null);
  const [workoutToPreview, setWorkoutToPreview] = useState<WorkoutSession | null>(null);
  
  // Readiness State
  const [showReadinessModal, setShowReadinessModal] = useState(false);
  const [pendingSessionName, setPendingSessionName] = useState<string | null>(null);
  const [currentReadiness, setCurrentReadiness] = useState<ReadinessData | null>(null);


  if (!program || !Array.isArray(program.sessions) || program.sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] text-center p-4">
        <h2 className="text-2xl font-bold text-red-400">Ошибка плана</h2>
        <button onClick={onOpenSettings} className="mt-4 px-6 py-3 bg-white text-black rounded-full font-bold">
          Сбросить план
        </button>
      </div>
    );
  }

  const todaysWorkoutIndex = logs.length % program.sessions.length;
  const todaysWorkout = program.sessions[todaysWorkoutIndex];

  if (!todaysWorkout || !todaysWorkout.name) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] text-center p-4">
          <h2 className="text-2xl font-bold text-red-400">Ошибка данных</h2>
          <button onClick={onOpenSettings} className="mt-4 px-6 py-3 bg-white text-black rounded-full font-bold">
            Сбросить план
          </button>
        </div>
      );
  }
  
  const { currentStreak } = calculateStreaks(logs);
  const lastWorkoutVolume = logs.length > 0 ? calculateWorkoutVolume(logs[logs.length-1]) : 0;


  if (activeWorkout) {
    const workout = program.sessions.find(s => s.name === activeWorkout);
    if (workout) {
      return (
        <WorkoutView 
          session={workout}
          profile={profile}
          readiness={currentReadiness}
          onFinish={(log) => {
            onWorkoutComplete(log);
            setActiveWorkout(null);
            setCurrentReadiness(null);
          }}
          onBack={() => {
            setActiveWorkout(null);
            setCurrentReadiness(null);
          }}
        />
      );
    }
  }

  const initiateWorkoutStart = (sessionName: string) => {
    setPendingSessionName(sessionName);
    setWorkoutToPreview(null);
    setShowReadinessModal(true);
  };

  const handleReadinessConfirm = (data: ReadinessData) => {
    setCurrentReadiness(data);
    setShowReadinessModal(false);
    if (pendingSessionName) {
        setActiveWorkout(pendingSessionName);
        setPendingSessionName(null);
    }
  };

  const renderBentoContent = () => {
      if (activeView === 'progress') return <ProgressView logs={logs} program={program} />;
      
      if (activeView === 'plan') {
          return (
            <div className="space-y-4 pb-48 animate-fade-in">
                <h2 className="text-2xl font-bold text-white px-1">Тренировочный цикл</h2>
                <div className="grid gap-4">
                    {program.sessions.map((session, index) => {
                        const isNext = index === todaysWorkoutIndex;
                        return (
                            <button 
                                key={index}
                                onClick={() => setWorkoutToPreview(session)}
                                className={`w-full text-left p-6 rounded-3xl border transition-all duration-300 ${
                                    isNext 
                                    ? 'bg-indigo-600/10 border-indigo-500/50' 
                                    : 'bg-neutral-900/50 border-white/5 hover:bg-neutral-800'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className={`font-bold text-lg ${isNext ? 'text-indigo-400' : 'text-white'}`}>{session.name}</h3>
                                    {isNext && <span className="text-xs font-bold bg-indigo-500 text-white px-2 py-1 rounded-full">ДАЛЕЕ</span>}
                                </div>
                                <p className="text-gray-400 text-sm">{session.exercises.length} Упражнений</p>
                            </button>
                        );
                    })}
                </div>
            </div>
          );
      }

      return (
        <div className="grid grid-cols-2 gap-4 pb-48 animate-fade-in">
            {/* Header */}
            <div className="col-span-2 flex justify-between items-end py-2 px-1 pt-[env(safe-area-inset-top)]">
                <div>
                    <p className="text-gray-400 text-sm font-medium">С возвращением,</p>
                    <h1 className="text-2xl font-bold text-white">Пора тренироваться</h1>
                </div>
                <button onClick={onOpenSettings} className="text-[10px] uppercase font-bold text-gray-600 bg-neutral-900 px-3 py-1 rounded-full border border-white/5 hover:text-white hover:border-white/20 transition">
                    Настройки
                </button>
            </div>

            {/* Hero Card - Next Workout */}
            <div className="col-span-2 relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500"></div>
                <div className="relative bg-neutral-900/90 border border-white/10 rounded-3xl p-6 overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-indigo-300 text-xs font-bold mb-2 uppercase tracking-wider">Сегодня</span>
                                <h2 className="text-3xl font-black text-white leading-tight">{todaysWorkout.name}</h2>
                            </div>
                            <div className="p-3 bg-indigo-500 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                                <Dumbbell size={24} />
                            </div>
                        </div>
                        
                        <div className="space-y-2 mb-8">
                             {todaysWorkout.exercises.slice(0, 3).map((ex, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm text-gray-300">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                    {ex.name} <span className="text-gray-500"> {ex.sets}x{ex.reps}</span>
                                </div>
                            ))}
                            {todaysWorkout.exercises.length > 3 && <p className="text-xs text-gray-500 pl-4.5">+{todaysWorkout.exercises.length - 3} еще</p>}
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => initiateWorkoutStart(todaysWorkout.name)}
                                className="flex-1 bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                            >
                                <Play size={18} fill="currentColor" /> Старт
                            </button>
                            <button 
                                onClick={() => setWorkoutToPreview(todaysWorkout)}
                                className="px-6 bg-white/5 text-white font-semibold rounded-2xl border border-white/10 hover:bg-white/10 transition-colors"
                            >
                                Обзор
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stat Block: Streak */}
            <div className="bg-neutral-900/80 border border-white/5 rounded-3xl p-5 flex flex-col justify-between h-36">
                <div className="p-2 bg-orange-500/10 w-fit rounded-xl text-orange-500">
                    <Flame size={20} />
                </div>
                <div>
                    <p className="text-3xl font-bold text-white">{currentStreak}</p>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Дней подряд</p>
                </div>
            </div>

            {/* Stat Block: Volume */}
            <div className="bg-neutral-900/80 border border-white/5 rounded-3xl p-5 flex flex-col justify-between h-36">
                <div className="p-2 bg-emerald-500/10 w-fit rounded-xl text-emerald-500">
                    <Activity size={20} />
                </div>
                <div>
                    <p className="text-lg font-bold text-white leading-none mb-1">{(lastWorkoutVolume / 1000).toFixed(1)}k</p>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Объем (кг)</p>
                </div>
            </div>

            {/* Readiness Status (Simulated/Cached) */}
             <div className="col-span-2 bg-neutral-900/80 border border-white/5 rounded-3xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                     <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                        <Zap size={20} fill="currentColor"/>
                     </div>
                     <div>
                         <p className="text-white font-bold">AI Адаптация</p>
                         <p className="text-xs text-gray-400">Логика Juggernaut активна</p>
                     </div>
                </div>
                <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500/30"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500/30"></div>
                </div>
             </div>
        </div>
      );
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-[100dvh] p-4 font-sans">
      <main className="py-4">
        {renderBentoContent()}
      </main>

      {/* Floating Island Navigation */}
      <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-neutral-900/90 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center gap-8 shadow-2xl shadow-black z-40 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <NavButton 
            icon={<LayoutGrid size={20} />} 
            label="Главная" 
            isActive={activeView === 'today'} 
            onClick={() => setActiveView('today')} 
        />
        <NavButton 
            icon={<Dumbbell size={20} />} 
            label="План" 
            isActive={activeView === 'plan'} 
            onClick={() => setActiveView('plan')} 
        />
        <NavButton 
            icon={<BarChart2 size={20} />} 
            label="Стат" 
            isActive={activeView === 'progress'} 
            onClick={() => setActiveView('progress')} 
        />
      </nav>

      {workoutToPreview && (
        <WorkoutPreviewModal 
          session={workoutToPreview}
          onClose={() => setWorkoutToPreview(null)}
          onStart={() => initiateWorkoutStart(workoutToPreview.name)}
        />
      )}

      {showReadinessModal && (
        <ReadinessModal 
            onConfirm={handleReadinessConfirm}
            onCancel={() => setShowReadinessModal(false)}
        />
      )}
    </div>
  );
};

const NavButton = ({ icon, isActive, onClick }: any) => (
    <button 
        onClick={onClick} 
        className={`relative p-2 transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
    >
        {icon}
        {isActive && (
            <span className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full"></span>
        )}
    </button>
)

export default Dashboard;