import { Service, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { VectorDatabase, VectorSearchResult } from "./VectorDatabase";
import { PatternStaging, GamePattern } from "./PatternStaging";
import { v4 as uuidv4 } from "uuid";

export interface EvolutionConfig {
    populationSize?: number;
    generationLimit?: number;
    mutationRate?: number;
    crossoverRate?: number;
    elitismCount?: number;
    similarityThreshold?: number;
    fitnessThreshold?: number;
}

export interface EvolutionResult {
    pattern: GamePattern;
    fitness: number;
    generation: number;
    parentIds: string[];
}

export class PatternEvolution extends Service {
    private runtime!: IAgentRuntime & { logger: typeof elizaLogger };
    private vectorDb!: VectorDatabase;
    private staging!: PatternStaging;

    private readonly defaultConfig: Required<EvolutionConfig> = {
        populationSize: 10,
        generationLimit: 50,
        mutationRate: 0.3,
        crossoverRate: 0.7,
        elitismCount: 2,
        similarityThreshold: 0.85,
        fitnessThreshold: 0.7,
    };

    constructor() {
        super();
    }

    override async initialize(
        runtime: IAgentRuntime & { logger: typeof elizaLogger }
    ): Promise<void> {
        this.runtime = runtime;
        this.vectorDb = await runtime.getService(VectorDatabase);
        this.staging = await runtime.getService(PatternStaging);
    }

    async evolvePattern(
        seedPattern: GamePattern,
        config: EvolutionConfig = {}
    ): Promise<EvolutionResult> {
        const evolutionConfig = { ...this.defaultConfig, ...config };

        try {
            // Find similar patterns to use as potential parents
            const similarPatterns = await this.vectorDb.findSimilarPatterns(
                seedPattern.embedding,
                seedPattern.type,
                evolutionConfig.similarityThreshold
            );

            // Initialize population with seed and similar patterns
            let population = this.initializePopulation(
                seedPattern,
                similarPatterns,
                evolutionConfig.populationSize
            );

            let bestResult: EvolutionResult = {
                pattern: seedPattern,
                fitness: await this.evaluateFitness(seedPattern),
                generation: 0,
                parentIds: [],
            };

            // Evolution loop
            for (
                let generation = 1;
                generation <= evolutionConfig.generationLimit;
                generation++
            ) {
                // Evaluate fitness for current population
                const evaluatedPopulation = await Promise.all(
                    population.map(async (pattern) => ({
                        pattern,
                        fitness: await this.evaluateFitness(pattern),
                    }))
                );

                // Sort by fitness
                evaluatedPopulation.sort((a, b) => b.fitness - a.fitness);

                // Check if we've found a better solution
                if (evaluatedPopulation[0].fitness > bestResult.fitness) {
                    bestResult = {
                        pattern: evaluatedPopulation[0].pattern,
                        fitness: evaluatedPopulation[0].fitness,
                        generation,
                        parentIds: [seedPattern.id],
                    };

                    // If we've reached our fitness threshold, we can stop
                    if (
                        bestResult.fitness >= evolutionConfig.fitnessThreshold
                    ) {
                        break;
                    }
                }

                // Create next generation
                const nextGeneration: GamePattern[] = [];

                // Elitism - carry over best patterns
                for (let i = 0; i < evolutionConfig.elitismCount; i++) {
                    nextGeneration.push(evaluatedPopulation[i].pattern);
                }

                // Fill rest of population with offspring
                while (nextGeneration.length < evolutionConfig.populationSize) {
                    if (Math.random() < evolutionConfig.crossoverRate) {
                        // Crossover
                        const parent1 = this.selectParent(evaluatedPopulation);
                        const parent2 = this.selectParent(evaluatedPopulation);
                        const offspring = await this.crossover(
                            parent1,
                            parent2
                        );
                        nextGeneration.push(offspring);
                    } else {
                        // Mutation
                        const parent = this.selectParent(evaluatedPopulation);
                        const offspring = await this.mutate(
                            parent,
                            evolutionConfig.mutationRate
                        );
                        nextGeneration.push(offspring);
                    }
                }

                population = nextGeneration;
            }

            // Store the best result in the vector database
            await this.vectorDb.storePattern(bestResult.pattern);

            return bestResult;
        } catch (error) {
            this.runtime.logger.error("Error during pattern evolution", {
                error,
            });
            throw error;
        }
    }

    private initializePopulation(
        seedPattern: GamePattern,
        similarPatterns: VectorSearchResult[],
        size: number
    ): GamePattern[] {
        const population: GamePattern[] = [seedPattern];

        // Add similar patterns
        population.push(...similarPatterns.map((result) => result.pattern));

        // Fill remaining slots with mutations of existing patterns
        while (population.length < size) {
            const basePattern =
                population[Math.floor(Math.random() * population.length)];
            population.push({
                ...basePattern,
                id: uuidv4(),
                pattern_name: `${basePattern.pattern_name}_variant_${population.length}`,
            });
        }

        return population;
    }

    private async evaluateFitness(pattern: GamePattern): Promise<number> {
        // Combine multiple fitness metrics
        const metrics = await Promise.all([
            this.evaluateComplexity(pattern),
            this.evaluateInteractivity(pattern),
            this.evaluateVisualAppeal(pattern),
            this.evaluatePerformance(pattern),
        ]);

        // Weighted average of metrics
        const weights = [0.3, 0.3, 0.2, 0.2];
        return metrics.reduce((sum, metric, i) => sum + metric * weights[i], 0);
    }

    private async evaluateComplexity(pattern: GamePattern): Promise<number> {
        const content = pattern.content;
        if (!content) return 0;

        let score = 0;
        const maxScore = 1;

        // Evaluate HTML complexity
        if (content.html) {
            // Count elements
            const elementCount = (content.html.match(/<[^>]+>/g) || []).length;
            score += Math.min(elementCount / 20, 0.25); // Max 0.25 for element count

            // Count nested depth
            const maxDepth = content.html.split("<").reduce((depth, part) => {
                if (part.trim().startsWith("/")) depth--;
                else if (part.includes(">")) depth++;
                return Math.max(depth, 0);
            }, 0);
            score += Math.min(maxDepth / 5, 0.25); // Max 0.25 for nesting depth
        }

        // Evaluate CSS complexity
        if (content.css) {
            // Count rules and properties
            const ruleCount = (content.css.match(/{[^}]*}/g) || []).length;
            score += Math.min(ruleCount / 10, 0.25); // Max 0.25 for CSS rules

            // Count animations and transitions
            const animationCount = (
                content.css.match(/@keyframes|animation:|transition:/g) || []
            ).length;
            score += Math.min(animationCount / 4, 0.25); // Max 0.25 for animations
        }

        return Math.min(score, maxScore);
    }

    private async evaluateInteractivity(pattern: GamePattern): Promise<number> {
        const content = pattern.content;
        if (!content) return 0;

        let score = 0;
        const maxScore = 1;

        // Count event listeners
        const eventListeners = (content.html.match(/on[a-z]+=/gi) || []).length;
        score += Math.min(eventListeners / 10, 0.3); // Max 0.3 for event listeners

        // Count interactive classes
        const interactiveClasses = (
            content.html.match(/class="[^"]*interactive[^"]*"/g) || []
        ).length;
        score += Math.min(interactiveClasses / 5, 0.2); // Max 0.2 for interactive classes

        // Count draggable elements
        const draggableElements = (
            content.html.match(/draggable="true"/g) || []
        ).length;
        score += Math.min(draggableElements / 3, 0.2); // Max 0.2 for draggable elements

        // Check for game elements
        const gameElements = (
            content.html.match(/class="[^"]*game-[^"]*"/g) || []
        ).length;
        score += Math.min(gameElements / 4, 0.3); // Max 0.3 for game elements

        return Math.min(score, maxScore);
    }

    private async evaluateVisualAppeal(pattern: GamePattern): Promise<number> {
        const content = pattern.content;
        if (!content) return 0;

        let score = 0;
        const maxScore = 1;

        // Check for color variety
        const colors = new Set(
            content.html.match(/(?:color|background-color):\s*([^;}"']+)/g) ||
                []
        );
        score += Math.min(colors.size / 5, 0.25); // Max 0.25 for color variety

        // Check for animations
        const animations = (content.html.match(/animation:[^;}"']+/g) || [])
            .length;
        score += Math.min(animations / 5, 0.25); // Max 0.25 for animations

        // Check for transitions
        const transitions = (content.html.match(/transition:[^;}"']+/g) || [])
            .length;
        score += Math.min(transitions / 3, 0.25); // Max 0.25 for transitions

        // Check for layout properties
        const layoutProps = (
            content.html.match(/(?:display|grid|flex|position):[^;}"']+/g) || []
        ).length;
        score += Math.min(layoutProps / 5, 0.25); // Max 0.25 for layout properties

        return Math.min(score, maxScore);
    }

    private async evaluatePerformance(pattern: GamePattern): Promise<number> {
        const content = pattern.content;
        if (!content) return 0;

        let score = 1; // Start with perfect score and deduct for potential issues
        const maxScore = 1;

        // Check DOM size (deduct for excessive elements)
        const elementCount = (content.html.match(/<[^>]+>/g) || []).length;
        if (elementCount > 50) score -= 0.2;
        if (elementCount > 100) score -= 0.2;

        // Check animation complexity (deduct for excessive animations)
        const animationCount = (content.html.match(/animation:[^;}"']+/g) || [])
            .length;
        if (animationCount > 10) score -= 0.2;
        if (animationCount > 20) score -= 0.2;

        // Check style complexity (deduct for excessive inline styles)
        const inlineStyles = (content.html.match(/style="[^"]+"/g) || [])
            .length;
        if (inlineStyles > 20) score -= 0.2;
        if (inlineStyles > 40) score -= 0.2;

        // Check for expensive operations in event handlers
        const expensiveOps = (
            content.html.match(
                /setTimeout|setInterval|requestAnimationFrame/g
            ) || []
        ).length;
        if (expensiveOps > 5) score -= 0.2;
        if (expensiveOps > 10) score -= 0.2;

        return Math.max(0, Math.min(score, maxScore));
    }

    private selectParent(
        evaluatedPopulation: { pattern: GamePattern; fitness: number }[]
    ): GamePattern {
        // Tournament selection
        const tournamentSize = 3;
        const tournament = Array(tournamentSize)
            .fill(null)
            .map(
                () =>
                    evaluatedPopulation[
                        Math.floor(Math.random() * evaluatedPopulation.length)
                    ]
            );
        tournament.sort((a, b) => b.fitness - a.fitness);
        return tournament[0].pattern;
    }

    private async crossover(
        parent1: GamePattern,
        parent2: GamePattern
    ): Promise<GamePattern> {
        // Create new pattern combining features from both parents
        const newPattern: GamePattern = {
            id: uuidv4(),
            type: parent1.type,
            pattern_name: `${parent1.pattern_name}_${parent2.pattern_name}_offspring`,
            content: await this.crossoverContent(
                parent1.content,
                parent2.content
            ),
            embedding: parent1.embedding.map(
                (value, i) => (value + parent2.embedding[i]) / 2
            ),
            effectiveness_score:
                (parent1.effectiveness_score + parent2.effectiveness_score) / 2,
            usage_count: 0,
        };

        // Validate through staging service
        return await this.staging.validatePattern(newPattern);
    }

    private async crossoverContent(content1: any, content2: any): Promise<any> {
        // Implement content crossover logic here
        // This should intelligently combine HTML, CSS, and JS from both parents
        return content1; // Placeholder implementation
    }

    private async mutate(
        pattern: GamePattern,
        rate: number
    ): Promise<GamePattern> {
        const mutatedPattern: GamePattern = {
            ...pattern,
            id: uuidv4(),
            pattern_name: `${pattern.pattern_name}_mutated`,
            content: await this.mutateContent(pattern.content, rate),
            embedding: pattern.embedding.map(
                (value) => value + (Math.random() - 0.5) * rate
            ),
        };

        // Validate through staging service
        return await this.staging.validatePattern(mutatedPattern);
    }

    private async mutateContent(content: any, rate: number): Promise<any> {
        // Implement content mutation logic here
        // This should make random changes to HTML, CSS, and JS
        return content; // Placeholder implementation
    }
}
