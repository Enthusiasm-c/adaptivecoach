// API Service for communicating with backend

const API_BASE_URL = 'https://api.sensei.training';

function getInitData(): string {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData;
  }
  return '';
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const initData = getInitData();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export interface AuthUser {
  id: number;
  telegramId: number;
  firstName: string;
  isPro: boolean;
  proExpiresAt: string | null;
}

export interface AuthResponse {
  success: boolean;
  user: AuthUser;
}

export interface PaymentStatusResponse {
  isPro: boolean;
  expiresAt: string | null;
}

export interface CreateInvoiceResponse {
  success: boolean;
  invoiceLink: string;
}

// Workout types
export interface WorkoutSyncRequest {
  sessionId: string;
  date: string;
  startTime?: string;
  duration?: number;
  completedExercises: any[];
  feedback?: any;
}

export interface WorkoutSyncResponse {
  success: boolean;
  totalVolume: number;
  newBadges: Badge[];
}

export interface WorkoutLog {
  id: number;
  session_id: string;
  workout_date: string;
  duration: number;
  total_volume: number;
  exercises_data: any;
  feedback_data: any;
  finished_at: string;
}

// Badge types
export interface Badge {
  id: number;
  code: string;
  name_ru: string;
  name_en: string;
  description_ru: string;
  description_en: string;
  icon: string;
  category: string;
  tier: string;
  threshold: number;
  earned: boolean;
  earned_at?: string;
}

// Kudos types
export interface KudosResponse {
  success: boolean;
  kudosCount: number;
}

// Challenge types
export interface Challenge {
  id: number;
  creator_id: number;
  creator_name: string;
  title: string;
  description: string;
  challenge_type: string;
  target_value: number;
  start_date: string;
  end_date: string;
  status: string;
  participants: ChallengeParticipant[];
  my_value?: number;
}

export interface ChallengeParticipant {
  user_id: number;
  first_name: string;
  username: string;
  current_value: number;
}

export interface CreateChallengeRequest {
  title: string;
  description?: string;
  challengeType: string;
  targetValue?: number;
  startDate: string;
  endDate: string;
  invitedUserIds: number[];
}

// Enhanced profile types
export interface EnhancedUserProfile {
  user: {
    id: number;
    first_name: string;
    username: string;
    total_volume: number;
    streak_days: number;
    level: number;
  };
  badges: Badge[];
  recentWorkouts: WorkoutLog[];
  workoutCount: number;
}

export const apiService = {
  // Auth endpoints
  auth: {
    validate: async (): Promise<AuthResponse> => {
      const initData = getInitData();
      return apiRequest<AuthResponse>('/api/auth/validate', {
        method: 'POST',
        body: JSON.stringify({ initData }),
      });
    },

    getMe: async (): Promise<AuthUser> => {
      return apiRequest<AuthUser>('/api/auth/me');
    },
  },

  // Payment endpoints
  payments: {
    createInvoice: async (itemId: string): Promise<CreateInvoiceResponse> => {
      return apiRequest<CreateInvoiceResponse>('/api/payments/create-invoice', {
        method: 'POST',
        body: JSON.stringify({ itemId }),
      });
    },

    getStatus: async (): Promise<PaymentStatusResponse> => {
      return apiRequest<PaymentStatusResponse>('/api/payments/status');
    },
  },

  // Workout endpoints
  workouts: {
    sync: async (data: WorkoutSyncRequest): Promise<WorkoutSyncResponse> => {
      return apiRequest<WorkoutSyncResponse>('/api/workouts/sync', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getHistory: async (): Promise<{ workouts: WorkoutLog[] }> => {
      return apiRequest<{ workouts: WorkoutLog[] }>('/api/workouts');
    },
  },

  // Badge endpoints
  badges: {
    getAll: async (): Promise<{ badges: Badge[] }> => {
      return apiRequest<{ badges: Badge[] }>('/api/social/badges');
    },

    getUserBadges: async (userId: number): Promise<{ badges: Badge[] }> => {
      return apiRequest<{ badges: Badge[] }>(`/api/social/users/${userId}/badges`);
    },
  },

  // Kudos endpoints
  kudos: {
    give: async (workoutLogId: number): Promise<KudosResponse> => {
      return apiRequest<KudosResponse>('/api/social/kudos', {
        method: 'POST',
        body: JSON.stringify({ workoutLogId }),
      });
    },

    remove: async (workoutLogId: number): Promise<KudosResponse> => {
      return apiRequest<KudosResponse>(`/api/social/kudos/${workoutLogId}`, {
        method: 'DELETE',
      });
    },
  },

  // Challenge endpoints
  challenges: {
    create: async (data: CreateChallengeRequest): Promise<{ success: boolean; challenge: Challenge }> => {
      return apiRequest('/api/social/challenges', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getAll: async (): Promise<{ challenges: Challenge[] }> => {
      return apiRequest<{ challenges: Challenge[] }>('/api/social/challenges');
    },
  },

  // Enhanced profile
  social: {
    getUserProfile: async (userId: number): Promise<EnhancedUserProfile> => {
      return apiRequest<EnhancedUserProfile>(`/api/social/users/${userId}/profile`);
    },
  },
};

export default apiService;
