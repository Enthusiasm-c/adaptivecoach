
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatAction } from '../types';
import { Send, X, Bot, Zap, ShieldAlert, Clock, ArrowRight } from 'lucide-react';

interface ChatbotProps {
    isOpen: boolean;
    onToggle: () => void;
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    onActionClick: (action: ChatAction) => void;
    isLoading: boolean;
    executingActionId?: string;
}

const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onToggle, messages, onSendMessage, onActionClick, isLoading, executingActionId }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(scrollToBottom, [messages, isLoading, isOpen]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        }
    };

    const suggestions = [
        {
            label: "🥵 Слишком легко",
            text: "Мне слишком легко заниматься. Можешь усложнить программу?",
            icon: <Zap size={16} className="text-yellow-400" />
        },
        {
            label: "🤕 Болит спина",
            text: "У меня болит спина при нагрузках. Замени опасные упражнения.",
            icon: <ShieldAlert size={16} className="text-red-400" />
        },
        {
            label: "⏳ Мало времени",
            text: "Сократи тренировки до 30 минут, я не успеваю.",
            icon: <Clock size={16} className="text-blue-400" />
        }
    ];

    return (
        <>
            {isOpen && (
                <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 w-[calc(100%-2rem)] max-w-sm h-[60vh] max-h-[600px] bg-gray-800 rounded-2xl shadow-2xl flex flex-col z-50 animate-fade-in-up border border-gray-700">
                    <header className="flex items-center justify-between p-4 border-b border-gray-700">
                        <div className="flex items-center gap-3">
                            <Bot className="text-indigo-400" />
                            <h3 className="font-bold text-lg">ИИ Тренер</h3>
                        </div>
                        <button onClick={onToggle} className="text-gray-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </header>

                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col justify-center items-center text-center space-y-6">
                                <div className="p-4 bg-indigo-500/10 rounded-full">
                                    <Bot size={32} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-lg mb-1">Привет!</h4>
                                    <p className="text-gray-400 text-sm max-w-[250px] mx-auto">Я могу изменить твою программу, дать совет по питанию или технике.</p>
                                </div>

                                <div className="grid gap-2 w-full">
                                    {suggestions.map((s, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => onSendMessage(s.text)}
                                            className="flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-xl transition text-left group"
                                        >
                                            <div className="p-2 bg-gray-800 rounded-lg group-hover:bg-gray-700 transition">
                                                {s.icon}
                                            </div>
                                            <span className="flex-1 text-sm font-medium text-gray-200">{s.label}</span>
                                            <ArrowRight size={14} className="text-gray-500 group-hover:text-white" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs md:max-w-sm rounded-2xl p-3 ${msg.role === 'user' ? 'bg-indigo-600 rounded-br-lg' : 'bg-gray-700 rounded-bl-lg'}`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>

                                    {/* Action Button - pending state */}
                                    {msg.action && msg.action.status === 'pending' && (
                                        <button
                                            onClick={() => onActionClick(msg.action!)}
                                            disabled={executingActionId === msg.action.id}
                                            className="mt-3 w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500
                                                       disabled:bg-gray-600 rounded-xl text-sm font-medium
                                                       flex items-center justify-center gap-2 transition-all
                                                       active:scale-[0.98]"
                                        >
                                            {executingActionId === msg.action.id ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Применяю...
                                                </>
                                            ) : (
                                                msg.action.label
                                            )}
                                        </button>
                                    )}

                                    {/* Action Button - completed state */}
                                    {msg.action && msg.action.status === 'completed' && (
                                        <div className="mt-3 py-2 px-4 bg-green-600/20 border border-green-500/30 rounded-xl text-sm text-green-400 text-center">
                                            ✅ Программа обновлена
                                        </div>
                                    )}

                                    {/* Action Button - failed state */}
                                    {msg.action && msg.action.status === 'failed' && (
                                        <div className="mt-3 py-2 px-4 bg-red-600/20 border border-red-500/30 rounded-xl text-sm text-red-400 text-center">
                                            ❌ Ошибка. Попробуй еще раз.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3 justify-start">
                                <div className="max-w-xs md:max-w-sm rounded-2xl p-3 bg-gray-700 rounded-bl-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="p-4 border-t border-gray-700">
                        <div className="flex items-center bg-gray-700 rounded-lg">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Задай вопрос..."
                                className="w-full bg-transparent p-3 focus:outline-none text-white placeholder-gray-400"
                                disabled={isLoading}
                            />
                            <button type="submit" className="p-3 text-indigo-400 hover:text-indigo-300 disabled:opacity-50" disabled={isLoading || !input.trim()}>
                                <Send size={20} />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
};

export default Chatbot;
