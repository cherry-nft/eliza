import { readFileSync } from "fs";
import { join } from "path";
import { VectorDatabase } from "../../../src/services/VectorDatabase";
import { GamePattern } from "../../../src/types/pattern.types";

export class PatternLoader {
    private readonly vectorDb: VectorDatabase;

    constructor(vectorDb: VectorDatabase) {
        this.vectorDb = vectorDb;
    }

    async loadPatternsFromJson(): Promise<void> {
        console.log("[PatternLoader] Starting pattern loading process");
        try {
            // Construct path to patterns.json relative to the workspace root
            const patternsPath = join(
                process.cwd(), // starts at playground directory
                "../src/data/patterns.json"
            );
            console.log("[PatternLoader] Loading patterns from:", patternsPath);

            const patternsData = readFileSync(patternsPath, "utf-8");
            const patterns: GamePattern[] = JSON.parse(patternsData);

            console.log(
                `[PatternLoader] Found ${patterns.length} patterns to load`
            );

            // Process each pattern
            for (const pattern of patterns) {
                try {
                    // Generate embedding for the pattern's HTML content
                    const html = this.extractHtmlContent(pattern);
                    const embedding =
                        await this.vectorDb.generateEmbedding(html);

                    // Create pattern object with embedding
                    const patternWithEmbedding: GamePattern = {
                        ...pattern,
                        embedding,
                    };

                    // Store pattern in VectorDB
                    await this.vectorDb.storePattern(patternWithEmbedding);
                    console.log(
                        `[PatternLoader] Successfully loaded pattern: ${pattern.id}`
                    );
                } catch (error) {
                    console.error(
                        `[PatternLoader] Failed to load pattern ${pattern.id}:`,
                        error
                    );
                }
            }

            console.log("[PatternLoader] Pattern loading process completed");
        } catch (error) {
            console.error("[PatternLoader] Failed to load patterns:", error);
            throw error;
        }
    }

    private extractHtmlContent(pattern: GamePattern): string {
        // First try the direct HTML content approach
        if (typeof pattern.content.html === "string") {
            return pattern.content.html;
        }

        if (pattern.content.implementation?.html) {
            if (Array.isArray(pattern.content.implementation.html)) {
                return pattern.content.implementation.html.join("\n");
            }
            return pattern.content.implementation.html;
        }

        // If no direct HTML, try to construct it from implementation sections
        if (pattern.content.implementation) {
            const impl = pattern.content.implementation;
            const sections: string[] = [];

            // Add container
            sections.push(
                `<div id="game-${pattern.id}" class="game-container">`
            );

            // Add any state initialization
            if (impl.state?.length) {
                sections.push('<script type="text/javascript">');
                sections.push("// State initialization");
                sections.push(impl.state.join("\n"));
                sections.push("</script>");
            }

            // Add any constants
            if (impl.constants?.length) {
                sections.push('<script type="text/javascript">');
                sections.push("// Constants");
                sections.push(impl.constants.join("\n"));
                sections.push("</script>");
            }

            // Add controls setup if present
            if (impl.controls?.setup?.length) {
                sections.push('<script type="text/javascript">');
                sections.push("// Controls setup");
                sections.push(impl.controls.setup.join("\n"));
                sections.push("</script>");
            }

            // Add event handlers if present
            if (impl.controls?.eventHandlers?.length) {
                sections.push('<script type="text/javascript">');
                sections.push("// Event handlers");
                sections.push(impl.controls.eventHandlers.join("\n"));
                sections.push("</script>");
            }

            // Add update logic if present
            if (impl.updateLogic?.length) {
                sections.push('<script type="text/javascript">');
                sections.push("// Update logic");
                sections.push(impl.updateLogic.join("\n"));
                sections.push("</script>");
            }

            // Add CSS if present
            if (impl.css?.length) {
                sections.push("<style>");
                sections.push(impl.css.join("\n"));
                sections.push("</style>");
            }

            // Close container
            sections.push("</div>");

            console.log(
                `[PatternLoader] Generated HTML content for pattern: ${pattern.id}`
            );
            return sections.join("\n");
        }

        throw new Error(`No HTML content found in pattern: ${pattern.id}`);
    }
}
