import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const Stopwatch: React.FC = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [time, setTime] = useState(0); // Now in centiseconds (hundredths of a second)
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                setTime((prev) => prev + 1);
            }, 10); // Update every 10ms for centisecond precision
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isRunning]);

    const formatTime = (centiseconds: number) => {
        const mins = Math.floor(centiseconds / 6000);
        const secs = Math.floor((centiseconds % 6000) / 100);
        const centis = centiseconds % 100;
        return `${mins}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
    };

    const reset = () => {
        setIsRunning(false);
        setTime(0);
    };

    return (
        <div className="flex flex-col items-center gap-3 bg-neutral-900/50 border border-white/5 p-4 rounded-2xl w-full max-w-[200px]">
            <div className="text-4xl font-black font-mono text-white tracking-wider">
                {formatTime(time)}
            </div>
            <div className="flex gap-2 w-full">
                <button
                    onClick={() => setIsRunning(!isRunning)}
                    className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 font-bold transition ${isRunning
                            ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                            : 'bg-green-500 text-black hover:bg-green-400'
                        }`}
                >
                    {isRunning ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                    {isRunning ? 'Стоп' : 'Старт'}
                </button>
                <button
                    onClick={reset}
                    className="p-2 bg-neutral-800 text-gray-400 rounded-xl hover:text-white hover:bg-neutral-700 transition"
                >
                    <RotateCcw size={18} />
                </button>
            </div>
        </div>
    );
};

export default Stopwatch;
