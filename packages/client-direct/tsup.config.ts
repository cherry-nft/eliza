import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    platform: "node",
    esbuildOptions(options) {
        options.external = [
            ...(options.external || []),
            "@anush008/tokenizers",
            "events",
            "path",
            "fs",
            "http",
            "https",
            "stream",
            "util",
            "buffer",
            "url",
        ];
    },
});
