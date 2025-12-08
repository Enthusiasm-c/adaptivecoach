import React, { useState } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';

interface ChatInputBarProps {
    onSendMessage: (message: string) => void;
    placeholder?: string;
}

const ChatInputBar: React.FC<ChatInputBarProps> = ({
    onSendMessage,
    placeholder = 'Спросить тренера...'
}) => {
    const [message, setMessage] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            hapticFeedback.impactOccurred('medium');
            onSendMessage(message.trim());
            setMessage('');
        }
    };

    return (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-0 right-0 px-4 z-30">
            <form
                onSubmit={handleSubmit}
                className={`bg-neutral-900/95 backdrop-blur-md border rounded-2xl transition-all duration-200 ${
                    isFocused
                        ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                        : 'border-white/10'
                }`}
            >
                <div className="flex items-center gap-2 p-2">
                    <div className="p-2 text-indigo-400">
                        <MessageCircle size={20} />
                    </div>
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder={placeholder}
                        className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none py-2"
                    />
                    <button
                        type="submit"
                        disabled={!message.trim()}
                        className={`p-2.5 rounded-xl transition-all ${
                            message.trim()
                                ? 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
                                : 'bg-white/5 text-gray-600'
                        }`}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatInputBar;
