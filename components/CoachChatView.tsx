import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatAction } from '../types';
import { Send, Bot, Zap, ShieldAlert, Clock, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';

interface CoachChatViewProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    onActionClick: (action: ChatAction) => void;
    isLoading: boolean;
    executingActionId?: string;
    onBack: () => void;
}

const CoachChatView: React.FC<CoachChatViewProps> = ({
    messages,
    onSendMessage,
    onActionClick,
    isLoading,
    executingActionId,
    onBack
}) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages, isLoading]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSendMessage(input);
            setInput('');
        }
    };

    const suggestions = [
        {
            label: "Слишком легко",
            text: "Мне слишком легко заниматься. Можешь усложнить программу?",
            icon: <Zap size={18} className="text-yellow-400" />,
            gradient: "from-yellow-500/20 to-orange-500/20"
        },
        {
            label: "Болит спина",
            text: "У меня болит спина при нагрузках. Замени опасные упражнения.",
            icon: <ShieldAlert size={18} className="text-red-400" />,
            gradient: "from-red-500/20 to-pink-500/20"
        },
        {
            label: "Мало времени",
            text: "Сократи тренировки до 30 минут, я не успеваю.",
            icon: <Clock size={18} className="text-blue-400" />,
            gradient: "from-blue-500/20 to-cyan-500/20"
        }
    ];

    return (
        <div className="flex flex-col h-full bg-black">
            {/* Minimal Header - just back button */}
            <div className="flex-shrink-0 px-4 pt-4 pb-2 flex items-center">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                    <ArrowLeft size={24} className="text-white" />
                </button>
                <span className="ml-2 text-lg font-semibold text-white">AI Тренер</span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center text-center py-8">
                        <div className="p-5 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border border-indigo-500/20 mb-6">
                            <Bot size={40} className="text-indigo-400" />
                        </div>
                        <h4 className="text-white font-bold text-xl mb-2">Привет! Я твой AI тренер</h4>
                        <p className="text-gray-400 text-sm max-w-[280px] mb-8">
                            Могу изменить программу, дать совет по питанию или технике упражнений
                        </p>

                        <div className="w-full space-y-3 max-w-sm">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Частые запросы</p>
                            {suggestions.map((s, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => onSendMessage(s.text)}
                                    className={`flex items-center gap-4 w-full p-4
                                        bg-gradient-to-r ${s.gradient}
                                        border border-white/5 rounded-2xl
                                        hover:border-white/10 transition-all
                                        active:scale-[0.98] group`}
                                >
                                    <div className="p-2 bg-black/30 rounded-xl">
                                        {s.icon}
                                    </div>
                                    <span className="flex-1 text-left text-sm font-medium text-gray-200">
                                        {s.label}
                                    </span>
                                    <ArrowRight size={16} className="text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 pt-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                                        <Bot size={16} className="text-indigo-400" />
                                    </div>
                                )}
                                <div className={`max-w-[80%] rounded-2xl p-4 ${
                                    msg.role === 'user'
                                        ? 'bg-indigo-600 rounded-br-md'
                                        : 'bg-surface border border-white/10 shadow-lg shadow-indigo-500/5 rounded-bl-md'
                                }`}>
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                                    {/* Action Button - pending state */}
                                    {msg.action && msg.action.status === 'pending' && (
                                        <button
                                            onClick={() => onActionClick(msg.action!)}
                                            disabled={executingActionId === msg.action.id}
                                            className="mt-4 w-full py-3 px-4
                                                bg-gradient-to-r from-indigo-600 to-purple-600
                                                hover:from-indigo-500 hover:to-purple-500
                                                disabled:from-gray-600 disabled:to-gray-600
                                                rounded-xl text-sm font-semibold
                                                flex items-center justify-center gap-2 transition-all
                                                active:scale-[0.98]"
                                        >
                                            {executingActionId === msg.action.id ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Применяю...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={16} />
                                                    {msg.action.label}
                                                </>
                                            )}
                                        </button>
                                    )}

                                    {/* Action Button - completed state */}
                                    {msg.action && msg.action.status === 'completed' && (
                                        <div className="mt-4 py-3 px-4 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400 text-center font-medium">
                                            ✅ Программа обновлена
                                        </div>
                                    )}

                                    {/* Action Button - failed state */}
                                    {msg.action && msg.action.status === 'failed' && (
                                        <div className="mt-4 py-3 px-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 text-center font-medium">
                                            ❌ Ошибка. Попробуй еще раз.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex gap-3 justify-start">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                                    <Bot size={16} className="text-indigo-400" />
                                </div>
                                <div className="bg-surface border border-white/10 rounded-2xl rounded-bl-md p-4">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area - Fixed at bottom */}
            <div className="flex-shrink-0 px-4 pb-6 pt-3 bg-black">
                <form onSubmit={handleSend} className="max-w-lg mx-auto">
                    <div className="flex items-center gap-2 bg-surface border border-white/15 rounded-2xl p-1.5">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Задай вопрос тренеру..."
                            className="flex-1 bg-transparent px-4 py-3 focus:outline-none text-white placeholder-gray-500 text-sm"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            className={`p-3 rounded-xl transition-all ${
                                input.trim() && !isLoading
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
                                    : 'bg-gray-700 text-gray-500'
                            }`}
                            disabled={isLoading || !input.trim()}
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CoachChatView;
