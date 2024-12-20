# Artcade Pattern System Architecture

## 1. Core Type System

### 1.1 GamePattern Interface

Located in: `packages/plugin-artcade/src/types/patterns.ts`

The `GamePattern` interface serves as the source of truth for all pattern operations in the system. It defines the core structure that all patterns must conform to for database storage and retrieval.

Key Components:

```typescript
export interface GamePattern {
    // Core Identifiers
    id: string; // UUID for unique identification
    type: "animation" | "layout" | "interaction" | "style" | "game_mechanic";
    pattern_name: string; // Human-readable identifier

    // Content Structure
    content: {
        html: string; // Required: Core implementation
        css?: string; // Optional: Styling
        js?: string; // Optional: Interactivity
        context: string; // Required: Usage context
        metadata: PatternMetadata;
    };

    // Vector Data
    embedding?: number[]; // 1536-dimensional vector

    // Usage Metrics
    effectiveness_score: number;
    usage_count: number;

    // Timestamps
    created_at?: Date;
    last_used?: Date;

    // Ownership
    room_id: string; // Required: UUID of containing room
    user_id: string; // Required: UUID of creator
    agent_id: string; // Required: UUID of generating agent

    // Extended Metrics
    usage_stats?: {
        total_uses: number;
        successful_uses: number;
        average_similarity: number;
        last_used: Date;
    };

    // Claude Integration
    claude_usage_metrics?: {
        last_usage: {
            direct_reuse: boolean;
            structural_similarity: number;
            feature_adoption: string[];
            timestamp: Date;
        };
    };
}

// Pattern Metadata Structure
export interface PatternMetadata {
    description?: string;
    visual_type?: string;
    interaction_type?: string;
    color_scheme?: string[];
    animation_duration?: string;
    dependencies?: string[];
    game_mechanics?: Array<{
        type: string;
        properties: Record<string, any>;
    }>;
    evolution?: {
        parent_pattern_id: string;
        applied_patterns: string[];
        mutation_type: GamePattern["type"];
        fitness_scores: Record<string, number>;
    };
    semantic_tags?: SemanticTags;
}

// Semantic Tagging System
export interface SemanticTags {
    use_cases: string[]; // Pattern application contexts
    mechanics: string[]; // Game mechanics implemented
    interactions: string[]; // User interaction patterns
    visual_style: string[]; // Visual design elements
}
```

Required Fields for Database Ingestion:

- `id`: UUID string
- `type`: Must be one of the valid pattern types
- `pattern_name`: Unique identifier name
- `content`: Must contain at least html and context
- `room_id`: UUID string
- `user_id`: UUID string
- `agent_id`: UUID string

The embedding field is automatically generated during storage operations using OpenAI's text-embedding-3-small model.

### 1.2 Type Hierarchy

#### Pattern Types

Located in: `packages/plugin-artcade/playground/src/shared/pattern.types.ts`

- **StoredPattern**: Base interface for patterns in storage
- **SimilarPattern**: Extends StoredPattern with `similarity: number`
- **StagedPattern**: Extends GamePattern with staging metadata

#### Request/Response Types

These types form the core contract between client and server for pattern operations:

```typescript
// Used when storing new patterns, includes content and metadata but no ID
interface PatternStorageRequest {
    type: GamePattern["type"];
    pattern_name?: string;
    content: {
        html: string; // The core HTML implementation
        css?: string; // Optional styling
        js?: string; // Optional interactivity
        context: string; // Usage context (e.g., "game", "ui", "animation")
        metadata: PatternMetadata;
    };
    room_id?: string; // Optional, generated if not provided
    user_id?: string; // Optional, generated if not provided
    agent_id?: string; // Optional, generated if not provided
}

// Response after pattern storage, includes generated ID and embedding
interface PatternStorageResponse {
    success: boolean;
    data?: GamePattern; // Complete pattern with generated fields
    error?: {
        message: string;
        details?: any; // Validation errors or storage issues
    };
}

// Response when retrieving a pattern by ID
interface PatternRetrievalResponse {
    success: boolean;
    data?: GamePattern; // Complete pattern if found
    error?: {
        message: string;
        details?: any; // Not found or retrieval issues
    };
}

// Request for finding similar patterns
interface SimilarPatternsRequest {
    patternId?: string; // Source pattern ID
    html?: string; // Alternative: raw HTML to match
    type?: GamePattern["type"]; // Optional type filter
    threshold?: number; // Similarity threshold (0.0-1.0)
    limit?: number; // Max results to return
}

// Response with similar patterns and their similarity scores
interface SimilarPatternsResponse {
    success: boolean;
    data?: Array<SimilarPattern>; // Patterns with similarity scores
    error?: {
        message: string;
        details?: any;
    };
}
```

