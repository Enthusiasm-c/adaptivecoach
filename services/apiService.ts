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
};

export default apiService;
