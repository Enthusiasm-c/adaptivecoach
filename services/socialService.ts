import { FriendProfile, ActivityFeedItem } from '../types';

const STORAGE_KEY_FRIENDS = 'sensei_training_friends';
const STORAGE_KEY_FEED = 'sensei_training_feed';

// Mock Database of Users
const MOCK_USERS: FriendProfile[] = [
    {
        id: 'alex_fit',
        name: 'Alex Fitness',
        level: 12,
        streak: 45,
        totalVolume: 125000,
        lastActive: new Date().toISOString(),
        isOnline: true
    },
    {
        id: 'kate_strong',
        name: 'Kate Power',
        level: 8,
        streak: 12,
        totalVolume: 85000,
        lastActive: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        isOnline: false
    },
    {
        id: 'mike_gym',
        name: 'Mike Gym',
        level: 20,
        streak: 100,
        totalVolume: 500000,
        lastActive: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        isOnline: false
    }
];

// Mock Feed Generator
const generateMockFeed = (friends: FriendProfile[]): ActivityFeedItem[] => {
    const feed: ActivityFeedItem[] = [];
    const now = Date.now();

    friends.forEach(friend => {
        // Randomly generate an activity
        if (Math.random() > 0.3) {
            feed.push({
                id: `feed_${friend.id}_1`,
                userId: friend.id,
                userName: friend.name,
                type: 'workout_finish',
                title: 'Закончил тренировку "Push Day"',
                description: `Поднял ${Math.floor(Math.random() * 10000 + 5000)} кг! 🔥`,
                timestamp: now - Math.floor(Math.random() * 86400000), // Within last 24h
                likes: Math.floor(Math.random() * 20),
                likedByMe: false
            });
        }
        if (Math.random() > 0.7) {
            feed.push({
                id: `feed_${friend.id}_2`,
                userId: friend.id,
                userName: friend.name,
                type: 'level_up',
                title: `Достиг уровня ${friend.level}!`,
                description: 'Новый ранг: Машина 🤖',
                timestamp: now - Math.floor(Math.random() * 172800000), // Within last 48h
                likes: Math.floor(Math.random() * 50),
                likedByMe: false
            });
        }
    });

    return feed.sort((a, b) => b.timestamp - a.timestamp);
};

export const socialService = {
    // Get current friends list
    getSquad: async (): Promise<FriendProfile[]> => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const stored = localStorage.getItem(STORAGE_KEY_FRIENDS);
        if (stored) {
            return JSON.parse(stored);
        }
        return [];
    },

    // Search for a user by ID (Mock)
    searchUser: async (query: string): Promise<FriendProfile | null> => {
        await new Promise(resolve => setTimeout(resolve, 800));

        // 1. Check hardcoded mock users
        const user = MOCK_USERS.find(u => u.id.toLowerCase() === query.toLowerCase() || u.name.toLowerCase().includes(query.toLowerCase()));
        if (user) return user;

        // 2. If not found, GENERATE a mock user (Simulating finding a real user in DB)
        // Only if query looks like a username (length > 3)
        if (query.length > 3) {
            return {
                id: query.toLowerCase().replace(/\s/g, '_'),
                name: query, // Use query as name for simplicity
                level: Math.floor(Math.random() * 10) + 1,
                streak: Math.floor(Math.random() * 20),
                totalVolume: Math.floor(Math.random() * 100000),
                lastActive: new Date().toISOString(),
                isOnline: Math.random() > 0.5
            };
        }

        return null;
    },

    // Add a friend
    addFriend: async (friend: FriendProfile): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 500));

        const stored = localStorage.getItem(STORAGE_KEY_FRIENDS);
        let friends: FriendProfile[] = stored ? JSON.parse(stored) : [];

        // Check if already exists
        if (!friends.some(f => f.id === friend.id)) {
            friends.push(friend);
            localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(friends));
        }
    },

    // Get activity feed
    getFeed: async (): Promise<ActivityFeedItem[]> => {
        await new Promise(resolve => setTimeout(resolve, 600));

        const storedFriends = localStorage.getItem(STORAGE_KEY_FRIENDS);
        const friends: FriendProfile[] = storedFriends ? JSON.parse(storedFriends) : [];

        // In a real app, we'd fetch from backend. Here we generate mock data based on friends.
        // We merge it with any "local" feed items if we had them (e.g. user's own activities)
        return generateMockFeed(friends);
    },

    // Nudge a friend
    nudgeFriend: async (friendId: string): Promise<boolean> => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return true; // Always success in mock
    },

    // Remove a friend
    removeFriend: async (friendId: string): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 500));

        const stored = localStorage.getItem(STORAGE_KEY_FRIENDS);
        if (stored) {
            let friends: FriendProfile[] = JSON.parse(stored);
            friends = friends.filter(f => f.id !== friendId);
            localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(friends));
        }
    }
};