## 2. Service Layer Architecture

### 2.1 VectorSupabase Service

Located in: `packages/plugin-artcade/src/services/VectorSupabase.ts`

Core Operations:

#### Storage Operations

```typescript
// Store a complete pattern with embedding
async storePattern(pattern: GamePattern): Promise<void> {
    const embedding = await this.generateEmbedding(pattern);
    await this.supabase.from("vector_patterns").insert({
        ...pattern,
        embedding,
        effectiveness_score: pattern.effectiveness_score || 0,
        usage_count: pattern.usage_count || 0,
        created_at: pattern.created_at || new Date(),
        last_used: pattern.last_used || new Date()
    });
}

// Store just the embedding for an existing pattern
async storePatternEmbedding(id: string, embedding: number[]): Promise<void>
```

#### Retrieval Operations

```typescript
// Direct pattern lookup by ID
async getPattern(id: string): Promise<GamePattern | null>

// Cached pattern lookup with validation
async getPatternById(id: string): Promise<GamePattern>

// Get all patterns (with optional filtering)
async getAllPatterns(): Promise<GamePattern[]>
```

#### Search Operations

```typescript
// Find patterns with similar embeddings
async findSimilarPatterns(
    input: string | GamePattern,
    threshold = 0.7,
    limit = 5,
    type?: GamePattern["type"]
): Promise<Array<{pattern: GamePattern, similarity: number}>> {
    // 1. Generate or extract embedding
    const searchEmbedding = typeof input === "string"
        ? await this.generateEmbeddingFromText(input)
        : await this.generateEmbedding(input);

    // 2. Perform vector similarity search
    const { data } = await this.supabase.rpc("match_patterns", {
        query_embedding: searchEmbedding,
        match_threshold: threshold,
        match_count: limit,
        pattern_type: type
    });

    return data;
}

// Find patterns based on context relevance
async findRelevantPatterns(
    context: string,
    limit: number
): Promise<GamePattern[]>
```

Database Schema:

```sql
-- Pattern Storage with Vector Support
CREATE TABLE vector_patterns (
    id UUID PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('animation', 'layout', 'interaction', 'style', 'game_mechanic')),
    pattern_name TEXT NOT NULL,
    content JSONB NOT NULL,
    embedding vector(1536),  -- pgvector extension type
    effectiveness_score FLOAT DEFAULT 0.0,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE,
    room_id UUID NOT NULL,
    user_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    usage_stats JSONB DEFAULT '{
        "total_uses": 0,
        "successful_uses": 0,
        "average_similarity": 0
    }'::jsonb,
    claude_usage_metrics JSONB DEFAULT '{
        "last_usage": {
            "direct_reuse": false,
            "structural_similarity": 0,
            "feature_adoption": []
        }
    }'::jsonb,
    CONSTRAINT valid_content CHECK (
        jsonb_typeof(content->'html') = 'string' AND
        jsonb_typeof(content->'context') = 'string'
    )
);

-- Vector Similarity Search Function
CREATE OR REPLACE FUNCTION match_patterns(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    pattern_type text DEFAULT NULL
)
RETURNS TABLE (
    pattern jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        to_jsonb(p.*) as pattern,
        1 - (p.embedding <=> query_embedding) as similarity
    FROM vector_patterns p
    WHERE
        CASE
            WHEN pattern_type IS NOT NULL THEN p.type = pattern_type
            ELSE TRUE
        END
        AND 1 - (p.embedding <=> query_embedding) > match_threshold
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Optimized Vector Search Index
CREATE INDEX pattern_embedding_idx ON vector_patterns
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Prompt Embeddings Table
CREATE TABLE prompt_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    user_id UUID NOT NULL,
    session_id UUID,
    project_context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_ms INTEGER,
    matched_pattern_ids UUID[],
    selected_pattern_id UUID,
    success_score FLOAT,
    user_feedback TEXT
);
```

