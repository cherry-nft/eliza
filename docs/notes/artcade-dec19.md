# Artcade Pattern System Architecture

## 1. Core Type System

### 1.1 GamePattern Interface

Located in: `packages/plugin-artcade/src/types/patterns.ts`

The `GamePattern` interface serves as the source of truth for all pattern operations in the system. It defines the core structure that all patterns must conform to for database storage and retrieval.

Key Components:

- **Basic Identifiers**: `id`, `type`, `pattern_name`
- **Content Structure**:
    ```typescript
    content: {
      html: string;      // Required
      css?: string;      // Optional
      js?: string;       // Optional
      context: string;   // Required
      metadata: PatternMetadata;
    }
    ```
- **Vector Data**: `embedding?: number[]`
- **Usage Metrics**: `effectiveness_score`, `usage_count`
- **Timestamps**: `created_at`, `last_used`
- **Ownership**: `room_id`, `user_id`, `agent_id`

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

- **Storage**:
    - `storePattern(pattern: GamePattern)`
    - `storePatternEmbedding(id: string, embedding: number[])`
- **Retrieval**:
    - `getPattern(id: string)`
    - `getPatternById(id: string)`
- **Search**:
    - `findSimilarPatterns(embedding: number[], threshold: number, limit: number)`
    - `findRelevantPatterns(context: string, limit: number)`

Database Schemas:

```sql
-- Pattern Storage
CREATE TABLE patterns (
  id UUID PRIMARY KEY,
  content JSONB,
  embedding vector(1536),
  effectiveness_score FLOAT
);

-- Prompt Embeddings
CREATE TABLE prompt_embeddings (
  id UUID PRIMARY KEY,
  embedding vector(1536),
  context TEXT
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

Pattern History:

```typescript
// Tracks the complete lifecycle of a pattern
interface PatternHistory {
    id: string; // History entry ID
    pattern_id: string; // Reference to pattern
    action: "created" | "approved" | "rejected"; // Lifecycle state
    timestamp: Date; // When the action occurred
    metadata: {
        version?: string; // Pattern version
        changes?: string[]; // What changed
        review_notes?: string; // Why approved/rejected
        performance_delta?: {
            // Performance impact
            before: number;
            after: number;
        };
        migration_data?: {
            // For pattern updates
            old_version: string;
            new_version: string;
            migration_steps: string[];
        };
    };
}
```

Pattern Evolution Workflow:

1. Creation Phase:

    - Initial pattern generation
    - Validation and testing
    - Metadata generation

2. Review Phase:

    - Pattern effectiveness review
    - Code quality assessment
    - Performance testing

3. Evolution Phase:
    - Pattern improvements
    - Version tracking
    - Migration handling

## 6. Type Validation and Safety

### 6.1 Validation Utilities

Located in: `packages/plugin-artcade/src/utils/pattern-validation.ts`

Core Validation Function:

```typescript
// Comprehensive pattern validation with detailed error reporting
validateGamePattern(pattern: GamePattern): string[] {
    const errors: string[] = [];

    // 1. Basic Field Validation
    if (!pattern.id || !isValidUUID(pattern.id)) {
        errors.push("Invalid or missing pattern ID");
    }
    if (!isValidPatternType(pattern.type)) {
        errors.push(`Invalid pattern type: ${pattern.type}`);
    }

    // 2. Content Validation
    if (!pattern.content?.html?.trim()) {
        errors.push("Missing or empty HTML content");
    }
    if (pattern.content?.css && !isValidCSS(pattern.content.css)) {
        errors.push("Invalid CSS syntax");
    }
    if (pattern.content?.js && !isValidJS(pattern.content.js)) {
        errors.push("Invalid JavaScript syntax");
    }

    // 3. Metadata Validation
    validateMetadata(pattern.content?.metadata, errors);

    // 4. Vector Validation
    if (pattern.embedding && !isValidEmbedding(pattern.embedding)) {
        errors.push("Invalid embedding vector format");
    }

    return errors;
}
```

Validation Checks:

- Required Fields:
    ```typescript
    function validateRequiredFields(pattern: GamePattern): string[] {
        // Checks for all required fields with type validation
    }
    ```
- Content Structure:
    ```typescript
    function validateContent(content: PatternContent): string[] {
        // Validates HTML structure, CSS/JS syntax, and context
    }
    ```
- Metadata Completeness:
    ```typescript
    function validateMetadata(metadata: PatternMetadata): string[] {
        // Ensures all required metadata fields are present and valid
    }
    ```

Error Types:

```typescript
// Base error class for pattern-related errors
class PatternValidationError extends Error {
    constructor(
        message: string,
        public readonly validationErrors: string[],
        public readonly pattern?: Partial<GamePattern>,
    ) {
        super(message);
        this.name = "PatternValidationError";
    }
}

