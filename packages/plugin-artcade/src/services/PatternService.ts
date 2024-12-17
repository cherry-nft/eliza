import { Service } from "@ai16z/eliza";
import { GamePattern } from "./PatternStaging";
import { SHADER_TEMPLATE } from "../templates/shader-template";

export class PatternService extends Service {
    private patterns: Map<string, GamePattern> = new Map();
    private templates: Map<string, Partial<GamePattern>> = new Map();

    constructor() {
        super();
        // Register built-in templates
        this.templates.set("shader", SHADER_TEMPLATE);
    }

    async initialize(): Promise<void> {
        // Initialize with default patterns if needed
    }

    async getTemplate(type: string): Promise<Partial<GamePattern> | null> {
        return this.templates.get(type) || null;
    }

    async createFromTemplate(
        type: string,
        customizations: Record<string, any> = {}
    ): Promise<GamePattern | null> {
        const template = await this.getTemplate(type);
        if (!template) return null;

        const pattern: GamePattern = {
            id: `${type}_${Date.now()}`,
            type: template.type || type,
            pattern_name: `${type}_pattern_${Date.now()}`,
            content: {
                html: template.content?.html || "",
                css: template.content?.css,
                js: template.content?.js,
                context: template.content?.context || "game",
                metadata: {
                    ...template.content?.metadata,
                    ...customizations,
                },
            },
            effectiveness_score: template.effectiveness_score || 1.0,
            usage_count: 0,
        };

        this.patterns.set(pattern.id, pattern);
        return pattern;
    }

    async storePattern(pattern: GamePattern): Promise<void> {
        this.patterns.set(pattern.id, pattern);
    }

    async getPattern(id: string): Promise<GamePattern | null> {
        return this.patterns.get(id) || null;
    }

    async updatePattern(
        id: string,
        updates: Partial<GamePattern>
    ): Promise<void> {
        const pattern = await this.getPattern(id);
        if (!pattern) throw new Error(`Pattern ${id} not found`);

        this.patterns.set(id, {
            ...pattern,
            ...updates,
            content: {
                ...pattern.content,
                ...updates.content,
                metadata: {
                    ...pattern.content.metadata,
                    ...updates.content?.metadata,
                },
            },
        });
    }

    async findPatternsByType(type: string): Promise<GamePattern[]> {
        return Array.from(this.patterns.values()).filter(
            (pattern) => pattern.type === type
        );
    }

    async deletePattern(id: string): Promise<void> {
        this.patterns.delete(id);
    }
}