### 2.2 Pattern Library Service

Located in: `packages/plugin-artcade/src/services/PatternLibrary.ts`

Core Responsibilities:

- Pattern staging and validation
- Pattern evolution tracking
- Integration with VectorSupabase for storage

Key Methods:

```typescript
storePattern(pattern: Partial<GamePattern>): Promise<string>
validateAndStore(pattern: GamePattern): Promise<void>
```

### 2.3 Claude Service

Located in: `packages/plugin-artcade/playground/src/server/services/ClaudeService.ts`

Responsibilities:

- Pattern Generation from Prompts:

    - Converts natural language descriptions into functional HTML/CSS/JS
    - Handles both visual and interactive pattern generation
    - Supports game mechanics, animations, layouts, and UI patterns
    - Generates semantic metadata for better searchability

- Type Alignment with GamePattern:

    - Ensures generated patterns match the GamePattern interface
    - Adds required fields like pattern_name and type
    - Generates appropriate metadata structure
    - Handles optional fields like css and js based on requirements

- Validation Before Storage:
    - Validates HTML structure and accessibility
    - Checks for required interactive elements
    - Ensures CSS/JS compatibility
    - Validates game mechanic implementations

Key Operations:

```typescript
// Generates a complete pattern from a natural language prompt
generatePattern(prompt: string): Promise<GeneratedPattern> {
    // 1. Analyzes prompt for pattern type and requirements
    // 2. Generates HTML structure with Claude
    // 3. Adds appropriate styling and interactivity
    // 4. Generates metadata and documentation
    // 5. Returns complete pattern ready for storage
}

// Validates generated pattern against requirements
validateGeneratedPattern(pattern: GeneratedPattern): void {
    // 1. Checks HTML validity
    // 2. Validates CSS/JS syntax
    // 3. Ensures interactive elements work
    // 4. Verifies metadata completeness
}
```

### 2.4 Client Pattern Service

Located in: `packages/plugin-artcade/playground/src/services/ClientPatternService.ts`

Core Features:

- Frontend pattern management
- Pattern storage and retrieval
- Type-safe pattern operations

## 3. API Layer (Pattern Server)

Located in: `packages/plugin-artcade/playground/src/server/patternServer.ts`

### 3.1 Endpoints Overview

```typescript
POST /store           // Pattern storage
GET  /similar        // Similar pattern search
GET  /:id            // Pattern retrieval
POST /:id/track-usage // Usage tracking
```

### 3.2 Type Safety

Request/Response Types:

```typescript
interface PatternStorageResponse {
    success: boolean;
    data?: GamePattern;
    error?: {
        message: string;
        details?: any;
    };
}

interface SimilarPatternsResponse {
    success: boolean;
    data?: SimilarPattern[];
    error?: {
        message: string;
        details?: any;
    };
}
```

Error Handling:

- `PatternStorageError`
- `PatternRetrievalError`
- `PatternSearchError`
- `PatternValidationError`

## 4. Search and Similarity Operations

### 4.1 Search Types

Located in: `packages/plugin-artcade/src/services/VectorSupabase.ts`

#### findSimilarPatterns

- Purpose: Find patterns with similar embeddings
- Parameters: `embedding`, `threshold`, `limit`
- Returns: `Array<{pattern: GamePattern, similarity: number}>`

#### findRelevantPatterns

- Purpose: Find patterns relevant to a context
- Parameters: `context`, `limit`
- Returns: `GamePattern[]`

#### Retrieval Methods

- `getPattern`: Direct database lookup
- `getPatternById`: Cached lookup with validation

### 4.2 Embedding Operations

#### Generation

Located in: `packages/plugin-artcade/src/services/VectorSupabase.ts`

