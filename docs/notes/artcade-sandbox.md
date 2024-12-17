# Artcade Sandbox Testing Questions

# Claude Proposes...

1. Setup a simple dev server
2. Create a visual pattern playground:
    - Pattern preview area
    - Controls for pattern parameters
    - Real-time embedding visualization
    - Pattern effectiveness metrics display
3. Add basic monitoring:
    - Console logging for pattern operations
    - Visual feedback for pattern mutations
    - Performance metrics display

## Pattern Evolution

**Question**: How does pattern evolution work in terms of effectiveness scores and mutation?
**Relevant Files**:

- `packages/plugin-artcade/src/services/PatternEvolution.ts` - Core evolution logic
- `packages/plugin-artcade/src/__tests__/PatternEvolution.test.ts` - Evolution tests
- `packages/plugin-artcade/src/types/effectiveness.ts` - Effectiveness type definitions

**Key Components to Test**:

1. Evolution Configuration:

```typescript
interface EvolutionConfig {
    populationSize?: number; // Default: 10
    generationLimit?: number; // Default: 50
    mutationRate?: number; // Default: 0.3
    crossoverRate?: number; // Default: 0.7
    elitismCount?: number; // Default: 2
    similarityThreshold?: number; // Default: 0.85
    fitnessThreshold?: number; // Default: 0.7
}
```

2. Effectiveness Metrics:

```typescript
interface PatternEffectivenessMetrics {
    pattern_id: string;
    prompt_keywords: string[];
    embedding_similarity: number;
    claude_usage: {
        direct_reuse: boolean;
        structural_similarity: number;
        feature_adoption: string[];
        timestamp: Date;
    };
    quality_scores: {
        visual: number;
        interactive: number;
        functional: number;
        performance: number;
    };
    usage_stats: {
        total_uses: number;
        successful_uses: number;
        average_similarity: number;
        last_used: Date;
    };
}
```

**Testing Focus Areas**:

1. Pattern Mutation

    - How mutations affect pattern structure
    - Mutation rate impact on evolution
    - Boundary conditions for mutation parameters

2. Effectiveness Scoring

    - Quality score calculation
    - Usage statistics tracking
    - Embedding similarity thresholds

3. Evolution Process
    - Population management
    - Generation progression
    - Elitism implementation
    - Crossover mechanics

## Vector Database

**Question**: How does the vector database store and retrieve patterns? What's the data structure?
**Relevant Files**:

- `packages/plugin-artcade/src/services/VectorDatabase.ts` - Database implementation
- `packages/plugin-artcade/src/__tests__/VectorDatabase.test.ts` - Database tests
- `packages/plugin-artcade/src/__tests__/helpers/DatabaseTestHelper.ts` - Test utilities

**Key Components to Test**:

1. Database Structure:

```typescript
export class VectorDatabase extends Service {
    private db!: DatabaseAdapter<any>;
    private embeddingCache!: any;
    private vectorOps!: any;
    private memoryManager!: MemoryManager;
    private cache: Map<
        string,
        {
            pattern: GamePattern;
            timestamp: number;
        }
    >;
}
```

2. Search Results Interface:

```typescript
export interface VectorSearchResult {
    pattern: GamePattern;
    similarity: number;
}
```

3. Error Handling:

```typescript
class DatabaseError extends Error {
    constructor(
        message: string,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = "DatabaseError";
    }
}
```

**Testing Focus Areas**:

1. Data Storage & Retrieval

    - Pattern storage mechanism
    - Vector embedding generation
    - Cache management
    - Memory management

2. Search Functionality

    - Similarity search implementation
    - Search result ranking
    - Performance optimization

3. Error Handling

    - Database operation failures
    - Invalid pattern handling
    - Cache invalidation
    - Connection management

4. Integration Points
    - Pattern service integration
    - Memory manager interaction
    - Embedding cache synchronization

## Pattern Staging

**Question**: What is the staging process for patterns before they're committed to the database?
**Relevant Files**:

- `packages/plugin-artcade/src/services/PatternStaging.ts` - Staging implementation
- `packages/plugin-artcade/src/__tests__/PatternStaging.test.ts` - Staging tests

**Key Components to Test**:

1. Pattern Structure:

```typescript
export interface GamePattern {
    id?: string;
    type: "animation" | "layout" | "interaction" | "style";
    pattern_name: string;
    content: {
        html: string;
        css?: string;
        js?: string;
        context: string;
        metadata: {
            visual_type?: string;
            interaction_type?: string;
            color_scheme?: string[];
            animation_duration?: string;
            dependencies?: string[];
        };
    };
    embedding?: number[];
    effectiveness_score: number;
    usage_count: number;
}
```

2. Staged Pattern Extension:

```typescript
export interface StagedPattern extends GamePattern {
    staged_at: Date;
    evolution_source: string;
    location: {
        file: string;
        start_line: number;
        end_line: number;
    };
    pending_approval: boolean;
}
```

**Testing Focus Areas**:

1. Pattern Validation

    - Type validation
    - Required field checking
    - Content structure verification
    - Metadata validation

2. Staging Process

    - Pattern staging workflow
    - Approval mechanism
    - Evolution source tracking
    - Location tracking

3. Integration

    - Pattern service interaction
    - Database staging area
    - Evolution pipeline integration

4. Error Cases
    - Invalid pattern rejection
    - Duplicate handling
    - Staging conflicts
    - Approval workflow errors

## Pattern Learning

**Question**: How does the system learn from user interactions and feedback?
**Relevant Files**:

- `packages/plugin-artcade/src/services/PatternLearning.ts` - Learning implementation
- `packages/plugin-artcade/src/__tests__/PatternLearning.test.ts` - Learning tests

**Key Components to Test**:

1. Feedback Structure:

```typescript
interface HTMLFeedback {
    html: string;
    sourceFile: string;
    lineRange: { start: number; end: number };
    feedback: {
        visualAppeal?: {
            colorHarmony?: number;
            animationSmoothness?: number;
            layoutBalance?: number;
            spacing?: number;
            typography?: number;
        };
        gameplayElements?: {
            playerControls?: number;
            collisionDetection?: number;
            scoreTracking?: number;
            powerUps?: number;
            obstacles?: number;
        };
        interactivity?: {
            responsiveness?: number;
            feedback?: number;
            controls?: number;
            transitions?: number;
        };
        performance?: {
            smoothness?: number;
            loadTime?: number;
            memoryUsage?: number;
        };
        accessibility?: {
            keyboardNav?: number;
            colorContrast?: number;
            screenReader?: number;
        };
        codeQuality?: {
            maintainability?: number;
            reusability?: number;
            modularity?: number;
        };
        naturalLanguageFeedback: string;
    };
}
```

**Testing Focus Areas**:

1. Feedback Processing

    - Visual appeal metrics
    - Gameplay element evaluation
    - Interactivity assessment
    - Performance metrics
    - Accessibility scoring
    - Code quality analysis

2. Learning Mechanism

    - Feedback incorporation
    - Pattern improvement
    - Score adjustment
    - Learning rate control

3. Integration Points

    - Pattern staging interaction
    - Database updates
    - Evolution pipeline feedback

4. Quality Assurance
    - Feedback validation
    - Score normalization
    - Metric consistency
    - Learning stability

## Pattern Library

**Question**: How are patterns stored and managed in the library?
**Relevant Files**:

- `packages/plugin-artcade/src/services/PatternLibrary.ts` - Library implementation
- `packages/plugin-artcade/src/__tests__/PatternLibrary.test.ts` - Library tests
- `packages/plugin-artcade/src/data/patterns.json` - Pattern data

**Key Components to Test**:

1. Pattern Structure:

```typescript
interface GamePattern {
    id: string;
    type: "animation" | "layout" | "interaction" | "style" | "game_mechanic";
    pattern_name: string;
    content: {
        html: string;
        css?: string;
        js?: string;
        context: string;
        metadata: {
            visual_type?: string;
            interaction_type?: string;
            color_scheme?: string[];
            animation_duration?: string;
            dependencies?: string[];
            game_mechanics?: {
                type: string;
                properties: Record<string, any>;
            }[];
        };
    };
    embedding: number[];
    effectiveness_score: number;
    usage_count: number;
    created_at?: Date;
    last_used?: Date;
}
```

2. Search Interface:

```typescript
interface PatternSearchResult {
    pattern: GamePattern;
    similarity: number;
}
```

**Testing Focus Areas**:

1. Pattern Management

    - Pattern storage
    - Pattern retrieval
    - Pattern updates
    - Pattern versioning
    - Pattern deletion

2. Search Functionality

    - Pattern search by type
    - Pattern search by metadata
    - Similarity-based search
    - Search result ranking

3. Library Operations

    - Pattern initialization
    - Pattern validation
    - Pattern deduplication
    - Pattern categorization

4. Integration Points
    - Vector database interaction
    - Pattern staging interaction
    - Runtime service integration

## Integration

**Question**: How do all these components work together in the system?
**Relevant Files**:

- `packages/plugin-artcade/src/__tests__/integration.test.ts` - Integration tests
- `packages/plugin-artcade/src/services/PatternService.ts` - Main service orchestration
- `packages/plugin-artcade/src/__tests__/PatternService.test.ts` - Service tests

**Key Components to Test**:

1. Pattern Service Structure:

