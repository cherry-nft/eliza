import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ControlCenter from "@/components/ControlCenter";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import "./App.css";

type TextResponse = {
    text: string;
    user: string;
    status?: string;
};

type MessageRequest = {
    text: string;
    userId: string;
    roomId: string;
};

const TypingIndicator = () => (
    <div className="flex justify-start">
        <div className="bg-[#E9E9EB] dark:bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] sm:max-w-[75%]">
            <motion.div
                className="flex gap-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
            >
                <motion.div
                    className="w-2 h-2 bg-gray-500 rounded-full"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                    className="w-2 h-2 bg-gray-500 rounded-full"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: 0.15 }}
                />
                <motion.div
                    className="w-2 h-2 bg-gray-500 rounded-full"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: 0.3 }}
                />
            </motion.div>
        </div>
    </div>
);

const SeenIndicator = () => (
    <div className="flex items-center justify-end gap-1 px-4 text-xs text-gray-500 dark:text-gray-400">
        <span>Seen</span>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.5 12.75L10.5 18.75L19.5 5.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    </div>
);

const StatusIndicator = ({ status }: { status: string }) => (
    <div className="flex items-center justify-start gap-2 px-4 py-2 text-sm bg-blue-50 dark:bg-gray-800 rounded-lg mx-4 mb-2">
        <div className="animate-spin w-4 h-4">
            <svg className="text-blue-500 dark:text-blue-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
        <span className="text-blue-700 dark:text-blue-300">{status}</span>
    </div>
);

export default function Chat() {
    const { agentId } = useParams<{ agentId: string }>();
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<TextResponse[]>([]);
    const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
    const [lastMessageSeen, setLastMessageSeen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const touchStartY = useRef<number | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Reset seen status when new message is sent
    useEffect(() => {
        if (messages.length > 0 && messages[messages.length - 1].user === "user") {
            setLastMessageSeen(false);
        }
    }, [messages]);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartY.current) return;

        const touchY = e.touches[0].clientY;
        const deltaY = touchStartY.current - touchY;

        if (deltaY > 50 && touchY < window.innerHeight - 100) {
            setIsControlCenterOpen(true);
            touchStartY.current = null;
        }
    };

    const handleTouchEnd = () => {
        touchStartY.current = null;
    };

    const mutation = useMutation<TextResponse[], Error, string>({
        mutationFn: async (text: string) => {
            if (!agentId) throw new Error("No agent ID provided");

            const request: MessageRequest = {
                text,
                userId: "user",
                roomId: `default-room-${agentId}`,
            };

            // Add a temporary status message immediately
            setMessages((prev) => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.user !== "user") {
                    return [...prev.slice(0, -1), { ...lastMessage, status: "Processing your request..." }];
                }
                return prev;
            });

            const res = await fetch(`/api/${agentId}/message`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(request),
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            // Create an event source for status updates
            const eventSource = new EventSource(`/api/${agentId}/status`);

            // Debug logging for SSE events
            eventSource.onopen = () => {
                console.log("SSE connection opened");
            };

            eventSource.onerror = (error) => {
                console.error("SSE connection error:", error);
            };

            eventSource.onmessage = (event) => {
                console.log("SSE status update received:", event.data);
                const status = JSON.parse(event.data);
                setMessages((prev) => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage && lastMessage.user !== "user") {
                        console.log("Updating message with status:", status.text);
                        return [...prev.slice(0, -1), { ...lastMessage, status: status.text }];
                    }
                    console.log("No suitable message found to update status");
                    return prev;
                });
            };

            const data = await res.json();
            eventSource.close();
            console.log("SSE connection closed, final response:", data);
            return data;
        },
        onSuccess: (data: TextResponse[]) => {
            setMessages((prev) => [...prev, ...data]);
            setLastMessageSeen(true);
        },
    });

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: TextResponse = {
            text: input,
            user: "user",
        };
        setMessages((prev) => [...prev, userMessage]);

        mutation.mutate(input);
        setInput("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim()) {
                handleSubmit(e as any);
            }
        }
    };

    return (
        <div
            className="flex flex-col h-[100dvh] w-full bg-gray-50 dark:bg-gray-900"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Messages Container */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4">
                <div className="max-w-3xl mx-auto space-y-2">
                    {messages.length > 0 ? (
                        <>
                            {messages.map((message, index) => (
                                <div key={index}>
                                    <div className={`flex ${
                                        message.user === "user"
                                            ? "justify-end"
                                            : "justify-start"
                                    }`}>
                                        <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2 text-base ${
                                            message.user === "user"
                                                ? "bg-[#007AFF] text-white dark:bg-blue-600"
                                                : "bg-[#E9E9EB] text-black dark:bg-gray-700 dark:text-white"
                                        } ${
                                            message.user === "user"
                                                ? "rounded-br-sm"
                                                : "rounded-bl-sm"
                                        }`}>
                                            <ReactMarkdown className="prose dark:prose-invert max-w-none prose-sm sm:prose-base">
                                                {message.text}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                    {message.status && (
                                        <StatusIndicator status={message.status} />
                                    )}
                                </div>
                            ))}
                            {mutation.isPending && <TypingIndicator />}
                            {!mutation.isPending && lastMessageSeen && messages[messages.length - 1].user === "user" && (
                                <SeenIndicator />
                            )}
                        </>
                    ) : (
                        <div className="text-center text-gray-500 dark:text-gray-400 p-4">
                            Start a conversation!
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Container */}
            <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky bottom-0 p-2 sm:p-3">
                <div className="max-w-3xl mx-auto">
                    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                        <div className="flex-1 min-h-[44px]">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="iMessage (Shift + Enter for new line)"
                                className="w-full text-base rounded-full px-4 py-2 min-h-[44px] max-h-32 bg-[#E9E9EB] dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 resize-none"
                                style={{
                                    height: 'auto',
                                    minHeight: '44px',
                                    maxHeight: '160px',
                                    overflowY: 'auto'
                                }}
                                rows={1}
                                disabled={mutation.isPending}
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={mutation.isPending || !input.trim()}
                            className="rounded-full w-[44px] h-[44px] p-0 bg-[#007AFF] dark:bg-blue-600 hover:bg-[#0063CC] dark:hover:bg-blue-700 disabled:bg-[#99C7FF] dark:disabled:bg-blue-400"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-5 h-5 rotate-90"
                            >
                                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                            </svg>
                        </Button>
                    </form>
                </div>
            </div>

            {/* Control Center */}
            <ControlCenter
                isOpen={isControlCenterOpen}
                onClose={() => setIsControlCenterOpen(false)}
            />
        </div>
    );
}
