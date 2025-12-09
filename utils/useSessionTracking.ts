import { useEffect, useRef, useCallback } from 'react';
import { apiService } from '../services/apiService';

// Generate a unique session token
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Get device info from Telegram WebApp
function getDeviceInfo(): Record<string, unknown> {
  const tg = window.Telegram?.WebApp;
  return {
    platform: tg?.platform || 'unknown',
    version: tg?.version || 'unknown',
    colorScheme: tg?.colorScheme || 'unknown',
    viewportHeight: tg?.viewportHeight || window.innerHeight,
    viewportWidth: window.innerWidth,
    userAgent: navigator.userAgent,
  };
}

export function useSessionTracking() {
  const sessionTokenRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track page view
  const trackPageView = useCallback((page: string) => {
    apiService.analytics.track('page_view', {
      page,
      sessionToken: sessionTokenRef.current,
    }).catch(() => {});
  }, []);

  // Track feature usage
  const trackFeature = useCallback((feature: string, metadata?: Record<string, unknown>) => {
    apiService.analytics.track('feature_used', {
      feature,
      sessionToken: sessionTokenRef.current,
      ...metadata,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // Generate session token
    sessionTokenRef.current = generateSessionToken();
    const deviceInfo = getDeviceInfo();

    // Track session start
    apiService.analytics.trackSession(sessionTokenRef.current, 'start', deviceInfo).catch(() => {});

    // Track app opened event
    apiService.analytics.track('app_opened', {
      sessionToken: sessionTokenRef.current,
      ...deviceInfo,
    }).catch(() => {});

    // Set up heartbeat every 30 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      if (sessionTokenRef.current) {
        apiService.analytics.trackSession(sessionTokenRef.current, 'heartbeat').catch(() => {});
      }
    }, 30000);

    // Cleanup on unmount - end session
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (sessionTokenRef.current) {
        apiService.analytics.trackSession(sessionTokenRef.current, 'end').catch(() => {});
      }
    };
  }, []);

  return {
    trackPageView,
    trackFeature,
    sessionToken: sessionTokenRef.current,
  };
}
