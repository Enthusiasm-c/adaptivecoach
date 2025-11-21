
import React, { useMemo } from 'react';
import { WorkoutLog, TrainingProgram, ReadinessData, WorkoutCompletion } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    AreaChart, Area, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { 
    calculateStreaks, calculateTotalVolume, calculateWeeklyVolume, 
    calculatePersonalRecords, calculateReadinessHistory, calculateMovementPatterns, getHeatmapData 
} from '../utils/progressUtils';
import { Dumbbell, Flame, TrendingUp, Trophy, Battery, PieChart, Calendar, Eye } from 'lucide-react';

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
                        { reps: 5, weight: 100 * volumeMultiplier + (12 - i) * 2.5 },
                        { reps: 5, weight: 100 * volumeMultiplier + (12 - i) * 2.5 },
                        { reps: 5, weight: 100 * volumeMultiplier + (12 - i) * 2.5 }
                    ]
                },
                {
                    name: "Bench Press",
                    sets: 3,
                    reps: "8-10",
                    rest: 90,
                    completedSets: [
                        { reps: 10, weight: 60 * volumeMultiplier + (12 - i) },
                        { reps: 9, weight: 60 * volumeMultiplier + (12 - i) },
                        { reps: 8, weight: 60 * volumeMultiplier + (12 - i) }
                    ]
                },
                {
                    name: "Deadlift",
                    sets: 1,
                    reps: "5",
                    rest: 180,
                    completedSets: [
                        { reps: 5, weight: 120 * volumeMultiplier + (12 - i) * 5 }
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
  
  // Use Memo to prevent regenerating mock data on every render
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

  const chartTheme = {
      grid: "#404040", 
      text: "#737373", 
  };

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
                      У вас пока нет завершенных тренировок. Мы показываем пример данных, чтобы вы увидели, как будут выглядеть ваши графики прогресса.
                  </p>
              </div>
          </div>
      )}

      <div className="flex justify-between items-end">
          <h2 className="text-3xl font-black text-white tracking-tight">Статистика</h2>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-neutral-900 px-2 py-1 rounded-lg border border-white/5">
            30 Дней
          </span>
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
            sub={`Лучшая: ${bestStreak}`} 
            icon={<Flame size={16}/>}
            color="text-orange-400"
            bg="bg-orange-500/10"
        />
      </div>

      {/* Consistency Heatmap */}
      <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-4 text-gray-300 font-bold text-sm">
              <Calendar size={16} className="text-green-400"/>
              Тренировочная активность
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
          <div className="flex justify-between text-[10px] text-gray-600 mt-2 uppercase font-bold">
              <span>4 Недели</span>
              <span>Сегодня</span>
          </div>
      </div>

      {/* Readiness Trends (Juggernaut Logic) */}
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
                <XAxis 
                    dataKey="date" 
                    stroke={chartTheme.text} 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10}
                />
                <YAxis 
                    stroke={chartTheme.text} 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    domain={[0, 25]} 
                />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="score" stroke="#60a5fa" fillOpacity={1} fill="url(#colorScore)" strokeWidth={3} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Volume Bar Chart */}
          <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-4 text-gray-300 font-bold text-sm">
                <TrendingUp size={16} className="text-indigo-400"/>
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
                    <YAxis 
                        stroke={chartTheme.text} 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} 
                    />
                    <Bar dataKey="volume" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                    <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                        contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                        formatter={(value: number) => [`${(value/1000).toFixed(1)}k kg`, "Volume"]}
                        labelStyle={{ display: 'none' }}
                    />
                    </BarChart>
                </ResponsiveContainer>
            </div>
          </div>

          {/* Movement Radar Chart */}
          <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-2 text-gray-300 font-bold text-sm">
                <PieChart size={16} className="text-pink-400"/>
                Баланс мышц
            </div>
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={movementData}>
                        <PolarGrid stroke="#525252" fill="transparent" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#a3a3a3', fontSize: 10, fontWeight: 'bold' }} />
                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                        <Radar name="Sets" dataKey="A" stroke="#ec4899" fill="#ec4899" fillOpacity={0.4} />
                        <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}/>
                    </RadarChart>
                </ResponsiveContainer>
            </div>
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
