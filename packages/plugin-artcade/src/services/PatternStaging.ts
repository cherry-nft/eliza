import { Service, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { randomUUID } from "crypto";
import {
    GamePattern,
    StagedPattern,
    ApprovalMetadata,
    PatternHistory,
} from "../types/patterns";
import { validateGamePattern } from "../utils/pattern-validation";

// Add service type definition
declare module "@ai16z/eliza" {
    interface ServiceRegistry {
        PatternService: PatternService;
    }
}

// Define expected service interface
export interface PatternService extends Service {
    storeApprovedPattern(pattern: GamePattern): Promise<void>;
}

export class PatternStagingService extends Service {
    private stagedPatterns: Map<string, StagedPattern> = new Map();
    private patternHistory: Map<string, PatternHistory[]> = new Map();
    private runtime!: IAgentRuntime & { logger: typeof elizaLogger };

    constructor() {
        super();
    }

    override async initialize(
        runtime: IAgentRuntime & { logger: typeof elizaLogger }
    ): Promise<void> {
        this.runtime = runtime;
    }

    async stagePattern(
        pattern: Partial<GamePattern>,
        source: string,
        location: { file: string; start_line: number; end_line: number }
    ): Promise<string> {
        const stagingId = randomUUID();

        const stagedPattern: StagedPattern = {
            id: pattern.id || stagingId,
            type: pattern.type || "game_mechanic",
            pattern_name: pattern.pattern_name || `pattern_${Date.now()}`,
            content: {
                html: pattern.content?.html || "",
                css: pattern.content?.css,
                js: pattern.content?.js,
                context: pattern.content?.context || "game",
                metadata: {
                    ...pattern.content?.metadata,
                    semantic_tags: pattern.content?.metadata?.semantic_tags || {
                        use_cases: [],
                        mechanics: [],
                        interactions: [],
                        visual_style: [],
                    },
                },
            },
            embedding: pattern.embedding || [],
            effectiveness_score: 0,
            usage_count: 0,
            created_at: new Date(),
            last_used: new Date(),
            room_id: pattern.room_id || "",
            user_id: pattern.user_id || "",
            agent_id: pattern.agent_id || "",
            usage_stats: {
                total_uses: 0,
                successful_uses: 0,
                average_similarity: 0,
                last_used: new Date(),
            },
            claude_usage_metrics: {
                last_usage: {
                    direct_reuse: false,
                    structural_similarity: 0,
                    feature_adoption: [],
                    timestamp: new Date(),
                },
            },
            staged_at: new Date(),
            evolution_source: source,
            location,
            pending_approval: true,
        };

        // Validate the pattern
        const errors = validateGamePattern(stagedPattern);
        if (errors.length > 0) {
            throw new Error(`Invalid pattern: ${errors.join(", ")}`);
        }

        this.stagedPatterns.set(stagingId, stagedPattern);

        // Add history entry for pattern creation
        const historyEntry: PatternHistory = {
            id: randomUUID(),
            pattern_id: stagingId,
            action: "created",
            timestamp: new Date(),
            metadata: {
                source_file: location.file,
                line_range: {
                    start: location.start_line,
                    end: location.end_line,
                },
            },
        };

        this.patternHistory.set(stagingId, [historyEntry]);

        this.runtime.logger.debug(`Pattern staged: ${stagingId}`, {
            type: pattern.type,
            location,
        });

        return stagingId;
    }

    async approvePattern(
        stagingId: string,
        approvalMetadata: Omit<ApprovalMetadata, "approved_at">
    ): Promise<void> {
        const pattern = this.stagedPatterns.get(stagingId);
        if (!pattern) {
            throw new Error(`Pattern ${stagingId} not found in staging`);
        }

        const approvedPattern: GamePattern = {
            id: pattern.id,
            type: pattern.type,
            pattern_name: pattern.pattern_name,
            content: {
                html: pattern.content.html,
                css: pattern.content.css,
                js: pattern.content.js,
                context: pattern.content.context,
                metadata: {
                    ...pattern.content.metadata,
                    approval: {
                        ...approvalMetadata,
                        approved_at: new Date(),
                    },
                },
            },
            embedding: pattern.embedding,
            effectiveness_score: pattern.effectiveness_score,
            usage_count: pattern.usage_count,
            created_at: pattern.created_at,
            last_used: pattern.last_used,
            room_id: pattern.room_id,
            user_id: pattern.user_id,
            agent_id: pattern.agent_id,
            usage_stats: pattern.usage_stats,
            claude_usage_metrics: pattern.claude_usage_metrics,
        };

        // Validate the approved pattern
        const errors = validateGamePattern(approvedPattern);
        if (errors.length > 0) {
            throw new Error(`Invalid approved pattern: ${errors.join(", ")}`);
        }

        try {
            // Store in vector database through pattern service
            const patternService = this.runtime.getService("PatternService");
            if (!patternService) {
                throw new Error("PatternService not found");
            }
            await patternService.storeApprovedPattern(approvedPattern);

            // Add history entry for pattern approval
            const historyEntry: PatternHistory = {
                id: randomUUID(),
                pattern_id: stagingId,
                action: "approved",
                timestamp: new Date(),
                metadata: {
                    approver: approvalMetadata.approver,
                    reason: approvalMetadata.reason,
                },
            };

            const history = this.patternHistory.get(stagingId) || [];
            history.push(historyEntry);
            this.patternHistory.set(stagingId, history);

            // Remove from staging
            this.stagedPatterns.delete(stagingId);

            this.runtime.logger.info(
                `Pattern ${stagingId} approved and stored`,
                {
                    type: pattern.type,
                    reason: approvalMetadata.reason,
                }
            );
        } catch (error) {
            this.runtime.logger.error(
                `Failed to approve pattern ${stagingId}`,
                {
                    error,
                    pattern: approvedPattern,
                }
            );
            throw error;
        }
    }

    async rejectPattern(stagingId: string, reason: string): Promise<void> {
        if (!this.stagedPatterns.has(stagingId)) {
            throw new Error(`Pattern ${stagingId} not found in staging`);
        }

        // Add history entry for pattern rejection
        const historyEntry: PatternHistory = {
            id: randomUUID(),
            pattern_id: stagingId,
            action: "rejected",
            timestamp: new Date(),
            metadata: {
                reason,
            },
        };

        const history = this.patternHistory.get(stagingId) || [];
        history.push(historyEntry);
        this.patternHistory.set(stagingId, history);

        this.stagedPatterns.delete(stagingId);
        this.runtime.logger.debug(`Pattern ${stagingId} rejected`);
    }

    async listStagedPatterns(): Promise<
        Array<{ id: string; pattern: StagedPattern }>
    > {
        return Array.from(this.stagedPatterns.entries()).map(
            ([id, pattern]) => ({ id, pattern })
        );
    }

    async getStagedPattern(stagingId: string): Promise<StagedPattern | null> {
        return this.stagedPatterns.get(stagingId) || null;
    }

    async clearStaging(): Promise<void> {
        this.stagedPatterns.clear();
        this.runtime.logger.debug("Pattern staging cleared");
    }

    async getPatternHistory(stagingId: string): Promise<PatternHistory[]> {
        return this.patternHistory.get(stagingId) || [];
    }
}
