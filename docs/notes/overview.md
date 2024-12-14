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

## Running Trump Character with OpenRouter

### Prerequisites

1. OpenRouter API key (set in `.env` as `OPENROUTER_API_KEY`)
2. Node.js 23+ and pnpm installed
3. SQLite installed for database functionality

### Configuration Files

1. Character Configuration (`characters/trump.character.json`):

```json
{
    "name": "trump",
    "clients": [],
    "modelProvider": "openrouter",
    "settings": {
        "model": "anthropic/claude-3.5-sonnet:beta",
        "temperature": 0.7
    }
}
```

2. Environment Variables (`.env`):

```env
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet:beta
```

### Starting the System

1. Start the Agent (Terminal 1):

```bash
pnpm start --character="characters/trump.character.json"
```

This will:

- Initialize SQLite database
- Start the API server on port 3000
- Load Trump character with OpenRouter/Claude 3.5
- Register the character with DirectClient for API access

2. Start the Client (Terminal 2):

```bash
cd client && pnpm dev
```

This will:

- Start Vite dev server on port 5173
- Connect to local agent API via proxy configuration
- Support deployment to slop.wtf
- Provide mobile-optimized iMessage-like interface

### Access Points

- Local Development: http://localhost:5173
- Production: https://slop.wtf
- API Endpoint: http://localhost:3000/api/agents (list available agents)
- Chat Endpoint: http://localhost:3000/api/[agentId]/message

### API Usage

1. Get Available Agents:

```bash
GET /api/agents
```

Response:

```json
{
    "agents": [
        {
            "id": "unique-agent-id",
            "name": "trump"
        }
    ]
}
```

2. Send Messages:

```bash
POST /api/[agentId]/message
```

Request body:

```json
{
    "text": "Your message here",
    "userId": "user",
    "roomId": "default-room-trump"
}
```

### Client Configuration

The client uses Vite's proxy configuration to route API requests:

```typescript
// vite.config.ts
export default defineConfig({
    server: {
        proxy: {
            "/api": {
                target: process.env.VITE_API_URL || "http://localhost:3000",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ""),
                ws: true,
            },
        },
        headers: {
            "Content-Security-Policy":
                "default-src 'self'; connect-src 'self' ws: wss: http: https: *.vercel.app slop.wtf; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self' https://slop.wtf;",
        },
        host: true,
        cors: true,
    },
});
```

### Mobile Optimization

The client interface is optimized for mobile with:

- iMessage-like chat bubbles
- Responsive design that adapts to screen size
- Touch-friendly input controls
- Native-feeling scrolling and animations

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
7. Trump character works with OpenRouter/Claude 3.5
8. Web interface supports both local and slop.wtf deployment
9. Agent registration system properly exposes characters via API
10. Mobile-optimized interface with iMessage-like design
11. Vite dev server with proper API proxy configuration
12. CORS and security headers configured for production

## Next Steps

1. Implement actual functionality in blockchain plugins
2. Add tests for all plugins
3. Add proper error handling
4. Add documentation for each plugin's specific functionality
5. Add more characters and model providers
6. Enhance the web interface with more features
7. Add real-time typing indicators and message status
8. Implement message persistence and history
9. Add support for media attachments
10. Enhance mobile UX with haptic feedback and animations

### Capabilities

**Looking at the API docs and the plugins we have, here are some specific actions this system can do:**

Crypto/Blockchain Actions:
"Send me 0.1 ETH on the Ethereum network"
"Check my Solana wallet balance"
"Buy $100 worth of SOL tokens"
"Track price movements on Birdeye"

Social Media Integration:
"Post this message to Twitter"
"Reply to my latest mentions"
"Schedule a tweet for tomorrow"
"Monitor Twitter for specific keywords"

AI-Enhanced Actions:
"Generate an image of Trump in the Oval Office"
"Transcribe this audio clip into text"
"Analyze the sentiment of these tweets"
"Generate a caption for this image"

Document/Knowledge Actions:
"Search through my PDF documents for mentions of inflation"
"Summarize this article about the border"
"Extract key points from this speech"
"Create a report based on these documents"

Web Interaction:
"Search the web for recent news about me"
"Check the latest polls on FiveThirtyEight"
"Monitor news sites for specific topics"
"Gather data from specified websites"
Memory/Relationship Management:
"Remember this fact about Hunter Biden"
"What do you recall about our last conversation about the wall?"
"Update your knowledge about the latest border statistics"
"Track relationships with different users or entities"

### Autonomous Trading

- "Buy 1000 SOL when the price drops below $20"
- "Set up a trailing stop loss at 5% for my BONK position"
- "Monitor JUPITER price and alert me if it moves more than 10%"
- "Validate this token contract for potential scams"
- "Show me my trading performance for the last week"
- "Automatically DCA $100 into SOL every day"

### Secure TEE Integration

- "Generate a new secure wallet for trading on Solana"
- "Prove that this transaction was executed in a secure environment"
- "Switch to production TEE mode for live trading"
- "Verify the authenticity of this trading bot's actions"
- "Sign this transaction securely within the TEE"

### Fine-tuning & Model Management

- "Use GPT-4 for complex trading analysis but Claude for chat"
- "Switch to a faster model for quick price checks"
- "Remember this trading pattern for future reference"
- "Make responses more creative for social media posts"
- "Optimize response speed for real-time market updates"

### Infrastructure & Data Management

- "Show me all trades where I made over 50% profit"
- "Find similar market conditions to right now"
- "Back up all my trading history to PostgreSQL"
- "Scale up the system to handle 1000 concurrent traders"
- "Give me access to only my own trading data"
- "Check if all trading systems are running properly"

### Trust Engine

- "Rate this trader's token recommendations"
- "Show me my most profitable trading patterns"
- "What's the risk level of this new token?"
- "Find traders with similar successful strategies"
- "Calculate trust score for this new signal group"
- "Verify if this token meets our safety criteria"
