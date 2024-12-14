# Eliza Plugin System Overview

## Directory Structure

```
eliza/
├── packages/
│   ├── plugin-bootstrap/
│   │   ├── src/
│   │   │   └── index.ts      # Core actions (CONTINUE, IGNORE, NONE)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── plugin-node/
│   │   ├── src/
│   │   │   └── index.ts      # Browser and Text Generation services
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── plugin-0g/
│   │   ├── src/
│   │   │   └── index.ts      # Zero-G blockchain integration
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── plugin-goat/
│   │   ├── src/
│   │   │   └── index.ts      # GOAT protocol integration
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   └── plugin-aptos/
│       ├── src/
│       │   └── index.ts      # Aptos blockchain integration
│       ├── package.json
│       ├── tsconfig.json
│       └── tsup.config.ts
```

## Core Interfaces

### Plugin Interface

```typescript
type Plugin = {
    name: string;
    description: string;
    actions?: Action[];
    providers?: Provider[];
    evaluators?: Evaluator[];
    services?: Service[];
    clients?: Client[];
};
```

### Action Interface

```typescript
interface Action {
    name: string;
    description: string;
    similes: string[];
    examples: ActionExample[][];
    handler: (runtime: IAgentRuntime) => Promise<{ text: string }>;
    validate: () => Promise<boolean>;
}
```

### Service Abstract Class

```typescript
abstract class Service {
    static get serviceType(): ServiceType;
    abstract initialize(runtime: IAgentRuntime): Promise<void>;
}
```

## Implemented Plugins

### Bootstrap Plugin

```typescript
export const bootstrapPlugin: Plugin = {
    name: "bootstrap",
    description: "Essential baseline functionality for Eliza",
    actions: [CONTINUE, IGNORE, NONE],
};
```

### Node Plugin

```typescript
export const createNodePlugin = (): Plugin => ({
    name: "node",
    description: "Core Node.js-based services for Eliza",
    services: [new BrowserService(), new TextGenerationService()],
});
```

### 0G Plugin

```typescript
export const zgPlugin: Plugin = {
    name: "0g",
    description: "Zero-G blockchain integration for Eliza",
    actions: [],
};
```

### GOAT Plugin

```typescript
export default function createGoatPlugin(): Plugin {
    return {
        name: "goat",
        description: "GOAT protocol integration for Eliza",
        actions: [],
    };
}
```

### Aptos Plugin

```typescript
export const aptosPlugin: Plugin = {
    name: "aptos",
    description: "Aptos blockchain integration for Eliza",
    actions: [],
};
```

## Build Configuration

All plugins use the same build configuration:

### tsconfig.json

```json
{
    "compilerOptions": {
        "target": "ESNext",
        "module": "ESNext",
        "moduleResolution": "node",
        "esModuleInterop": true,
        "strict": true,
        "skipLibCheck": true,
        "declaration": true,
        "outDir": "dist"
    },
    "include": ["src"],
    "exclude": ["node_modules", "dist"]
}
```

### tsup.config.ts

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
});
```

## What Works

1. All plugins now build successfully with proper TypeScript types
2. Bootstrap plugin provides core actions (CONTINUE, IGNORE, NONE)
3. Node plugin provides essential services (Browser, Text Generation)
4. Blockchain plugins (0G, GOAT, Aptos) have minimal working structure
5. All plugins follow consistent build configuration
6. All plugins implement proper interfaces from @ai16z/eliza

## Next Steps

1. Implement actual functionality in blockchain plugins
2. Add tests for all plugins
3. Add proper error handling
4. Add documentation for each plugin's specific functionality
5. Consider adding more services to the node plugin
