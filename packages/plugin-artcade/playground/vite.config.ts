import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import Markdown from "vite-plugin-md";

export default defineConfig(({ mode }) => {
    // Load env file based on mode
    const env = loadEnv(mode, process.cwd(), "");

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
                VITE_SUPABASE_PROJECT_URL: JSON.stringify(
                    env.VITE_SUPABASE_PROJECT_URL
                ),
                VITE_SUPABASE_ANON_KEY: JSON.stringify(
                    env.VITE_SUPABASE_ANON_KEY
                ),
                VITE_OPENROUTER_API_KEY: JSON.stringify(
                    env.VITE_OPENROUTER_API_KEY
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
                external: [
                    "path",
                    "url",
                    "fs",
                    "crypto",
                    "onnxruntime-node",
                    /\.node$/,
                ],
            },
        },
        ssr: {
            noExternal: true,
        },
    };
});
