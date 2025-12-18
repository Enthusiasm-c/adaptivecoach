import React, { useState } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { hapticFeedback } from '../utils/hapticUtils';

interface ChatInputBarProps {
    onSendMessage: (message: string) => void;
    placeholder?: string;
    onFocusChange?: (focused: boolean) => void;
    compact?: boolean;
}

const ChatInputBar: React.FC<ChatInputBarProps> = ({
    onSendMessage,
    placeholder = 'Спросить тренера...',
    onFocusChange,
    compact = false
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
            className={`bg-neutral-900/50 border transition-all duration-200 ${
                compact ? 'rounded-xl' : 'rounded-2xl'
            } ${
                isFocused
                    ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/20 bg-neutral-900'
                    : 'border-white/5'
            }`}
        >
            <div className={`flex items-center gap-2 ${compact ? 'p-1.5' : 'p-2'}`}>
                <div className={`text-indigo-400 ${compact ? 'p-1.5' : 'p-2'}`}>
                    <MessageCircle size={compact ? 16 : 20} />
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
                    className={`flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none ${
                        compact ? 'text-xs py-1.5' : 'text-sm py-2'
                    }`}
                />
                <button
                    type="submit"
                    disabled={!message.trim()}
                    className={`rounded-lg transition-all ${
                        compact ? 'p-2' : 'p-2.5 rounded-xl'
                    } ${
                        message.trim()
                            ? 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
                            : 'bg-white/5 text-gray-600'
                    }`}
                >
                    <Send size={compact ? 14 : 18} />
                </button>
            </div>
        </form>
    );
};

export default ChatInputBar;
