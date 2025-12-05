
import React, { useState } from 'react';
import { OnboardingProfile, TelegramUser, Goal } from '../types';
import { Trash2, Save, User, LogOut, Target, Calendar, Clock, CreditCard, Star, Check, Award } from 'lucide-react';
import BadgesView from './BadgesView';

interface SettingsViewProps {
    profile: OnboardingProfile;
    telegramUser: TelegramUser | null;
    onUpdateProfile: (newProfile: OnboardingProfile) => void;
    onResetAccount: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ profile, telegramUser, onUpdateProfile, onResetAccount }) => {
    const [weight, setWeight] = useState(profile.weight);
    const [age, setAge] = useState(profile.age);
    const [daysPerWeek, setDaysPerWeek] = useState(profile.daysPerWeek);
    const [timePerWorkout, setTimePerWorkout] = useState(profile.timePerWorkout);
    const [primaryGoal, setPrimaryGoal] = useState(profile.goals.primary);
    
    const [activeTab, setActiveTab] = useState<'profile' | 'badges' | 'subscription'>('profile');

    const [isConfirmingReset, setIsConfirmingReset] = useState(false);
    const [showBadgesModal, setShowBadgesModal] = useState(false);

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
                    onClick={() => setActiveTab('badges')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'badges' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500'}`}
                >
                    <Award size={16} /> Бейджи
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

            {/* Badges Content */}
            {activeTab === 'badges' && (
                <div className="animate-slide-up">
                    <button
                        onClick={() => setShowBadgesModal(true)}
                        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg mb-6"
                    >
                        <Award size={20} /> Открыть все достижения
                    </button>
                    <p className="text-center text-gray-500 text-sm">
                        Выполняйте тренировки и получайте уникальные бейджи за ваши достижения!
                    </p>
                </div>
            )}

            {showBadgesModal && (
                <BadgesView onClose={() => setShowBadgesModal(false)} />
            )}

            {/* Subscription Content */}
            {activeTab === 'subscription' && (
                <div className="space-y-6 animate-slide-up">
                    <SubscriptionCard 
                        title="Базовый" 
                        price="Бесплатно" 
                        features={["Стандартный план", "Базовая статистика", "История тренировок"]} 
                        isCurrent={true} 
                    />
                    <SubscriptionCard 
                        title="MAX" 
                        price="299₽ / мес" 
                        features={["AI Тренер в чате 24/7", "Умная адаптация плана", "Расширенная аналитика", "Коррекция техники"]} 
                        isCurrent={false}
                        isPremium={true}
                    />
                    
                    <p className="text-center text-xs text-gray-500 mt-8">
                        Подписка управляется через Telegram. Средства списываются автоматически.
                    </p>
                </div>
            )}
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
