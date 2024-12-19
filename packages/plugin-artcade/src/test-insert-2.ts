import { createClient } from "@supabase/supabase-js";
import { GamePattern } from "./types/patterns";
import {
    extractSemanticTags,
    encodeSemanticRoomId,
} from "./utils/semantic-utils";
import OpenAI from "openai";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    {
        db: {
            schema: "public",
        },
    }
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbedding(pattern: GamePattern): Promise<number[]> {
    const textToEmbed = `
        Pattern: ${pattern.pattern_name}
        Type: ${pattern.type}
        Description: ${pattern.content.context}
        HTML: ${pattern.content.html}
        ${pattern.content.css ? `CSS: ${pattern.content.css}` : ""}
        ${pattern.content.js ? `JS: ${pattern.content.js}` : ""}
        Metadata: ${JSON.stringify(pattern.content.metadata)}
    `.trim();

    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: textToEmbed,
        encoding_format: "float",
    });

    return response.data[0].embedding;
}

async function insertPattern(pattern: GamePattern) {
    try {
        // Generate embedding
        const embedding = await generateEmbedding(pattern);

        // Insert pattern with embedding as a vector
        const { data, error } = await supabase
            .from("vector_patterns")
            .insert({
                ...pattern,
                embedding: embedding as unknown as string, // Cast to string to satisfy TypeScript
            })
            .select();

        if (error) {
            console.error("Insert error:", error);
            throw error;
        }
        console.log("Successfully inserted pattern:", pattern.pattern_name);
        return data;
    } catch (error) {
        console.error("Failed to insert pattern:", error);
        throw error;
    }
}

// Export for use in other files
export { insertPattern, generateEmbedding };
