import React, { useState } from 'react';
import { OnboardingProfile } from '../types';
import { ChevronLeft, Trash2, Save, User } from 'lucide-react';

interface SettingsViewProps {
    profile: OnboardingProfile;
    onBack: () => void;
    onUpdateProfile: (newProfile: OnboardingProfile) => void;
    onResetAccount: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ profile, onBack, onUpdateProfile, onResetAccount }) => {
    const [weight, setWeight] = useState(profile.weight);
    const [age, setAge] = useState(profile.age);
    const [isConfirmingReset, setIsConfirmingReset] = useState(false);

    const handleSave = () => {
        onUpdateProfile({
            ...profile,
            weight,
            age
        });
        onBack();
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-6 pt-[max(1.5rem,env(safe-area-inset-top))] animate-fade-in max-w-lg mx-auto">
            <header className="flex items-center justify-between mb-8">
                <button onClick={onBack} className="p-2 bg-neutral-900 rounded-full border border-white/10 hover:bg-neutral-800 transition">
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-xl font-bold">Настройки</h1>
                <div className="w-10"></div> {/* Spacer */}
            </header>

            <div className="space-y-8">
                {/* Profile Section */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <User className="text-indigo-400" size={20} />
                        <h2 className="text-lg font-semibold">Мой Профиль</h2>
                    </div>
                    
                    <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-6">
                        <div>
                            <label className="block text-sm text-gray-500 font-bold uppercase mb-2">Вес (кг)</label>
                            <input 
                                type="number" 
                                value={weight} 
                                onChange={(e) => setWeight(parseFloat(e.target.value))} 
                                className="w-full bg-neutral-800 border border-white/10 rounded-xl p-4 text-xl font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-500 font-bold uppercase mb-2">Возраст</label>
                            <input 
                                type="number" 
                                value={age} 
                                onChange={(e) => setAge(parseInt(e.target.value))} 
                                className="w-full bg-neutral-800 border border-white/10 rounded-xl p-4 text-xl font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleSave}
                        className="w-full bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200 transition"
                    >
                        <Save size={18} /> Сохранить
                    </button>
                </section>

                {/* Data Zone */}
                <section className="pt-10 border-t border-white/10">
                     <h2 className="text-lg font-semibold text-red-400 mb-4">Опасная зона</h2>
                     
                     {!isConfirmingReset ? (
                         <button 
                            onClick={() => setIsConfirmingReset(true)}
                            className="w-full py-4 border border-red-900/50 text-red-500 rounded-2xl font-bold hover:bg-red-900/20 transition"
                         >
                             Сбросить весь прогресс
                         </button>
                     ) : (
                         <div className="bg-red-900/10 border border-red-900/50 rounded-2xl p-4 text-center space-y-4">
                             <p className="text-red-300 text-sm">Вы уверены? Это действие удалит все тренировки и текущий план. Его нельзя отменить.</p>
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
                                     <Trash2 size={16} /> Да, удалить
                                 </button>
                             </div>
                         </div>
                     )}
                </section>
            </div>
        </div>
    );
};

export default SettingsView;