import React, { useMemo } from 'react';
import { WorkoutLog, TrainingProgram, ReadinessData, WorkoutCompletion } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    AreaChart, Area, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
    calculateStreaks, calculateTotalVolume, calculateWeeklyVolume, 
    calculatePersonalRecords, calculateReadinessHistory, calculateMovementPatterns, getHeatmapData,
    calculateLevel, getStrengthProgression, getVolumeDistribution
} from '../utils/progressUtils';
import { Dumbbell, Flame, TrendingUp, Trophy, Battery, PieChart as PieIcon, Calendar, Eye, Crown, Star, Activity } from 'lucide-react';

interface ProgressViewProps {
  logs: WorkoutLog[];
  program: TrainingProgram;
}

// --- Mock Data Generator ---
const generateMockLogs = (): WorkoutLog[] => {
    const logs: WorkoutLog[] = [];
    const today = new Date();
    
    // Create 12 workouts over the last 4 weeks (3 per week)
    for (let i = 11; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - (i * 2.5)); // Every 2-3 days

        // Fluctuate volume and readiness for realistic charts
        const isStrongDay = i % 3 !== 0; 
        const volumeMultiplier = isStrongDay ? 1.1 : 0.9;
        const strengthProgression = (12 - i) * 1.5; // Gradual increase
        
        const readinessScore = isStrongDay ? 18 : 10; // Mix of Green and Red days

        logs.push({
            sessionId: `Mock Session ${i}`,
            date: date.toISOString(),
            feedback: {
                completion: WorkoutCompletion.Yes,
                pain: { hasPain: false },
                readiness: {
                    sleep: isStrongDay ? 5 : 2,
                    food: 4,
                    stress: isStrongDay ? 4 : 2,
                    soreness: 5,
                    score: readinessScore,
                    status: readinessScore > 15 ? 'Green' : 'Red'
                }
            },
            completedExercises: [
                {
                    name: "Barbell Squat",
                    sets: 3,
                    reps: "5",
                    rest: 120,
                    completedSets: [
                        { reps: 5, weight: 100 + strengthProgression },
                        { reps: 5, weight: 100 + strengthProgression },
                        { reps: 5, weight: 100 + strengthProgression }
                    ]
                },
                {
                    name: "Bench Press",
                    sets: 3,
                    reps: "8-10",
                    rest: 90,
                    completedSets: [
                        { reps: 10, weight: 60 + (strengthProgression * 0.6) },
                        { reps: 9, weight: 60 + (strengthProgression * 0.6) },
                        { reps: 8, weight: 60 + (strengthProgression * 0.6) }
                    ]
                },
                {
                    name: "Deadlift",
                    sets: 1,
                    reps: "5",
                    rest: 180,
                    completedSets: [
                        { reps: 5, weight: 120 + (strengthProgression * 1.2) }
                    ]
                },
                // Add variety for radar chart
                ...(i % 2 === 0 ? [{
                    name: "Pull Up",
                    sets: 3,
                    reps: "10",
                    rest: 60,
                    completedSets: [{reps: 10, weight: 0}, {reps: 10, weight: 0}, {reps: 8, weight: 0}]
                }] : [])
            ]
        });
    }
    return logs;
};

