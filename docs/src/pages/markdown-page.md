---
title: Markdown page example
---

# Markdown page example

You don't need React to write simple standalone pages.

```mermaid
sequenceDiagram
    Client->>ClientPatternService: User submits prompt
    ClientPatternService->>PatternServer: POST /generate
    PatternServer->>ClaudeService: generatePattern(prompt)
    ClaudeService->>VectorSupabase: findSimilarPatterns()
    VectorSupabase->>Supabase: pgvector similarity search
    Supabase-->>VectorSupabase: Similar patterns
    ClaudeService->>OpenRouter: Generate with context
    OpenRouter-->>ClaudeService: Generated pattern
    ClaudeService->>VectorSupabase: trackClaudeUsage()
    PatternServer-->>ClientPatternService: Pattern response
```
