# What is Eliza?

Eliza is an open-source, multi-agent simulation framework for creating and managing autonomous AI agents.

graph TD
A[Agent Runtime] --> B[Character System]
A --> C[Memory Manager]
A --> D[Action System]
B --> E[Model Provider]
C --> F[Database]
D --> G[Platform Clients]

Key Components:

- Agents: Core AI personalities with runtime environments
- Actions: Predefined behaviors for task execution
- Clients: Platform-specific interfaces
- Providers: Contextual information suppliers
- Evaluators: Conversation assessment modules
- Character Files: Personality definitions
- Memory System: Vector-based persistent storage

# Architecture and Components

_Agents (from agents.md):_
Core runtime components that handle autonomous interactions
Manage message/memory processing, state management, action execution
Integrate with clients, providers, actions, and evaluators
Support flexible and extensible functionality

_Actions (from actions.md):_
Define specific behaviors agents can execute
Include validation and handler logic
Can be customized and extended
Handle tasks like media processing, image generation, room following

_Character Files (from characterfile.md):_
JSON configurations that define an AI agent's:
Core identity and behavior
Model provider settings
Client settings and capabilities
Interaction examples and guidelines
Highly customizable for different use cases

_Evaluators (from evaluators.md):_
Assess and extract information from conversations
Build long-term memory
Track goal progress
Extract facts and insights
Maintain contextual awareness

_Providers (from providers.md):_
Inject dynamic context and real-time information
Include built-in providers for:
Time awareness
Facts management
Boredom/engagement tracking
Memory integration
Can be extended with custom providers

The system is built with a modular architecture where each component has clear responsibilities:
Agents act as the central runtime environment
Actions define what agents can do
Character files configure how agents behave
Evaluators process and learn from interactions
Providers supply contextual information

## Advanced Features

Eliza is a sophisticated multi-agent simulation framework with several advanced features:

_Autonomous Trading System_
Built on Solana blockchain
Uses Jupiter aggregator for token swaps
Includes position management, risk assessment, and order book systems
Implements smart order routing and safety limits

_Trust Engine_
Sophisticated scoring system for evaluating token recommendations
Combines on-chain analysis, trader metrics, and historical performance
Includes comprehensive token validation and risk management
Features pattern detection and performance monitoring

_Fine-tuning Capabilities_
Supports multiple AI model providers (OpenAI, Anthropic, Grok, etc.)
Configurable model behavior and embedding generation
Different model classes based on capabilities
Extensive configuration options for optimization

_Infrastructure_
Flexible database architecture supporting multiple adapters
Support for PostgreSQL, SQLite, SQL.js, and Supabase
Comprehensive schema for user/agent identities, conversations, memories
Advanced memory management and relationship tracking

_TEE (Trusted Execution Environment) Integration_
Secure deployment option using Dstack SDK
Remote attestation capabilities
Confidential VM support
Secure key management and state persistence
The system is particularly notable for its integration of AI, blockchain, and security features, making it suitable for both autonomous trading and general AI agent deployment. It's being used in production by notable accounts like @DegenSpartanAI and @MarcAIndreessen.

### Packages

Eliza uses a modular architecture with five core components:
graph TD
A[Core Package] --> B[Agent Package]
A --> C[Database Adapters]
A --> D[Client Packages]
A --> E[Plugin System]
B --> C
B --> D
B --> E

_Core Components:_
@ai16z/core: Central framework and shared functionality
@ai16z/agent: Agent runtime and management
@ai16z/adapters: Database implementations
@ai16z/clients: Platform integrations
@ai16z/plugins: Extension modules

_Installation:_

```bash
# Core framework
pnpm add @ai16z/core

# Database adapters
pnpm add @ai16z/adapter-postgres
pnpm add @ai16z/adapter-sqlite

# Platform clients
pnpm add @ai16z/client-discord
pnpm add @ai16z/client-telegram
pnpm add @ai16z/plugin-bootstrap
pnpm add @ai16z/plugin-node
```

_Database Adapters (@ai16z/adapters):_
Multiple database backend support:
PostgreSQL (production-ready with vector search)
SQLite (lightweight local development)
SQL.js (in-memory for testing)
Supabase (cloud-native PostgreSQL)
Unified interface for data persistence
Handles memories, relationships, goals storage
Features vector similarity search
Connection pooling and performance optimization

_Agent Package (@ai16z/agent):_
High-level orchestration layer
Manages:
Agent lifecycles
Character loading
Client initialization
Runtime coordination
Plugin system
Handles environment and token management
Provides flexible configuration options

