import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs/promises";
import {
    validateEmbedding,
    validatePatternData,
    type PatternData,
} from "./test-insert-example";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../../.env") });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbedding(description: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: description,
        encoding_format: "float",
    });

    return response.data[0].embedding;
}

async function insertWebDawPattern() {
    try {
        // Read the HTML file
        const htmlContent = await fs.readFile(
            resolve(__dirname, "../../embeddings/webdaw-sequencer.html"),
            "utf-8"
        );

        // Description that captures the semantic meaning
        const description = `
            A modern, dark-themed drum sequencer web application with an intuitive interface.
            Features four drum types: kick, snare, hi-hat open, and hi-hat closed.
            Includes visual tempo indicator, tempo control slider, and play/pause/stop functionality.
            Uses a beautiful dark mode theme with turquoise, purple, and gray colors.
            Self-contained HTML pattern that creates an interactive drum machine.
            Simple and intuitive layout with clear visual feedback.
            Allows users to create basic drum patterns with visual grid interface.
            Includes real-time playback with adjustable tempo from 60-180 BPM.
        `.trim();

        // Generate embedding from description
        const embedding = await generateEmbedding(description);

        // Validate embedding
        validateEmbedding(embedding);

        const patternData: PatternData = {
            pattern_name: "webdaw-modern-sequencer",
            embedding: embedding,
            html_content: htmlContent,
            description: description,
            room_id:
                "drum_machine-beat_maker-rhythm_sequencer-" +
                "music_production-drum_pad-beat_box-" +
                "percussion_sequencer-pattern_maker-" +
                "drum_loop_creator-music_maker-" +
                "beat_sequencer-rhythm_composer-" +
                "dark_mode_interface-modern_ui",
            metadata: {
                type: "drum-sequencer",
                features: [
                    "tempo-control",
                    "visual-feedback",
                    "dark-theme",
                    "interactive-grid",
                    "real-time-playback",
                ],
                instruments: ["kick", "snare", "hihat-open", "hihat-closed"],
                ui_theme: {
                    mode: "dark",
                    colors: ["turquoise", "purple", "gray"],
                },
                tempo_range: {
                    min: 60,
                    max: 180,
                },
            },
        };

        // Validate the complete pattern data
        validatePatternData(patternData);

        // Insert into database
        const { data, error } = await supabase
            .from("vector_patterns")
            .insert(patternData);

        if (error) {
            throw new Error(`Database insertion failed: ${error.message}`);
        }

        console.log("WebDaw pattern inserted successfully!");
    } catch (err) {
        console.error(
            "Failed to insert WebDaw pattern:",
            err instanceof Error ? err.message : String(err)
        );
        throw err;
    }
}

// Run if this file is being executed directly
if (require.main === module) {
    insertWebDawPattern().catch(console.error);
}

export { insertWebDawPattern };
