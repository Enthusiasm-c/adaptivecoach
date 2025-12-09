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
  // Track page duration
  const lastPageRef = useRef<string | null>(null);
  const lastPageTimeRef = useRef<number | null>(null);

  // Track page view with duration tracking
  const trackPageView = useCallback((page: string) => {
    // Send duration of previous page before tracking new one
    if (lastPageRef.current && lastPageTimeRef.current) {
      const durationMs = Date.now() - lastPageTimeRef.current;
      apiService.analytics.track('page_duration', {
        page: lastPageRef.current,
        duration_ms: durationMs,
        sessionToken: sessionTokenRef.current,
      }).catch(() => {});
    }

    // Remember new page and time
    lastPageRef.current = page;
    lastPageTimeRef.current = Date.now();

    // Standard page_view event
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

    // Cleanup on unmount - end session and track exit page
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Track exit page and final page duration
      if (lastPageRef.current && lastPageTimeRef.current) {
        const durationMs = Date.now() - lastPageTimeRef.current;
        apiService.analytics.track('page_duration', {
          page: lastPageRef.current,
          duration_ms: durationMs,
          sessionToken: sessionTokenRef.current,
        }).catch(() => {});

        apiService.analytics.track('session_exit', {
          exitPage: lastPageRef.current,
          sessionToken: sessionTokenRef.current,
        }).catch(() => {});
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
