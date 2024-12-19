import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../../../.env") });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface VerificationResult {
    total_records: number;
    valid_records: number;
    invalid_records: number;
    errors: string[];
}

async function verifyConvertedData(): Promise<VerificationResult> {
    const result: VerificationResult = {
        total_records: 0,
        valid_records: 0,
        invalid_records: 0,
        errors: [],
    };

    // Get all records
    const { data: records, error } = await supabase
        .from("vector_patterns")
        .select("id, embedding")
        .not("embedding", "is", null);

    if (error) {
        throw new Error(`Failed to fetch records: ${error.message}`);
    }

    result.total_records = records.length;

    // Verify each record
    for (const record of records) {
        try {
            // Debug: Log the first record's embedding format
            if (result.total_records === records.length) {
                // First iteration
                console.log("\nDebug - First record format:");
                console.log("Type:", typeof record.embedding);
                console.log(
                    "Value:",
                    JSON.stringify(record.embedding).slice(0, 200) + "..."
                );
            }

            // Parse embedding if it's a string
            const embeddingArray =
                typeof record.embedding === "string"
                    ? JSON.parse(record.embedding)
                    : record.embedding;

            // Check if embedding is an array
            if (!Array.isArray(embeddingArray)) {
                result.invalid_records++;
                result.errors.push(
                    `ID ${record.id}: Embedding is not an array (type: ${typeof embeddingArray})`
                );
                continue;
            }

            // Check if embedding has correct length (1536 for OpenAI embeddings)
            if (embeddingArray.length !== 1536) {
                result.invalid_records++;
                result.errors.push(
                    `ID ${record.id}: Embedding has incorrect length ${embeddingArray.length}`
                );
                continue;
            }

            // Check if all elements are numbers
            if (!embeddingArray.every((val) => typeof val === "number")) {
                result.invalid_records++;
                result.errors.push(
                    `ID ${record.id}: Embedding contains non-numeric values`
                );
                continue;
            }

            result.valid_records++;
        } catch (err) {
            result.invalid_records++;
            result.errors.push(
                `ID ${record.id}: Error processing record - ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    return result;
}

async function runVerification() {
    console.log("Verifying converted data...\n");

    try {
        const result = await verifyConvertedData();

        console.log("Verification Results:");
        console.log("-----------------");
        console.log(`Total records checked: ${result.total_records}`);
        console.log(`Valid records: ${result.valid_records}`);
        console.log(`Invalid records: ${result.invalid_records}`);

        if (result.errors.length > 0) {
            console.log("\nErrors found:");
            result.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
            });
        } else {
            console.log("\nAll records are valid!");
        }

        // Compare with backup
        const { count: backupCount } = await supabase
            .from("vector_patterns_backup_embeddings")
            .select("*", { count: "exact", head: true });

        console.log("\nBackup Comparison:");
        console.log(`Backup records: ${backupCount}`);
        console.log(`Converted records: ${result.total_records}`);

        if (backupCount === result.total_records) {
            console.log("✅ Record count matches backup");
        } else {
            console.log("❌ Record count mismatch with backup!");
        }
    } catch (error) {
        console.error("Verification failed:", error);
    }
}

runVerification().catch(console.error);