```typescript
export class PatternService extends Service {
    private patterns: Map<string, GamePattern> = new Map();
    private templates: Map<string, Partial<GamePattern>> = new Map();

    async createFromTemplate(
        type: string,
        customizations: Record<string, any> = {},
    ): Promise<GamePattern | null> {
        const template = await this.getTemplate(type);
        if (!template) return null;

        const pattern: GamePattern = {
            id: `${type}_${Date.now()}`,
            type: template.type || type,
            pattern_name: `${type}_pattern_${Date.now()}`,
            content: {
                html: template.content?.html || "",
                css: template.content?.css,
                js: template.content?.js,
                context: template.content?.context || "game",
                metadata: {
                    ...template.content?.metadata,
                    ...customizations,
                },
            },
            effectiveness_score: template.effectiveness_score || 1.0,
            usage_count: 0,
        };
        return pattern;
    }
}
```

2. Integration Test Setup:

```typescript
describe("Artcade Plugin Integration", () => {
    let runtime: IAgentRuntime;
    let memoryStore: Map<string, any>;
    let lastMemoryId: string;

    beforeEach(() => {
        memoryStore = new Map();
        lastMemoryId = "0";

        runtime = {
            getMemoryManager: () => ({
                createMemory: vi.fn(async (memory) => {
                    const id = (parseInt(lastMemoryId) + 1).toString();
                    lastMemoryId = id;
                    memoryStore.set(id, { id, ...memory });
                    return { id, ...memory };
                }),
                // ... other memory operations
            }),
        };
    });
});
```

**Testing Focus Areas**:

1. Service Orchestration

    - Pattern creation workflow
    - Template management
    - Service initialization
    - Component interaction

2. Memory Management

    - Memory creation
    - Memory retrieval
    - Memory search
    - Memory persistence

3. Plugin Integration

    - Plugin initialization
    - Action handling
    - Event propagation
    - Error handling

4. Component Interaction
    - Service communication
    - Data flow
    - State management
    - Event handling

## Pattern Templates

**Question**: How are shader templates generated and managed?
**Relevant Files**:

- `packages/plugin-artcade/src/templates/shader-template.ts` - Template implementation
- `packages/plugin-artcade/src/__tests__/ShaderTemplate.test.ts` - Template tests

**Key Components to Test**:

1. Shader Template Structure:

```typescript
export const SHADER_TEMPLATE: Partial<GamePattern> = {
    type: "shader",
    pattern_name: "webgl_shader_template",
    content: {
        html: `
<!-- WebGL Shader Template with Real-time Controls -->
<canvas id="shaderCanvas"></canvas>
<button id="toggleMenu">Customize Shader</button>
<button id="randomizeButton">Randomize Shader</button>
<div id="customizeMenu">
    <h3>Shader Customization</h3>
    <div id="controls"></div>
</div>

<script id="vertexShader" type="x-shader/x-vertex">
    attribute vec4 aVertexPosition;
    void main() {
        gl_Position = aVertexPosition;
    }
</script>

<script id="fragmentShader" type="x-shader/x-fragment">
    precision highp float;
    // Standard uniforms
    uniform vec2 uResolution;
    uniform float uTime;
    // Customizable uniforms
    uniform float uIterations;
    uniform float uColorShift;
    uniform float uZoom;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uColor4;
    uniform float uMirrors;
</script>
`,
    },
};
```

**Testing Focus Areas**:

1. Template Generation

    - Shader compilation
    - Template customization
    - Dynamic control generation
    - WebGL context management

2. Template Management

    - Template registration
    - Template versioning
    - Template validation
    - Template updates

3. Shader Functionality

    - Uniform handling
    - Shader compilation
    - WebGL integration
    - Performance optimization

4. User Interface
    - Control panel functionality
    - Real-time updates
    - Customization options
    - Event handling

## Demo Implementation

**Question**: How is the demo implemented and what does it demonstrate?
**Relevant Files**:

- `packages/plugin-artcade/demo/index.html` - Demo interface
- `packages/plugin-artcade/demo/evolve.js` - Evolution demo

**Key Components to Test**:

1. Demo Interface:

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Artcade Demo</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 20px;
                padding: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Test Page</h1>
            <div class="content">
                <p>
                    This is a test paragraph that will be evolved into something
                    more interactive.
                </p>
                <div class="box">
                    <span>Click me!</span>
                </div>
            </div>
        </div>
    </body>