// Specific error types for different validation scenarios
class PatternContentError extends PatternValidationError {
    constructor(message: string, errors: string[]) {
        super(`Content validation failed: ${message}`, errors);
        this.name = "PatternContentError";
    }
}

class PatternMetadataError extends PatternValidationError {
    constructor(message: string, errors: string[]) {
        super(`Metadata validation failed: ${message}`, errors);
        this.name = "PatternMetadataError";
    }
}
```

### 6.2 Type Transformations

Service Layer Transformations:

```typescript
// Transforms raw database result into typed GamePattern
function transformStoredPattern(stored: any): GamePattern {
    // 1. Basic field mapping
    const pattern: GamePattern = {
        id: stored.id,
        type: stored.type,
        pattern_name: stored.pattern_name,
        content: JSON.parse(stored.content),
        embedding: stored.embedding?.array || [],
        effectiveness_score: stored.effectiveness_score || 0,
        usage_count: stored.usage_count || 0,
        created_at: new Date(stored.created_at),
        last_used: stored.last_used ? new Date(stored.last_used) : undefined,
        room_id: stored.room_id,
        user_id: stored.user_id,
        agent_id: stored.agent_id,
    };

    // 2. Validate transformed pattern
    const errors = validateGamePattern(pattern);
    if (errors.length > 0) {
        throw new PatternValidationError(
            "Stored pattern validation failed",
            errors,
            pattern,
        );
    }

    return pattern;
}

// Transforms Claude's output into GamePattern format
function transformGeneratedPattern(generated: GeneratedPattern): GamePattern {
    // 1. Extract core components
    const { html, css, js } = extractComponents(generated.code);

    // 2. Generate metadata
    const metadata = generateMetadata(generated);

    // 3. Create pattern structure
    const pattern: GamePattern = {
        id: randomUUID(),
        type: inferPatternType(generated),
        pattern_name: generatePatternName(generated),
        content: {
            html,
            css,
            js,
            context: generated.context || "game",
            metadata,
        },
        effectiveness_score: 0,
        usage_count: 0,
        created_at: new Date(),
        room_id: generated.room_id,
        user_id: generated.user_id,
        agent_id: generated.agent_id,
    };

    // 4. Validate and return
    validateGamePattern(pattern);
    return pattern;
}
```

## 7. Best Practices and Conventions

### 7.1 Pattern Operations

#### Search Operations

- Use `findSimilarPatterns` for embedding-based similarity
- Use `findRelevantPatterns` for context-based search
- Use `getPattern` for direct ID lookup
- Use `getPatternById` when validation is needed

#### Error Handling

- Always validate patterns before storage
- Use appropriate error types for different failures
- Include detailed error messages for debugging
- Handle both client and server-side validation

#### Performance

- Use appropriate search limits
- Cache frequently accessed patterns
- Batch similar operations when possible
- Use indexes for common queries

### 7.2 Type Safety

#### Required Fields

- Always include `id`, `type`, `pattern_name`
- Ensure `content.html` is present
- Validate `content.context`
- Check ownership fields (`room_id`, `user_id`, `agent_id`)

#### Optional Fields

- Handle missing `css` and `js` gracefully
- Provide defaults for missing metadata
- Check embedding presence before similarity search
- Use optional chaining for nested fields

#### Validation Strategy

1. Validate at service boundaries
2. Validate before storage operations
3. Validate after pattern generation
4. Validate during pattern evolution

## 8. Database Schema Details

### 8.1 Pattern Storage

```sql
CREATE TABLE patterns (
    id UUID PRIMARY KEY,
    type TEXT NOT NULL,
    pattern_name TEXT NOT NULL,
    content JSONB NOT NULL,
    embedding vector(1536),
    effectiveness_score FLOAT DEFAULT 0.0,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE,
    room_id UUID NOT NULL,
    user_id UUID NOT NULL,
    agent_id UUID NOT NULL
);

CREATE INDEX pattern_embedding_idx ON patterns
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### 8.2 Pattern Evolution

```sql
CREATE TABLE pattern_history (
    id UUID PRIMARY KEY,
    pattern_id UUID REFERENCES patterns(id),
    action TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);
```
