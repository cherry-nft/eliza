# Artcade Pattern Learning Workflow

## Overview

## This document outlines the exact workflow for adding, testing, and utilizing HTML patterns in the Artcade plugin, with specific references to our existing implementation.

---

**CLIENT AND SERVER TESTS NOW COMPLETE IN PLAYGROUND DIRECTORY IN ARTCADE PLUGIN**

## Playground Implementation

### Directory Structure

```
packages/plugin-artcade/playground/
├── src/
│   ├── services/           # Client-side services
│   │   ├── ClientPatternService.ts
│   │   └── test-pattern-variations.ts
│   ├── server/            # Server-side implementation
│   │   ├── services/
│   │   │   └── ClaudeService.ts
│   │   └── patternServer.ts
│   ├── shared/            # Shared types and interfaces
│   │   └── types/
│   │       └── pattern.types.ts
│   └── components/        # React components
```

### Core Components

#### 1. Shared Types (`pattern.types.ts`)

- `GeneratedPattern`: Core interface for pattern data
    - Contains plan, HTML, title, description, and thumbnail
    - Used for communication between client and server
- `PatternGenerationError`: Custom error type for generation failures
- `PatternValidationError`: Custom error type for validation failures

#### 2. Client Implementation

##### ClientPatternService

Location: `src/services/ClientPatternService.ts`

- Handles all client-server communication
- Features:
    - Pattern generation requests
    - Health checks
    - Error handling with custom types
    - Extensive logging for debugging
- Key Methods:
    ```typescript
    generatePattern(prompt: string): Promise<GeneratedPattern>
    healthCheck(): Promise<boolean>
    ```

##### Pattern Variation Tests

Location: `src/services/test-pattern-variations.ts`

- Comprehensive test suite for pattern generation
- Tests multiple pattern categories:
    - Interactive Elements
    - Games
    - Visual Effects
- Validates:
    - Generation success
    - Response structure
    - Feature presence
    - Performance metrics

#### 3. Server Implementation

##### ClaudeService

Location: `src/server/services/ClaudeService.ts`

- Core service for pattern generation
- Features:
    - Claude API integration via OpenRouter
    - Prompt template management
    - Response validation
    - Error handling
- Configuration:
    - Max tokens: 8192
    - Response timeout: 60 seconds
    - Temperature: 0.7

##### Pattern Server

Location: `src/server/patternServer.ts`

- Express server implementation
- Endpoints:
    - `/generate`: Pattern generation
    - `/health`: Service health check
- Features:
    - Request validation
    - Error handling
    - CORS support
    - Logging

### Testing Infrastructure

#### 1. Pattern Generation Tests

- Location: `src/services/test-pattern-variations.ts`
- Tests multiple pattern types:
    ```typescript
    const TEST_CASES: TestCase[] = [
      {
        category: "Interactive Elements",
        name: "Pulsing Button",
        prompt: "...",
        expectedFeatures: [...]
      },
      // More test cases...
    ];
    ```

#### 2. Client Service Tests

- Location: `src/services/test-client-service.ts`
- Tests:
    - Service initialization
    - API communication
    - Error handling
    - Response validation

### Key Features

1. **Robust Error Handling**

    - Custom error types for different scenarios
    - Detailed error messages with context
    - Error recovery strategies

2. **Extensive Logging**

    - Request/response logging
    - Performance metrics
    - Error tracking
    - Generation statistics

3. **Type Safety**

    - Shared type definitions
    - Runtime type validation
    - Consistent interfaces

4. **Performance Optimization**
    - Configurable timeouts
    - Token optimization
    - Response caching (where appropriate)

### Usage Example

```typescript
// Client-side pattern generation
const clientService = new ClientPatternService();
try {
    const pattern = await clientService.generatePattern(
        "Create an interactive button with hover effects",
    );
    console.log(`Generated pattern: ${pattern.title}`);
} catch (error) {
    if (error instanceof PatternGenerationError) {
        console.error("Generation failed:", error.message);
    }
}
```

