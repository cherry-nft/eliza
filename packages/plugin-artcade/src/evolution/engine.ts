import { IAgentRuntime } from "@ai16z/eliza";
import {
    HTMLOrganism,
    EvolutionConfig,
    EvolutionResult,
    FitnessScores,
    MutationOperator,
    CrossoverOperator,
    SelectionOperator,
    FitnessEvaluator,
} from "./types";
import { v4 as uuidv4 } from "uuid";

const DEFAULT_CONFIG: EvolutionConfig = {
    populationSize: 50,
    maxGenerations: 20,
    mutationRate: 0.5,
    crossoverRate: 0.8,
    elitismCount: 2,
    tournamentSize: 3,
};

export class EvolutionEngine {
    private runtime: IAgentRuntime;
    private config: EvolutionConfig;
    private mutationOperators: MutationOperator[];
    private crossoverOperators: CrossoverOperator[];
    private selectionOperator: SelectionOperator;
    private fitnessEvaluator?: FitnessEvaluator;

    constructor(runtime: IAgentRuntime, config: Partial<EvolutionConfig> = {}) {
        this.runtime = runtime;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.mutationOperators = [];
        this.crossoverOperators = [];
        this.selectionOperator = this.createTournamentSelection();
    }

    registerMutationOperator(operator: MutationOperator): void {
        this.mutationOperators.push(operator);
    }

    registerCrossoverOperator(operator: CrossoverOperator): void {
        this.crossoverOperators.push(operator);
    }

    setFitnessEvaluator(evaluator: FitnessEvaluator): void {
        this.fitnessEvaluator = evaluator;
    }

    async evolve(initialHtml: string): Promise<EvolutionResult> {
        if (!this.fitnessEvaluator) {
            throw new Error("Fitness evaluator not set");
        }

        // Initialize population
        let population = await this.initializePopulation(initialHtml);
        const history = [];

        // Evolution loop
        for (
            let generation = 0;
            generation < this.config.maxGenerations;
            generation++
        ) {
            // Evaluate fitness
            await this.evaluatePopulation(population);

            // Record history
            const stats = this.calculateGenerationStats(population);
            history.push({
                generation,
                bestFitness: stats.bestFitness,
                averageFitness: stats.averageFitness,
                population: [...population],
            });

            // Selection
            const parents = await this.selectionOperator.select(
                population,
                this.config.populationSize - this.config.elitismCount
            );

            // Create next generation
            const offspring = await this.createOffspring(parents);

            // Update generation number
            offspring.forEach((org) => (org.generation = generation + 1));

            // Elitism
            const elite = this.getElite(population, this.config.elitismCount);
            population = [...elite, ...offspring];

            // Store generation in memory
            await this.storeGeneration(population, generation);
        }

        // Return best organism and history
        const bestOrganism = this.getBestOrganism(population);
        return {
            organism: bestOrganism,
            history,
        };
    }

    private async initializePopulation(
        initialHtml: string
    ): Promise<HTMLOrganism[]> {
        const population: HTMLOrganism[] = [];

        // Create initial organism
        population.push({
            id: uuidv4(),
            html: initialHtml,
            generation: 0,
            fitness: this.createEmptyFitnessScores(),
            parentIds: [],
            appliedPatterns: [],
        });

        // Create variations
        for (let i = 1; i < this.config.populationSize; i++) {
            const mutated = await this.mutate(initialHtml);
            population.push({
                id: uuidv4(),
                html: mutated,
                generation: 0,
                fitness: this.createEmptyFitnessScores(),
                parentIds: [],
                appliedPatterns: [],
            });
        }

        return population;
    }

    private async evaluatePopulation(
        population: HTMLOrganism[]
    ): Promise<void> {
        if (!this.fitnessEvaluator) {
            throw new Error("Fitness evaluator not set");
        }

        await Promise.all(
            population.map(async (organism) => {
                organism.fitness =
                    await this.fitnessEvaluator!.evaluate(organism);
            })
        );
    }

