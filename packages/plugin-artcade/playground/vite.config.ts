import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import Markdown from "vite-plugin-md";

export default defineConfig(({ mode }) => {
    // Load env file based on mode
    process.env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };

    return {
        plugins: [react(), Markdown()],
        server: {
            port: 3000,
            open: true,
            hmr: {
                overlay: true,
            },
            proxy: {
                "/api": {
                    target: "http://localhost:3001",
                    changeOrigin: true,
                },
            },
        },
        resolve: {
            alias: {
                "@": "/src",
                "@components": "/src/components",
                "@utils": "/src/utils",
            },
        },
        optimizeDeps: {
            include: [
                "react",
                "react-dom",
                "@mui/material",
                "three",
                "plotly.js",
            ],
            exclude: [
                "@ai16z/plugin-artcade",
                "onnxruntime-node",
                "@anush008/tokenizers",
                "@anush008/tokenizers-darwin-universal",
            ],
        },
        define: {
            "process.env": {
                VITE_OPENROUTER_API_KEY: JSON.stringify(
                    process.env.VITE_OPENROUTER_API_KEY
                ),
                NODE_ENV: JSON.stringify(mode),
            },
        },
        assetsInclude: ["**/*.md"],
        build: {
            commonjsOptions: {
                exclude: [
                    "@ai16z/plugin-artcade/**",
                    "onnxruntime-node/**",
                    "@anush008/tokenizers/**",
                    "@anush008/tokenizers-darwin-universal/**",
                ],
            },
            rollupOptions: {
                external: ["path", "url", "onnxruntime-node", /\.node$/],
            },
        },
        ssr: {
            noExternal: true,
        },
    };
});