### Testing Commands

```bash
# Run pattern variation tests
pnpm test:patterns

# Run client service tests
pnpm test:client

# Start development server
pnpm dev:server
```

This implementation provides a robust foundation for pattern generation, with clear separation of concerns between client and server components, while maintaining type safety and extensive error handling throughout the system.

---

**PREVIOUS STATES**

## Previous State

We can use:

- PatternLibrary to extract the best aspect of the HTML code
- PatternStaging to stage it as a preserved pattern
- PatternLearning to evaluate new combinations
- VectorDatabase to find similar high-quality patterns

The existing system already supports:

1. Pattern type categorization
2. Quality scoring
3. Embedding-based similarity search
4. Evolution tracking
5. Feedback incorporation

For your basketball game example:

1. Extract the gravity physics using PatternLibrary.extractGameMechanics()
2. Store it with high effectiveness score
3. Use PatternEvolution with your parameters to find complementary patterns
4. Use PatternLearning to evaluate the combinations

Would you like me to:

1. Show how to use these existing services for your workflow
2. Explain how to integrate the evolution parameters
3. Demonstrate the pattern preservation process

The infrastructure is more sophisticated than I initially realized - we should definitely leverage it rather than build new systems.

---

## Previous State

1. User writes a prompt
2. Claude generates HTML output
3. Pattern type is selected (animation, layout, interaction, style, game mechanic)
4. Evolution parameters are currently using hardcoded mutations
5. Similar patterns section shows related patterns but isn't using embeddings effectively

## Phase 1: Moving from Hardcoded to Embedding-Based Evolution

### Step 1: Pattern Analysis

```typescript
// File: packages/plugin-artcade/src/services/PatternFingerprinting.ts

interface PatternFeatures {
    // Visual features like animations, colors, layouts
    visual: {
        hasAnimations: boolean;
        colorCount: number;
        layoutType: "flex" | "grid" | "standard";
    };

    // Interactive elements like clicks, hovers, drags
    interactive: {
        eventListeners: string[];
        hasUserInput: boolean;
        stateChanges: boolean;
    };

    // Core functionality features
    functional: {
        hasGameLogic: boolean;
        dataManagement: boolean;
        complexity: number;
    };
}

// Takes HTML string, returns numerical features for embedding
function extractFeatures(html: string): PatternFeatures {
    // Natural language: Analyze HTML/CSS/JS to identify key characteristics
    // that define the pattern's behavior and appearance
}
```

### Step 2: Embedding Generation

```typescript
// File: packages/plugin-artcade/src/services/VectorDatabase.ts

interface PatternVector {
    id: string;
    vector: number[]; // Our embedding
    features: PatternFeatures;
    type: string;
}

// Natural language: Convert pattern features into a numerical embedding
// that can be used for similarity search
function generateEmbedding(features: PatternFeatures): number[] {
    return [
        // Visual dimension (0-1)
        features.visual.hasAnimations ? 0.5 : 0,
        features.visual.colorCount / 10,

        // Interactive dimension (0-1)
        features.interactive.eventListeners.length / 5,
        features.interactive.hasUserInput ? 0.5 : 0,

        // Functional dimension (0-1)
        features.functional.complexity,
        features.functional.hasGameLogic ? 0.5 : 0,
    ];
}
```

### Step 3: Pattern Evolution Using Embeddings

```typescript
// File: packages/plugin-artcade/playground/src/services/PG-PatternService.ts

// Natural language: Instead of hardcoded mutations, find similar patterns
// in embedding space and apply their successful mutations
async function evolvePattern(
    pattern: GamePattern,
    config: EvolutionConfig,
): Promise<GamePattern> {
    // 1. Extract features from current pattern
    const features = extractFeatures(pattern.content.html);

    // 2. Generate embedding
    const embedding = generateEmbedding(features);

    // 3. Find similar patterns
    const similarPatterns = await findSimilarPatterns(embedding, pattern.type);

    // 4. Extract successful mutations from similar patterns
    const mutations = extractMutations(similarPatterns);

    // 5. Apply mutations based on similarity and success rate
    return applyMutations(pattern, mutations, config.mutationRate);
}
```

