# Artcade Plugin PRD

## Overview

Artcade is a plugin for Eliza that evolves HTML using arcade game patterns, creating interactive web experiences through genetic algorithms.

## Core Requirements

1. HTML evolution using genetic algorithms
2. Arcade game pattern library
3. WebAssembly-based testing environment
4. Integration with Eliza's memory system

## Implementation Steps

### Phase 1: Basic Plugin Structure

1. Create plugin directory and base files:

```bash
packages/plugin-artcade/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── actions/
│   ├── memory/
│   └── __tests__/
```

2. Configure package.json:

```json
{
    "name": "@ai16z/plugin-artcade",
    "version": "0.1.0",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "dependencies": {
        "@ai16z/eliza": "workspace:*"
    },
    "scripts": {
        "build": "tsup src/index.ts --format esm,cjs --dts",
        "test": "vitest run",
        "dev": "tsup src/index.ts --format esm,cjs --watch"
    }
}
```

3. Define core actions (src/actions/index.ts):

```typescript
import { Action, IAgentRuntime } from "@ai16z/eliza";

export const EVOLVE: Action = {
    name: "EVOLVE",
    description: "Evolve HTML using arcade patterns",
    similes: ["transform", "mutate", "enhance", "gamify"],
    examples: [
        "Evolve this HTML to be more interactive",
        "Make this code more arcade-like",
        "Transform this div into a game element",
    ],
    handler: async (runtime: IAgentRuntime, args: any) => {
        // Store original HTML
        await runtime.memoryManager.createMemory({
            type: "evolution_input",
            content: { html: args.html },
        });

        // Basic evolution implementation
        const evolved = args.html; // TODO: Implement evolution

        // Store result
        await runtime.memoryManager.createMemory({
            type: "evolution_result",
            content: {
                input: args.html,
                output: evolved,
                timestamp: new Date().toISOString(),
            },
        });

        return { text: "Evolution complete", html: evolved };
    },
    validate: async (runtime: IAgentRuntime, args: any) => {
        return typeof args.html === "string" && args.html.length > 0;
    },
};

export const ANALYZE_PATTERN: Action = {
    name: "ANALYZE_PATTERN",
    description: "Analyze effectiveness of arcade patterns",
    similes: ["evaluate", "assess", "review"],
    examples: [
        "Analyze the effectiveness of this pattern",
        "Review pattern performance",
    ],
    handler: async (runtime: IAgentRuntime, args: any) => {
        // Basic pattern analysis
        return { text: "Pattern analysis complete" };
    },
    validate: async () => true,
};
```

4. Create plugin entry point (src/index.ts):

```typescript
import { Plugin } from "@ai16z/eliza";
import { EVOLVE, ANALYZE_PATTERN } from "./actions";

export const artcadePlugin: Plugin = {
    name: "artcade",
    description: "HTML evolution through arcade mechanics",
    actions: [EVOLVE, ANALYZE_PATTERN],
};
```

### Phase 2: Memory Integration

1. Define memory usage (src/memory/index.ts):

```typescript
import { IAgentRuntime } from "@ai16z/eliza";

export async function storeEvolutionResult(
    runtime: IAgentRuntime,
    input: string,
    output: string,
): Promise<void> {
    await runtime.memoryManager.createMemory({
        type: "evolution_result",
        content: {
            input,
            output,
            timestamp: new Date().toISOString(),
        },
    });
}

export async function getRecentEvolutions(
    runtime: IAgentRuntime,
    limit: number = 10,
): Promise<any[]> {
    return runtime.memoryManager.searchMemories({
        tableName: "evolution_results",
        limit,
    });
}
```

### Phase 3: Testing Setup

1. Create basic tests (src/**tests**/index.test.ts):

```typescript
import { describe, it, expect } from "vitest";
import { artcadePlugin } from "../index";
import { MockRuntime } from "@ai16z/eliza/testing";

describe("Artcade Plugin", () => {
    it("should register actions", () => {
        expect(artcadePlugin.actions).toHaveLength(2);
        expect(artcadePlugin.actions[0].name).toBe("EVOLVE");
        expect(artcadePlugin.actions[1].name).toBe("ANALYZE_PATTERN");
    });

    it("should validate HTML input", async () => {
        const runtime = new MockRuntime();
        const valid = await artcadePlugin.actions[0].validate(runtime, {
            html: "<div>Test</div>",
        });
        expect(valid).toBe(true);
    });

    it("should store evolution results", async () => {
        const runtime = new MockRuntime();
        await artcadePlugin.actions[0].handler(runtime, {
            html: "<div>Test</div>",
        });

        const memories = await runtime.memoryManager.searchMemories({
            tableName: "evolution_results",
            limit: 1,
        });
        expect(memories).toHaveLength(1);
    });
});
```

## Development Workflow

1. Initial Setup:

```bash
cd packages
mkdir plugin-artcade
cd plugin-artcade
pnpm init
```

2. Install Dependencies:

```bash
pnpm add -D typescript tsup vitest @types/node
pnpm add @ai16z/eliza@workspace:*
```

3. Build and Test:

```bash
pnpm build
pnpm test
```

4. Integration Testing:

```bash
cd ../..
pnpm test packages/plugin-artcade/src/__tests__/integration.test.ts
```

## Next Steps

1. Implement actual evolution logic in EVOLVE action handler
2. Add pattern library and management
3. Implement WebAssembly testing environment
4. Add more sophisticated memory relationships
5. Implement pattern analysis and effectiveness tracking
