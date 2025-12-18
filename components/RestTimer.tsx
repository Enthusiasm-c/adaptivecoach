
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus, X, Play, Pause } from 'lucide-react';

interface RestTimerProps {
    initialSeconds: number;
    isOpen: boolean;
    onClose: () => void;
}

const RestTimer: React.FC<RestTimerProps> = ({ initialSeconds, isOpen, onClose }) => {
    const [timeLeft, setTimeLeft] = useState(initialSeconds);
    const [isActive, setIsActive] = useState(false);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeLeft(initialSeconds);
            setIsActive(true);
        } else {
            setIsActive(false);
        }
    }, [isOpen, initialSeconds]);

    useEffect(() => {
        if (isActive && timeLeft > 0) {
            timerRef.current = window.setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isActive, timeLeft]);

    const toggleTimer = () => setIsActive(!isActive);
    
    const adjustTime = (seconds: number) => {
        setTimeLeft(prev => Math.max(0, prev + seconds));
    };

    if (!isOpen) return null;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <>
            {/* Overlay - клик закрывает таймер */}
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            />
            <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
                <div className="bg-neutral-800/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-2 pl-4 pr-2 flex items-center gap-3">
                
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="20" cy="20" r="18" stroke="#333" strokeWidth="3" fill="none" />
                            <circle 
                                cx="20" cy="20" r="18" 
                                stroke={timeLeft === 0 ? '#10B981' : '#818cf8'} 
                                strokeWidth="3" 
                                fill="none" 
                                strokeDasharray={113}
                                strokeDashoffset={113 - (113 * timeLeft) / initialSeconds}
                                className="transition-all duration-1000 ease-linear"
                            />
                        </svg>
                        <span className="absolute text-xs font-mono font-bold text-white">{formatTime(timeLeft)}</span>
                    </div>
                    
                    <div className="flex gap-1">
                         <button onClick={() => adjustTime(-10)} className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600 text-white"><Minus size={14}/></button>
                         <button onClick={() => adjustTime(10)} className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600 text-white"><Plus size={14}/></button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                     <button 
                        onClick={toggleTimer}
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-yellow-500 text-black' : 'bg-green-500 text-black'} transition`}
                    >
                        {isActive ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    </button>
                    <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center bg-neutral-700 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition">
                        <X size={18} />
                    </button>
                </div>

                </div>
            </div>
        </>
    );
};

export default RestTimer;