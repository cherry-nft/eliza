export interface PatternPlan {
    coreMechanics: string[];
    visualElements: string[];
    interactivity: string[];
    interactionFlow: Array<{
        trigger: string;
        action: string;
        description: string;
    }>;
    stateManagement: {
        variables: Array<{
            name: string;
            type: string;
            description: string;
        }>;
        updates: string[];
    };
    assetRequirements: {
        scripts: string[];
        styles: string[];
        fonts: string[];
        images: string[];
        animations: Array<{
            type: string;
            property: string;
            element: string;
        }>;
    };
}

export interface ThumbnailElement {
    type: "rect" | "circle" | "path";
    attributes: Record<string, string>;
}

export interface PatternThumbnail {
    alt: string;
    backgroundColor: string;
    elements: ThumbnailElement[];
}

export interface GeneratedPattern {
    plan: PatternPlan;
    title: string;
    description: string;
    html: string;
    thumbnail: PatternThumbnail;
}

export interface PatternServiceInterface {
    generatePattern(prompt: string): Promise<GeneratedPattern>;
}

// Error types for better error handling
export class PatternGenerationError extends Error {
    constructor(
        message: string,
        public readonly details?: any
    ) {
        super(message);
        this.name = "PatternGenerationError";
    }
}

export class PatternValidationError extends Error {
    constructor(
        message: string,
        public readonly validationErrors: string[]
    ) {
        super(message);
        this.name = "PatternValidationError";
    }
}

// Configuration types
export interface PatternServiceConfig {
    apiKey: string;
    apiUrl: string;
    promptTemplate: string;
}

// Response types for API endpoints
export interface PatternGenerationResponse {
    success: boolean;
    data?: GeneratedPattern;
    error?: {
        message: string;
        details?: any;
    };
}

// Pattern storage and retrieval types
export interface StoredPattern {
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
}

export interface PatternStorageRequest {
    type: string;
    pattern_name: string;
    content: {
        html: string;
        css?: string[];
        javascript?: string[];
    };
}

export interface PatternStorageResponse {
    success: boolean;
    data?: StoredPattern;
    error?: {
        message: string;
        details?: any;
    };
}

export interface PatternRetrievalResponse {
    success: boolean;
    data?: StoredPattern;
    error?: {
        message: string;
        details?: any;
    };
}

export interface SimilarPatternsRequest {
    patternId?: string;
    html?: string;
    type?: string;
    threshold?: number;
    limit?: number;
}

export interface SimilarPattern extends StoredPattern {
    similarity: number;
}

export interface SimilarPatternsResponse {
    success: boolean;
    data?: SimilarPattern[];
    error?: {
        message: string;
        details?: any;
    };
}

export interface PatternUsageContext {
    prompt?: string;
    generated_html?: string;
    quality_scores?: {
        visual: number;
        interactive: number;
        functional: number;
        performance: number;
    };
}

export interface PatternUsageResponse {
    success: boolean;
    data?: {
        pattern_id: string;
        new_score: number;
        usage_count: number;
    };
    error?: {
        message: string;
        details?: any;
    };
}

// Error types for storage and retrieval
export class PatternStorageError extends Error {
    constructor(
        message: string,
        public readonly details?: any
    ) {
        super(message);
        this.name = "PatternStorageError";
    }
}

export class PatternRetrievalError extends Error {
    constructor(
        message: string,
        public readonly details?: any
    ) {
        super(message);
        this.name = "PatternRetrievalError";
    }
}

export class PatternSearchError extends Error {
    constructor(
        message: string,
        public readonly details?: any
    ) {
        super(message);
        this.name = "PatternSearchError";
    }
}
