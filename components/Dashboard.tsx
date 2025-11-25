
import React, { useState, useEffect } from 'react';
import { OnboardingProfile, TrainingProgram, WorkoutLog, WorkoutSession, ReadinessData, TelegramUser } from '../types';
import WorkoutView from './WorkoutView';
import ProgressView from './ProgressView';
import SettingsView from './SettingsView';
import { Calendar, BarChart2, Dumbbell, Play, Flame, Activity, Zap, LayoutGrid, Bot, MessageCircle, ChevronLeft, ChevronRight, Check, Clock, Settings, ArrowLeftRight, Edit3, X, Crown, TrendingUp } from 'lucide-react';
import WorkoutPreviewModal from './WorkoutPreviewModal';
import ReadinessModal from './ReadinessModal';
import { calculateStreaks, calculateWorkoutVolume, calculateWeeklyProgress, getMuscleFocus, calculateLevel } from '../utils/progressUtils';
import { getDashboardInsight } from '../services/geminiService';


interface DashboardProps {
  profile: OnboardingProfile;
  program: TrainingProgram;
  logs: WorkoutLog[];
  telegramUser: TelegramUser | null;
  onWorkoutComplete: (log: WorkoutLog) => void;
  onUpdateProfile: (newProfile: OnboardingProfile) => void;
  onResetAccount: () => void;
  onOpenChat: () => void;
}

type View = 'today' | 'plan' | 'progress' | 'settings';

