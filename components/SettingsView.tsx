
import React, { useState, useEffect } from 'react';
import { OnboardingProfile, TelegramUser, Goal } from '../types';
import { Trash2, Save, User, LogOut, Target, Calendar, Clock, Star, Check, Award, Loader2, MessageCircle, Bell, BellOff } from 'lucide-react';
import { apiService, Badge, NotificationSettings } from '../services/apiService';

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
    const [age, setAge] = useState(profile.age);
    const [daysPerWeek, setDaysPerWeek] = useState(profile.daysPerWeek);
    const [timePerWorkout, setTimePerWorkout] = useState(profile.timePerWorkout);
    const [primaryGoal, setPrimaryGoal] = useState(profile.goals.primary);

    const [activeTab, setActiveTab] = useState<'profile' | 'subscription'>('profile');

    const [isConfirmingReset, setIsConfirmingReset] = useState(false);

    // Badges state
    const [allBadges, setAllBadges] = useState<Badge[]>([]);
    const [myBadges, setMyBadges] = useState<Badge[]>([]);
    const [loadingBadges, setLoadingBadges] = useState(true);

    // Notification settings state
    const [notifEnabled, setNotifEnabled] = useState(true);
    const [notifDays, setNotifDays] = useState<number[]>([1, 3, 5]);
    const [notifSaving, setNotifSaving] = useState(false);

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

    // Load notification settings
    useEffect(() => {
        const loadNotifSettings = async () => {
            try {
                const settings = await apiService.notifications.getSettings();
                setNotifEnabled(settings.reminder_enabled);
                setNotifDays(settings.preferred_days || [1, 3, 5]);
            } catch (e) {
                console.error('Failed to load notification settings:', e);
            }
        };
        loadNotifSettings();
    }, []);

    // Sync preferredDays from profile on mount
    useEffect(() => {
        if (profile.preferredDays && profile.preferredDays.length > 0) {
            setNotifDays(profile.preferredDays);
        }
    }, [profile.preferredDays]);

    const handleNotifToggle = async () => {
        const newEnabled = !notifEnabled;
        setNotifEnabled(newEnabled);
        setNotifSaving(true);
        try {
            await apiService.notifications.saveSettings({
                preferredDays: notifDays,
                enabled: newEnabled,
            });
        } catch (e) {
            console.error('Failed to save notification settings:', e);
            setNotifEnabled(!newEnabled); // revert on error
        } finally {
            setNotifSaving(false);
        }
    };

    const handleNotifDaysChange = async (day: number) => {
        const newDays = notifDays.includes(day)
            ? notifDays.filter(d => d !== day)
            : [...notifDays, day].sort();
        setNotifDays(newDays);
        setNotifSaving(true);
        try {
            await apiService.notifications.saveSettings({
                preferredDays: newDays,
                enabled: notifEnabled,
            });
        } catch (e) {
            console.error('Failed to save notification days:', e);
        } finally {
            setNotifSaving(false);
        }
    };

    const handleSave = () => {
        onUpdateProfile({
            ...profile,
            weight,
            age,
            daysPerWeek,
            timePerWorkout,
            goals: { ...profile.goals, primary: primaryGoal }
        });
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-4 pt-[max(1rem,env(safe-area-inset-top))] animate-fade-in max-w-lg mx-auto pb-32">
            <header className="flex items-center justify-between mb-6 px-2">
                <h1 className="text-2xl font-bold">Настройки</h1>
            </header>

            {/* Tab Switcher */}
            <div className="flex p-1 bg-neutral-900 rounded-2xl mb-6 border border-white/5">
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'profile' ? 'bg-neutral-800 text-white shadow-lg' : 'text-gray-500'}`}
                >
                    <User size={16} /> Профиль
                </button>
                <button
                    onClick={() => setActiveTab('subscription')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'subscription' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500'}`}
                >
                    <Star size={16} /> Pro
                </button>
            </div>

            {/* Profile Content */}
            {activeTab === 'profile' && (
                <div className="space-y-8 animate-slide-up">
                    {/* Profile Card */}
                    <div className="bg-neutral-900 border border-white/5 rounded-3xl p-6 flex items-center gap-5">
                        {telegramUser?.photo_url ? (
                            <img src={telegramUser.photo_url} alt="Profile" className="w-16 h-16 rounded-full border-2 border-indigo-500" />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                                <User size={32} />
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {telegramUser ? `${telegramUser.first_name} ${telegramUser.last_name || ''}` : 'Пользователь'}
                            </h2>
                            <p className="text-gray-400 text-sm">
                                {telegramUser?.username ? `@${telegramUser.username}` : 'Спортсмен'}
                            </p>
                        </div>
                    </div>

                    {/* Edit Section */}
                    <section className="space-y-6">
                        <h2 className="text-lg font-bold text-gray-300 px-2">Параметры тела</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-neutral-900 rounded-2xl p-4 border border-white/5">
                                <label className="block text-xs text-gray-500 font-bold uppercase mb-2">Вес (кг)</label>
                                <input 
                                    type="number" 
                                    value={weight} 
                                    onChange={(e) => setWeight(parseFloat(e.target.value))} 
                                    className="w-full bg-neutral-800 border border-white/10 rounded-xl p-3 text-xl font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-center"
                                />
                            </div>
                            <div className="bg-neutral-900 rounded-2xl p-4 border border-white/5">
                                <label className="block text-xs text-gray-500 font-bold uppercase mb-2">Возраст</label>
                                <input 
                                    type="number" 
                                    value={age} 
                                    onChange={(e) => setAge(parseInt(e.target.value))} 
                                    className="w-full bg-neutral-800 border border-white/10 rounded-xl p-3 text-xl font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-center"
                                />
                            </div>
                        </div>

                        <h2 className="text-lg font-bold text-gray-300 px-2 pt-4">Режим тренировок</h2>
                        
                        {/* Days Per Week */}
                        <div className="bg-neutral-900 rounded-2xl p-4 border border-white/5">
                            <div className="flex items-center gap-2 mb-3">
                                <Calendar size={16} className="text-indigo-400"/>
                                <label className="text-sm font-bold text-gray-300">Дней в неделю</label>
                            </div>
                            <div className="flex justify-between gap-2">
                                {[2, 3, 4, 5, 6].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDaysPerWeek(d)}
                                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                                            daysPerWeek === d 
                                            ? 'bg-indigo-600 text-white shadow-lg' 
                                            : 'bg-neutral-800 text-gray-500 hover:bg-neutral-700'
                                        }`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Time Per Workout */}
                        <div className="bg-neutral-900 rounded-2xl p-4 border border-white/5">
                            <div className="flex items-center gap-2 mb-3">
                                <Clock size={16} className="text-indigo-400"/>
                                <label className="text-sm font-bold text-gray-300">Длительность (мин)</label>
                            </div>
                            <div className="flex justify-between gap-2">
                                {[30, 45, 60, 75].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTimePerWorkout(t)}
                                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                                            timePerWorkout === t 
                                            ? 'bg-indigo-600 text-white shadow-lg' 
                                            : 'bg-neutral-800 text-gray-500 hover:bg-neutral-700'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Goal */}
                        <div className="bg-neutral-900 rounded-2xl p-4 border border-white/5">
                            <div className="flex items-center gap-2 mb-3">
                                <Target size={16} className="text-indigo-400"/>
                                <label className="text-sm font-bold text-gray-300">Главная цель</label>
                            </div>
                            <div className="space-y-2">
                                {Object.values(Goal).map(g => (
                                    <button 
                                        key={g}
                                        onClick={() => setPrimaryGoal(g)}
                                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                            primaryGoal === g 
                                            ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/50' 
                                            : 'bg-neutral-800 text-gray-500 hover:bg-neutral-700'
                                        }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            className="w-full bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200 transition shadow-lg shadow-white/10"
                        >
                            <Save size={18} /> Сохранить изменения
                        </button>
                    </section>

                    {/* Badges Section */}
                    <section className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-300 px-2 flex items-center gap-2">
                            <Award size={18} className="text-amber-500" /> Мои бейджи
                        </h2>

                        {loadingBadges ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="animate-spin text-amber-500" size={24} />
                            </div>
                        ) : (
                            <>
                                {/* Earned Badges */}
                                {myBadges.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {myBadges.map((badge) => (
                                            <div
                                                key={badge.id}
                                                className={`aspect-square rounded-xl border p-2 flex flex-col items-center justify-center ${tierBgColors[badge.tier] || 'bg-neutral-800 border-white/10'}`}
                                            >
                                                <span className="text-2xl">{badge.icon}</span>
                                                <span className={`text-[8px] font-bold mt-1 bg-gradient-to-r ${tierColors[badge.tier]} bg-clip-text text-transparent`}>
                                                    {badge.name_ru.split(' ')[0]}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* No badges yet */}
                                {myBadges.length === 0 && (
                                    <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6 text-center">
                                        <div className="text-4xl mb-3">🏅</div>
                                        <p className="text-gray-400 text-sm">
                                            Пока нет бейджей. Тренируйся, чтобы получить первый!
                                        </p>
                                    </div>
                                )}

                                {/* Locked Badges Preview */}
                                {allBadges.length > myBadges.length && (
                                    <div className="mt-4">
                                        <p className="text-xs text-gray-500 mb-2 px-2">Доступны для получения:</p>
                                        <div className="grid grid-cols-6 gap-1.5">
                                            {allBadges
                                                .filter(b => !myBadges.some(mb => mb.id === b.id))
                                                .slice(0, 12)
                                                .map((badge) => (
                                                    <div
                                                        key={badge.id}
                                                        className="aspect-square rounded-lg bg-neutral-900/50 border border-white/5 flex items-center justify-center opacity-40"
                                                    >
                                                        <span className="text-lg grayscale">{badge.icon}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    {/* Notifications Section */}
                    <section className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-300 px-2 flex items-center gap-2">
                            <Bell size={18} className="text-indigo-400" /> Уведомления
                        </h2>

                        <div className="bg-neutral-900 rounded-2xl border border-white/5 overflow-hidden">
                            {/* Toggle */}
                            <div className="p-4 flex items-center justify-between border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    {notifEnabled ? (
                                        <Bell size={20} className="text-indigo-400" />
                                    ) : (
                                        <BellOff size={20} className="text-gray-500" />
                                    )}
                                    <div>
                                        <p className="text-sm font-bold text-white">Напоминания о тренировках</p>
                                        <p className="text-xs text-gray-500">Утром в дни тренировок</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleNotifToggle}
                                    disabled={notifSaving}
                                    className={`w-12 h-7 rounded-full relative transition-colors ${
                                        notifEnabled ? 'bg-indigo-600' : 'bg-neutral-700'
                                    }`}
                                >
                                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                                        notifEnabled ? 'left-6' : 'left-1'
                                    }`} />
                                </button>
                            </div>

                            {/* Days selector */}
                            {notifEnabled && (
                                <div className="p-4">
                                    <p className="text-xs text-gray-500 mb-3">Дни тренировок:</p>
                                    <div className="flex gap-2">
                                        {[
                                            { day: 1, label: 'Пн' },
                                            { day: 2, label: 'Вт' },
                                            { day: 3, label: 'Ср' },
                                            { day: 4, label: 'Чт' },
                                            { day: 5, label: 'Пт' },
                                            { day: 6, label: 'Сб' },
                                            { day: 0, label: 'Вс' },
                                        ].map(({ day, label }) => (
                                            <button
                                                key={day}
                                                onClick={() => handleNotifDaysChange(day)}
                                                disabled={notifSaving}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                                    notifDays.includes(day)
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-neutral-800 text-gray-500'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className="text-[10px] text-gray-600 px-2">
                            Напоминания приходят в чат с ботом утром (08:00 МСК) в выбранные дни. Макс 2-3 сообщения в неделю.
                        </p>
                    </section>

                    {/* Danger Zone */}
                    <section className="pt-6 border-t border-white/10">
                        
                        {!isConfirmingReset ? (
                            <button 
                                onClick={() => setIsConfirmingReset(true)}
                                className="w-full py-4 flex items-center justify-center gap-2 text-red-500 font-bold hover:bg-red-900/10 rounded-xl transition"
                            >
                                <LogOut size={18} /> Сбросить прогресс и выйти
                            </button>
                        ) : (
                            <div className="bg-red-900/10 border border-red-900/50 rounded-2xl p-4 text-center space-y-4">
                                <p className="text-red-300 text-sm">Это действие удалит всю историю тренировок и текущий план.</p>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setIsConfirmingReset(false)}
                                        className="flex-1 py-3 bg-neutral-800 text-white rounded-xl font-bold"
                                    >
                                        Отмена
                                    </button>
                                    <button 
                                        onClick={onResetAccount}
                                        className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-500"
                                    >
                                        <Trash2 size={16} /> Удалить
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {/* Subscription Content */}
            {activeTab === 'subscription' && (
                <div className="space-y-6 animate-slide-up">
                    <SubscriptionCard
                        title="Базовый"
                        price="Бесплатно"
                        features={["Персональный план тренировок", "Трекинг прогресса"]}
                        isCurrent={!profile.isPro}
                    />
                    <SubscriptionCard
                        title="PRO"
                        price="500 ⭐ / мес"
                        features={["AI-тренер в чате 24/7", "Детальный анализ силы", "Команды и лидерборды", "Социальные функции"]}
                        isCurrent={profile.isPro}
                        isPremium={true}
                    />

                    <p className="text-center text-xs text-gray-500 mt-8">
                        Оплата через Telegram Stars. Отмена в любое время.
                    </p>
                </div>
            )}

            {/* Cooperation / Contact Section */}
            <div className="mt-8 pt-6 border-t border-white/5">
                <button
                    onClick={() => {
                        if (window.Telegram?.WebApp?.openTelegramLink) {
                            window.Telegram.WebApp.openTelegramLink('https://t.me/domashenkod');
                        } else {
                            window.open('https://t.me/domashenkod', '_blank');
                        }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 text-gray-400 hover:text-white transition text-sm"
                >
                    <MessageCircle size={16} />
                    Сотрудничество: @domashenkod
                </button>
            </div>
        </div>
    );
};

const SubscriptionCard = ({ title, price, features, isCurrent, isPremium }: any) => (
    <div className={`rounded-3xl p-6 border relative overflow-hidden ${isPremium ? 'bg-gradient-to-br from-indigo-900/80 to-purple-900/80 border-indigo-500/50' : 'bg-neutral-900 border-white/5'}`}>
        
        {isPremium && (
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
        )}

        <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
                <h3 className={`text-xl font-black ${isPremium ? 'text-white' : 'text-gray-300'}`}>{title}</h3>
                <p className="text-2xl font-bold text-white mt-1">{price}</p>
            </div>
            {isCurrent ? (
                <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-white border border-white/10">Текущий</span>
            ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/50">
                    <Star size={16} fill="currentColor" />
                </div>
            )}
        </div>

        <ul className="space-y-3 mb-6 relative z-10">
            {features.map((f: string, i: number) => (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                    <Check size={16} className={isPremium ? 'text-indigo-400' : 'text-gray-500'} />
                    {f}
                </li>
            ))}
        </ul>

        {!isCurrent && (
            <button className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:scale-[1.02] transition-transform shadow-lg relative z-10">
                Подключить MAX
            </button>
        )}
    </div>
);

export default SettingsView;
