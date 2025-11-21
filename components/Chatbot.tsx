import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { MessageSquare, Send, X, Bot } from 'lucide-react';

interface ChatbotProps {
    isOpen: boolean;
    onToggle: () => void;
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    isLoading: boolean;
}

const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onToggle, messages, onSendMessage, isLoading }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(scrollToBottom, [messages, isLoading]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        }
    };

    return (
        <>
            <button
                onClick={onToggle}
                className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-500 transition transform hover:scale-110 z-50"
                aria-label="Toggle Chatbot"
            >
                <MessageSquare size={24} />
            </button>

            {isOpen && (
                <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 w-[calc(100%-2rem)] max-w-sm h-[60vh] max-h-[600px] bg-gray-800 rounded-2xl shadow-2xl flex flex-col z-50 animate-fade-in-up border border-gray-700">
                    <header className="flex items-center justify-between p-4 border-b border-gray-700">
                        <div className="flex items-center gap-3">
                            <Bot className="text-indigo-400" />
                            <h3 className="font-bold text-lg">Coach Gemini</h3>
                        </div>
                        <button onClick={onToggle} className="text-gray-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </header>

                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                        {messages.length === 0 && (
                             <div className="text-center text-gray-400 h-full flex items-center justify-center">
                                <p>Спроси меня о тренировках, упражнениях или питании!</p>
                             </div>
                        )}
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs md:max-w-sm rounded-2xl p-3 ${msg.role === 'user' ? 'bg-indigo-600 rounded-br-lg' : 'bg-gray-700 rounded-bl-lg'}`}>
                                    <p className="text-sm">{msg.text}</p>
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
                                className="w-full bg-transparent p-3 focus:outline-none"
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