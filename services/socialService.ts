import { FriendProfile, ActivityFeedItem, FriendRequest } from '../types';

const API_BASE = 'https://api.sensei.training';

function getInitData(): string {
    return window.Telegram?.WebApp?.initData || '';
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    const initData = getInitData();
    if (initData) {
        headers['X-Telegram-Init-Data'] = initData;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return response.json();
}

export const socialService = {
    // Search users by username
    searchUser: async (query: string): Promise<FriendProfile[]> => {
        if (!query || query.length < 2) return [];
        try {
            const { users } = await apiRequest<{ users: FriendProfile[] }>(
                `/api/social/search?q=${encodeURIComponent(query)}`
            );
            return users;
        } catch (e) {
            console.error('Search error:', e);
            return [];
        }
    },

    // Send friend request
    sendFriendRequest: async (addresseeId: number): Promise<void> => {
        await apiRequest('/api/social/friends/request', {
            method: 'POST',
            body: JSON.stringify({ addresseeId })
        });
    },

    // Get incoming friend requests
    getFriendRequests: async (): Promise<FriendRequest[]> => {
        try {
            const { requests } = await apiRequest<{ requests: FriendRequest[] }>(
                '/api/social/friends/requests'
            );
            return requests;
        } catch (e) {
            console.error('Get requests error:', e);
            return [];
        }
    },

    // Respond to friend request
    respondToRequest: async (friendshipId: number, accept: boolean): Promise<void> => {
        await apiRequest('/api/social/friends/respond', {
            method: 'POST',
            body: JSON.stringify({ friendshipId, accept })
        });
    },

    // Get friends list
    getSquad: async (): Promise<FriendProfile[]> => {
        try {
            const { friends } = await apiRequest<{ friends: FriendProfile[] }>(
                '/api/social/friends'
            );
            return friends;
        } catch (e) {
            console.error('Get squad error:', e);
            return [];
        }
    },

    // Remove friend
    removeFriend: async (friendId: number): Promise<void> => {
        await apiRequest(`/api/social/friends/${friendId}`, { method: 'DELETE' });
    },

    // Get activity feed
    getFeed: async (): Promise<ActivityFeedItem[]> => {
        try {
            const { feed } = await apiRequest<{ feed: ActivityFeedItem[] }>(
                '/api/social/feed'
            );
            return feed;
        } catch (e) {
            console.error('Get feed error:', e);
            return [];
        }
    },

    // Nudge friend
    nudgeFriend: async (friendId: number): Promise<boolean> => {
        try {
            await apiRequest('/api/social/nudge', {
                method: 'POST',
                body: JSON.stringify({ friendId })
            });
            return true;
        } catch (e) {
            console.error('Nudge error:', e);
            return false;
        }
    }
};
