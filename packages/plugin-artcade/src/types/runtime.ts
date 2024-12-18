import { IAgentRuntime, elizaLogger } from "@ai16z/eliza";

export interface EmbeddingCache {
    get(key: string): Promise<number[] | null>;
    set(key: string, value: number[], ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
    initialize(): Promise<void>;
}

export interface VectorOperations {
    initialize(config: any): Promise<void>;
    generateEmbedding(text: string): Promise<number[]>;
}

export interface ArtcadeRuntime
    extends Pick<IAgentRuntime, "databaseAdapter" | "getMemoryManager"> {
    embeddingCache: EmbeddingCache;
    vectorOperations: VectorOperations;
    logger: typeof elizaLogger;
}
