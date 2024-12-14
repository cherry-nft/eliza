import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import "./App.css";

type TextResponse = {
    text: string;
    user: string;
};

type MessageRequest = {
    text: string;
    userId: string;
    roomId: string;
};

export default function Chat() {
    const { agentId } = useParams<{ agentId: string }>();
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<TextResponse[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const mutation = useMutation<TextResponse[], Error, string>({
        mutationFn: async (text: string) => {
            if (!agentId) throw new Error("No agent ID provided");

            const request: MessageRequest = {
                text,
                userId: "user",
                roomId: `default-room-${agentId}`,
            };

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

            return res.json();
        },
        onSuccess: (data: TextResponse[]) => {
            setMessages((prev) => [...prev, ...data]);
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

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-[#F5F5F5]">
            {/* Messages Container */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4">
                <div className="max-w-3xl mx-auto space-y-2">
                    {messages.length > 0 ? (
                        messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${
                                    message.user === "user"
                                        ? "justify-end"
                                        : "justify-start"
                                }`}
                            >
                                <div
                                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2 text-base ${
                                        message.user === "user"
                                            ? "bg-[#007AFF] text-white"
                                            : "bg-[#E9E9EB] text-black"
                                    } ${
                                        message.user === "user"
                                            ? "rounded-br-sm"
                                            : "rounded-bl-sm"
                                    }`}
                                >
                                    {message.text}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-gray-500 p-4">
                            Start a conversation with Trump!
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Container */}
            <div className="border-t bg-[#FFFFFF] sticky bottom-0 p-2 sm:p-3">
                <div className="max-w-3xl mx-auto">
                    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                        <div className="flex-1 min-h-[44px]">
                            <Input
                                value={input}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                                placeholder="iMessage"
                                className="flex-1 text-base rounded-full px-4 py-2 min-h-[44px] bg-[#E9E9EB]"
                                disabled={mutation.isPending}
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={mutation.isPending || !input.trim()}
                            className="rounded-full w-[44px] h-[44px] p-0 bg-[#007AFF] hover:bg-[#0063CC] disabled:bg-[#99C7FF]"
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
        </div>
    );
}