```typescript
generateEmbedding(content: string): Promise<number[]>
```

#### Storage

```typescript
storePatternEmbedding(id: string, embedding: number[])
```

#### Similarity Calculation

- Cosine similarity between embeddings
- Configurable threshold (default: 0.7)
- Vector dimension: 1536

## 5. Pattern Lifecycle

### 5.1 Creation and Storage

Located in: `packages/plugin-artcade/src/services/PatternLibrary.ts`

Creation Methods:

- Claude Generation
    ```typescript
    generatePattern(prompt: string): Promise<GeneratedPattern>
    ```
- Manual Creation
    ```typescript
    storePattern(pattern: Partial<GamePattern>): Promise<string>
    ```

### 5.2 Retrieval and Usage

Usage Tracking:

```typescript
// Tracks how patterns are used and their effectiveness
interface PatternUsageContext {
    prompt?: string; // The prompt that led to pattern usage
    generated_html?: string; // The final HTML after pattern application
    quality_scores?: {
        visual: number; // Visual appeal and design (0.0-1.0)
        interactive: number; // User interaction quality (0.0-1.0)
        functional: number; // Technical implementation (0.0-1.0)
        performance: number; // Runtime performance (0.0-1.0)
    };
}
```

Effectiveness Scoring:
The effectiveness scoring system uses a weighted multi-factor approach:

1. Quality Score Calculation:

    - Visual Score: Measures design consistency and appeal
    - Interactive Score: Evaluates user interaction smoothness
    - Functional Score: Assesses technical implementation
    - Performance Score: Measures runtime efficiency

2. Usage-Based Adjustments:

    ```typescript
    // Scoring formula
    newScore = (currentScore * usageCount + qualityScore) / (usageCount + 1);
    ```

    - Scores are weighted by usage count
    - Recent scores have more influence
    - Minimum threshold of 0.3 maintained

3. Search Ranking Impact:
    - Higher scores boost pattern visibility
    - Affects similarity thresholds
    - Influences pattern recommendations
    ```typescript
    // Example search boost
    similarityScore *= 1 + effectivenessScore * 0.2;
    ```

### 5.3 Evolution and Updates

Located in: `packages/plugin-artcade/src/services/PatternEvolution.ts`

Pattern Evolution Process:

1. **Pattern Selection**

```typescript
// Select parent pattern and determine mutation type
async selectParentPattern(
    type: GamePattern["type"],
    effectiveness_threshold = 0.7
): Promise<GamePattern> {
    const patterns = await this.vectorDb.getPatternsByType(type);
    return patterns.find(p => p.effectiveness_score >= effectiveness_threshold);
}
```

2. **Mutation Process**

```typescript
// Core mutation function
async mutate(pattern: GamePattern): Promise<GamePattern> {
    // 1. Extract semantic information
    const parentTags = extractSemanticTags(pattern);

    // 2. Apply targeted mutations based on type
    const mutatedHtml = await this.applyMutation(pattern);

    // 3. Generate new pattern with preserved context
    const evolvedPattern = {
        ...pattern,
        id: randomUUID(),
        content: {
            ...pattern.content,
            html: mutatedHtml,
            metadata: {
                ...pattern.content.metadata,
                evolution: {
                    parent_pattern_id: pattern.id,
                    applied_patterns: [],
                    mutation_type: pattern.type,
                    fitness_scores: await this.calculateFitnessScores(mutatedHtml)
                }
            }
        }
    };

    // 4. Merge semantic tags
    evolvedPattern.content.metadata.semantic_tags =
        this.mergeSemanticTags(parentTags, extractSemanticTags(evolvedPattern));

    return evolvedPattern;
}
```

3. **Semantic Tag Merging**

```typescript
// Intelligent tag merging with preservation
private mergeSemanticTags(
    parent: SemanticTags,
    evolved: SemanticTags
): SemanticTags {
    return {
        use_cases: [...new Set([...parent.use_cases, ...evolved.use_cases])],
        mechanics: [...new Set([...parent.mechanics, ...evolved.mechanics])],
        interactions: [...new Set([...parent.interactions, ...evolved.interactions])],
        visual_style: [...new Set([...parent.visual_style, ...evolved.visual_style])]
    };
}
```