const Dashboard: React.FC<DashboardProps> = ({ profile, program, logs, telegramUser, onWorkoutComplete, onUpdateProfile, onResetAccount, onOpenChat }) => {
  const [activeView, setActiveView] = useState<View>('today');
  const [activeWorkout, setActiveWorkout] = useState<string | null>(null);
  const [workoutToPreview, setWorkoutToPreview] = useState<WorkoutSession | null>(null);
  
  // Readiness State
  const [showReadinessModal, setShowReadinessModal] = useState(false);
  const [pendingSessionName, setPendingSessionName] = useState<string | null>(null);
  const [currentReadiness, setCurrentReadiness] = useState<ReadinessData | null>(null);

  // AI Insight State
  const [coachInsight, setCoachInsight] = useState<string | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);

  // Calendar State
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  // Schedule Editing State
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [selectedDateToMove, setSelectedDateToMove] = useState<Date | null>(null);
  const [scheduleOverrides, setScheduleOverrides] = useState<{[date: string]: number | null}>({}); // DateString -> SessionIndex (null means Rest)

  useEffect(() => {
    // Load overrides
    const storedOverrides = localStorage.getItem('scheduleOverrides');
    if (storedOverrides) {
        setScheduleOverrides(JSON.parse(storedOverrides));
    }
  }, []);

  const saveOverrides = (newOverrides: {[date: string]: number | null}) => {
      setScheduleOverrides(newOverrides);
      localStorage.setItem('scheduleOverrides', JSON.stringify(newOverrides));
  }


  useEffect(() => {
      // Check local storage for cached insight
      const cached = localStorage.getItem('lastCoachInsight');
      const lastLogCount = logs.length;
      
      let shouldFetch = true;
      
      if (cached) {
          const parsed = JSON.parse(cached);
          // Fetch if logs count changed OR it's been > 6 hours
          const now = new Date().getTime();
          const isStale = (now - parsed.timestamp) > 6 * 60 * 60 * 1000;
          
          if (parsed.logCount === lastLogCount && !isStale) {
              setCoachInsight(parsed.text);
              shouldFetch = false;
          }
      }

      if (shouldFetch) {
          const fetchInsight = async () => {
              setIsInsightLoading(true);
              try {
                  const text = await getDashboardInsight(profile, logs);
                  setCoachInsight(text);
                  localStorage.setItem('lastCoachInsight', JSON.stringify({
                      timestamp: new Date().getTime(),
                      logCount: lastLogCount,
                      text: text
                  }));
              } catch (e) {
                  console.error("Failed to fetch insight", e);
              } finally {
                  setIsInsightLoading(false);
              }
          }
          fetchInsight();
      }
  }, [logs.length]); // Re-run only if workout count changes


  if (!program || !Array.isArray(program.sessions) || program.sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] text-center p-4">
        <h2 className="text-2xl font-bold text-red-400">Ошибка плана</h2>
        <button onClick={onResetAccount} className="mt-4 px-6 py-3 bg-white text-black rounded-full font-bold">
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
          <button onClick={onResetAccount} className="mt-4 px-6 py-3 bg-white text-black rounded-full font-bold">
            Сбросить план
          </button>
        </div>
      );
  }
  
  const { currentStreak } = calculateStreaks(logs);
  const lastWorkoutVolume = logs.length > 0 ? calculateWorkoutVolume(logs[logs.length-1]) : 0;
  const weeklyProgress = calculateWeeklyProgress(logs);
  const userLevel = calculateLevel(logs);
  const muscleFocus = getMuscleFocus(todaysWorkout);


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

  // --- Calendar Logic ---
  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
      // Adjust for Monday start (Russian standard)
      const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; 
      
      const days = [];
      // Padding
      for (let i = 0; i < adjustedFirstDay; i++) days.push(null);
      // Days
      for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
      
      return days;
  };

  const getScheduledWorkoutForDate = (date: Date) => {
      if (!date) return null;
      
      const dateStr = date.toDateString();
      const overrideKey = dateStr;

      // 1. Check completion first (Immutable history)
      const completedLog = logs.find(l => new Date(l.date).toDateString() === dateStr);
      if (completedLog) return { type: 'completed', log: completedLog, index: -1 };

      // 2. Check for manual overrides (User edits)
      if (scheduleOverrides.hasOwnProperty(overrideKey)) {
          const overrideIndex = scheduleOverrides[overrideKey];
          if (overrideIndex === null) return null; // Explicit Rest Day
          return { type: 'planned', session: program.sessions[overrideIndex], index: overrideIndex };
      }

      // 3. New Schedule Logic based on specific days
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...
      
      const preferredDays = profile.preferredDays || [];
      const isWorkoutDay = preferredDays.includes(dayOfWeek);

      if (isWorkoutDay) {
          const sortedDays = [...preferredDays].sort();
          const dayIndexInWeek = sortedDays.indexOf(dayOfWeek);
          const sessionIndex = dayIndexInWeek % program.sessions.length;
          return { type: 'planned', session: program.sessions[sessionIndex], index: sessionIndex };
      }

      return null;
  };

  const changeMonth = (delta: number) => {
      const newDate = new Date(calendarDate);
      newDate.setMonth(newDate.getMonth() + delta);
      setCalendarDate(newDate);
  };

  const handleDateClick = (date: Date, status: any) => {
      if (isEditingSchedule) {
          if (!selectedDateToMove) {
              // Select first date
              setSelectedDateToMove(date);
          } else {
              // Swap Logic
              const date1Str = selectedDateToMove.toDateString();
              const date2Str = date.toDateString();

              if (date1Str === date2Str) {
                  setSelectedDateToMove(null); // Deselect
                  return;
              }

              const status1 = getScheduledWorkoutForDate(selectedDateToMove);
              const status2 = getScheduledWorkoutForDate(date);

              // We only swap planned sessions, not completed ones
              if (status1?.type === 'completed' || status2?.type === 'completed') {
                  alert("Нельзя менять уже выполненные тренировки!");
                  setSelectedDateToMove(null);
                  return;
              }

              const newOverrides = { ...scheduleOverrides };

              // Determine index for Date 1
              let idx1 = null; // null means rest
              if (status1?.type === 'planned') idx1 = status1.index;
              
              // Determine index for Date 2
              let idx2 = null;
              if (status2?.type === 'planned') idx2 = status2.index;

              // Swap
              newOverrides[date1Str] = idx2;
              newOverrides[date2Str] = idx1;

              saveOverrides(newOverrides);
              setSelectedDateToMove(null);
          }
      } else {
          // Normal Click -> Preview
          if (status?.type === 'planned') {
              setWorkoutToPreview(status.session);
          }
      }
  };


  const renderContent = () => {
      if (activeView === 'settings') {
          return (
            <div className="pb-32 animate-fade-in">
                <SettingsView 
                    profile={profile} 
                    telegramUser={telegramUser}
                    onUpdateProfile={onUpdateProfile}
                    onResetAccount={onResetAccount}
                />
            </div>
          );
      }

      if (activeView === 'progress') return <ProgressView logs={logs} program={program} />;
      
      if (activeView === 'plan') {
          const days = getDaysInMonth(calendarDate);
          const monthName = calendarDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
          const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

          return (
            <div className="space-y-6 pb-32 animate-fade-in pt-[env(safe-area-inset-top)]">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-2xl font-bold text-white">Календарь</h2>
                    <button 
                        onClick={() => {
                            setIsEditingSchedule(!isEditingSchedule);
                            setSelectedDateToMove(null);
                        }}
                        className={`p-2 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${isEditingSchedule ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-neutral-900 border-white/10 text-gray-400'}`}
                    >
                        {isEditingSchedule ? <><X size={14}/> Готово</> : <><Edit3 size={14}/> Изменить</>}
                    </button>
                </div>

                {/* Calendar Component */}
                <div className={`bg-neutral-900 border rounded-3xl p-4 shadow-lg transition-colors ${isEditingSchedule ? 'border-indigo-500/30' : 'border-white/5'}`}>
                    
                    {isEditingSchedule && (
                        <div className="mb-4 text-center p-2 bg-indigo-500/10 rounded-xl text-indigo-300 text-xs font-bold">
                             {selectedDateToMove 
                                ? "Выберите второй день для обмена" 
                                : "Выберите день, чтобы переместить тренировку"}
                        </div>
                    )}

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/5 rounded-full text-gray-400"><ChevronLeft size={20}/></button>
                        <span className="font-bold text-lg capitalize text-white">{monthName}</span>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/5 rounded-full text-gray-400"><ChevronRight size={20}/></button>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {weekDays.map(d => <div key={d} className="text-center text-xs text-gray-500 font-bold py-2">{d}</div>)}
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, idx) => {
                            if (!day) return <div key={idx} className="aspect-square"></div>;
                            
                            const status = getScheduledWorkoutForDate(day);
                            const isToday = day.toDateString() === new Date().toDateString();
                            const isSelected = selectedDateToMove?.toDateString() === day.toDateString();
                            
                            return (
                                <button 
                                    key={idx}
                                    onClick={() => handleDateClick(day, status)}
                                    disabled={!status && !isEditingSchedule}
                                    className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all duration-300 
                                        ${isToday ? 'bg-white/10 border border-white/20' : ''} 
                                        ${(status || isEditingSchedule) ? 'hover:bg-white/5' : 'opacity-30'}
                                        ${isSelected ? 'bg-indigo-600/40 border-indigo-500 ring-2 ring-indigo-500 scale-95' : ''}
                                        ${isEditingSchedule && !isSelected ? 'animate-pulse bg-neutral-800/50' : ''}
                                    `}
                                >
                                    <span className={`text-xs font-medium ${isToday ? 'text-white font-bold' : 'text-gray-400'}`}>{day.getDate()}</span>
                                    
                                    {status?.type === 'completed' && (
                                        <div className="mt-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
                                            <Check size={10} className="text-black" strokeWidth={4}/>
                                        </div>
                                    )}
                                    
                                    {status?.type === 'planned' && (
                                        <div className="mt-1 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
                                    )}

                                    {/* Empty slot visual for editing */}
                                    {isEditingSchedule && !status && (
                                        <div className="mt-1 w-1.5 h-1.5 border border-gray-600 rounded-full"></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5 flex justify-center gap-6 text-xs text-gray-400">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div> По плану
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div> Выполнено
                        </div>
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-gradient-to-br from-indigo-900/20 to-violet-900/20 border border-indigo-500/30 rounded-3xl p-6">
                     <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-indigo-500 rounded-xl text-white">
                            <ArrowLeftRight size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-indigo-300 uppercase">Гибкий график</p>
                            <p className="text-white font-bold">Меняй дни местами</p>
                        </div>
                     </div>
                     <p className="text-sm text-gray-400 leading-relaxed">
                         Нажми "Изменить", чтобы перенести тренировку на другой день или поменять их местами. Адаптируй план под свою жизнь.
                     </p>
                </div>
            </div>
          );
      }

      // Default 'today' view
      return (
        <div className="grid grid-cols-2 gap-4 pb-32 animate-fade-in">
            {/* Header with Weekly Progress Ring */}
            <div className="col-span-2 flex justify-between items-center py-2 px-1 pt-[env(safe-area-inset-top)]">
                <div className="flex items-center gap-3">
                     {telegramUser?.photo_url ? (
                        <img 
                            src={telegramUser.photo_url} 
                            alt="User" 
                            className="w-12 h-12 rounded-full border border-white/20"
                        />
                    ) : (
                         <div className="w-12 h-12 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center">
                            <Bot size={20} className="text-gray-400"/>
                         </div>
                    )}
                    <div>
                         <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">
                            Добрый день,
                        </p>
                        <h1 className="text-xl font-bold text-white leading-none mt-0.5">
                            {telegramUser?.first_name || "Спортсмен"}
                        </h1>
                    </div>
                </div>
                
                {/* Weekly Goal Widget */}
                <div className="flex items-center gap-3 bg-neutral-900 border border-white/10 rounded-full pl-4 pr-1.5 py-1.5">
                    <div className="text-right mr-1">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">План на неделю</p>
                        <p className="text-sm font-black text-white leading-none">{weeklyProgress} <span className="text-gray-500">/ {profile.daysPerWeek}</span></p>
                    </div>
                    <div className="relative w-10 h-10 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="20" cy="20" r="16" stroke="#333" strokeWidth="4" fill="none" />
                            <circle 
                                cx="20" cy="20" r="16" 
                                stroke={weeklyProgress >= profile.daysPerWeek ? '#10B981' : '#6366f1'} 
                                strokeWidth="4" 
                                fill="none" 
                                strokeDasharray={100}
                                strokeDashoffset={100 - (100 * Math.min(weeklyProgress, profile.daysPerWeek) / profile.daysPerWeek)}
                                className="transition-all duration-1000 ease-out"
                                strokeLinecap="round"
                            />
                        </svg>
                        {weeklyProgress >= profile.daysPerWeek && (
                             <div className="absolute inset-0 flex items-center justify-center">
                                 <Check size={14} className="text-green-500" strokeWidth={4} />
                             </div>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Insight & Body Status Combined Widget */}
            <div 
                onClick={onOpenChat}
                className="col-span-2 bg-neutral-900/80 border border-white/10 rounded-3xl p-4 flex items-start gap-4 cursor-pointer hover:bg-neutral-800 transition active:scale-[0.99] relative overflow-hidden group"
            >
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                
                <div className="shrink-0 pt-1">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 relative">
                        <MessageCircle size={20} />
                        {!coachInsight && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-neutral-900 animate-pulse"></div>}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                         <h3 className="font-bold text-white text-sm">Статус восстановления</h3>
                         <div className="px-2 py-0.5 bg-green-500/10 rounded text-[10px] font-bold text-green-400 uppercase tracking-wide">
                            Готов к бою
                         </div>
                    </div>
                    
                    {/* Visual Battery Bar */}
                    <div className="flex gap-1 mb-2 h-1.5 w-full max-w-[120px]">
                        <div className="flex-1 bg-green-500 rounded-full"></div>
                        <div className="flex-1 bg-green-500 rounded-full"></div>
                        <div className="flex-1 bg-green-500 rounded-full"></div>
                        <div className="flex-1 bg-neutral-700 rounded-full"></div>
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                        {coachInsight || "Твое тело восстановилось. Сегодня отличный день, чтобы увеличить нагрузку в базовых движениях."}
                    </p>
                </div>
            </div>

            {/* Hero Card - Next Workout */}
            <div className="col-span-2 relative group mt-2">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-[2rem] blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
                <div className="relative bg-[#111] border border-white/10 rounded-[2rem] p-6 overflow-hidden">
                    
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
                        <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
                            <path d="M100 0L200 100L100 200L0 100L100 0Z" fill="white"/>
                        </svg>
                    </div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider">
                                        <Calendar size={10} /> Сегодня
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                        <Clock size={10} /> ~{profile.timePerWorkout} мин
                                    </span>
                                </div>
                                <h2 className="text-3xl font-black text-white leading-tight mb-2">{todaysWorkout.name}</h2>
                            </div>
                        </div>

                        {/* Muscle Focus Tags */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            {muscleFocus.map(muscle => (
                                <span key={muscle} className="px-3 py-1 rounded-full border border-indigo-500/30 text-indigo-300 text-xs font-bold bg-indigo-500/10">
                                    {muscle}
                                </span>
                            ))}
                            <span className="px-3 py-1 rounded-full border border-white/5 text-gray-500 text-xs font-bold">
                                +{Math.max(0, todaysWorkout.exercises.length - muscleFocus.length)} упр.
                            </span>
                        </div>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => initiateWorkoutStart(todaysWorkout.name)}
                                className="flex-1 bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200 transition active:scale-95 shadow-xl shadow-white/5"
                            >
                                <Play size={20} fill="currentColor" /> Начать
                            </button>
                            <button 
                                onClick={() => setWorkoutToPreview(todaysWorkout)}
                                className="px-5 bg-white/5 text-white font-semibold rounded-2xl border border-white/10 hover:bg-white/10 transition active:scale-95"
                            >
                                Обзор
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid - Gamification */}
            <div className="col-span-2 grid grid-cols-3 gap-3 mt-2">
                
                {/* Streak */}
                <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1">
                    <Flame size={20} className="text-orange-500 mb-1" fill="currentColor" fillOpacity={0.2} />
                    <span className="text-xl font-black text-white leading-none">{currentStreak}</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Дней подряд</span>
                </div>

                {/* Level */}
                <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1 relative overflow-hidden">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-neutral-800">
                        <div className="h-full bg-yellow-500" style={{ width: `${userLevel.levelProgress}%` }}></div>
                    </div>
                    <Crown size={20} className="text-yellow-500 mb-1" fill="currentColor" fillOpacity={0.2} />
                    <span className="text-xl font-black text-white leading-none">{userLevel.level}</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Уровень</span>
                </div>

                {/* Last Volume */}
                <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1">
                    <Dumbbell size={20} className="text-emerald-500 mb-1" />
                    <span className="text-xl font-black text-white leading-none">{(lastWorkoutVolume / 1000).toFixed(1)}т</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Поднято</span>
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-[100dvh] p-4 font-sans text-gray-100 relative">
      <main className="py-2">
        {renderContent()}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full bg-neutral-950/90 backdrop-blur-md border-t border-white/5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3 flex justify-around items-center z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <NavButton 
            icon={<LayoutGrid size={24} strokeWidth={activeView === 'today' ? 2.5 : 2} />} 
            label="Главная" 
            isActive={activeView === 'today'} 
            onClick={() => setActiveView('today')} 
        />
        <NavButton 
            icon={<Dumbbell size={24} strokeWidth={activeView === 'plan' ? 2.5 : 2} />} 
            label="План" 
            isActive={activeView === 'plan'} 
            onClick={() => setActiveView('plan')} 
        />
        <NavButton 
            icon={<BarChart2 size={24} strokeWidth={activeView === 'progress' ? 2.5 : 2} />} 
            label="Прогресс" 
            isActive={activeView === 'progress'} 
            onClick={() => setActiveView('progress')} 
        />
         <NavButton 
            icon={<Settings size={24} strokeWidth={activeView === 'settings' ? 2.5 : 2} />} 
            label="Настройки" 
            isActive={activeView === 'settings'} 
            onClick={() => setActiveView('settings')} 
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

const NavButton = ({ icon, label, isActive, onClick }: any) => (
    <button 
        onClick={onClick} 
        className={`relative flex flex-col items-center justify-center gap-1 w-16 py-1 transition-all duration-300 group ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
    >
        <div className={`relative p-1 transition-transform duration-300 ${isActive ? '-translate-y-1' : ''}`}>
            {icon}
            {isActive && (
                <div className="absolute inset-0 bg-indigo-500/30 blur-lg rounded-full opacity-60"></div>
            )}
        </div>
        <span className={`text-[10px] font-medium tracking-wider transition-opacity duration-300 ${isActive ? 'opacity-100 text-indigo-300' : 'opacity-70'}`}>
            {label}
        </span>
        
        {/* Top indicator line for active state */}
        {isActive && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-indigo-500 rounded-b-full shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>
        )}
    </button>
)

export default Dashboard;
