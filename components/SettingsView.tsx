
import React, { useState, useEffect } from 'react';
import { OnboardingProfile, TelegramUser, Goal, Location } from '../types';
import { Trash2, Save, User, LogOut, Target, Calendar, Clock, Award, Loader2, MessageCircle, MapPin, AlertTriangle, Activity, ExternalLink, Unlink } from 'lucide-react';
import { apiService, Badge } from '../services/apiService';

interface SettingsViewProps {
    profile: OnboardingProfile;
    telegramUser: TelegramUser | null;
    onUpdateProfile: (newProfile: OnboardingProfile) => void;
    onResetAccount: () => void;
}

const tierColors: Record<string, string> = {
    bronze: 'from-amber-700 to-amber-500',
    silver: 'from-gray-400 to-gray-200',
    gold: 'from-yellow-500 to-amber-300',
    diamond: 'from-cyan-400 to-blue-300',
};

const tierBgColors: Record<string, string> = {
    bronze: 'bg-amber-900/30 border-amber-700/50',
    silver: 'bg-gray-700/30 border-gray-500/50',
    gold: 'bg-yellow-900/30 border-yellow-600/50',
    diamond: 'bg-cyan-900/30 border-cyan-500/50',
};

const SettingsView: React.FC<SettingsViewProps> = ({ profile, telegramUser, onUpdateProfile, onResetAccount }) => {
    const [weight, setWeight] = useState(profile.weight);
    const [daysPerWeek, setDaysPerWeek] = useState(profile.daysPerWeek);
    const [timePerWorkout, setTimePerWorkout] = useState(profile.timePerWorkout);
    const [primaryGoal, setPrimaryGoal] = useState(profile.goals.primary);
    const [selectedLocation, setSelectedLocation] = useState<Location>(profile.location);
    const [pendingLocation, setPendingLocation] = useState<Location | null>(null);
    const [isChangingLocation, setIsChangingLocation] = useState(false);

    const [isConfirmingReset, setIsConfirmingReset] = useState(false);

    // Badges state
    const [allBadges, setAllBadges] = useState<Badge[]>([]);
    const [myBadges, setMyBadges] = useState<Badge[]>([]);
    const [loadingBadges, setLoadingBadges] = useState(true);

    // WHOOP state
    const [whoopConnected, setWhoopConnected] = useState(false);
    const [whoopLoading, setWhoopLoading] = useState(true);
    const [whoopConnecting, setWhoopConnecting] = useState(false);

    // Load WHOOP status
    useEffect(() => {
        const loadWhoopStatus = async () => {
            try {
                const status = await apiService.whoop.getStatus();
                setWhoopConnected(status.connected);
            } catch (e) {
                console.error('Failed to load WHOOP status:', e);
            } finally {
                setWhoopLoading(false);
            }
        };
        loadWhoopStatus();

        // Also check on window focus (user returning from WHOOP OAuth)
        const handleFocus = () => {
            loadWhoopStatus();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    // Connect WHOOP
    const handleConnectWhoop = async () => {
        setWhoopConnecting(true);
        try {
            const { authUrl } = await apiService.whoop.getAuthUrl();
            // Open WHOOP OAuth in browser
            if (window.Telegram?.WebApp?.openLink) {
                window.Telegram.WebApp.openLink(authUrl);
            } else {
                window.open(authUrl, '_blank');
            }
        } catch (e) {
            console.error('Failed to start WHOOP auth:', e);
        } finally {
            setWhoopConnecting(false);
        }
    };

    // Disconnect WHOOP
    const handleDisconnectWhoop = async () => {
        try {
            await apiService.whoop.disconnect();
            setWhoopConnected(false);
        } catch (e) {
            console.error('Failed to disconnect WHOOP:', e);
        }
    };

    useEffect(() => {
        const loadBadges = async () => {
            try {
                const userId = telegramUser?.id;
                const [allBadgesRes, myBadgesRes] = await Promise.all([
                    apiService.badges.getAll(),
                    userId ? apiService.badges.getUserBadges(userId) : Promise.resolve({ badges: [] })
                ]);
                setAllBadges(allBadgesRes.badges || []);
                setMyBadges(myBadgesRes.badges || []);
            } catch (e) {
                console.error('Failed to load badges:', e);
            } finally {
                setLoadingBadges(false);
            }
        };
        loadBadges();
    }, [telegramUser]);

    const handleSave = () => {
        const locationChanged = selectedLocation !== profile.location;

        onUpdateProfile({
            ...profile,
            weight,
            daysPerWeek,
            timePerWorkout,
            location: selectedLocation,
            goals: { ...profile.goals, primary: primaryGoal }
        });

        if (locationChanged) {
            setIsChangingLocation(true);
            // The parent component (App.tsx) will handle program adaptation
            // and reset this state via profile update
            setTimeout(() => setIsChangingLocation(false), 3000);
        }
    };

    // Helper for "WHOOP-style" section headers
    const SectionHeader = ({ title, icon: Icon }: { title: string, icon?: any }) => (
        <h2 className="text-gray-400 font-display uppercase tracking-widest text-xs font-bold mb-3 mt-8 flex items-center gap-2 px-1">
            {Icon && <Icon size={14} className="text-white/40" />}
            {title}
        </h2>
    );

    // Helper for "WHOOP-style" rows
    const SettingRow = ({ label, value, children, className = '' }: { label: string, value?: React.ReactNode, children?: React.ReactNode, className?: string }) => (
        <div className={`bg-surface border-b border-subtle last:border-0 p-4 flex items-center justify-between ${className}`}>
            <span className="text-gray-200 font-bold text-sm">{label}</span>
            <div className="flex items-center gap-2">
                {value && <span className="font-display text-white text-lg tracking-wide uppercase">{value}</span>}
                {children}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background text-white p-4 pt-[max(1rem,env(safe-area-inset-top))] animate-fade-in max-w-lg mx-auto pb-32">
            <header className="flex items-center justify-between mb-8 px-2">
                <h1 className="text-3xl font-display font-bold uppercase tracking-tighter">Profile</h1>
                {/* Save Button in Header for easier access */}
                <button
                    onClick={handleSave}
                    disabled={isChangingLocation}
                    className="bg-white text-black font-display font-bold uppercase text-xs tracking-widest px-4 py-2 rounded-full hover:bg-gray-200 transition disabled:opacity-50"
                >
                    {isChangingLocation ? <Loader2 size={14} className="animate-spin" /> : 'SAVE'}
                </button>
            </header>

            <div className="animate-slide-up space-y-2">
                {/* Athlete Card */}
                <div className="bg-surface border border-subtle rounded-xl overflow-hidden mb-6">
                    <div className="p-6 flex items-center gap-5">
                        <div className="relative">
                            {telegramUser?.photo_url ? (
                                <img src={telegramUser.photo_url} alt="Profile" className="w-20 h-20 rounded-full border-2 border-white/10 grayscale md:grayscale-0" />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-subtle flex items-center justify-center text-white/50">
                                    <User size={32} />
                                </div>
                            )}
                            {whoopConnected && (
                                <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-1 border border-subtle">
                                    <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
                                </div>
                            )}
                        </div>
                        <div>
                            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-tight">
                                {telegramUser ? `${telegramUser.first_name} ${telegramUser.last_name || ''}` : 'ATHLETE'}
                            </h2>
                            <p className="text-primary font-display font-bold text-xs tracking-widest uppercase mt-1">
                                {telegramUser?.username ? `@${telegramUser.username}` : 'MEMBER'}
                            </p>
                        </div>
                    </div>
                </div>

                <SectionHeader title="Body Metrics" />
                <div className="bg-surface border border-subtle rounded-xl overflow-hidden">
                    <div className="p-4 flex items-center justify-between">
                        <span className="text-gray-200 font-bold text-sm">Weight</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={weight}
                                onChange={(e) => setWeight(parseFloat(e.target.value))}
                                className="bg-transparent text-right font-display text-2xl font-bold text-white w-20 outline-none focus:text-primary transition-colors"
                            />
                            <span className="text-gray-500 font-display text-sm font-bold pt-2">KG</span>
                        </div>
                    </div>
                </div>

                <SectionHeader title="Training Schedule" />
                <div className="bg-surface border border-subtle rounded-xl overflow-hidden divide-y divide-subtle">
                    {/* Days Picker as a simplified segmented control */}
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-gray-200 font-bold text-sm">Days / Week</span>
                        </div>
                        <div className="flex bg-black/50 p-1 rounded-lg">
                            {[2, 3, 4, 5, 6].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDaysPerWeek(d)}
                                    className={`flex-1 py-3 rounded-md font-display font-bold text-lg transition-all ${
                                        daysPerWeek === d
                                        ? 'bg-subtle text-white shadow-sm border border-white/5'
                                        : 'text-gray-600 hover:text-gray-400'
                                    }`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Time Picker */}
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-gray-200 font-bold text-sm">Duration (Min)</span>
                        </div>
                        <div className="flex bg-black/50 p-1 rounded-lg">
                            {[30, 45, 60, 75].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTimePerWorkout(t)}
                                    className={`flex-1 py-3 rounded-md font-display font-bold text-lg transition-all ${
                                        timePerWorkout === t
                                        ? 'bg-subtle text-white shadow-sm border border-white/5'
                                        : 'text-gray-600 hover:text-gray-400'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <SectionHeader title="Goals & Location" />
                <div className="bg-surface border border-subtle rounded-xl overflow-hidden divide-y divide-subtle">
                    {/* Goal Selector */}
                    <div className="p-1">
                        {Object.values(Goal).map(g => (
                            <button
                                key={g}
                                onClick={() => setPrimaryGoal(g)}
                                className={`w-full flex items-center justify-between p-4 transition-colors ${primaryGoal === g ? 'bg-white/5' : 'hover:bg-white/5'}`}
                            >
                                <span className={`font-bold text-sm ${primaryGoal === g ? 'text-white' : 'text-gray-400'}`}>{g}</span>
                                {primaryGoal === g && <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(233,61,61,0.8)]" />}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="mt-2 bg-surface border border-subtle rounded-xl overflow-hidden divide-y divide-subtle">
                     {/* Location Selector */}
                     <div className="p-1">
                        {Object.values(Location).map(loc => (
                            <button
                                key={loc}
                                onClick={() => {
                                    if (loc !== selectedLocation) setPendingLocation(loc);
                                }}
                                className={`w-full flex items-center justify-between p-4 transition-colors ${selectedLocation === loc ? 'bg-white/5' : 'hover:bg-white/5'}`}
                            >
                                <span className={`font-bold text-sm ${selectedLocation === loc ? 'text-white' : 'text-gray-400'}`}>{loc}</span>
                                {selectedLocation === loc && <MapPin size={14} className="text-primary" />}
                            </button>
                        ))}
                    </div>
                </div>
                {selectedLocation !== profile.location && (
                     <div className="mt-2 text-center">
                        <span className="text-primary font-display uppercase tracking-widest text-xs font-bold animate-pulse">
                            Needs Adaptation
                        </span>
                     </div>
                )}


                {/* WHOOP Integration - Redesigned */}
                <SectionHeader title="Devices" />
                <div className="bg-surface border border-subtle rounded-xl overflow-hidden p-6 relative">
                    <div className="flex items-start justify-between">
                        <div>
                             {/* Official Whoop Logo (Simulated via SVG) */}
                            <svg viewBox="0 0 100 34" className="h-6 w-auto fill-white mb-2" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12.9 0L7.1 19.6L3.9 9.5H0L5.3 26.2H8.8L14.7 6.4L20.6 26.2H24.1L29.4 9.5H25.4L22.2 19.6L16.4 0H12.9Z" />
                                <path d="M37.3 0H33.8V26.2H37.3V14.8H43.9V26.2H47.4V0H37.3ZM43.9 11.5H37.3V3.3H43.9V11.5Z" />
                                <path d="M64.6 13.1C64.6 20.3 58.7 26.2 51.5 26.2C44.3 26.2 38.4 20.3 38.4 13.1C38.4 5.9 44.3 0 51.5 0C58.7 0 64.6 5.9 64.6 13.1ZM61.1 13.1C61.1 7.8 56.8 3.5 51.5 3.5C46.2 3.5 41.9 7.8 41.9 13.1C41.9 18.4 46.2 22.7 51.5 22.7C56.8 22.7 61.1 18.4 61.1 13.1Z" />
                                <path d="M80.8 13.1C80.8 20.3 74.9 26.2 67.7 26.2C60.5 26.2 54.6 20.3 54.6 13.1C54.6 5.9 60.5 0 67.7 0C74.9 0 80.8 5.9 80.8 13.1ZM77.3 13.1C77.3 7.8 73 3.5 67.7 3.5C62.4 3.5 58.1 7.8 58.1 13.1C58.1 18.4 62.4 22.7 67.7 22.7C73 22.7 77.3 18.4 77.3 13.1Z" />
                                <path d="M85.4 0H81.9V26.2H85.4V16.7H91.1C96 16.7 100 12.8 100 8.3C100 3.7 96 0 91.1 0H85.4ZM91.1 13.3H85.4V3.4H91.1C93.9 3.4 96.3 5.7 96.3 8.3C96.3 11 93.9 13.3 91.1 13.3Z" />
                            </svg>
                            <p className="text-gray-500 text-xs font-bold leading-relaxed max-w-[200px]">
                                {whoopConnected 
                                    ? "Data is syncing automatically throughout your recovery cycle."
                                    : "Connect your Whoop strap to sync Recovery, Strain, and Sleep metrics automatically."
                                }
                            </p>
                        </div>
                        <div className={`w-3 h-3 rounded-full mt-2 ${whoopConnected ? 'bg-success shadow-[0_0_10px_rgba(76,199,109,0.5)]' : 'bg-gray-700'}`} />
                    </div>
                    
                    <button
                        onClick={whoopConnected ? handleDisconnectWhoop : handleConnectWhoop}
                        disabled={whoopConnecting}
                        className={`mt-6 w-full py-3 rounded-lg font-display font-bold uppercase tracking-widest text-sm transition-all ${
                            whoopConnected 
                            ? 'bg-red-900/20 text-red-500 border border-red-500/30 hover:bg-red-900/30' 
                            : 'bg-white text-black hover:bg-gray-200'
                        }`}
                    >
                        {whoopConnecting ? (
                            <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={14}/> CONNECTING</span>
                        ) : whoopConnected ? (
                            'DISCONNECT'
                        ) : (
                            'CONNECT STRAP'
                        )}
                    </button>
                </div>

                {/* Account Actions */}
                <div className="pt-8">
                    {!isConfirmingReset ? (
                        <button 
                            onClick={() => setIsConfirmingReset(true)}
                            className="w-full py-3 flex items-center justify-center gap-2 text-gray-600 font-bold hover:text-red-500 transition text-xs uppercase tracking-widest"
                        >
                            Reset Account Data
                        </button>
                    ) : (
                        <div className="bg-red-900/10 border border-red-900/50 rounded-xl p-4 text-center space-y-4 animate-scale-in">
                            <p className="text-red-300 font-display font-bold uppercase tracking-wide">Danger Zone</p>
                            <p className="text-red-200/70 text-xs">This will permanently delete all your training data.</p>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsConfirmingReset(false)}
                                    className="flex-1 py-3 bg-surface text-gray-400 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-subtle"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={onResetAccount}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-red-500"
                                >
                                    Confirm Delete
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Location Change Confirmation Modal */}
            {pendingLocation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
                    <div className="bg-surface border border-subtle rounded-3xl p-8 max-w-sm w-full animate-scale-in">
                        <div className="text-center mb-6">
                            <MapPin size={48} className="text-primary mx-auto mb-4" />
                            <h3 className="text-2xl font-display font-bold text-white uppercase tracking-tight">Change Location?</h3>
                            <p className="text-gray-400 text-sm mt-2">Your entire program will be adapted.</p>
                        </div>

                        <div className="bg-black rounded-xl p-4 mb-8 text-center border border-white/5">
                            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">New Location</p>
                            <p className="text-white font-display text-3xl font-bold uppercase">{pendingLocation}</p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setSelectedLocation(pendingLocation);
                                    setPendingLocation(null);
                                }}
                                className="w-full py-4 bg-white text-black rounded-xl font-display font-bold uppercase tracking-widest text-lg hover:bg-gray-200 transition"
                            >
                                Confirm
                            </button>
                            <button
                                onClick={() => setPendingLocation(null)}
                                className="w-full py-4 text-gray-500 font-bold uppercase tracking-widest text-xs hover:text-white transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsView;
