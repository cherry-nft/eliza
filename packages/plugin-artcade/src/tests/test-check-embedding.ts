import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../../.env") });

if (
    !process.env.SUPABASE_PROJECT_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
    throw new Error("Missing required Supabase environment variables");
}

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkEmbedding() {
    // Query the vector_patterns table instead of patterns
    const { data, error } = await supabase
        .from("vector_patterns")
        .select("id, pattern_name, embedding")
        .limit(1);

    if (error) {
        console.error("Error fetching embedding:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No embeddings found");
        return;
    }

    console.log("Pattern ID:", data[0].id);
    console.log("Pattern Name:", data[0].pattern_name);
    console.log("\nRaw embedding data:");
    console.log(data[0].embedding);
    console.log("\nType:", typeof data[0].embedding);

    // Check if it's an array or string
    if (Array.isArray(data[0].embedding)) {
        console.log("Length:", data[0].embedding.length);
        console.log("Sample values:", data[0].embedding.slice(0, 5));
    } else if (typeof data[0].embedding === "string") {
        console.log("WARNING: Embedding is stored as string!");
        try {
            const parsed = JSON.parse(data[0].embedding);
            console.log(
                "Parsed length:",
                Array.isArray(parsed) ? parsed.length : "N/A"
            );
            console.log(
                "Sample values:",
                Array.isArray(parsed) ? parsed.slice(0, 5) : "N/A"
            );
        } catch (e) {
            console.log("Failed to parse embedding string:", e);
        }
    } else {
        console.log("Unexpected embedding format:", typeof data[0].embedding);
    }
}

checkEmbedding().catch(console.error);