4. **Fitness Score Calculation**

```typescript
private async calculateFitnessScores(
    html: string
): Promise<Record<string, number>> {
    const scores = {
        interactivity: this.calculateInteractivityScore(html),
        gameplay: this.calculateGameplayScore(html),
        visual: this.calculateVisualScore(html),
        performance: this.calculatePerformanceScore(html)
    };

    return scores;
}

// Individual Score Calculations
private calculateInteractivityScore(html: string): number {
    let score = 0;
    // Movement controls (0.25)
    if (html.includes("handleMovement")) score += 0.25;
    // Click events (0.25)
    if (html.includes("click") || html.includes("mousedown")) score += 0.25;
    // Keyboard events (0.25)
    if (html.includes("keydown")) score += 0.25;
    // Custom events (0.25)
    if (html.includes("CustomEvent")) score += 0.25;
    return score;
}

private calculateGameplayScore(html: string): number {
    let score = 0;
    // Player element (0.2)
    if (html.includes('class="player"')) score += 0.2;
    // Enemy elements (0.2)
    if (html.includes('class="enemy"')) score += 0.2;
    // Collectibles (0.2)
    if (html.includes('class="collectible"')) score += 0.2;
    // Score tracking (0.2)
    if (html.includes("score") && html.includes("updateGameState")) score += 0.2;
    // Game over condition (0.2)
    if (html.includes("gameOver")) score += 0.2;
    return score;
}
```

5. **Pattern History Tracking**

```typescript
interface PatternHistory {
    id: string;
    pattern_id: string;
    action: "created" | "approved" | "rejected" | "modified";
    timestamp: Date;
    metadata: {
        source_file?: string;
        line_range?: { start: number; end: number };
        approver?: string;
        reason?: string;
        changes?: string[];
        performance_delta?: {
            before: number;
            after: number;
        };
        mutation_data?: {
            parent_id: string;
            mutation_type: string;
            fitness_delta: Record<string, number>;
        };
    };
}
```

Evolution Workflow:

1. **Creation Phase**:

    - Initial pattern generation from parent
    - Semantic tag extraction and preservation
    - Mutation application based on type
    - Fitness score calculation

2. **Review Phase**:

    - Pattern effectiveness review
    - Code quality assessment
    - Performance testing
    - Semantic consistency check

3. **Evolution Phase**:

    - Pattern improvements through mutation
    - Semantic tag merging
    - Fitness score tracking
    - History recording

4. **Validation Phase**:
    - Structure validation
    - Content validation
    - Semantic validation
    - Performance validation

## 6. Type Validation and Safety

Located in: `packages/plugin-artcade/src/utils/pattern-validation.ts`

### 6.1 Core Validation Functions

```typescript
// Pattern Type Validation
export function validatePatternType(
    type: string,
): type is (typeof validPatternTypes)[number] {
    return validPatternTypes.includes(
        type as (typeof validPatternTypes)[number],
    );
}

// Embedding Validation
export function validateEmbedding(embedding?: number[]): void {
    if (embedding) {
        if (!Array.isArray(embedding)) {
            throw new PatternValidationError("Embedding must be an array");
        }
        if (embedding.length !== 1536) {
            throw new PatternValidationError(
                `Embedding must have exactly 1536 dimensions, got ${embedding.length}`,
            );
        }
        if (!embedding.every((val) => typeof val === "number" && !isNaN(val))) {
            throw new PatternValidationError(
                "All embedding values must be valid numbers",
            );
        }
        if (!embedding.every((val) => val >= -1 && val <= 1)) {
            throw new PatternValidationError(
                "All embedding values must be between -1 and 1",
            );
        }
    }
}

// Metadata Validation
export function validateMetadata(metadata: PatternMetadata): void {
    if (metadata.semantic_tags) {
        const { use_cases, mechanics, interactions, visual_style } =
            metadata.semantic_tags;
        if (
            !Array.isArray(use_cases) ||
            !Array.isArray(mechanics) ||
            !Array.isArray(interactions) ||
            !Array.isArray(visual_style)
        ) {
            throw new PatternValidationError(
                "Semantic tags must contain arrays for use_cases, mechanics, interactions, and visual_style",
            );
        }
    }
}
```

