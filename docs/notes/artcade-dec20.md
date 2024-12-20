# _KEY QUESTIONS:_

1. How to structure the prompt template to guide Claude's learning
2. What specific instructions to include for pattern analysis
3. How to ensure Claude explains its pattern usage
4. How to validate that Claude is actually using the patterns

## _Initial Plan:_

1. Enhance Pattern Learning in Prompt Template

Current: Patterns are provided as passive references
Goal: Make Claude actively learn from and incorporate pattern elements

Areas to consider:

- Pattern analysis instructions
- Feature extraction guidance
- Implementation requirements
- Usage tracking requirements

2. Implement Pattern Usage Analysis

Current: Using hardcoded similarity scores and empty feature lists
Goal: Track actual pattern usage and influence

Areas to consider:

- HTML structure comparison
- CSS/JS feature matching
- Semantic similarity scoring
  Feature adoption tracking

## _Current State:_

The issues are:

- Patterns are passively presented as "reference"
- No explicit instruction to analyze them
- No requirement to explain what was learned
- No mechanism to verify pattern usage

# Implementation Details

## 1. Pattern Learning Enhancement

### A. Prompt Template Structure (ClaudeService.ts)

```typescript
private readonly PROMPT_TEMPLATE = `# System Prompt: Artcade Pattern Learning

You are an expert web developer tasked with creating an interactive HTML experience.
Your primary goal is to REUSE and ADAPT proven code patterns from our library.

CRITICAL INSTRUCTION: You MUST copy and adapt code from the provided patterns. DO NOT create new code from scratch when a pattern exists.

User Request: "{{user_prompt}}"

Available Patterns to Reuse:
{{pattern_examples}}

DIRECT CODE REUSE REQUIREMENTS:
1. For each pattern provided:
   - This is WORKING, TESTED code that you MUST incorporate
   - Copy the exact HTML structure, CSS rules, and JavaScript functions
   - Only modify identifiers and selectors to fit the new context
   - Keep all functionality, animations, and interactions intact
   - Preserve all performance optimizations and ARIA attributes

2. Code Adaptation Process:
   - First, copy the entire code blocks from patterns
   - Then, identify what needs to be renamed/modified
   - Document every change with comments: /* Adapted from pattern: [ID] */
   - Maintain the exact same structure and functionality
   - Keep all event listeners and state management

3. Your implementation MUST:
   - Use code from at least 2 different patterns
   - Keep pattern code blocks together (don't split them up)
   - Preserve all comments and documentation
   - Include pattern IDs in comments for traceability
   - Match or exceed the original effectiveness scores

4. Response Format:
{
  "pattern_usage": {
    "incorporated_patterns": [{
      "pattern_id": string,
      "code_blocks": {
        "html": {
          "original": string,
          "adapted": string,
          "changes": string[]  // List of modifications made
        },
        "css": {
          "original": string,
          "adapted": string,
          "changes": string[]
        },
        "js": {
          "original": string,
          "adapted": string,
          "changes": string[]
        }
      },
      "location_markers": {
        "html_start": string,  // Comment marking where pattern HTML starts
        "html_end": string,    // Comment marking where pattern HTML ends
        "css_start": string,   // Similar markers for CSS
        "css_end": string,
        "js_start": string,    // And JavaScript
        "js_end": string
      }
    }]
  },
  "verification_data": {
    "pattern_coverage": [{
      "pattern_id": string,
      "coverage_percentage": number,  // How much of the pattern was used
      "unused_elements": string[],    // List of elements not used
      "adaptation_notes": string[]    // Why certain elements were/weren't used
    }]
  },
  "plan": {
    // ... existing plan structure
  },
  "title": string,
  "description": string,
  "html": string,
  "thumbnail": {
    // ... existing thumbnail structure
  }
}`;
```

### B. Pattern Presentation (VectorSupabase.ts)

```typescript
private formatPatternExamples(patterns: GamePattern[]): string {
    return patterns.map(pattern => `
Pattern ID: ${pattern.id}
Type: ${pattern.type}
Effectiveness Score: ${pattern.effectiveness_score}
Usage Count: ${pattern.usage_count}

Features:
${this.formatMetadata(pattern.content.metadata)}

Implementation:
\`\`\`html
${pattern.content.html}
\`\`\`
${pattern.content.css ? `\`\`\`css\n${pattern.content.css}\n\`\`\`` : ''}
${pattern.content.js ? `\`\`\`javascript\n${pattern.content.js}\n\`\`\`` : ''}

Context: ${pattern.content.context}
    `).join('\n\n');
}
```

## 2. Usage Analysis Implementation

### A. Pattern Matching System (types/effectiveness.ts)

```typescript
export interface PatternAnalysis {
    html: {
        elementTypes: Set<string>;
        classNames: Set<string>;
        attributes: Set<string>;
        structure: string;
        interactiveElements: string[];
    };
    css: {
        properties: Set<string>;
        selectors: Set<string>;
        animations: string[];
        mediaQueries: string[];
        variables: Set<string>;
    };
    js: {
        functions: Set<string>;
        eventListeners: Set<string>;
        stateManagement: string[];
        algorithms: string[];
    };
}

export interface ClaudeUsageContext {
    prompt?: string;
    generated_html?: string;
    similarity_score?: number;
    matched_patterns: Array<{
        pattern_id: string;
        similarity: number;
        features_used: string[];
    }>;
    quality_assessment: {
        visual_score: number;
        interactive_score: number;
        functional_score: number;
        performance_score: number;
    };
}
```

### B. Similarity Scoring (VectorSupabase.ts)

```typescript
interface PatternSimilarityMetrics {
    structural: number;  // HTML structure similarity
    visual: number;     // CSS/style similarity
    functional: number; // JS/behavior similarity
    semantic: number;   // Content/purpose similarity
    overall: number;    // Weighted average
}

interface FeatureAdoption {
    pattern_id: string;
    adopted_features: {
        html: string[];
        css: string[];
        js: string[];
    };
    adaptation_score: number;
    implementation_quality: number;
}

// Update pattern usage metrics
async trackClaudeUsage(context: ClaudeUsageContext): Promise<void> {
    const { matched_patterns, quality_assessment } = context;

    for (const match of matched_patterns) {
        const { pattern_id, similarity, features_used } = match;
        // ... implementation details
    }
}
```

## Next Steps

1. Update ClaudeService.ts:

    - Implement new prompt template
    - Add pattern analysis logic
    - Update response handling

2. Update VectorSupabase.ts:

    - Implement similarity scoring
    - Add feature tracking
    - Update usage metrics

3. Create new test cases:
    - Pattern analysis validation
    - Feature adoption tracking
    - Similarity scoring accuracy