### Step 4: Similarity Search

```typescript
// File: packages/plugin-artcade/src/services/PatternLibrary.ts

// Natural language: Find patterns with similar embeddings that have been
// successful in the past
async function findSimilarPatterns(
    embedding: number[],
    type: string,
    limit: number = 5,
): Promise<GamePattern[]> {
    const patterns = await getAllPatterns();

    return patterns
        .filter((p) => p.type === type)
        .map((p) => ({
            pattern: p,
            similarity: cosineSimilarity(embedding, p.embedding),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map((x) => x.pattern);
}
```

## Implementation Plan

1. Create `PatternFingerprinting` service

    - Start with basic feature extraction
    - Focus on easily identifiable patterns
    - Add more sophisticated analysis gradually

2. Update `VectorDatabase`

    - Add embedding generation
    - Implement similarity search
    - Store successful mutations

3. Modify `PG-PatternService`

    - Replace hardcoded mutations with embedding-based evolution
    - Keep hardcoded mutations as fallback
    - Add logging for evolution success

4. Success Metrics
    - Pattern diversity
    - User satisfaction
    - Evolution speed
    - Code quality

## Notes

- Start simple with basic feature extraction
- Add complexity only when needed
- Keep hardcoded mutations as fallback
- Focus on user feedback loop

## Transition Plan to Embeddings-Based Evolution

### Phase 1: Pattern Analysis & Embedding Integration

#### 1. Pattern Database Analysis

```typescript
// Reference: packages/plugin-artcade/src/data/patterns.json
// Current implementation: packages/plugin-artcade/playground/src/services/PG-PatternService.ts
```

##### Pattern Structure Analysis

- **HTML Structure**

    - Extract DOM hierarchy patterns
    - Identify common component structures
    - Map reusable layout patterns
    - Document structural variations by pattern type

- **CSS Analysis**

    - Catalog animation properties and timing functions
    - Document interaction styles (hover, active, focus states)
    - Map visual style patterns (gradients, shadows, transforms)
    - Identify responsive design patterns

- **JavaScript Patterns**
    - Event handling patterns
    - State management approaches
    - Animation control patterns
    - Game mechanic implementations

##### Embedding Space Mapping

```typescript
// Reference: packages/plugin-artcade/src/services/VectorDatabase.ts
// Current implementation: packages/plugin-artcade/src/types/patterns.ts
```

- **Core Dimensions**

    1. Visual Complexity (0-1)

        - Number of styled elements
        - CSS property diversity
        - Animation complexity

    2. Interaction Depth (0-1)

        - Event listener count
        - State changes
        - User input handling

    3. Functional Complexity (0-1)

        - Logic complexity
        - Data management
        - Algorithm sophistication

    4. Performance Impact (0-1)
        - Resource usage
        - Animation performance
        - DOM manipulation frequency

#### 2. Pattern Fingerprinting System

```typescript
// Target Implementation: packages/plugin-artcade/src/services/PatternFingerprinting.ts
```

##### Feature Extraction Pipeline

1. **Static Analysis**

    - Parse HTML structure
    - Extract CSS properties
    - Analyze JavaScript patterns
    - Generate structural fingerprint

2. **Dynamic Analysis**

    - Interaction patterns
    - Animation sequences
    - State transitions
    - Performance characteristics

3. **Metadata Generation**
    - Pattern type classification
    - Complexity metrics
    - Dependency graph
    - Usage context

##### Embedding Generation

```typescript
// Reference: packages/plugin-artcade/src/services/PatternLearning.ts
```

1. **Feature Vector Creation**

    - Convert fingerprint to numerical vector
    - Normalize dimensions
    - Apply dimension reduction
    - Generate embedding coordinates

2. **Similarity Computation**
    - Define distance metrics
    - Implement nearest neighbor search
    - Optimize search performance
    - Cache common queries