### 6.2 Pattern Validation

Complete pattern validation with error collection:

```typescript
export function validateGamePattern(pattern: GamePattern): string[] {
    const errors: string[] = [];

    // Required Fields
    if (!pattern.id) errors.push("Pattern ID is required");
    if (!pattern.pattern_name) errors.push("Pattern name is required");
    if (!pattern.room_id) errors.push("Room ID is required");
    if (!pattern.user_id) errors.push("User ID is required");
    if (!pattern.agent_id) errors.push("Agent ID is required");

    // Pattern Type
    if (!validatePatternType(pattern.type)) {
        errors.push(
            `Invalid pattern type: ${pattern.type}. Must be one of: ${validPatternTypes.join(", ")}`,
        );
    }

    // Content Validation
    if (!pattern.content) {
        errors.push("Content is required");
    } else {
        if (!pattern.content.html) errors.push("HTML content is required");
        if (!pattern.content.context) errors.push("Context is required");

        // Metadata Validation
        if (pattern.content.metadata) {
            try {
                validateMetadata(pattern.content.metadata);
            } catch (error) {
                if (error instanceof PatternValidationError) {
                    errors.push(error.message);
                }
            }
        }
    }

    // Embedding Validation
    if (pattern.embedding) {
        try {
            validateEmbedding(pattern.embedding);
        } catch (error) {
            if (error instanceof PatternValidationError) {
                errors.push(error.message);
            }
        }
    }

    // Numeric Fields
    if (
        typeof pattern.effectiveness_score !== "number" ||
        pattern.effectiveness_score < 0
    ) {
        errors.push("Effectiveness score must be a non-negative number");
    }
    if (typeof pattern.usage_count !== "number" || pattern.usage_count < 0) {
        errors.push("Usage count must be a non-negative number");
    }

    return errors;
}
```

### 6.3 Validation Error Handling

```typescript
export class PatternValidationError extends Error {
    constructor(
        message: string,
        public readonly validationErrors: string[],
    ) {
        super(message);
        this.name = "PatternValidationError";
    }
}

export function assertValidPattern(pattern: GamePattern): void {
    const errors = validateGamePattern(pattern);
    if (errors.length > 0) {
        throw new PatternValidationError(
            `Invalid pattern: ${errors.join(", ")}`,
            errors,
        );
    }
}
```

### 6.4 Database Constraints

SQL constraints ensuring data integrity:

```sql
CREATE TABLE vector_patterns (
    id UUID PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('animation', 'layout', 'interaction', 'style', 'game_mechanic')),
    pattern_name TEXT NOT NULL,
    content JSONB NOT NULL,
    embedding vector(1536),
    effectiveness_score FLOAT DEFAULT 0.0,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE,
    room_id UUID NOT NULL,
    user_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    CONSTRAINT valid_content CHECK (
        jsonb_typeof(content->'html') = 'string' AND
        jsonb_typeof(content->'context') = 'string'
    )
);
```

### 6.5 Testing Coverage

Key validation test cases:

1. **Pattern Type Tests**

    - Valid pattern types
    - Invalid pattern types
    - Type constraints

2. **Semantic Tag Tests**

    - Valid tag structures
    - Invalid tag types
    - Missing required arrays

3. **Pattern Metadata Tests**

    - Complete metadata validation
    - Optional field handling
    - Invalid field types

4. **Complete Pattern Tests**

    - Full pattern validation
    - Required field checking
    - Field type validation
    - Numeric constraints

5. **Error Collection Tests**
    - Multiple validation errors
    - Error message formatting
    - Error aggregation

[Continue with next section...]

## 7. Best Practices and Conventions

### 7.1 Pattern Operations

#### Search Operations

