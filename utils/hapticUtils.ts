
// Utility for Telegram Haptic Feedback
// Safely calls the Telegram WebApp API if available

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotificationType = 'error' | 'success' | 'warning';

export const hapticFeedback = {
    impactOccurred: (style: ImpactStyle) => {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
        } else {
            // Fallback for development/browser (optional logging)
            // console.log(`[Haptic] Impact: ${style}`);
        }
    },

    notificationOccurred: (type: NotificationType) => {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
        } else {
            // console.log(`[Haptic] Notification: ${type}`);
        }
    },

    selectionChanged: () => {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.selectionChanged();
        } else {
            // console.log(`[Haptic] Selection Changed`);
        }
    }
};
