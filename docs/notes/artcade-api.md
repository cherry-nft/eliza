# Artcade API Documentation

## Overview

The Artcade API provides a comprehensive set of endpoints for managing game patterns, including pattern generation, storage, retrieval, and evolution. This API is part of the Artcade plugin system located in `packages/plugin-artcade/playground/src/server`.

## Base URL

```
http://localhost:3001/api/patterns
```

## Types

All type definitions can be found in `packages/plugin-artcade/playground/src/shared/types/pattern.types.ts`

### Core Types

```typescript
interface GeneratedPattern {
    title: string;
    description: string;
    html: string;
    css?: string[];
    javascript?: string[];
    plan?: string;
}

interface PatternStorageRequest {
    type: string;
    pattern_name: string;
    content: {
        html: string;
        css?: string[];
        javascript?: string[];
    };
}

interface PatternUsageContext {
    prompt?: string;
    generated_html?: string;
    quality_scores?: {
        visual: number;
        interactive: number;
        functional: number;
        performance: number;
    };
}
```

## Endpoints

### Health Check

```http
GET /health
```

Checks the health status of the API server.

**Response**

```json
{
    "status": "healthy",
    "timestamp": "2024-01-20T12:00:00.000Z"
}
```

### Generate Pattern

```http
POST /generate
```

Generates a new pattern based on the provided prompt using Claude AI.

**Request Body**

```json
{
    "prompt": "Create a simple button that pulses with a subtle glow effect when hovered"
}
```

**Response**

```typescript
interface PatternGenerationResponse {
    success: true;
    data: GeneratedPattern;
}
```

**Example Response**

```json
{
    "success": true,
    "data": {
        "title": "Pulsing Glow Button with Hover Effect",
        "description": "A modern button with a subtle pulsing glow effect on hover",
        "html": "<button class='glow-button'>Click Me</button>",
        "css": [".glow-button { ... }", ".glow-button:hover { ... }"]
    }
}
```

**Error Response**

```json
{
    "success": false,
    "error": {
        "message": "Error message",
        "details": {} // Optional validation or generation errors
    }
}
```

### Store Pattern

```http
POST /store
```

Stores a pattern in the vector database with embedding generation.

**Request Body**

```typescript
PatternStorageRequest;
```

**Response**

```typescript
interface PatternStorageResponse {
    success: true;
    data: {
        id: string;
        type: string;
        pattern_name: string;
        content: {
            html: string;
            css?: string[];
            javascript?: string[];
        };
        embedding: number[];
        effectiveness_score: number;
        usage_count: number;
    };
}
```

### Retrieve Pattern

```http
GET /:id
```

Retrieves a specific pattern by ID.

**Response**

```typescript
interface PatternRetrievalResponse {
    success: true;
    data: {
        id: string;
        type: string;
        pattern_name: string;
        content: {
            html: string;
            css?: string[];
            javascript?: string[];
        };
        embedding: number[];
        effectiveness_score: number;
        usage_count: number;
    };
}
```

### Search Similar Patterns

```http
POST /search/similar
```

Finds patterns similar to either a provided pattern ID or HTML content.

**Request Body**

```typescript
interface SimilarPatternsRequest {
    patternId?: string;
    html?: string;
    type?: string;
    threshold?: number;
    limit?: number;
}
```

**Response**

```typescript
interface SimilarPatternsResponse {
    success: true;
    data: Array<{
        id: string;
        type: string;
        pattern_name: string;
        content: {
            html: string;
            css?: string[];
            javascript?: string[];
        };
        embedding: number[];
        effectiveness_score: number;
        usage_count: number;
        similarity_score: number;
    }>;
}
```

### Track Pattern Usage

```http
POST /:id/track-usage
```

Tracks pattern usage and updates effectiveness scores.

**Request Body**

```typescript
PatternUsageContext;
```

**Response**

```typescript
interface PatternUsageResponse {
    success: true;
    data: {
        pattern_id: string;
        new_score: number;
        usage_count: number;
    };
}
```

## Error Handling

All endpoints follow a consistent error response format:

```typescript
interface ErrorResponse {
    success: false;
    error: {
        message: string;
        details?: unknown;
    };
}
```

Common HTTP status codes:

- 400: Bad Request (invalid input)
- 404: Not Found (pattern not found)
- 500: Internal Server Error

## Implementation Details

### Server Setup

- Main server file: `packages/plugin-artcade/playground/src/server/index.ts`
- Router implementation: `packages/plugin-artcade/playground/src/server/patternServer.ts`
- Configuration: `packages/plugin-artcade/playground/src/server/config/serverConfig.ts`

### Services

- Claude AI Service: `packages/plugin-artcade/playground/src/server/services/ClaudeService.ts`
- Vector Database: `packages/plugin-artcade/src/services/VectorDatabase.ts`
- Pattern Evolution: `packages/plugin-artcade/src/services/PatternEvolution.ts`

### Testing

Test files are available for all major components:

- Endpoint Tests: `packages/plugin-artcade/playground/src/server/test-endpoints.ts`
- Generation Tests: `packages/plugin-artcade/playground/src/server/test-generations.ts`
- Integration Tests: `packages/plugin-artcade/playground/src/server/test-server-integration.ts`

Run tests using:

```bash
pnpm test:endpoints    # Test all API endpoints
pnpm test:generations # Test pattern generation
pnpm test:integration # Test service integration
```

## Special Notes

1. **Embeddings**: Pattern storage automatically generates embeddings for similarity search using the HTML content.

2. **Effectiveness Scoring**: The effectiveness score is calculated as an average of visual, interactive, functional, and performance scores when provided in usage tracking.

3. **Pattern Evolution**: The system supports pattern evolution through the similarity search feature, allowing for iterative improvements based on successful patterns.

4. **Rate Limiting**: Currently in development. Plan to add rate limiting middleware for production use.

5. **Environment Variables**: Required environment variables:
    ```
    VITE_OPENROUTER_API_KEY=your_api_key
    ```

## Client Integration

A client service is available at `packages/plugin-artcade/playground/src/services/ClientPatternService.ts` for easy integration with the frontend. This service handles all API communication and provides typed responses.

Example client usage:

```typescript
import { ClientPatternService } from "../services/ClientPatternService";

const client = new ClientPatternService();

// Generate a pattern
const pattern = await client.generatePattern(
    "Create a button with a rainbow gradient",
);

// Store the pattern
const stored = await client.storePattern({
    type: "ui",
    pattern_name: pattern.title,
    content: {
        html: pattern.html,
        css: pattern.css,
    },
});
```
