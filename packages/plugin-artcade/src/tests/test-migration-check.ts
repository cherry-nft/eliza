import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function checkEmbeddingState() {
    try {
        // Get a sample of current embeddings
        const { data: sampleData, error: sampleError } = await supabase
            .from("vector_patterns")
            .select("id, pattern_name, embedding")
            .limit(5);

        if (sampleError) {
            console.error("Error fetching sample:", sampleError);
            return;
        }

        console.log("\nCurrent Embedding State:");
        console.log("------------------------");

        if (!sampleData || sampleData.length === 0) {
            console.log("No embeddings found in the database");
            return;
        }

        // Analyze each sample
        sampleData.forEach((row, index) => {
            console.log(`\nSample ${index + 1}:`);
            console.log("ID:", row.id);
            console.log("Pattern Name:", row.pattern_name);
            console.log("Embedding Type:", typeof row.embedding);

            if (typeof row.embedding === "string") {
                try {
                    const parsed = JSON.parse(row.embedding);
                    console.log(
                        "Parsed Length:",
                        Array.isArray(parsed) ? parsed.length : "N/A"
                    );
                    console.log("Format: String (needs conversion)");
                } catch (e) {
                    console.log("Format: Invalid string format");
                }
            } else if (Array.isArray(row.embedding)) {
                console.log("Array Length:", row.embedding.length);
                console.log("Format: Array");
            } else {
                console.log("Format: Unknown");
            }
        });

        // Get total count of embeddings
        const { count: totalCount, error: countError } = await supabase
            .from("vector_patterns")
            .select("id", { count: "exact", head: true });

        if (countError) {
            console.error("Error getting total count:", countError);
            return;
        }

        // Check for NULL embeddings
        const { count: nullCount, error: nullError } = await supabase
            .from("vector_patterns")
            .select("id", { count: "exact", head: true })
            .is("embedding", null);

        if (nullError) {
            console.error("Error checking null embeddings:", nullError);
            return;
        }

        console.log("\nSummary:");
        console.log("--------");
        console.log("Total patterns:", totalCount ?? 0);
        console.log("Patterns with NULL embeddings:", nullCount ?? 0);
        console.log(
            "Patterns with embeddings:",
            (totalCount ?? 0) - (nullCount ?? 0)
        );
    } catch (error) {
        console.error("Test error:", error);
    }
}

checkEmbeddingState().catch(console.error);