#### 3. Enhanced Pattern Storage

```typescript
// Reference: packages/plugin-artcade/src/services/PatternLibrary.ts
```

##### Metadata Schema

```typescript
interface PatternMetadata {
    effectiveness: {
        visual: number;
        interactive: number;
        functional: number;
        performance: number;
    };
    mutations: {
        successful: string[];
        failed: string[];
        impact: Record<string, number>;
    };
    usage: {
        count: number;
        contexts: string[];
        feedback: FeedbackRecord[];
    };
}
```

##### Feature Tracking

1. **Success Metrics**

    - Pattern adoption rate
    - User satisfaction scores
    - Performance benchmarks
    - Error rates

2. **Evolution History**
    - Mutation lineage
    - Effectiveness changes
    - Adaptation patterns
    - Version control

##### Natural Language Integration

1. **Pattern Descriptions**

    - Human-readable summaries
    - Technical specifications
    - Usage guidelines
    - Best practices

2. **Search Enhancement**
    - Keyword extraction
    - Semantic tagging
    - Context mapping
    - Query optimization

#### Implementation Notes

- Keep pattern fingerprints in memory for fast lookup
- Use efficient vector storage for embeddings
- Implement caching for common queries
- Maintain versioning for pattern evolution
- Document all magic numbers and thresholds
- Add telemetry for pattern usage
- Implement failure recovery
- Add validation for pattern integrity

### Phase 2: Evolution Engine Redesign

1. Replace Hardcoded Mutations:

    - Move from static mutation list to dynamic feature extraction
    - Use embeddings to identify potential mutation targets
    - Create weighted mutation selection based on pattern type

2. Implement Smart Mutation Selection:

    - Use pattern type to filter relevant embeddings
    - Calculate similarity scores between current pattern and stored patterns
    - Extract successful mutation patterns from similar examples

3. Add Evolutionary Memory:
    - Track successful mutation chains
    - Store effectiveness metrics for each mutation
    - Build a feedback loop for mutation success rates

### Phase 3: Integration & Testing

1. Update Playground Interface:

    - Show available mutations based on pattern analysis
    - Display embedding space visualization
    - Add feedback mechanisms for mutation success

2. Implement Testing Framework:

    - Create benchmark patterns for each type
    - Measure evolution effectiveness
    - Compare with hardcoded mutation results

3. Add Monitoring & Metrics:
    - Track evolution success rates
    - Measure embedding space coverage
    - Monitor pattern diversity

## New Workflow

1. User Input:

    - Write prompt
    - Claude generates base HTML
    - System analyzes output and maps to embedding space

2. Pattern Evolution:

    - System identifies similar patterns using embeddings
    - Extracts successful mutation patterns
    - Applies weighted mutations based on pattern type
    - Updates embedding space with results

3. Feedback Loop:

    - User provides feedback on mutations
    - System updates mutation weights
    - Stores successful patterns with embeddings
    - Refines evolution strategies

4. Pattern Library Growth:
    - New successful patterns enrich embedding space
    - Evolution strategies improve over time
    - Pattern relationships become more refined

## Success Metrics

1. Evolution Quality:

    - Mutation relevance to pattern type
    - Success rate of mutations
    - Pattern diversity

2. System Performance:

    - Evolution speed
    - Embedding accuracy
    - Pattern matching precision

3. User Experience:
    - Mutation predictability
    - Evolution control
    - Result quality

## Implementation Priorities

1. First Sprint:

    - Implement pattern fingerprinting
    - Create embedding extraction pipeline
    - Update pattern storage schema

2. Second Sprint:

    - Build dynamic mutation selection
    - Integrate embedding-based similarity
    - Create feedback collection

3. Third Sprint:
    - Implement evolutionary memory
    - Add metrics tracking
    - Refine mutation strategies

## Notes

- Keep existing hardcoded mutations as fallback
- Gradually phase out static mutations as embedding coverage improves
- Focus on collecting quality feedback for embedding refinement
- Maintain clear separation between pattern types while allowing cross-pollination
