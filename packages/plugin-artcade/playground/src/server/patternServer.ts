import express, { Router } from "express";
import { randomUUID } from "crypto";
import {
    GeneratedPattern,
    PatternGenerationError,
    PatternGenerationResponse,
    PatternValidationError,
    PatternStorageRequest,
    PatternStorageResponse,
    PatternRetrievalResponse,
    SimilarPatternsRequest,
    SimilarPatternsResponse,
    PatternUsageResponse,
    PatternStorageError,
    PatternRetrievalError,
    PatternSearchError,
    PatternUsageContext,
} from "../shared/pattern.types";
import { TokenizationService } from "./services/TokenizationService";
import { GamePattern } from "../../../src/types/patterns";

const router: Router = Router();

// Health check endpoint
router.get("/health", (req, res) => {
    console.log("[PatternServer] Health check requested");
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Add tokenization endpoint
router.post("/tokenize", async (req, res) => {
    console.log("[PatternServer] Received tokenization request");
    try {
        const { text } = req.body;
        if (!text || typeof text !== "string") {
            console.error(
                "[PatternServer] Invalid tokenization request: No text provided"
            );
            return res.status(400).json({
                success: false,
                error: {
                    message: "Text is required for tokenization",
                    details: { provided: typeof text },
                },
            });
        }

        const tokenizationService = req.app.locals
            .tokenizationService as TokenizationService;
        if (!tokenizationService) {
            throw new Error("TokenizationService not available");
        }

        const result = await tokenizationService.tokenize(text);
        console.log("[PatternServer] Tokenization successful", {
            inputLength: text.length,
            tokenCount: result.tokenCount,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("[PatternServer] Tokenization error:", error);
        res.status(500).json({
            success: false,
            error: {
                message:
                    error instanceof Error ? error.message : "Unknown error",
                details:
                    process.env.NODE_ENV === "development" ? error : undefined,
            },
        });
    }
});

// Pattern Generation
router.post("/generate", async (req, res) => {
    console.log("[PatternServer] Received generation request");
    try {
        const { prompt } = req.body;
        if (!prompt) {
            console.error("[PatternServer] No prompt provided in request");
            return res.status(400).json({
                success: false,
                error: { message: "No prompt provided" },
            });
        }

        console.log("[PatternServer] Generating pattern from prompt:", prompt);
        const pattern =
            await req.app.locals.claudeService.generatePattern(prompt);
        console.log("[PatternServer] Successfully generated pattern");

        const response: PatternGenerationResponse = {
            success: true,
            data: pattern,
        };
        res.json(response);
    } catch (error) {
        console.error("[PatternServer] Error generating pattern:", error);
        const response: PatternGenerationResponse = {
            success: false,
            error: {
                message:
                    error instanceof Error ? error.message : "Unknown error",
                details:
                    error instanceof PatternGenerationError
                        ? error.details
                        : error instanceof PatternValidationError
                          ? error.validationErrors
                          : undefined,
            },
        };
        res.status(500).json(response);
    }
});

// Pattern Storage
router.post("/store", async (req, res) => {
    console.log("[PatternServer] Received storage request");
    try {
        const patternData: PatternStorageRequest = req.body;
        if (!patternData.content?.html) {
            throw new PatternStorageError("No HTML content provided");
        }

        // Generate embedding for the pattern
        console.log("[PatternServer] Generating embedding for pattern");
        const embedding = await req.app.locals.vectorDb.generateEmbedding(
            patternData.content.html
        );

        // Create pattern object with generated ID
        const pattern = {
            id: randomUUID(),
            ...patternData,
            embedding,
            effectiveness_score: 0.0,
            usage_count: 0,
        };

        // Store the pattern
        console.log("[PatternServer] Storing pattern:", pattern.id);
        await req.app.locals.vectorDb.storePattern(pattern);
        console.log("[PatternServer] Pattern stored successfully");

        const response: PatternStorageResponse = {
            success: true,
            data: pattern,
        };
        res.json(response);
    } catch (error) {
        console.error("[PatternServer] Error storing pattern:", error);
        const response: PatternStorageResponse = {
            success: false,
            error: {
                message:
                    error instanceof Error ? error.message : "Unknown error",
                details:
                    error instanceof PatternStorageError
                        ? error.details
                        : undefined,
            },
        };
        res.status(500).json(response);
    }
});

// List all patterns
router.get("/", async (req, res) => {
    console.log("[PatternServer] Received request to list all patterns");
    try {
        const vectorDb = req.app.locals.vectorDb;
        if (!vectorDb) {
            throw new Error("VectorDatabase service not available");
        }
        const patterns = await vectorDb.getAllPatterns();
        console.log("[PatternServer] Successfully retrieved patterns");
        res.json({
            success: true,
            data: patterns,
        });
    } catch (error) {
        console.error("[PatternServer] Error retrieving patterns:", error);
        res.status(500).json({
            success: false,
            error: {
                message:
                    error instanceof Error ? error.message : "Unknown error",
                details:
                    error instanceof PatternRetrievalError
                        ? error.details
                        : undefined,
            },
        });
    }
});

// Pattern Retrieval
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    console.log("[PatternServer] Received retrieval request for pattern:", id);

    try {
        const pattern = await req.app.locals.vectorDb.getPatternById(id);
        if (!pattern) {
            throw new PatternRetrievalError("Pattern not found");
        }

        console.log("[PatternServer] Successfully retrieved pattern:", id);
        const response: PatternRetrievalResponse = {
            success: true,
            data: pattern,
        };
        res.json(response);
    } catch (error) {
        console.error("[PatternServer] Error retrieving pattern:", error);
        const response: PatternRetrievalResponse = {
            success: false,
            error: {
                message:
                    error instanceof Error ? error.message : "Unknown error",
                details:
                    error instanceof PatternRetrievalError
                        ? error.details
                        : undefined,
            },
        };
        res.status(error instanceof PatternRetrievalError ? 404 : 500).json(
            response
        );
    }
});

// Similar Pattern Search
router.post("/search/similar", async (req, res) => {
    console.log("[PatternServer] Received similar pattern search request");
    try {
        const {
            patternId,
            html,
            type,
            threshold = 0.6,
            limit = 5,
        } = req.body as SimilarPatternsRequest;

        if (!patternId && !html) {
            throw new Error("Either patternId or html must be provided");
        }

        console.log("[PatternServer] Search params:", {
            patternId,
            type,
            threshold,
            limit,
            hasHtml: !!html,
        });

        let searchPattern: GamePattern;
        if (patternId) {
            const pattern = await req.app.locals.vectorDb.getPattern(patternId);
            if (!pattern) {
                throw new Error(`Pattern ${patternId} not found`);
            }
            searchPattern = pattern;
        } else if (html) {
            // Create a temporary pattern for search
            searchPattern = {
                id: "temp-search",
                type: type || "game_mechanic",
                pattern_name: "Temporary Search Pattern",
                content: {
                    html,
                    context: "search",
                    metadata: {},
                },
                effectiveness_score: 0,
                usage_count: 0,
                created_at: new Date(),
                last_used: new Date(),
                embedding: [],
            };
        } else {
            throw new Error("Invalid request: missing both patternId and html");
        }

        try {
            const similarPatterns =
                await req.app.locals.vectorDb.findSimilarPatterns(
                    searchPattern,
                    Number(threshold),
                    Number(limit),
                    type as GamePattern["type"]
                );

            console.log(
                "[PatternServer] Found similar patterns:",
                similarPatterns.length
            );

            // Transform the response to match the expected format
            const response: SimilarPatternsResponse = {
                success: true,
                data: similarPatterns.map(({ pattern, similarity }) => ({
                    ...pattern,
                    similarity,
                })),
            };

            res.json(response);
        } catch (searchError) {
            console.error(
                "[PatternServer] Error in pattern search:",
                searchError
            );
            throw new PatternSearchError(
                "Failed to search for similar patterns",
                searchError instanceof Error
                    ? searchError.message
                    : String(searchError)
            );
        }
    } catch (error) {
        console.error("[PatternServer] Error finding similar patterns:", error);
        const response: SimilarPatternsResponse = {
            success: false,
            error: {
                message:
                    error instanceof Error ? error.message : "Unknown error",
                details:
                    error instanceof PatternSearchError
                        ? error.details
                        : undefined,
            },
        };
        res.status(500).json(response);
    }
});

// Pattern Usage Tracking
router.post("/:id/track-usage", async (req, res) => {
    const { id } = req.params;
    console.log("[PatternServer] Received usage tracking request for:", id);

    try {
        const context: PatternUsageContext = req.body;
        const pattern = await req.app.locals.vectorDb.getPatternById(id);
        if (!pattern) {
            throw new PatternRetrievalError("Pattern not found");
        }

        // Update pattern usage stats
        await req.app.locals.vectorDb.incrementUsageCount(id);

        // If quality scores provided, update effectiveness
        if (context.quality_scores) {
            const newScore =
                (context.quality_scores.visual +
                    context.quality_scores.interactive +
                    context.quality_scores.functional +
                    context.quality_scores.performance) /
                4;
            await req.app.locals.vectorDb.updateEffectivenessScore(
                id,
                newScore
            );
        }

        // Get updated pattern
        const updatedPattern = await req.app.locals.vectorDb.getPatternById(id);
        console.log("[PatternServer] Successfully tracked usage for:", id);

        const response: PatternUsageResponse = {
            success: true,
            data: {
                pattern_id: id,
                new_score: updatedPattern!.effectiveness_score,
                usage_count: updatedPattern!.usage_count,
            },
        };
        res.json(response);
    } catch (error) {
        console.error("[PatternServer] Error tracking pattern usage:", error);
        const response: PatternUsageResponse = {
            success: false,
            error: {
                message:
                    error instanceof Error ? error.message : "Unknown error",
                details:
                    error instanceof PatternRetrievalError
                        ? error.details
                        : undefined,
            },
        };
        res.status(error instanceof PatternRetrievalError ? 404 : 500).json(
            response
        );
    }
});

export default router;
