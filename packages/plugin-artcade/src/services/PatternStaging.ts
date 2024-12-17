import { Service, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { randomUUID } from "crypto";

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

export interface GamePattern {
    id?: string;
    type: "animation" | "layout" | "interaction" | "style";
    pattern_name: string;
    content: {
        html: string;
        css?: string;
        js?: string;
        context: string;
        metadata: {
            visual_type?: string;
            interaction_type?: string;
            color_scheme?: string[];
            animation_duration?: string;
            dependencies?: string[];
        };
    };
    embedding?: number[];
    effectiveness_score: number;
    usage_count: number;
}

export interface StagedPattern extends GamePattern {
    staged_at: Date;
    evolution_source: string;
    location: {
        file: string;
        start_line: number;
        end_line: number;
    };
    pending_approval: boolean;
}

export interface ApprovalMetadata {
    reason: string;
    quality_notes?: string;
    inspiration_source?: string;
    approved_at: Date;
}

export interface PatternHistory {
    id: string;
    pattern_id: string;
    action: "created" | "approved" | "rejected" | "modified";
    timestamp: Date;
    metadata: {
        source_file?: string;
        line_range?: { start: number; end: number };
        approver?: string;
        reason?: string;
        changes?: string[];
    };
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
            ...(pattern as GamePattern),
            staged_at: new Date(),
            evolution_source: source,
            location,
            pending_approval: true,
            effectiveness_score: 0,
            usage_count: 0,
        };

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

        const approvedPattern = {
            ...pattern,
            content: {
                ...pattern.content,
                metadata: {
                    ...pattern.content.metadata,
                    approval: {
                        ...approvalMetadata,
                        approved_at: new Date(),
                    },
                },
            },
            pending_approval: false,
        };

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
