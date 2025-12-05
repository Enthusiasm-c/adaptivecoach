
export enum Gender {
  Male = "Мужчина",
  Female = "Женщина",
}

export enum ExperienceLevel {
  Beginner = "Новичок (0-6 месяцев)",
  Intermediate = "Любитель (6-24 месяцев)",
  Advanced = "Атлет (2+ года)",
}

export enum ActivityLevel {
  Sedentary = "Сидячий (офис, дом)",
  Light = "Малоактивный (прогулки)",
  Moderate = "Средний (спорт 1-2 раза)",
  VeryActive = "Активный (физ. работа/спорт)",
}

export enum Goal {
  LoseFat = "Снижение веса / Рельеф",
  BuildMuscle = "Набор мышечной массы",
  GetStronger = "Развитие силы",
  GeneralHealth = "Тонус и здоровье",
}

export enum Location {
  CommercialGym = "Фитнес-клуб",
  HomeGym = "Домашний зал (штанга)",
  Bodyweight = "Дома (свой вес/резинки)",
}

export enum Intensity {
  Easy = "Вводная нагрузка",
  Normal = "Умеренная (есть прогресс)",
  Hard = "Высокая (работа на отказ)",
}

export enum LastWorkout {
  LessThanWeek = "Менее недели назад",
  OneMonth = "Около месяца назад",
  ThreeMonths = "3-6 месяцев назад",
  YearOrMore = "Год и более",
}

export interface KnownWeight {
  exercise: string; // e.g., "Bench Press"
  weight: number;
}

export interface FriendProfile {
  id: string;
  name: string;
  photoUrl?: string;
  level: number;
  streak: number;
  totalVolume: number; // kg
  lastActive: string; // ISO date
  isOnline?: boolean;
}

export interface ActivityFeedItem {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  type: 'workout_finish' | 'level_up' | 'badge_earned' | 'challenge_join';
  title: string;
  description: string;
  timestamp: number;
  likes: number;
  likedByMe?: boolean;
}

export interface OnboardingProfile {
  gender: Gender;
  age: number;
  weight: number;
  height: number;
  targetWeight?: number;
  activityLevel: ActivityLevel;
  experience: ExperienceLevel;
  hasInjuries: boolean;
  injuries?: string;
  goals: {
    primary: Goal;
    secondary?: Goal;
  };
  daysPerWeek: number;
  preferredDays: number[]; // 0=Sun, 1=Mon, etc.
  location: Location;
  timePerWorkout: number;
  intensity: Intensity;
  lastWorkout?: LastWorkout;
  knownWeights?: KnownWeight[];
  isPro?: boolean; // New field for subscription status
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string; // e.g., "8-12" or "5"
  weight?: number; // Starting weight suggestion
  rest: number; // in seconds
  isWarmup?: boolean; // New: to distinguish warmup sets
  description?: string; // Short technical instruction
}

export interface WorkoutSession {
  name: string; // e.g., "Day 1 - Full Body A"
  exercises: Exercise[];
}

export interface ScheduleItem {
  day: string;
  workoutId: string;
  isCompleted: boolean;
}

export interface TrainingProgram {
  sessions: WorkoutSession[];
  schedule?: ScheduleItem[];
}

export interface CompletedSet {
  reps: number;
  weight: number;
  rir?: number;
}

export interface CompletedExercise extends Exercise {
  completedSets: CompletedSet[];
}

export enum WorkoutCompletion {
  Yes = "Все выполнил",
  Mostly = "Почти все",
  No = "Не совсем"
}

export interface WorkoutFeedback {
  completion: WorkoutCompletion;
  pain: {
    hasPain: boolean;
    location?: string;
    details?: string;
  };
  readiness?: ReadinessData; // Store how they felt before starting
}

export interface WorkoutLog {
  sessionId: string; // e.g., "Day 1 - Full Body A"
  date: string; // ISO string
  startTime?: number; // Timestamp when workout started
  duration?: number; // Duration in seconds
  feedback: WorkoutFeedback;
  completedExercises: CompletedExercise[];
}

export interface ActiveWorkoutState {
  session: WorkoutSession;
  completedExercises: CompletedExercise[];
  startTime: number;
  readiness: ReadinessData | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatResponse {
  text: string;
  updatedProgram?: TrainingProgram;
}

export interface PersonalRecord {
  exerciseName: string;
  e1rm: number;
  date: string;
}

// --- Readiness ---

export interface ReadinessData {
  sleep: number; // 1-5
  food: number; // 1-5
  stress: number; // 1-5 (1 is high stress, 5 is low stress)
  soreness: number; // 1-5 (1 is very sore, 5 is fresh)
  score: number; // Calculated total
  status: 'Green' | 'Yellow' | 'Red';
}
