import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bot, MessageCircle, Settings, Zap, Brain, Share2, FileText, History } from "lucide-react";
import "./App.css";

type Agent = {
    id: string;
    name: string;
};

const AppTile = ({
    icon: Icon,
    label,
    color,
    onClick,
    delay = 0
}: {
    icon: React.ElementType;
    label: string;
    color: string;
    onClick?: () => void;
    delay?: number;
}) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.3 }}
        className="group cursor-pointer"
        onClick={onClick}
    >
        <div className={`aspect-square rounded-2xl p-4 flex flex-col items-center justify-center gap-3 ${color} transition-transform duration-200 group-hover:scale-95 group-active:scale-90`}>
            <Icon className="w-8 h-8 text-white" />
        </div>
        <p className="text-sm text-center mt-2 font-medium text-gray-700 dark:text-gray-300">
            {label}
        </p>
    </motion.div>
);

function App() {
    const navigate = useNavigate();
    const { data: agents, isLoading } = useQuery({
        queryKey: ["agents"],
        queryFn: async () => {
            const res = await fetch("/api/agents");
            const data = await res.json();
            return data.agents as Agent[];
        },
    });

    const handleAgentSelect = (agentId: string) => {
        navigate(`/${agentId}/chat`);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
            {/* Status Bar */}
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Eliza</h1>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Online</span>
                </div>
            </div>

            {/* Grid Layout */}
            <div className="max-w-2xl mx-auto">
                {isLoading ? (
                    <div className="text-center text-gray-600 dark:text-gray-400">
                        Loading agents...
                    </div>
                ) : agents && agents.length > 0 ? (
                    <>
                        {/* Active Agent Section */}
                        <div className="mb-8">
                            <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">
                                Active Agent
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                <AppTile
                                    icon={Bot}
                                    label={agents[0].name}
                                    color="bg-gradient-to-br from-blue-500 to-blue-600"
                                    onClick={() => handleAgentSelect(agents[0].id)}
                                    delay={0.1}
                                />
                                <AppTile
                                    icon={MessageCircle}
                                    label="Chat"
                                    color="bg-gradient-to-br from-green-500 to-green-600"
                                    onClick={() => handleAgentSelect(agents[0].id)}
                                    delay={0.2}
                                />
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="mb-8">
                            <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">
                                Quick Actions
                            </h2>
                            <div className="grid grid-cols-4 gap-4">
                                <AppTile
                                    icon={Zap}
                                    label="Actions"
                                    color="bg-gradient-to-br from-yellow-500 to-yellow-600"
                                    delay={0.3}
                                />
                                <AppTile
                                    icon={Brain}
                                    label="AI Services"
                                    color="bg-gradient-to-br from-purple-500 to-purple-600"
                                    delay={0.4}
                                />
                                <AppTile
                                    icon={Share2}
                                    label="Share"
                                    color="bg-gradient-to-br from-pink-500 to-pink-600"
                                    delay={0.5}
                                />
                                <AppTile
                                    icon={Settings}
                                    label="Settings"
                                    color="bg-gradient-to-br from-gray-500 to-gray-600"
                                    delay={0.6}
                                />
                            </div>
                        </div>

                        {/* Tools */}
                        <div>
                            <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">
                                Tools
                            </h2>
                            <div className="grid grid-cols-4 gap-4">
                                <AppTile
                                    icon={FileText}
                                    label="Documents"
                                    color="bg-gradient-to-br from-indigo-500 to-indigo-600"
                                    delay={0.7}
                                />
                                <AppTile
                                    icon={History}
                                    label="History"
                                    color="bg-gradient-to-br from-teal-500 to-teal-600"
                                    delay={0.8}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center text-gray-600 dark:text-gray-400">
                        No agents available
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
