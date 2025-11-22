
export enum Gender {
  Male = "Мужчина",
  Female = "Женщина",
}

export enum ExperienceLevel {
  Beginner = "Новичок (0-6 месяцев)",
  Intermediate = "Любитель (6-24 месяцев)",
  Advanced = "Атлет (2+ года)",
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
  feedback: WorkoutFeedback;
  completedExercises: CompletedExercise[];
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

// --- New Types for Readiness ---

export interface ReadinessData {
  sleep: number; // 1-5
  food: number; // 1-5
  stress: number; // 1-5 (1 is high stress, 5 is low stress)
  soreness: number; // 1-5 (1 is very sore, 5 is fresh)
  score: number; // Calculated total
  status: 'Green' | 'Yellow' | 'Red';
}
