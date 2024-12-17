# Artcade Vector Pattern Storage PRD

## Overview

Implement a vector-based pattern storage system as part of the Artcade plugin for Eliza to improve HTML evolution quality by learning from successful game patterns, starting with the spinwheel example.

## Goals

1. Store successful game UI patterns as embeddings
2. Guide mutation operations using learned patterns
3. Improve evolution quality through pattern matching
4. Create a self-improving game pattern library

## Technical Architecture

### 1. Database Integration

```typescript
// Using Eliza's database adapter
import { DatabaseAdapter } from "@ai16z/eliza/plugin-node";

class VectorPatternStorage extends Service {
    private db: DatabaseAdapter;

    constructor(runtime: IAgentRuntime) {
        super();
        this.db = runtime.getDatabaseAdapter();
    }

    async initialize() {
        await this.db.query(`
      CREATE TABLE IF NOT EXISTS game_patterns (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" TEXT NOT NULL,
        "pattern_name" TEXT NOT NULL,
        "content" JSONB NOT NULL,
        "embedding" vector(1536),
        "effectiveness_score" FLOAT,
        "usage_count" INTEGER DEFAULT 0,
        "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        "last_used" TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_game_patterns_embedding
      ON game_patterns USING hnsw ("embedding" vector_cosine_ops);
    `);
    }
}
```

### 2. Pattern Types

```typescript
interface GamePattern {
    id: string;
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
    embedding: number[];
    effectiveness_score: number;
    usage_count: number;
}
```

### 3. Integration Points

#### A. Pattern Service (packages/plugin-artcade/src/services/PatternService.ts)

```typescript
import { Service } from "@ai16z/eliza/plugin-node";

class PatternService extends Service {
    private storage: VectorPatternStorage;
    private extractor: PatternExtractor;

    async initialize(runtime: IAgentRuntime) {
        await super.initialize(runtime);
        this.storage = new VectorPatternStorage(runtime);
        this.extractor = new PatternExtractor();
        await this.storage.initialize();
    }

    async extractAndStorePatterns(html: string): Promise<void> {
        const patterns = await this.extractor.extractAllPatterns(html);
        for (const pattern of patterns) {
            await this.storage.storePattern(pattern);
        }
    }
}
```

#### B. Pattern Extractor (packages/plugin-artcade/src/services/PatternExtractor.ts)

```typescript
class PatternExtractor {
    extractAnimationPatterns(html: string): Pattern[];
    extractLayoutPatterns(html: string): Pattern[];
    extractInteractionPatterns(html: string): Pattern[];
    extractStylePatterns(html: string): Pattern[];
}
```

#### C. Enhanced Evolution Integration (packages/plugin-artcade/src/evolution/EnhancedEvolution.ts)

```typescript
import { Service } from "@ai16z/eliza/plugin-node";

class EnhancedEvolution extends Service {
    private patternService: PatternService;

    async initialize(runtime: IAgentRuntime) {
        await super.initialize(runtime);
        this.patternService = runtime.getService("PatternService");
    }

    async mutate(html: string): Promise<string> {
        const patterns = await this.patternService.findRelevantPatterns(html);
        return this.applyPatternBasedMutation(html, patterns);
    }
}
```

## Plugin Configuration

Add to elizaConfig.yaml:

```yaml
plugins:
    - name: artcade
      enabled: true
      services:
          - PatternService
          - EnhancedEvolution
      settings:
          vector_storage:
              enabled: true
              embedding_dimension: 1536
              similarity_threshold: 0.85
              max_patterns_per_query: 10
```

## Implementation Phases

### Phase 1: Pattern Extraction

1. Create pattern extractors for the spinwheel example:

    - Extract neon glow animations
    - Extract centered layout patterns
    - Extract interaction patterns (buttons, hover effects)
    - Extract style patterns (gradients, shadows)

2. Initial patterns to extract from spinwheel:

```typescript
const initialPatterns = [
    {
        type: "animation",
        pattern_name: "neon_glow",
        content: {
            css: `@keyframes neon {
                0%, 100% { filter: drop-shadow(0 0 5px #ff00de)... }
                50% { filter: drop-shadow(0 0 10px #00fff2)... }
            }`,
            context: "interactive_feedback",
            metadata: {
                visual_type: "glow",
                animation_duration: "2s",
                color_scheme: ["#ff00de", "#00fff2"],
            },
        },
    },
    // ... more patterns
];
```

### Phase 2: Service Integration

1. Implement PatternService and register with Eliza
2. Set up database tables using Eliza's adapter
3. Add effectiveness scoring system
4. Create pattern usage tracking

### Phase 3: Evolution Enhancement

1. Modify evolution.js to use PatternService:

```typescript
class PatternBasedEvolution {
    constructor(private runtime: IAgentRuntime) {}

    async evolve(html: string) {
        const patternService = this.runtime.getService("PatternService");
        const patterns = await patternService.findRelevantPatterns(html);
        return this.applyPatterns(html, patterns);
    }
}
```

### Phase 4: Testing & Validation

1. Unit tests for pattern extraction
2. Integration tests with Eliza's test framework
3. Evolution quality metrics:
    - Pattern application success rate
    - Evolution improvement metrics
    - User engagement metrics

## Success Metrics

1. Evolution Quality:

    - Reduced number of invalid mutations
    - Increased pattern reuse
    - Higher consistency in game UI quality

2. Performance:

    - Pattern retrieval < 100ms
    - Mutation success rate > 90%
    - Pattern library growth rate

3. User Experience:
    - Improved visual consistency
    - Better game mechanics integration
    - More engaging animations

## Next Steps

1. Create PatternService implementation
2. Set up database tables using Eliza's adapter
3. Modify evolution.js to use patterns
4. Implement pattern scoring system
5. Create monitoring and metrics

## Questions to Resolve

1. Pattern granularity level
2. Scoring system weights
3. Pattern combination strategies
4. Version control for patterns
5. Pattern deprecation policy

## Detailed Implementation

### 1. Database Layer Implementation

```typescript
// packages/plugin-artcade/src/services/database/VectorDatabase.ts
import { DatabaseAdapter, Service } from "@ai16z/eliza/plugin-node";
import { Pool } from "pg";

export class VectorDatabase extends Service {
    private pool: Pool;
    private db: DatabaseAdapter;

    constructor(runtime: IAgentRuntime) {
        super();
        this.db = runtime.getDatabaseAdapter();
        // Initialize connection pool with Eliza's infrastructure settings
        this.pool = new Pool({
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }

    async initialize() {
        // Enable vector extension if not exists
        await this.db.query(`
            CREATE EXTENSION IF NOT EXISTS vector;
            CREATE EXTENSION IF NOT EXISTS hnsw;
        `);

        // Create vector operations
        await this.db.query(`
            CREATE OR REPLACE FUNCTION pattern_similarity(
                pattern1 vector,
                pattern2 vector
            ) RETURNS float AS $$
                SELECT 1 - (pattern1 <=> pattern2);
            $$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;
        `);
    }

    async findSimilarPatterns(
        embedding: number[],
        type: string,
        threshold: number = 0.85,
        limit: number = 5,
    ): Promise<GamePattern[]> {
        const result = await this.db.query(
            `
            SELECT *,
                pattern_similarity(embedding, $1::vector) as similarity
            FROM game_patterns
            WHERE
                type = $2 AND
                pattern_similarity(embedding, $1::vector) > $3
            ORDER BY similarity DESC
            LIMIT $4;
        `,
            [embedding, type, threshold, limit],
        );

        return result.rows;
    }
}
```

### 2. Pattern Extraction Service

```typescript
// packages/plugin-artcade/src/services/PatternExtractor.ts
import { OpenAIEmbeddings } from "@ai16z/eliza/plugin-node";
import { JSDOM } from "jsdom";

export class PatternExtractor extends Service {
    private embeddings: OpenAIEmbeddings;

    constructor(runtime: IAgentRuntime) {
        super();
        this.embeddings = new OpenAIEmbeddings(runtime);
    }

    async extractAnimationPatterns(html: string): Promise<Pattern[]> {
        const dom = new JSDOM(html);
        const document = dom.window.document;
        const patterns: Pattern[] = [];

        // Extract keyframe animations
        const styleSheets = document.querySelectorAll("style");
        for (const sheet of styleSheets) {
            const keyframes = sheet.textContent.match(
                /@keyframes\s+([^{]+)\s*{([^}]+)}/g,
            );
            if (keyframes) {
                for (const kf of keyframes) {
                    const pattern = await this.createAnimationPattern(kf);
                    patterns.push(pattern);
                }
            }
        }

        return patterns;
    }

    private async createAnimationPattern(css: string): Promise<Pattern> {
        const embedding = await this.embeddings.embedText(css);
        return {
            type: "animation",
            pattern_name: this.extractPatternName(css),
            content: {
                css,
                context: "animation",
                metadata: this.extractAnimationMetadata(css),
            },
            embedding,
            effectiveness_score: 1.0,
            usage_count: 0,
        };
    }

    private extractAnimationMetadata(css: string): PatternMetadata {
        // Implementation details for metadata extraction
        return {
            visual_type: this.detectVisualType(css),
            animation_duration: this.extractDuration(css),
            color_scheme: this.extractColors(css),
        };
    }
}
```

### 3. Pattern Application Service

```typescript
// packages/plugin-artcade/src/services/PatternApplicator.ts
import { Service } from "@ai16z/eliza/plugin-node";
import { JSDOM } from "jsdom";

export class PatternApplicator extends Service {
    async applyPattern(html: string, pattern: GamePattern): Promise<string> {
        const dom = new JSDOM(html);
        const document = dom.window.document;

        switch (pattern.type) {
            case "animation":
                return this.applyAnimationPattern(document, pattern);
            case "layout":
                return this.applyLayoutPattern(document, pattern);
            case "style":
                return this.applyStylePattern(document, pattern);
            default:
                throw new Error(`Unknown pattern type: ${pattern.type}`);
        }
    }

    private async applyAnimationPattern(
        document: Document,
        pattern: GamePattern,
    ): Promise<string> {
        // Add style tag if not exists
        let styleTag = document.querySelector("style");
        if (!styleTag) {
            styleTag = document.createElement("style");
            document.head.appendChild(styleTag);
        }

        // Add animation CSS
        styleTag.textContent += `\n${pattern.content.css}`;

        // Apply animation to target elements
        const targetElements = this.findTargetElements(document, pattern);
        for (const element of targetElements) {
            this.applyAnimationToElement(element, pattern);
        }

        return document.documentElement.outerHTML;
    }

    private findTargetElements(
        document: Document,
        pattern: GamePattern,
    ): Element[] {
        // Smart element selection based on pattern context
        const selectors = this.generateSelectors(pattern);
        return Array.from(document.querySelectorAll(selectors.join(", ")));
    }

    private generateSelectors(pattern: GamePattern): string[] {
        // Generate appropriate selectors based on pattern context
        const selectors = [];
        if (pattern.content.metadata.visual_type === "glow") {
            selectors.push(".btn", ".interactive", '[role="button"]');
        }
        return selectors;
    }
}
```

### 4. Evolution Integration

```typescript
// packages/plugin-artcade/src/evolution/PatternBasedEvolution.ts
import { Service } from "@ai16z/eliza/plugin-node";

export class PatternBasedEvolution extends Service {
    private patternService: PatternService;
    private applicator: PatternApplicator;
    private vectorDb: VectorDatabase;

    async initialize(runtime: IAgentRuntime) {
        await super.initialize(runtime);
        this.patternService = runtime.getService("PatternService");
        this.applicator = new PatternApplicator(runtime);
        this.vectorDb = new VectorDatabase(runtime);
    }

    async evolve(html: string): Promise<string> {
        // Extract current patterns
        const currentPatterns = await this.patternService.extractPatterns(html);

        // Find similar successful patterns
        const improvements = await Promise.all(
            currentPatterns.map(async (pattern) => {
                const similar = await this.vectorDb.findSimilarPatterns(
                    pattern.embedding,
                    pattern.type,
                    0.85,
                );
                return this.selectBestPattern(similar);
            }),
        );

        // Apply improvements
        let evolvedHtml = html;
        for (const pattern of improvements) {
            if (pattern) {
                evolvedHtml = await this.applicator.applyPattern(
                    evolvedHtml,
                    pattern,
                );
            }
        }

        return evolvedHtml;
    }

    private selectBestPattern(patterns: GamePattern[]): GamePattern | null {
        if (patterns.length === 0) return null;

        // Weight by effectiveness and usage
        return patterns.reduce((best, current) => {
            const bestScore =
                best.effectiveness_score * Math.log(best.usage_count + 1);
            const currentScore =
                current.effectiveness_score * Math.log(current.usage_count + 1);
            return currentScore > bestScore ? current : best;
        });
    }
}
```

### 5. Fine-tuning Integration

```typescript
// packages/plugin-artcade/src/services/PatternOptimizer.ts
import { Service } from "@ai16z/eliza/plugin-node";

export class PatternOptimizer extends Service {
    private readonly BATCH_SIZE = 100;
    private readonly MIN_SAMPLES = 50;

    async optimizePatterns(): Promise<void> {
        const patterns = await this.getTrainingPatterns();
        if (patterns.length < this.MIN_SAMPLES) {
            return; // Not enough data for optimization
        }

        // Prepare training data
        const trainingData = patterns.map((pattern) => ({
            input: pattern.content,
            output: {
                effectiveness: pattern.effectiveness_score,
                usage: pattern.usage_count,
            },
        }));

        // Fine-tune pattern selection model
        await this.fineTuneModel(trainingData);
    }

    private async fineTuneModel(trainingData: any[]): Promise<void> {
        // Implementation using Eliza's fine-tuning infrastructure
        const modelConfig = {
            baseModel: "gpt-3.5-turbo",
            epochs: 3,
            batchSize: this.BATCH_SIZE,
            learningRate: 1e-5,
        };

        await this.runtime.fineTuneModel(
            trainingData,
            modelConfig,
            "pattern-optimization",
        );
    }
}
```

## Pattern Approval System

### 1. Staging Area Implementation

```typescript
// packages/plugin-artcade/src/services/PatternStaging.ts
import { Service } from "@ai16z/eliza/plugin-node";

interface StagedPattern extends GamePattern {
    staged_at: Date;
    evolution_source: string; // Which evolution run produced this
    location: {
        file: string;
        start_line: number;
        end_line: number;
    };
    pending_approval: boolean;
}

export class PatternStagingService extends Service {
    private stagedPatterns: Map<string, StagedPattern> = new Map();

    async stagePattern(
        pattern: Partial<GamePattern>,
        source: string,
        location: { file: string; start_line: number; end_line: number },
    ): Promise<string> {
        const stagingId = crypto.randomUUID();

        this.stagedPatterns.set(stagingId, {
            ...pattern,
            staged_at: new Date(),
            evolution_source: source,
            location,
            pending_approval: true,
        } as StagedPattern);

        return stagingId;
    }

    async approvePattern(
        stagingId: string,
        approvalMetadata: {
            reason: string;
            quality_notes?: string;
            inspiration_source?: string;
        },
    ): Promise<void> {
        const pattern = this.stagedPatterns.get(stagingId);
        if (!pattern) {
            throw new Error(`Pattern ${stagingId} not found in staging`);
        }

        // Add approval metadata
        const approvedPattern = {
            ...pattern,
            content: {
                ...pattern.content,
                metadata: {
                    ...pattern.content.metadata,
                    approval: {
                        approved_at: new Date(),
                        ...approvalMetadata,
                    },
                },
            },
            pending_approval: false,
        };

        // Store in vector database
        await this.runtime
            .getService("PatternService")
            .storeApprovedPattern(approvedPattern);

        // Remove from staging
        this.stagedPatterns.delete(stagingId);
    }

    async rejectPattern(stagingId: string): Promise<void> {
        this.stagedPatterns.delete(stagingId);
    }

    async listStagedPatterns(): Promise<
        Array<{ id: string; pattern: StagedPattern }>
    > {
        return Array.from(this.stagedPatterns.entries()).map(
            ([id, pattern]) => ({ id, pattern }),
        );
    }
}
```

### 2. Evolution Result Tracking

```typescript
// packages/plugin-artcade/src/evolution/EvolutionTracker.ts
export class EvolutionTracker extends Service {
    private currentRun: {
        id: string;
        startTime: Date;
        sourceFile: string;
        patterns: Array<{
            stagingId: string;
            location: {
                start_line: number;
                end_line: number;
            };
            type: string;
        }>;
    } | null = null;

    startEvolutionRun(sourceFile: string): string {
        const runId = crypto.randomUUID();
        this.currentRun = {
            id: runId,
            startTime: new Date(),
            sourceFile,
            patterns: [],
        };
        return runId;
    }

    async trackPattern(
        runId: string,
        pattern: Partial<GamePattern>,
        location: { start_line: number; end_line: number },
    ): Promise<string> {
        if (!this.currentRun || this.currentRun.id !== runId) {
            throw new Error("No active evolution run");
        }

        const stagingService = this.runtime.getService("PatternStagingService");
        const stagingId = await stagingService.stagePattern(pattern, runId, {
            file: this.currentRun.sourceFile,
            ...location,
        });

        this.currentRun.patterns.push({
            stagingId,
            location,
            type: pattern.type,
        });

        return stagingId;
    }
}
```

### 3. Modified Pattern Storage

```typescript
// Update VectorDatabase class
export class VectorDatabase extends Service {
    // ... existing code ...

    async storeApprovedPattern(pattern: GamePattern): Promise<void> {
        const { approval } = pattern.content.metadata;

        await this.db.query(
            `
            INSERT INTO game_patterns (
                type,
                pattern_name,
                content,
                embedding,
                effectiveness_score,
                approval_metadata
            ) VALUES (
                $1, $2, $3, $4, $5, $6
            )
        `,
            [
                pattern.type,
                pattern.pattern_name,
                pattern.content,
                pattern.embedding,
                1.0, // Initial score
                approval,
            ],
        );
    }

    async getPatternHistory(patternId: string): Promise<{
        approval: any;
        usage_history: Array<{
            used_at: Date;
            success_rate: number;
        }>;
    }> {
        const result = await this.db.query(
            `
            SELECT
                content->'metadata'->'approval' as approval,
                usage_history
            FROM game_patterns
            WHERE id = $1
        `,
            [patternId],
        );

        return result.rows[0];
    }
}
```

### 4. Usage Example

```typescript
// In evolution.js
async function evolveWithApproval() {
    const tracker = runtime.getService("EvolutionTracker");
    const runId = tracker.startEvolutionRun("evolved.html");

    const evolved = await evolution.evolve(sourceHtml);

    // Extract potential patterns
    const patterns = await patternExtractor.extractPatterns(evolved);

    // Stage all patterns for approval
    for (const pattern of patterns) {
        const stagingId = await tracker.trackPattern(
            runId,
            pattern,
            pattern.location,
        );

        console.log(`
Pattern staged for approval:
ID: ${stagingId}
Type: ${pattern.type}
Location: Lines ${pattern.location.start_line}-${pattern.location.end_line}
        `);
    }

    return evolved;
}

// Later, when you approve a pattern:
async function approvePattern(stagingId: string, reason: string) {
    const staging = runtime.getService("PatternStagingService");
    await staging.approvePattern(stagingId, {
        reason,
        approved_at: new Date(),
    });
}

// When you reject a pattern:
async function rejectPattern(stagingId: string) {
    const staging = runtime.getService("PatternStagingService");
    await staging.rejectPattern(stagingId);
}
```

This approval system ensures:

1. All evolved patterns go to staging first
2. Each pattern maintains its source location for review
3. Only explicitly approved patterns enter the vector database
4. Approval metadata is preserved for quality tracking
5. Rejected patterns are cleanly removed
6. Pattern history and usage statistics are tracked

When running evolution tests, the workflow will be:

1. Run evolution
2. System shows you staged patterns with their locations
3. You review and explicitly approve/reject each pattern
4. Approved patterns enter the vector database with your quality notes
5. Future evolutions can only learn from approved patterns

Would you like me to implement any specific part of this approval system first?

---

Basic Game Elements:
✅ Player character with collision detection
✅ Collectibles with points
✅ Obstacles with damage
✅ Score tracking
✅ Health system
✅ Timer
Movement and Controls:
✅ Keyboard controls (arrow keys)
✅ Touch controls for mobile
✅ Player speed attribute
✅ Smooth movement
Game State Management:
✅ Score system with multipliers
✅ Health tracking
✅ Level progression
✅ Game over condition
✅ Combo system
Power-ups and Special Features:
✅ Speed boost
✅ Invincibility
✅ Duration-based effects
✅ Power-up collection
Level Design:
✅ Portals for level progression
✅ Checkpoints
✅ Level counter
UI Elements:
✅ Score display
✅ Health bar
✅ Level indicator
✅ Touch controls layout
Collision System:
✅ Bounding box collision detection
✅ Event-based collision handling
✅ Collision response (damage, points, effects)
Animation and Visual Feedback:
✅ CSS transitions for movement
✅ Visual feedback for power-ups
✅ Score popup animations