const ProgressView: React.FC<ProgressViewProps> = ({ logs, program }) => {
  const isDemoMode = logs.length === 0;
  
  const displayLogs = useMemo(() => {
      return isDemoMode ? generateMockLogs() : logs;
  }, [logs, isDemoMode]);

  const { currentStreak, bestStreak } = calculateStreaks(displayLogs);
  const totalVolume = calculateTotalVolume(displayLogs);
  const weeklyVolumeData = calculateWeeklyVolume(displayLogs);
  const personalRecords = calculatePersonalRecords(displayLogs);
  const readinessData = calculateReadinessHistory(displayLogs);
  const movementData = calculateMovementPatterns(displayLogs);
  const heatmapData = getHeatmapData(displayLogs);
  
  // New Analytics
  const userLevel = calculateLevel(displayLogs);
  const strengthData = getStrengthProgression(displayLogs);
  const volumeDistData = getVolumeDistribution(displayLogs);

  const chartTheme = {
      grid: "#404040", 
      text: "#737373", 
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']; // Indigo, Emerald, Amber, Pink

  return (
    <div className="pb-40 space-y-6 animate-fade-in px-1 relative">
      
      {/* Demo Mode Banner */}
      {isDemoMode && (
          <div className="bg-indigo-500/10 border border-indigo-500/50 rounded-2xl p-4 flex items-start gap-3 animate-slide-up">
              <div className="p-2 bg-indigo-500 text-white rounded-lg mt-0.5">
                  <Eye size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-white">Демонстрационный режим</h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Показываем пример статистики. Начните тренироваться, чтобы увидеть свой реальный прогресс!
                  </p>
              </div>
          </div>
      )}

      {/* Gamification Header */}
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-900/50 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
          
          <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-500/30 transform rotate-3 border border-white/10">
                  {userLevel.level}
              </div>
              <div>
                  <div className="flex items-center gap-2">
                     <h2 className="text-2xl font-black text-white">{userLevel.title}</h2>
                     <Crown size={18} className="text-yellow-400 fill-yellow-400" />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">{userLevel.xp} XP</p>
              </div>
          </div>

          <div className="relative z-10">
              <div className="flex justify-between text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                  <span>Прогресс уровня</span>
                  <span>{userLevel.levelProgress.toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-indigo-500 rounded-full relative"
                    style={{ width: `${userLevel.levelProgress}%` }}
                  >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
              </div>
          </div>
      </div>
      
      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard 
            label="Общий Тоннаж" 
            value={`${(totalVolume/1000).toFixed(1)}k`} 
            sub="КГ Поднято" 
            icon={<Dumbbell size={16}/>}
            color="text-indigo-400"
            bg="bg-indigo-500/10"
        />
        <StatCard 
            label="Регулярность" 
            value={`${currentStreak} Дн`} 
            sub={`Рекорд: ${bestStreak}`} 
            icon={<Flame size={16}/>}
            color="text-orange-400"
            bg="bg-orange-500/10"
        />
      </div>

      {/* Strength Progression Chart */}
      <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-4 text-gray-300 font-bold text-sm">
              <TrendingUp size={16} className="text-indigo-400"/>
              Силовой Прогресс (e1RM)
          </div>
          <div className="h-56 -ml-2">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={strengthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke={chartTheme.text} fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke={chartTheme.text} fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} iconType="circle" />
                    <Line type="monotone" dataKey="squat" name="Присед" stroke="#6366f1" strokeWidth={3} dot={false} connectNulls />
                    <Line type="monotone" dataKey="bench" name="Жим" stroke="#10b981" strokeWidth={3} dot={false} connectNulls />
                    <Line type="monotone" dataKey="deadlift" name="Тяга" stroke="#f59e0b" strokeWidth={3} dot={false} connectNulls />
                </LineChart>
             </ResponsiveContainer>
          </div>
      </div>

      {/* Readiness Trends */}
      <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg overflow-hidden relative">
        <div className="flex items-center gap-2 mb-4 text-gray-300 font-bold text-sm z-10 relative">
            <Battery size={16} className="text-blue-400"/>
            Тенденция Восстановления
        </div>
        <div className="h-48 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={readinessData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={chartTheme.text} fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke={chartTheme.text} fontSize={10} tickLine={false} axisLine={false} domain={[0, 25]} />
                <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="score" stroke="#60a5fa" fillOpacity={1} fill="url(#colorScore)" strokeWidth={3} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Split & Volume Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Volume Bar Chart */}
          <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-4 text-gray-300 font-bold text-sm">
                <Activity size={16} className="text-emerald-400"/>
                Недельный Объем
            </div>
            <div className="h-48 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyVolumeData.length > 0 ? weeklyVolumeData : [{name: 'No Data', volume: 0}]} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
                    <XAxis 
                        dataKey="name" 
                        stroke={chartTheme.text} 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => val.includes('-W') ? val.split('-W')[1] : val} 
                        dy={10}
                    />
                    <YAxis stroke={chartTheme.text} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                    <Bar dataKey="volume" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                    <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                        contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                    />
                    </BarChart>
                </ResponsiveContainer>
            </div>
          </div>

          {/* Split Distribution Pie */}
          <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-2 text-gray-300 font-bold text-sm">
                <PieIcon size={16} className="text-pink-400"/>
                Распределение Нагрузки
            </div>
            <div className="h-48 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={volumeDistData}
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {volumeDistData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }} />
                        <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px', color: '#a3a3a3' }}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
          </div>
      </div>

      {/* Consistency Heatmap */}
      <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-4 text-gray-300 font-bold text-sm">
              <Calendar size={16} className="text-green-400"/>
              Активность
          </div>
          <div className="flex justify-between gap-1">
              {heatmapData.map((day, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                      <div 
                        className={`w-full aspect-[4/5] rounded-md transition-all duration-500 ${
                            day.hasWorkout 
                            ? (day.intensity > 1 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-green-500/60') 
                            : 'bg-neutral-800'
                        }`}
                        title={day.date.toDateString()}
                      ></div>
                  </div>
              ))}
          </div>
      </div>

      {/* PR List */}
      {personalRecords.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-white text-lg flex items-center gap-2"><Trophy size={18} className="text-yellow-500"/> Личные Рекорды (e1RM)</h3>
          <div className="grid gap-2">
            {personalRecords.map(pr => (
                <div key={pr.exerciseName} className="flex justify-between items-center bg-neutral-900 border border-white/5 p-4 rounded-2xl">
                    <span className="font-bold text-gray-300 text-sm">{pr.exerciseName}</span>
                    <div className="text-right">
                        <span className="font-black text-xl text-white">{pr.e1rm.toFixed(0)}</span>
                        <span className="text-xs text-gray-500 font-bold ml-1">КГ</span>
                    </div>
                </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, sub, icon, color, bg }: any) => (
    <div className="bg-neutral-900 border border-white/5 p-4 rounded-3xl flex flex-col justify-between min-h-[110px]">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bg} ${color} mb-2`}>
            {icon}
        </div>
        <div>
            <p className="text-2xl font-black text-white tracking-tight">{value}</p>
            <p className="text-xs text-gray-500 font-bold uppercase mt-0.5">{sub}</p>
        </div>
    </div>
);

export default ProgressView;