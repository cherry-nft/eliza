import { Service, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { PatternStagingService, GamePattern } from "./PatternStaging";
import { JSDOM } from "jsdom";

interface HTMLFeedback {
    html: string;
    sourceFile: string;
    lineRange: { start: number; end: number };
    feedback: {
        visualAppeal?: {
            colorHarmony?: number;
            animationSmoothness?: number;
            layoutBalance?: number;
            spacing?: number;
            typography?: number;
        };
        gameplayElements?: {
            playerControls?: number;
            collisionDetection?: number;
            scoreTracking?: number;
            powerUps?: number;
            obstacles?: number;
        };
        interactivity?: {
            responsiveness?: number;
            feedback?: number;
            controls?: number;
            transitions?: number;
        };
        performance?: {
            smoothness?: number;
            loadTime?: number;
            memoryUsage?: number;
        };
        accessibility?: {
            keyboardNav?: number;
            colorContrast?: number;
            screenReader?: number;
        };
        codeQuality?: {
            maintainability?: number;
            reusability?: number;
            modularity?: number;
        };
        naturalLanguageFeedback: string;
    };
}

export class PatternLearning extends Service {
    private runtime!: IAgentRuntime & { logger: typeof elizaLogger };
    private staging!: PatternStagingService;

    constructor() {
        super();
    }

    override async initialize(
        runtime: IAgentRuntime & { logger: typeof elizaLogger }
    ): Promise<void> {
        this.runtime = runtime;
        const staging = await runtime.getService(PatternStagingService);
        if (!staging) {
            throw new Error("PatternStagingService not found");
        }
        this.staging = staging;
    }

    async learnFromFeedback(feedback: HTMLFeedback): Promise<string> {
        // Calculate effectiveness score from feedback
        const effectivenessScore = this.calculateEffectivenessScore(
            feedback.feedback
        );

        // Detect pattern type from HTML and feedback
        const type = await this.detectPatternType(
            feedback.html,
            feedback.feedback
        );

        // Create pattern
        const pattern: Partial<GamePattern> = {
            type,
            pattern_name: `pattern_${Date.now()}`,
            content: {
                html: feedback.html,
                context: "game",
                metadata: {
                    visual_type: this.detectVisualType(feedback),
                    interaction_type: this.detectInteractionType(feedback),
                    // Extract color scheme from HTML
                    color_scheme: this.extractColorScheme(feedback.html),
                    // Extract animation duration if present
                    animation_duration: this.extractAnimationDuration(
                        feedback.html
                    ),
                },
            },
            effectiveness_score: effectivenessScore,
        };

        // Stage the pattern
        const stagingId = await this.staging.stagePattern(
            pattern,
            "user_feedback",
            {
                file: feedback.sourceFile,
                start_line: feedback.lineRange.start,
                end_line: feedback.lineRange.end,
            }
        );

        // Auto-approve if effectiveness score is high enough
        if (effectivenessScore >= 0.8) {
            await this.staging.approvePattern(stagingId, {
                reason: "High effectiveness score from user feedback",
                quality_notes: feedback.feedback.naturalLanguageFeedback,
            });
        }

        return stagingId;
    }

    private calculateEffectivenessScore(
        feedback: HTMLFeedback["feedback"]
    ): number {
        let totalScore = 0;
        let totalMetrics = 0;

        // Helper to process category
        const processCategory = (
            category: Record<string, number | undefined>
        ) => {
            Object.values(category).forEach((value) => {
                if (value !== undefined) {
                    totalScore += value / 10; // Convert 1-10 to 0-1
                    totalMetrics++;
                }
            });
        };

        // Process each category
        if (feedback.visualAppeal) processCategory(feedback.visualAppeal);
        if (feedback.gameplayElements)
            processCategory(feedback.gameplayElements);
        if (feedback.interactivity) processCategory(feedback.interactivity);
        if (feedback.performance) processCategory(feedback.performance);
        if (feedback.accessibility) processCategory(feedback.accessibility);
        if (feedback.codeQuality) processCategory(feedback.codeQuality);

        return totalMetrics > 0 ? totalScore / totalMetrics : 0;
    }

    private async detectPatternType(
        html: string,
        feedback: HTMLFeedback["feedback"]
    ): Promise<GamePattern["type"]> {
        // Use DOM parsing to analyze HTML structure
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // Check for animations
        if (html.includes("@keyframes") || html.includes("animation:")) {
            return "animation";
        }

        // Check for interaction patterns
        if (
            html.includes("onclick") ||
            html.includes("addEventListener") ||
            feedback.interactivity?.controls !== undefined
        ) {
            return "interaction";
        }

        // Check for layout patterns
        if (
            html.includes("display: grid") ||
            html.includes("display: flex") ||
            feedback.visualAppeal?.layoutBalance !== undefined
        ) {
            return "layout";
        }

        // Default to style
        return "style";
    }

    private detectVisualType(feedback: HTMLFeedback): string {
        const { visualAppeal, gameplayElements } = feedback.feedback;

        if (
            visualAppeal?.animationSmoothness &&
            visualAppeal.animationSmoothness > 7
        ) {
            return "animated";
        }
        if (
            gameplayElements?.playerControls &&
            gameplayElements.playerControls > 7
        ) {
            return "interactive";
        }
        return "static";
    }

    private detectInteractionType(feedback: HTMLFeedback): string {
        const { interactivity, gameplayElements } = feedback.feedback;

        if (
            gameplayElements?.playerControls &&
            gameplayElements.playerControls > 7
        ) {
            return "game_control";
        }
        if (interactivity?.controls && interactivity.controls > 7) {
            return "user_input";
        }
        return "passive";
    }

    private extractColorScheme(html: string): string[] {
        const colorRegex =
            /#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\([^)]+\)|rgba\([^)]+\)/g;
        const matches = html.match(colorRegex) || [];
        return [...new Set(matches)];
    }

    private extractAnimationDuration(html: string): string | undefined {
        const durationRegex =
            /animation(?:-duration)?:\s*([0-9.]+m?s)|animation:[^;]*\s([0-9.]+m?s)/;
        const match = html.match(durationRegex);
        return match ? match[1] || match[2] : undefined;
    }
}
