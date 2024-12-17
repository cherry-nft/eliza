import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        open: true,
        hmr: {
            overlay: true,
        },
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
            "@components": resolve(__dirname, "./src/components"),
            "@utils": resolve(__dirname, "./src/utils"),
        },
    },
    optimizeDeps: {
        include: ["react", "react-dom", "@mui/material", "three", "plotly.js"],
    },
});
