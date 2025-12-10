import React, { useState } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';

interface ChatInputBarProps {
    onSendMessage: (message: string) => void;
    placeholder?: string;
    onFocusChange?: (focused: boolean) => void;
}

const ChatInputBar: React.FC<ChatInputBarProps> = ({
    onSendMessage,
    placeholder = 'Спросить тренера...',
    onFocusChange
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
        <form
            onSubmit={handleSubmit}
            className={`bg-neutral-900/50 border rounded-2xl transition-all duration-200 ${
                isFocused
                    ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/20 bg-neutral-900'
                    : 'border-white/5'
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
                    onFocus={() => {
                        setIsFocused(true);
                        onFocusChange?.(true);
                    }}
                    onBlur={() => {
                        setIsFocused(false);
                        onFocusChange?.(false);
                    }}
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
    );
};

export default ChatInputBar;