_Core Package (@ai16z/core):_
Central framework functionality
Provides:
Memory management
Message processing
Runtime environment
Action & evaluator systems
Provider integration
Service infrastructure
The architecture follows a modular design where:
Core package provides fundamental building blocks
Agent package handles high-level orchestration
Adapters enable different storage backends
Clients connect to various platforms
Plugins add specialized capabilities
Key features across packages:
Flexible database support with vector search
Sophisticated memory and state management
Plugin system for extensibility
Character-based agent configuration
Multi-platform client support
Comprehensive error handling

_Client Packages (@ai16z/clients):_
The client packages provide platform integrations through a standardized interface:
Key Features:
Supports multiple platforms: Discord, Telegram, Twitter, Direct, and Auto clients
Standardized message handling and media support
Platform-specific feature integration
Error handling and rate limiting
Resource management and connection pooling

Agent Runtime
↓
Client Interface
↓
Platform Clients:

- Direct Client (REST API)
- Discord Client (Bot Integration)
- Telegram Client (Bot API)
- Twitter Client (Social)
- Auto Client (Trading)

_Core Package (@ai16z/core):_
The core package is the fundamental building block of Eliza's architecture:
Key Components:
AgentRuntime: Central orchestrator managing all major components
Memory System: Handles persistent storage and retrieval with semantic search
Context System: Manages state composition and template handling
Action System: Defines available behaviors and responses
State Management: Maintains conversation context and agent knowledge
Service Architecture: Implements extensible service-based system
Features:
Memory Management & Semantic Search
Message Processing & Generation
Runtime Environment & State Management
Action & Evaluator Systems
Provider Integration
Service Infrastructure

_Database Adapters (@ai16z/adapters):_
The database adapters provide Eliza's persistence layer:
Available Adapters:
PostgreSQL: Production-ready with vector search
SQLite: Lightweight local development
Supabase: Cloud-native PostgreSQL
SQL.js: In-memory SQLite for testing
Key Features:
Unified interface for data persistence
Vector similarity search support
Connection pooling and performance optimization
Transaction management
Error handling and recovery
Schema management and migrations
Core Data Models:
Memories (with embeddings)
Relationships
Goals
User Accounts
Rooms and Participants
The architecture follows a modular design where:
The core package provides fundamental building blocks
Database adapters enable different storage backends
Client packages connect to various platforms
All components interact through the AgentRuntime

Integration Example:

```typescript
const runtime = new AgentRuntime({
    databaseAdapter: new PostgresDatabaseAdapter({
        connectionString: process.env.DATABASE_URL,
    }),
    token: process.env.API_TOKEN,
    modelProvider: ModelProviderName.OPENAI,
    character: customCharacter,
    plugins: [bootstrapPlugin, nodePlugin],
});

const clients = await initializeClients(runtime, ["discord", "telegram"]);
```

### Plugin System

The plugin system provides modular extensibility through a standardized interface:

```typescript
interface Plugin {
    name: string;
    description: string;
    actions?: Action[];
    evaluators?: Evaluator[];
    providers?: Provider[];
    services?: Service[];
}
```

Key Available Plugins:

_Bootstrap Plugin (@eliza/plugin-bootstrap):_
Core actions: continue, followRoom, unfollowRoom, ignore, muteRoom
Evaluators: fact, goal
Providers: boredom, time, facts

_Image Generation Plugin (@eliza/plugin-image-generation):_
Actions: GENERATE_IMAGE
Supports multiple services (Anthropic, Together)
Auto-caption generation

_Node Plugin (@eliza/plugin-node):_
Services: Browser, ImageDescription, Llama, PDF, Speech, Transcription, Video

_Solana Plugin (@eliza/plugin-solana):_
Evaluators: trustEvaluator
Providers: walletProvider, trustScoreProvider

_Coinbase Plugins:_
Token Contract Plugin: ERC20, ERC721, ERC1155 deployment and management
Mass Payments Plugin: Batch transaction handling
Webhook Plugin: Event monitoring and notifications

_Plugin Usage:_

```typescript
import { bootstrapPlugin } from "@eliza/plugin-bootstrap";
import { imageGenerationPlugin } from "@eliza/plugin-image-generation";

const character = {
    plugins: [bootstrapPlugin, imageGenerationPlugin],
};
```

_Components & Development Example:_

Actions: Implement validation and handlers
Evaluators: Define clear criteria
Providers: Handle state and context
Services: Follow service architecture

```typescript
const myCustomPlugin: Plugin = {
    name: "my-custom-plugin",
    description: "Adds custom functionality",
    actions: [
        /* custom actions */
    ],
    evaluators: [
        /* custom evaluators */
    ],
    providers: [
        /* custom providers */
    ],
    services: [
        /* custom services */
    ],
};
```
