import express from "express";
import {
    GeneratedPattern,
    PatternGenerationError,
    PatternGenerationResponse,
    PatternValidationError,
} from "../shared/types/pattern.types";

const router = express.Router();

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

// Simple health check endpoint
router.get("/health", (req, res) => {
    console.log("[PatternServer] Health check requested");
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

export default router;