```typescript
// Find patterns with similar embeddings
async findSimilarPatterns(
    input: string | GamePattern,
    threshold = 0.7,
    limit = 5,
    type?: GamePattern["type"]
): Promise<Array<{pattern: GamePattern, similarity: number}>> {
    // 1. Generate or extract embedding
    const searchEmbedding = typeof input === "string"
        ? await this.generateEmbeddingFromText(input)
        : await this.generateEmbedding(input);

    // 2. Perform vector similarity search
    const { data } = await this.supabase.rpc("match_patterns", {
        query_embedding: searchEmbedding,
        match_threshold: threshold,
        match_count: limit,
        pattern_type: type
    });

    return data;
}

// Update pattern effectiveness
async updateEffectivenessScore(
    patternId: string,
    score: number
): Promise<void> {
    const pattern = await this.vectorDb.getPattern(patternId);
    if (!pattern) {
        throw new Error(`Pattern ${patternId} not found`);
    }

    // Update with exponential moving average
    const alpha = 0.3; // Weight for new score
    const newScore = alpha * score + (1 - alpha) * pattern.effectiveness_score;

    await this.vectorDb.updatePattern(patternId, {
        effectiveness_score: newScore,
        usage_count: pattern.usage_count + 1,
        last_used: new Date(),
    });
}
```

### 7.2 Pattern Evolution

#### Mutation Operators

```typescript
private createTargetedMutationOperators(
    patternType: GamePattern["type"]
): Array<{
    name: string;
    weight: number;
    type: string;
}> {
    switch (patternType) {
        case "animation":
            return [
                { name: "add_transition", weight: 1, type: "css" },
                { name: "add_keyframe", weight: 1, type: "css" },
                { name: "modify_timing", weight: 0.5, type: "css" },
            ];
        case "layout":
            return [
                { name: "adjust_grid", weight: 1, type: "css" },
                { name: "modify_flexbox", weight: 1, type: "css" },
                { name: "update_positioning", weight: 0.5, type: "css" },
            ];
        case "interaction":
            return [
                { name: "add_event_listener", weight: 1, type: "js" },
                { name: "enhance_controls", weight: 1, type: "js" },
                { name: "add_feedback", weight: 0.5, type: "js" },
            ];
        case "style":
            return [
                { name: "update_colors", weight: 1, type: "css" },
                { name: "modify_typography", weight: 1, type: "css" },
                { name: "enhance_visuals", weight: 0.5, type: "css" },
            ];
        case "game_mechanic":
            return [
                { name: "add_scoring", weight: 1, type: "js" },
                { name: "enhance_collision", weight: 1, type: "js" },
                { name: "add_powerup", weight: 0.5, type: "js" },
                { name: "add_obstacle", weight: 0.5, type: "js" },
            ];
        default:
            return [];
    }
}
```

### 7.3 Pattern Staging

```typescript
interface StagedPattern extends GamePattern {
    staged_at: Date;
    evolution_source: string;
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
}
```

### 7.4 Effectiveness Metrics

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

### 7.5 Best Practices

1. **Pattern Search**

    - Use appropriate thresholds (default: 0.7)
    - Limit result sets (default: 5)
    - Include pattern type for targeted search
    - Validate search results

2. **Pattern Evolution**

    - Use targeted mutation operators
    - Apply weighted selection
    - Preserve semantic information
    - Track evolution history

3. **Pattern Staging**

    - Stage before committing
    - Track evolution source
    - Maintain location information
    - Require approval process

4. **Effectiveness Tracking**

    - Use exponential moving average (α = 0.3)
    - Track usage statistics
    - Monitor quality scores
    - Record Claude usage metrics

5. **Error Handling**
    - Validate patterns before operations
    - Use appropriate error types
    - Include detailed error messages
    - Handle validation failures gracefully

[Continue with next section...]

### Semantic Term Management

The semantic term management system is implemented through a combination of explicit tagging and inference logic, with a focus on maintaining semantic consistency across patterns.

#### Tag Categories and Structure

```typescript
export interface SemanticTags {
    use_cases: string[]; // Pattern application contexts
    mechanics: string[]; // Game mechanics implemented
    interactions: string[]; // User interaction patterns
    visual_style: string[]; // Visual design elements
}
```

