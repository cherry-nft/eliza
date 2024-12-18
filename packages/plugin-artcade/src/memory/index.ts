import { IAgentRuntime, Memory, IMemoryManager } from "@ai16z/eliza";

interface EvolutionMemory {
    text: string;
    input: string;
    output: string;
    timestamp: string;
    generation?: number;
    fitness?: number;
}

interface EvolutionSearchOptions {
    limit?: number;
    minGeneration?: number;
    maxGeneration?: number;
    minFitness?: number;
}

const EVOLUTION_TABLE = "evolution_results";

export async function storeEvolutionResult(
    runtime: IAgentRuntime,
    input: string,
    output: string,
    generation?: number,
    fitness?: number
): Promise<void> {
    const memoryManager = runtime.getMemoryManager(EVOLUTION_TABLE);
    if (!memoryManager) {
        throw new Error("Memory manager not available");
    }

    const content: EvolutionMemory = {
        text: `Evolution Result - Input: ${input}, Output: ${output}`,
        input,
        output,
        timestamp: new Date().toISOString(),
        generation,
        fitness,
    };

    await memoryManager.createMemory({
        userId: "system",
        agentId: "evolution-engine",
        roomId: "evolution-0000-0000-0000-000000000000" as `${string}-${string}-${string}-${string}-${string}`,
        type: "evolution_result",
        content,
        metadata: {
            generation,
            fitness,
        },
    });
}

export async function getRecentEvolutions(
    runtime: IAgentRuntime,
    options: EvolutionSearchOptions = {}
): Promise<EvolutionMemory[]> {
    const { limit = 10, minGeneration, maxGeneration, minFitness } = options;
    const memoryManager = runtime.getMemoryManager(EVOLUTION_TABLE);
    if (!memoryManager) {
        throw new Error("Memory manager not available");
    }

    // Build the filter based on options
    const filter: Record<string, any> = {
        type: "evolution_result",
    };

    if (minGeneration !== undefined || maxGeneration !== undefined) {
        filter["metadata.generation"] = {};
        if (minGeneration !== undefined) {
            filter["metadata.generation"].$gte = minGeneration;
        }
        if (maxGeneration !== undefined) {
            filter["metadata.generation"].$lte = maxGeneration;
        }
    }

    if (minFitness !== undefined) {
        filter["metadata.fitness"] = { $gte: minFitness };
    }

    const memories = await memoryManager.getMemories({
        roomId: "evolution-0000-0000-0000-000000000000" as `${string}-${string}-${string}-${string}-${string}`,
        count: limit,
    });

    return memories.map((memory) => memory.content as EvolutionMemory);
}

export async function getEvolutionById(
    runtime: IAgentRuntime,
    evolutionId: string
): Promise<EvolutionMemory | null> {
    const memoryManager = runtime.getMemoryManager(EVOLUTION_TABLE);
    if (!memoryManager) {
        throw new Error("Memory manager not available");
    }

    const memory = await memoryManager.getMemoryById(evolutionId);
    return memory ? (memory.content as EvolutionMemory) : null;
}
