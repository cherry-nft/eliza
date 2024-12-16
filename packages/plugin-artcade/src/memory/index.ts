import { IAgentRuntime } from "@ai16z/eliza";

export async function storeEvolutionResult(
    runtime: IAgentRuntime,
    input: string,
    output: string
): Promise<void> {
    await runtime.memoryManager.createMemory({
        type: "evolution_result",
        content: {
            input,
            output,
            timestamp: new Date().toISOString(),
        },
    });
}

export async function getRecentEvolutions(
    runtime: IAgentRuntime,
    limit: number = 10
): Promise<any[]> {
    return runtime.memoryManager.searchMemories({
        tableName: "evolution_results",
        limit,
    });
}
