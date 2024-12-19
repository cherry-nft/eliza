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

async function runMigration() {
    try {
        console.log("Starting migration...");

        // Step 1: Get current state
        console.log("\nChecking current state...");
        const { data: currentData, error: currentError } = await supabase
            .from("vector_patterns")
            .select("id, embedding")
            .limit(1);

        if (currentError) {
            console.error("Error checking current state:", currentError);
            return;
        }

        if (!currentData || currentData.length === 0) {
            console.log("No data found to migrate");
            return;
        }

        const sampleEmbedding = currentData[0].embedding;
        console.log("Current embedding type:", typeof sampleEmbedding);
        if (typeof sampleEmbedding === "string") {
            try {
                const parsed = JSON.parse(sampleEmbedding);
                console.log(
                    "Current format: String array with length",
                    parsed.length
                );
            } catch (e) {
                console.log("Current format: Invalid string");
                return;
            }
        } else {
            console.log(
                "Current format:",
                Array.isArray(sampleEmbedding) ? "Array" : "Unknown"
            );
        }

        // Step 2: Update embeddings one by one
        console.log("\nUpdating embeddings...");
        const { data: allData, error: allError } = await supabase
            .from("vector_patterns")
            .select("id, embedding")
            .not("embedding", "is", null);

        if (allError) {
            console.error("Error fetching patterns:", allError);
            return;
        }

        if (!allData || allData.length === 0) {
            console.log("No patterns to update");
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const pattern of allData) {
            if (typeof pattern.embedding === "string") {
                try {
                    const parsed = JSON.parse(pattern.embedding);
                    if (Array.isArray(parsed) && parsed.length === 1536) {
                        // Update with proper vector format
                        const { error: updateError } = await supabase
                            .from("vector_patterns")
                            .update({
                                embedding: `[${parsed.join(",")}]::vector(1536)`,
                            })
                            .eq("id", pattern.id);

                        if (updateError) {
                            console.error(
                                `Error updating pattern ${pattern.id}:`,
                                updateError
                            );
                            errorCount++;
                        } else {
                            successCount++;
                        }
                    } else {
                        console.warn(
                            `Pattern ${pattern.id} has invalid dimensions:`,
                            parsed.length
                        );
                        errorCount++;
                    }
                } catch (e) {
                    console.error(
                        `Error parsing embedding for pattern ${pattern.id}:`,
                        e
                    );
                    errorCount++;
                }
            }
        }

        console.log("\nMigration Results:");
        console.log("------------------");
        console.log("Total patterns processed:", allData.length);
        console.log("Successfully updated:", successCount);
        console.log("Errors encountered:", errorCount);

        if (errorCount > 0) {
            console.warn(
                "\nWarning: Some patterns could not be updated. Manual review may be needed."
            );
        } else {
            console.log("\nMigration completed successfully!");
        }
    } catch (error) {
        console.error("Migration error:", error);
    }
}

runMigration().catch(console.error);
