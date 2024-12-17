# Artcade Pattern Learning Workflow

## Overview

This document outlines the exact workflow for adding, testing, and utilizing HTML patterns in the Artcade plugin, with specific references to our existing implementation.

## Core Components

### 1. Pattern Storage Infrastructure

- `packages/plugin-artcade/src/services/VectorDatabase.ts`
    - Already implements Eliza's DatabaseAdapter ✅
    - Has proper caching with Eliza's EmbeddingCache ✅
    - Has basic CRUD operations ✅

### 2. Pattern Staging & Approval

- `packages/plugin-artcade/src/services/PatternStaging.ts`
    - Needs implementation of staging area
    - Will track source locations and metadata
    - Will handle approval workflow

### 3. Testing Infrastructure

- `packages/plugin-artcade/src/__tests__/helpers/DatabaseTestHelper.ts`
    - Already provides test pattern creation ✅
    - Handles database cleanup ✅
    - Mocks necessary services ✅

## Implementation Workflow

### Phase 1: Pattern Staging Implementation

1. Extend PatternStaging.ts:

```typescript
interface StagedPattern {
    id: string;
    sourceFile: string;
    lineNumbers: { start: number; end: number };
    html: string;
    type: "animation" | "layout" | "interaction" | "style";
    metadata: {
        approvalStatus: "pending" | "approved" | "rejected";
        submittedAt: Date;
        approvedAt?: Date;
        approvedBy?: string;
        notes?: string;
    };
}
```

2. Add test cases in `packages/plugin-artcade/src/__tests__/PatternStaging.test.ts`:

```typescript
describe("Pattern Staging", () => {
    it("should stage new patterns with source tracking");
    it("should track approval status");
    it("should prevent duplicate staging");
    it("should maintain pattern history");
});
```

### Phase 2: Pattern Learning Pipeline

1. HTML Input → Pattern Extraction:

```typescript
// packages/plugin-artcade/src/services/PatternLibrary.ts
async function learnFromHTML(
    html: string,
    sourceFile: string,
    lineRange: { start: number; end: number },
): Promise<string> {
    const staging = await this.runtime.getService(PatternStaging);
    const patternId = await staging.stagePattern({
        html,
        sourceFile,
        lineRange,
        type: await this.detectPatternType(html),
    });
    return patternId;
}
```

2. Pattern Approval Process:

```typescript
// packages/plugin-artcade/src/services/PatternStaging.ts
async function approvePattern(
    patternId: string,
    metadata: {
        approvedBy: string;
        notes?: string;
        effectiveness?: number;
    },
): Promise<void> {
    const vectorDb = await this.runtime.getService(VectorDatabase);
    const pattern = await this.getStagedPattern(patternId);

    if (!pattern) throw new Error("Pattern not found in staging");

    // Generate embedding using Eliza's infrastructure
    const embedding = await this.runtime
        .getEmbeddingCache()
        .getOrCreateEmbedding(pattern.html);

    await vectorDb.storePattern({
        ...pattern,
        embedding,
        metadata: {
            ...pattern.metadata,
            approvedAt: new Date(),
            ...metadata,
        },
    });
}
```

### Phase 3: Integration Testing

1. Add test cases in `packages/plugin-artcade/src/__tests__/integration.test.ts`:

```typescript
describe("Pattern Learning Pipeline", () => {
    it("should learn from sample HTML");
    it("should maintain source tracking");
    it("should influence future mutations");
});
```

2. Test HTML Samples:

```typescript
// packages/plugin-artcade/src/__tests__/fixtures/patterns.ts
export const TEST_PATTERNS = {
    animation: `<div class="glow-effect">...</div>`,
    layout: `<div class="game-grid">...</div>`,
    interaction: `<button class="hover-effect">...</button>`,
};
```

## Usage Example

```typescript
// Example workflow usage
async function improveGamePattern(html: string, sourceFile: string) {
    const library = runtime.getService(PatternLibrary);
    const staging = runtime.getService(PatternStaging);

    // Stage the pattern
    const patternId = await library.learnFromHTML(html, sourceFile, {
        start: 1,
        end: 10,
    });

    // Review and approve
    await staging.approvePattern(patternId, {
        approvedBy: "developer",
        notes: "Effective game animation pattern",
        effectiveness: 0.95,
    });

    // Use in future mutations
    const evolution = runtime.getService(PatternEvolution);
    const improved = await evolution.evolveWithPatterns(html);
    return improved;
}
```

## Testing Workflow

1. Unit Tests:

```bash
# Run specific test categories
pnpm test PatternStaging
pnpm test VectorDatabase
pnpm test integration
```

2. Test Coverage Requirements:

- Pattern staging: 90%
- Vector operations: 85%
- Integration tests: 75%

## Quality Metrics

1. Pattern Quality:

- Source tracking completeness
- Embedding quality (cosine similarity > 0.85)
- Approval metadata completeness

2. Performance Metrics:

- Pattern storage < 100ms
- Pattern retrieval < 50ms
- Embedding generation < 200ms

## Implementation Checklist

### Immediate Tasks

- [ ] Implement `StagedPattern` interface
- [ ] Add source location tracking
- [ ] Create approval workflow
- [ ] Add pattern history tracking

### Secondary Tasks

- [ ] Enhance vector similarity search
- [ ] Implement pattern effectiveness tracking
- [ ] Add pattern usage analytics

### Final Tasks

- [ ] Integration with fine-tuning
- [ ] Advanced pattern combination
- [ ] Pattern deprecation workflow

## Success Criteria

1. Technical:

- All tests passing
- Coverage requirements met
- Performance metrics achieved

2. Functional:

- Successful pattern learning from HTML
- Effective pattern reuse in mutations
- Proper source tracking

3. Quality:

- Clean approval workflow
- Complete pattern history
- Reliable embedding generation
