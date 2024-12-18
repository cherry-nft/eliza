export interface PatternPlan {
    coreMechanics: string[];
    visualElements: string[];
    interactionFlow: string[];
    stateManagement: string[];
    assetRequirements: string[];
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
