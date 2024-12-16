import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: {
        entry: {
            index: "src/index.ts",
            types: "src/types.ts",
        },
        resolve: true,
    },
    splitting: false,
    clean: true,
    sourcemap: true,
    treeshake: true,
});
