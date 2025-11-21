
export enum Gender {
  Male = "Мужчина",
  Female = "Женщина",
}

export enum ExperienceLevel {
  Beginner = "Новичок (0-6 месяцев)",
  Intermediate = "Средний (6-24 месяцев)",
  Advanced = "Продвинутый (2+ года)",
}

export enum Goal {
  LoseFat = "Похудение",
  BuildMuscle = "Набор мышечной массы",
  GetStronger = "Увеличение силы",
  GeneralHealth = "Общее здоровье",
}

export enum Location {
  CommercialGym = "Фитнес-клуб",
  HomeGym = "Домашний зал (штанга/гантели)",
  Bodyweight = "Дома (минимум оборудования)",
}

export enum Intensity {
  Easy = "Легко для начала",
  Normal = "Нормально, люблю челлендж",
  Hard = "Тяжело, работаю на отказ",
}

export interface OnboardingProfile {
  gender: Gender;
  age: number;
  weight: number;
  height?: number;
  experience: ExperienceLevel;
  hasInjuries: boolean;
  injuries?: string;
  goals: {
    primary: Goal;
    secondary?: Goal;
  };
  daysPerWeek: number;
  location: Location;
  timePerWorkout: number;
  intensity: Intensity;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string; // e.g., "8-12" or "5"
  weight?: number; // Starting weight suggestion
  rest: number; // in seconds
  isWarmup?: boolean; // New: to distinguish warmup sets
}

export interface WorkoutSession {
  name: string; // e.g., "Day 1 - Full Body A"
  exercises: Exercise[];
}

export interface TrainingProgram {
  sessions: WorkoutSession[];
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
  Yes = "Да, полностью!",
  Mostly = "Почти все",
  No = "Нет, не совсем"
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
  feedback: WorkoutFeedback;
  completedExercises: CompletedExercise[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface PersonalRecord {
    exerciseName: string;
    e1rm: number;
    date: string;
}

// --- New Types for Readiness ---

export interface ReadinessData {
  sleep: number; // 1-5
  food: number; // 1-5
  stress: number; // 1-5 (1 is high stress, 5 is low stress)
  soreness: number; // 1-5 (1 is very sore, 5 is fresh)
  score: number; // Calculated total
  status: 'Green' | 'Yellow' | 'Red';
}