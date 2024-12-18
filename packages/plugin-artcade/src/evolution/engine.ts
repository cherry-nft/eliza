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
import { JSDOM } from "jsdom";

interface Memory {
    userId: string;
    agentId: string;
    roomId: `${string}-${string}-${string}-${string}-${string}`;
    type: "evolution_generation";
    content: {
        text: string; // Required for embedding
        generation: number;
        population: HTMLOrganism[];
        timestamp: string;
    };
    metadata: {
        generation: number;
        bestFitness: number;
    };
}

const DEFAULT_CONFIG: EvolutionConfig = {
    populationSize: 50,
    maxGenerations: 20,
    mutationRate: 0.8,
    crossoverRate: 0.8,
    elitismCount: 2,
    tournamentSize: 3,
};

export class EvolutionEngine {
    private readonly MEMORY_TABLE = "evolution_memories";
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

        // Create initial organism with guaranteed interactive element
        const baseHtml = await this.addBaseInteractivity(initialHtml);
        population.push({
            id: uuidv4(),
            html: baseHtml,
            generation: 0,
            fitness: this.createEmptyFitnessScores(),
            parentIds: [],
            appliedPatterns: [],
        });

        // Create variations
        for (let i = 1; i < this.config.populationSize; i++) {
            const mutated = await this.mutate(baseHtml);
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

    private async addBaseInteractivity(html: string): Promise<string> {
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const root = doc.querySelector("div");
        if (!root) return html;

        // Add a progress/score tracking element
        const tracker = doc.createElement("div");
        tracker.className = "progress-tracker";
        tracker.style.position = "fixed";
        tracker.style.top = "10px";
        tracker.style.right = "10px";
        tracker.style.padding = "8px";
        tracker.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
        tracker.style.borderRadius = "4px";
        tracker.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
        tracker.innerHTML = `
            <div class="score" style="font-weight: bold;">Score: <span>0</span></div>
            <div class="progress" style="margin-top: 4px;">Progress: <span>0%</span></div>
        `;

        // Add interaction to increment score/progress
        const interactiveElement = doc.createElement("div");
        interactiveElement.className = "interactive-element";
        interactiveElement.style.cursor = "pointer";
        interactiveElement.style.padding = "10px";
        interactiveElement.style.marginTop = "10px";
        interactiveElement.style.backgroundColor = "#f0f0f0";
        interactiveElement.style.borderRadius = "4px";
        interactiveElement.style.transition = "transform 0.2s";
        interactiveElement.setAttribute(
            "onclick",
            `
            const score = parseInt(document.querySelector('.score span').textContent);
            document.querySelector('.score span').textContent = score + 1;
            const progress = Math.min(100, Math.floor((score + 1) / 10 * 100));
            document.querySelector('.progress span').textContent = progress + '%';
            this.style.transform = 'scale(1.05)';
            setTimeout(() => this.style.transform = 'scale(1)', 200);
        `
        );
        interactiveElement.textContent = "Click to Progress";

        root.insertBefore(tracker, root.firstChild);
        root.appendChild(interactiveElement);

        return root.outerHTML;
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
            responsiveness: 0,
            aesthetics: 0,
            performance: 0,
            novelty: 0,
            userInput: 0,
            stateManagement: 0,
            feedback: 0,
            progression: 0,
            gameElements: 0,
            socialElements: 0,
            mediaElements: 0,
            nostalgia: 0,
            playerControl: 0,
            collectibles: 0,
            scoring: 0,
            obstacles: 0,
            gameLoop: 0,
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
        const memoryManager = this.runtime.getMemoryManager(this.MEMORY_TABLE);
        if (!memoryManager) {
            throw new Error("Memory manager not available in runtime");
        }

        // Create a text representation of the generation for embedding
        const generationSummary = {
            generation,
            bestFitness: Math.max(...population.map((o) => o.fitness.total)),
            populationSize: population.length,
            timestamp: new Date().toISOString(),
        };

        const memory: Memory = {
            userId: "system", // Since this is system-generated
            agentId: "evolution-engine", // Identifier for our evolution engine
            roomId: uuidv4() as `${string}-${string}-${string}-${string}-${string}`, // Generate a unique room ID
            type: "evolution_generation",
            content: {
                text: JSON.stringify(generationSummary),
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
        };

        await memoryManager.createMemory(memory as any);
    }
}
