import { IAgentRuntime } from "@ai16z/eliza";

interface EvolutionMemory {
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

export async function storeEvolutionResult(
    runtime: IAgentRuntime,
    input: string,
    output: string,
    generation?: number,
    fitness?: number
): Promise<void> {
    const memoryManager = runtime.getMemoryManager();
    await memoryManager.createMemory({
        type: "evolution_result",
        content: {
            input,
            output,
            timestamp: new Date().toISOString(),
            generation,
            fitness,
        } as EvolutionMemory,
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
    const memoryManager = runtime.getMemoryManager();

    const filter: Record<string, any> = {};
    if (minGeneration !== undefined) {
        filter["metadata.generation"] = { $gte: minGeneration };
    }
    if (maxGeneration !== undefined) {
        filter["metadata.generation"] = {
            ...filter["metadata.generation"],
            $lte: maxGeneration,
        };
    }
    if (minFitness !== undefined) {
        filter["metadata.fitness"] = { $gte: minFitness };
    }

    const memories = await memoryManager.searchMemories({
        tableName: "evolution_results",
        filter,
        limit,
        sort: { "metadata.generation": -1 },
    });

    return memories.map((memory) => memory.content as EvolutionMemory);
}

export async function getEvolutionById(
    runtime: IAgentRuntime,
    evolutionId: string
): Promise<EvolutionMemory | null> {
    const memoryManager = runtime.getMemoryManager();
    const memory = await memoryManager.getMemory({
        id: evolutionId,
        tableName: "evolution_results",
    });

    return memory ? (memory.content as EvolutionMemory) : null;
}
