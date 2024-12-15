import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

interface ControlCenterProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ControlCenter({ isOpen, onClose }: ControlCenterProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const [dragY, setDragY] = useState(0);

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.y > 50) {
            onClose();
        }
        setDragY(0);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        ref={panelRef}
                        className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-t-3xl p-4 pb-8"
                        initial={{ y: "100%" }}
                        animate={{ y: dragY }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.2}
                        onDragEnd={handleDragEnd}
                        onDrag={(e, info) => {
                            if (info.offset.y > 0) {
                                setDragY(info.offset.y);
                            }
                        }}
                    >
                        {/* Drag Handle */}
                        <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-6" />

                        {/* Grid Layout */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {/* Quick Actions */}
                            <div className="bg-white/50 dark:bg-white/10 rounded-2xl p-4 aspect-square">
                                <h3 className="text-sm font-semibold mb-2">Quick Actions</h3>
                                {/* Add quick action buttons here */}
                            </div>

                            {/* Crypto Controls */}
                            <div className="bg-white/50 dark:bg-white/10 rounded-2xl p-4 aspect-square">
                                <h3 className="text-sm font-semibold mb-2">Crypto</h3>
                                {/* Add crypto controls here */}
                            </div>

                            {/* AI Services */}
                            <div className="bg-white/50 dark:bg-white/10 rounded-2xl p-4 aspect-square">
                                <h3 className="text-sm font-semibold mb-2">AI Services</h3>
                                {/* Add AI service controls here */}
                            </div>

                            {/* Social Media */}
                            <div className="bg-white/50 dark:bg-white/10 rounded-2xl p-4 aspect-square">
                                <h3 className="text-sm font-semibold mb-2">Social</h3>
                                {/* Add social media controls here */}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}