</html>
```

2. Evolution Demo:

```javascript
async function evolveHTML() {
    const mockRuntime = {
        memory: new Map(),
        async get(key) {
            return this.memory.get(key);
        },
        async set(key, value) {
            this.memory.set(key, value);
        },
        async delete(key) {
            this.memory.delete(key);
        },
        getMemoryManager() {
            return {
                get: async (key) => this.memory.get(key),
                set: async (key, value) => this.memory.set(key, value),
                delete: async (key) => this.memory.delete(key),
                clear: async () => this.memory.clear(),
                createMemory: async (key, value) => this.memory.set(key, value),
            };
        },
    };

    const evolved = await engine.evolve(inputHTML, {
        generations: 1,
        populationSize: 3,
        mutationRate: 0.8,
    });
}
```

**Testing Focus Areas**:

1. Demo Setup

    - HTML structure
    - Initial state
    - Environment setup
    - Plugin initialization

2. Evolution Process

    - HTML evolution
    - Memory management
    - Runtime simulation
    - Evolution parameters

3. User Interface

    - Interactive elements
    - Visual feedback
    - Event handling
    - State updates

4. Integration Testing
    - Plugin integration
    - Evolution engine
    - Memory persistence
    - File I/O operations

## Types and Interfaces

**Question**: What are the core types and interfaces used throughout the system?
**Relevant Files**:

- `packages/plugin-artcade/src/types/index.ts` - Main type definitions
- `packages/plugin-artcade/src/types/effectiveness.ts` - Effectiveness types
- `packages/plugin-artcade/src/types/patterns.ts` - Pattern types

**Key Components to Test**:

1. Game Pattern Interface:

```typescript
export interface GamePattern {
    id: string;
    type: "animation" | "layout" | "interaction" | "style" | "game_mechanic";
    pattern_name: string;
    content: {
        html: string;
        css?: string;
        js?: string;
        context: string;
        metadata: {
            visual_type?: string;
            interaction_type?: string;
            color_scheme?: string[];
            animation_duration?: string;
            dependencies?: string[];
            game_mechanics?: Array<{
                type: string;
                properties: Record<string, any>;
            }>;
        };
    };
    embedding: number[];
    effectiveness_score: number;
    usage_count: number;
    created_at?: Date;
    last_used?: Date;
}
```

2. Pattern Management Interfaces:

```typescript
export interface StagedPattern extends GamePattern {
    staged_at: Date;
    evolution_source: string;
    location: {
        file: string;
        start_line: number;
        end_line: number;
    };
    pending_approval: boolean;
}

export interface ApprovalMetadata {
    reason: string;
    quality_notes?: string;
    inspiration_source?: string;
    approved_at: Date;
}

export interface PatternHistory {
    id: string;
    pattern_id: string;
    action: "created" | "approved" | "rejected" | "modified";
}
```

**Testing Focus Areas**:

1. Type Validation

    - Pattern type constraints
    - Required fields
    - Optional fields
    - Type extensions

2. Interface Integration

    - Cross-component compatibility
    - Type consistency
    - Interface inheritance
    - Type safety

3. Pattern Lifecycle

    - Pattern creation
    - Pattern staging
    - Pattern approval
    - Pattern history

4. Type Usage
    - Type imports/exports
    - Type composition
    - Type guards
    - Type utilities

## Cursor Mechanics

**Question**: How are cursor mechanics implemented and tracked?
**Relevant Files**:

- `packages/plugin-artcade/src/patterns/cursor-mechanics.ts` - Cursor implementation

**Key Components to Test**:

1. Cursor Pattern Implementation:

```typescript
export const glitchInvasionPattern: GamePattern = {
    id: uuidv4(),
    type: "game_mechanic",
    pattern_name: "cursor_trail_scoring",
    content: {
        html: `<div id='gameArea'></div>`,
        js: `document.addEventListener('mousemove', e => {
            const trail = document.createElement('div');
            trail.className = 'trail';
            trail.style.left = e.clientX + 'px';
            trail.style.top = e.clientY + 'px';
            gameArea.appendChild(trail);
            setTimeout(() => trail.remove(), 1000);
            score += 1;
            document.getElementById('score').textContent = score;
        });`,
        css: `.trail {
            position: absolute;
            width: 32px;
            height: 32px;
            background: #0f0;
            border-radius: 50%;
            transition: all 0.3s;
        }`,
        metadata: {
            interaction_type: "cursor_following",
            game_mechanics: [
                {
                    type: "movement",
                    properties: {
                        uses_mouse: true,
                        creates_trail: true,
                        affects_score: true,
                        cleanup_timeout: 1000,
                    },
                },
            ],
            effectiveness_metrics: {
                responsiveness: 1.0,
                visual_feedback: 0.9,
                performance: 0.95,
                engagement: 0.85,
            },
        },
    },
};
```

**Testing Focus Areas**:

1. Cursor Tracking

    - Mouse movement detection
    - Position calculation
    - Trail generation
    - Performance optimization

2. Visual Feedback

    - Trail rendering
    - Animation smoothness
    - Visual effects
    - Style customization

3. Game Mechanics

    - Score tracking
    - Trail cleanup
    - Event handling
    - State management

4. Performance
    - DOM manipulation
    - Memory management
    - Animation performance
    - Event throttling

This completes the detailed analysis of all sections in the sandbox testing documentation. Would you like me to focus on any particular section in more detail?
