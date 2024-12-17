import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import Markdown from "vite-plugin-md";

export default defineConfig({
    plugins: [react(), Markdown()],
    server: {
        port: 3000,
        open: true,
        hmr: {
            overlay: true,
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@components": path.resolve(__dirname, "./src/components"),
            "@utils": path.resolve(__dirname, "./src/utils"),
        },
    },
    optimizeDeps: {
        include: ["react", "react-dom", "@mui/material", "three", "plotly.js"],
    },
    define: {
        "process.env.OPENROUTER_API_KEY": JSON.stringify(
            process.env.OPENROUTER_API_KEY
        ),
    },
    assetsInclude: ["**/*.md"],
});