    private async createOffspring(
        parents: HTMLOrganism[]
    ): Promise<HTMLOrganism[]> {
        const offspring: HTMLOrganism[] = [];

        for (let i = 0; i < parents.length; i += 2) {
            const parent1 = parents[i];
            const parent2 = parents[i + 1] || parents[0];

            // Crossover
            if (Math.random() < this.config.crossoverRate) {
                const [child1Html, child2Html] = await this.crossover(
                    parent1.html,
                    parent2.html
                );

                offspring.push(
                    this.createOrganism(child1Html, [parent1.id, parent2.id]),
                    this.createOrganism(child2Html, [parent1.id, parent2.id])
                );
            } else {
                offspring.push(
                    this.createOrganism(parent1.html, [parent1.id]),
                    this.createOrganism(parent2.html, [parent2.id])
                );
            }
        }

        // Mutation
        for (const organism of offspring) {
            if (Math.random() < this.config.mutationRate) {
                organism.html = await this.mutate(organism.html);
            }
        }

        return offspring.slice(0, parents.length);
    }

    private createOrganism(html: string, parentIds: string[]): HTMLOrganism {
        return {
            id: uuidv4(),
            html,
            generation: 0,
            fitness: this.createEmptyFitnessScores(),
            parentIds,
            appliedPatterns: [],
        };
    }

    private createEmptyFitnessScores(): FitnessScores {
        return {
            interactivity: 0,
            complexity: 0,
            performance: 0,
            entertainment: 0,
            novelty: 0,
            total: 0,
        };
    }

    private async mutate(html: string): Promise<string> {
        if (this.mutationOperators.length === 0) {
            console.log("No mutation operators registered!");
            return html;
        }

        console.log(
            "Starting mutation process with operators:",
            this.mutationOperators.map((op) => op.name)
        );

        // Apply at least one mutation
        const operator = this.selectRandomOperator(this.mutationOperators);
        console.log("Applying first mutation:", operator.name);
        let mutatedHtml = await operator.apply(html);

        // Randomly apply additional mutations
        let mutationCount = 1;
        while (Math.random() < this.config.mutationRate) {
            const nextOperator = this.selectRandomOperator(
                this.mutationOperators
            );
            console.log("Applying additional mutation:", nextOperator.name);
            mutatedHtml = await nextOperator.apply(mutatedHtml);
            mutationCount++;
        }

        console.log(`Applied ${mutationCount} mutations`);
        return mutatedHtml;
    }

    private async crossover(
        parent1: string,
        parent2: string
    ): Promise<[string, string]> {
        if (this.crossoverOperators.length === 0) {
            return [parent1, parent2];
        }

        const operator = this.selectRandomOperator(this.crossoverOperators);
        return await operator.apply(parent1, parent2);
    }

    private selectRandomOperator<T extends { weight: number }>(
        operators: T[]
    ): T {
        const totalWeight = operators.reduce((sum, op) => sum + op.weight, 0);
        let random = Math.random() * totalWeight;

        for (const operator of operators) {
            random -= operator.weight;
            if (random <= 0) {
                return operator;
            }
        }

        return operators[0];
    }

    private createTournamentSelection(): SelectionOperator {
        return {
            name: "tournament",
            select: async (population: HTMLOrganism[], count: number) => {
                const selected: HTMLOrganism[] = [];

                while (selected.length < count) {
                    // Select random organisms for tournament
                    const tournament = Array.from(
                        { length: this.config.tournamentSize },
                        () => {
                            const index = Math.floor(
                                Math.random() * population.length
                            );
                            return population[index];
                        }
                    );

                    // Select winner
                    const winner = tournament.reduce((best, current) => {
                        return current.fitness.total > best.fitness.total
                            ? current
                            : best;
                    });

                    selected.push(winner);
                }

                return selected;
            },
        };
    }

    private getElite(
        population: HTMLOrganism[],
        count: number
    ): HTMLOrganism[] {
        return [...population]
            .sort((a, b) => b.fitness.total - a.fitness.total)
            .slice(0, count);
    }

    private getBestOrganism(population: HTMLOrganism[]): HTMLOrganism {
        return population.reduce((best, current) => {
            return current.fitness.total > best.fitness.total ? current : best;
        });
    }

    private calculateGenerationStats(population: HTMLOrganism[]) {
        const bestFitness = Math.max(...population.map((o) => o.fitness.total));
        const averageFitness =
            population.reduce((sum, o) => sum + o.fitness.total, 0) /
            population.length;

        return { bestFitness, averageFitness };
    }

    private async storeGeneration(
        population: HTMLOrganism[],
        generation: number
    ): Promise<void> {
        const memoryManager = this.runtime.getMemoryManager();
        await memoryManager.createMemory({
            type: "evolution_generation",
            content: {
                generation,
                population,
                timestamp: new Date().toISOString(),
            },
            metadata: {
                generation,
                bestFitness: Math.max(
                    ...population.map((o) => o.fitness.total)
                ),
            },
        });
    }
}
