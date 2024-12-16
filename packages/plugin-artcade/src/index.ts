import { Plugin, IAgentRuntime } from "@ai16z/eliza";
import { EVOLVE, ANALYZE_PATTERN } from "./actions";
import { EvolutionEngine } from "./evolution/engine";
import { InteractiveFitnessEvaluator } from "./evolution/fitness";
import { mutationOperators } from "./evolution/mutations";
import { crossoverOperators } from "./evolution/crossover";

export * from "./evolution/types";

export const artcadePlugin: Plugin = {
    name: "artcade",
    description: "HTML evolution through arcade mechanics",
    actions: [EVOLVE, ANALYZE_PATTERN],
};

export class ArtcadePlugin implements Plugin {
    private initializeEngine(runtime: IAgentRuntime): EvolutionEngine {
        const engine = new EvolutionEngine(runtime);

        // Register fitness evaluator
        engine.setFitnessEvaluator(new InteractiveFitnessEvaluator());

        // Register mutation operators
        mutationOperators.forEach((operator) => {
            engine.registerMutationOperator(operator);
        });

        // Register crossover operators
        crossoverOperators.forEach((operator) => {
            engine.registerCrossoverOperator(operator);
        });

        return engine;
    }
}
