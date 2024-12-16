import { Action, IAgentRuntime } from "@ai16z/eliza";
import { EvolutionEngine } from "../evolution/engine";
import { mutationOperators } from "../evolution/mutations";
import { crossoverOperators } from "../evolution/crossover";
import { InteractiveFitnessEvaluator } from "../evolution/fitness";

interface EvolutionArgs {
    html: string;
    generations?: number;
    populationSize?: number;
}

interface EvolutionResult {
    text: string;
    html: string;
    stats?: {
        generations: number;
        bestFitness: number;
        averageFitness: number;
    };
}

interface PatternAnalysisArgs {
    patternId: string;
}

interface PatternAnalysisResult {
    text: string;
    effectiveness?: number;
}

export const EVOLVE: Action<EvolutionArgs, EvolutionResult> = {
    name: "EVOLVE",
    description: "Evolve HTML using arcade patterns",
    similes: ["transform", "mutate", "enhance", "gamify"],
    examples: [
        "Evolve this HTML to be more interactive",
        "Make this code more arcade-like",
        "Transform this div into a game element",
    ],
    handler: async (
        runtime: IAgentRuntime,
        args: EvolutionArgs
    ): Promise<EvolutionResult> => {
        // Initialize evolution engine with configuration
        const engine = new EvolutionEngine(runtime, {
            maxGenerations: args.generations || 20,
            populationSize: args.populationSize || 50,
        });

        // Register mutation operators
        console.log(
            "Available mutation operators:",
            mutationOperators.map((op) => op.name)
        );
        mutationOperators.forEach((operator) => {
            engine.registerMutationOperator(operator);
        });

        // Register crossover operators
        console.log(
            "Available crossover operators:",
            crossoverOperators.map((op) => op.name)
        );
        crossoverOperators.forEach((operator) => {
            engine.registerCrossoverOperator(operator);
        });

        // Initialize fitness evaluator
        const fitnessEvaluator = new InteractiveFitnessEvaluator();
        engine.setFitnessEvaluator(fitnessEvaluator);

        // Store original HTML
        const memoryManager = runtime.getMemoryManager();
        await memoryManager.createMemory({
            type: "evolution_input",
            content: { html: args.html },
        });

        // Run evolution
        const result = await engine.evolve(args.html);

        // Log evolved HTML for debugging
        console.log("Evolved HTML:", result.organism.html);

        // Store result
        await memoryManager.createMemory({
            type: "evolution_result",
            content: {
                input: args.html,
                output: result.organism.html,
                fitness: result.organism.fitness,
                generation: result.organism.generation,
                timestamp: new Date().toISOString(),
            },
        });

        // Calculate stats from history
        const lastGeneration = result.history[result.history.length - 1];
        const stats = {
            generations: result.history.length,
            bestFitness: lastGeneration.bestFitness,
            averageFitness: lastGeneration.averageFitness,
        };

        return {
            text: `Evolution complete (${stats.generations} generations, best fitness: ${stats.bestFitness.toFixed(2)})`,
            html: result.organism.html,
            stats,
        };
    },
    validate: async (
        runtime: IAgentRuntime,
        args: EvolutionArgs
    ): Promise<boolean> => {
        return typeof args.html === "string" && args.html.length > 0;
    },
};

export const ANALYZE_PATTERN: Action<
    PatternAnalysisArgs,
    PatternAnalysisResult
> = {
    name: "ANALYZE_PATTERN",
    description: "Analyze effectiveness of arcade patterns",
    similes: ["evaluate", "assess", "review"],
    examples: [
        "Analyze the effectiveness of this pattern",
        "Review pattern performance",
    ],
    handler: async (
        runtime: IAgentRuntime,
        args: PatternAnalysisArgs
    ): Promise<PatternAnalysisResult> => {
        const memoryManager = runtime.getMemoryManager();

        // Get pattern from memory
        const pattern = await memoryManager.getMemory({
            id: args.patternId,
            tableName: "arcade_patterns",
        });

        if (!pattern) {
            return { text: "Pattern not found" };
        }

        // Get pattern usage statistics
        const usageStats = await memoryManager.searchMemories({
            tableName: "evolution_results",
            filter: {
                appliedPatterns: args.patternId,
            },
        });

        // Calculate effectiveness
        const effectiveness =
            usageStats.reduce((sum, memory) => {
                return sum + (memory.content.fitness?.total || 0);
            }, 0) / (usageStats.length || 1);

        return {
            text: `Pattern analysis complete (used ${usageStats.length} times)`,
            effectiveness,
        };
    },
    validate: async (
        runtime: IAgentRuntime,
        args: PatternAnalysisArgs
    ): Promise<boolean> => {
        return typeof args.patternId === "string" && args.patternId.length > 0;
    },
};
