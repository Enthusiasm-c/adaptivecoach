
import React, { useState } from 'react';
import { calculatePlates } from '../utils/progressUtils';
import { X, Settings } from 'lucide-react';

interface PlateCalculatorModalProps {
    targetWeight: number;
    onClose: () => void;
}

const PlateCalculatorModal: React.FC<PlateCalculatorModalProps> = ({ targetWeight, onClose }) => {
    const [barWeight, setBarWeight] = useState(20);
    const plates = calculatePlates(targetWeight, barWeight);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 pb-28 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-6 border border-gray-700 animate-fade-in-up relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                    <X size={24} />
                </button>

                <div className="text-center">
                    <h2 className="text-3xl font-bold text-white mb-1">{targetWeight} <span className="text-lg font-normal text-gray-400">кг</span></h2>
                    <p className="text-gray-400 text-sm">Загрузка штанги (на одну сторону)</p>
                </div>

                <div className="flex justify-center items-center gap-1 h-32 bg-gray-900 rounded-lg relative overflow-hidden px-4">
                    {/* Bar End */}
                    <div className="h-4 w-full bg-gray-600 absolute left-0 z-0"></div>
                    
                    {/* Sleeve Stop */}
                    <div className="h-16 w-4 bg-gray-500 z-10 rounded-sm mr-2"></div>
                    
                    {plates.length === 0 ? (
                        <p className="text-gray-500 z-10">Только гриф!</p>
                    ) : (
                        plates.map((plate, idx) => (
                            <div key={idx} className="flex gap-0.5 z-10">
                                {[...Array(plate.count)].map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`${plate.color} border-r border-black/20 flex items-center justify-center text-[10px] font-bold text-black/70`}
                                        style={{ 
                                            height: `${Math.min(100, plate.weight * 4 + 40)}px`, 
                                            width: `${Math.max(10, plate.weight + 5)}px`
                                        }}
                                    >
                                        <span className="transform -rotate-90 whitespace-nowrap">{plate.weight}</span>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                <div className="space-y-2">
                     {plates.map((plate, idx) => (
                         <div key={idx} className="flex justify-between items-center bg-gray-700 px-4 py-2 rounded-lg">
                             <div className="flex items-center gap-2">
                                 <div className={`w-4 h-4 rounded-full ${plate.color}`}></div>
                                 <span className="font-bold">{plate.weight} кг</span>
                             </div>
                             <span className="text-gray-300">x {plate.count} на сторону</span>
                         </div>
                     ))}
                </div>

                <div className="border-t border-gray-700 pt-4">
                     <label className="flex items-center justify-between text-sm text-gray-400">
                        <span className="flex items-center gap-2"><Settings size={14}/> Вес грифа</span>
                        <select 
                            value={barWeight} 
                            onChange={(e) => setBarWeight(Number(e.target.value))}
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white focus:outline-none"
                        >
                            <option value="20">20 кг (Стандарт)</option>
                            <option value="15">15 кг (Женский)</option>
                            <option value="10">10 кг (Тренировочный)</option>
                        </select>
                     </label>
                </div>
            </div>
        </div>
    );
};

export default PlateCalculatorModal;
