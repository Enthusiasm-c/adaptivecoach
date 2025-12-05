// Service to handle Telegram Stars payments
import { apiService } from './apiService';

export const paymentService = {
    /**
     * Creates an invoice link for a specific item via backend API.
     * @param itemId The ID of the item to purchase (e.g., 'pro_monthly')
     * @returns A promise that resolves to the invoice URL
     */
    createInvoice: async (itemId: string): Promise<string> => {
        console.log(`[Payment] Creating invoice for ${itemId}`);

        try {
            const response = await apiService.payments.createInvoice(itemId);
            if (response.success && response.invoiceLink) {
                console.log(`[Payment] Invoice created successfully`);
                return response.invoiceLink;
            }
            throw new Error('Failed to create invoice');
        } catch (error) {
            console.error('[Payment] Error creating invoice:', error);
            throw error;
        }
    },

    /**
     * Checks the payment/subscription status from backend.
     * @returns Promise with isPro status and expiration date
     */
    checkPaymentStatus: async (): Promise<{ isPro: boolean; expiresAt: string | null }> => {
        try {
            const status = await apiService.payments.getStatus();
            return {
                isPro: status.isPro,
                expiresAt: status.expiresAt,
            };
        } catch (error) {
            console.error('[Payment] Error checking status:', error);
            return { isPro: false, expiresAt: null };
        }
    },

    /**
     * Validates user authentication and returns user data.
     * Should be called on app start.
     */
    validateAndGetUser: async () => {
        try {
            const response = await apiService.auth.validate();
            if (response.success) {
                return response.user;
            }
            return null;
        } catch (error) {
            console.error('[Payment] Auth validation error:', error);
            return null;
        }
    },
};