#### Tag Extraction Process

1. **Primary Source**: Explicitly defined tags in pattern metadata

    ```typescript
    if (pattern.content.metadata.semantic_tags) {
        const explicitTags = pattern.content.metadata.semantic_tags;
        tags.use_cases.push(...explicitTags.use_cases);
        tags.mechanics.push(...explicitTags.mechanics);
        tags.interactions.push(...explicitTags.interactions);
        tags.visual_style.push(...explicitTags.visual_style);
    }
    ```

2. **Fallback Inference Logic**:

    - Pattern Name Analysis
    - Type-based Inference
    - Content Context Analysis
    - Code Analysis (HTML/CSS/JS)

3. **Inference Rules**:
    - Game Mechanics:
        ```typescript
        if (type === "game_mechanic") {
            if (name.includes("movement")) tags.mechanics.push("movement");
            if (name.includes("physics")) tags.mechanics.push("physics");
            if (name.includes("collision")) tags.mechanics.push("collision");
        }
        ```
    - Use Cases:
        ```typescript
        if (context.includes("racing")) tags.use_cases.push("racing_game");
        if (context.includes("driving"))
            tags.use_cases.push("driving_simulation");
        ```
    - Interactions:
        ```typescript
        if (js.includes("keydown") || js.includes("keyup")) {
            tags.interactions.push("keyboard_control");
        }
        if (js.includes("mousemove") || js.includes("click")) {
            tags.interactions.push("mouse_control");
        }
        ```

#### Semantic Similarity Calculation

Weighted similarity scoring based on tag matches:

```typescript
const weights = {
    use_cases: 0.4, // Highest priority
    mechanics: 0.3, // Core gameplay elements
    interactions: 0.2, // User interface patterns
    visual_style: 0.1, // Visual elements
};

// Calculate intersection sizes and weighted boost
Object.entries(weights).forEach(([key, weight]) => {
    const matchCount = intersections[key as keyof typeof intersections];
    if (matchCount > 0) {
        boost +=
            weight *
            (matchCount / patternTags[key as keyof SemanticTags].length);
    }
});
```

#### Room ID Encoding

Semantic tags are encoded into room IDs for efficient storage and retrieval:

```typescript
export function encodeSemanticRoomId(tags: SemanticTags): string {
    // Create segments that fit UUID format (8-4-4-4-12)
    const segments = [
        (tags.use_cases.join("_") || "00000000").slice(0, 8),
        (tags.mechanics.join("_") || "0000").slice(0, 4),
        (tags.interactions.join("_") || "0000").slice(0, 4),
        (tags.visual_style.join("_") || "0000").slice(0, 4),
        "000000000000", // Padding to maintain UUID length
    ];
    return segments.join("-");
}
```

#### Best Practices

1. **Tag Extraction**:

    - Always prefer explicit tags when available
    - Use inference only when categories are empty
    - Maintain tag uniqueness through Set operations
    - Consider context when inferring tags

2. **Similarity Calculations**:

    - Use weighted scoring based on tag category importance
    - Consider tag frequency and relevance
    - Normalize scores for consistent comparison
    - Cache similarity calculations when possible

3. **Room ID Management**:

    - Use standardized encoding format
    - Handle missing tags gracefully with padding
    - Maintain UUID format compatibility
    - Implement robust parsing for encoded IDs

4. **Tag Maintenance**:
    - Regular validation of tag categories
    - Deduplication of similar tags
    - Monitoring of tag usage patterns
    - Updates based on pattern evolution

<!--

Random Notes:

ERRORS:

[Pattern Context Enhancement]
The current formatPatternExamples method simply shows the raw HTML/CSS/JS
We should enhance it to include semantic information and usage patterns
This will help Claude better understand how to adapt and combine patterns

[Similarity Search Refinement]
Current threshold (0.85) might be too strict
We should consider using semantic tags in addition to vector similarity
Need to track which patterns Claude successfully adapts

[Pattern Usage Tracking]
We're storing lastUsedPatterns but not fully utilizing this information
Need to implement feedback loop for pattern effectiveness
Should track how Claude combines and modifies patterns


-->
