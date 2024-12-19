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

interface ConversionResult {
    total_records: number;
    converted_count: number;
    failed_count: number;
    errors: string[];
    duration_seconds: number;
    start_time: string;
    end_time: string;
}

async function convertAllRecords() {
    console.log("Phase 2.2: Full Conversion\n");

    // 1. Verify backup exists
    console.log("1. Verifying backup...");
    const { count: backupCount, error: backupError } = await supabase
        .from("vector_patterns_backup_embeddings")
        .select("*", { count: "exact", head: true });

    if (backupError) {
        console.error("Error checking backup:", backupError);
        return;
    }

    if (!backupCount) {
        console.error("No backup found! Please run backup first.");
        return;
    }

    console.log(`Found backup with ${backupCount} records`);

    // 2. Run conversion
    console.log("\n2. Starting full conversion...");
    console.log(
        "This may take a while. Progress will be logged in the database...\n"
    );

    const { data: result, error: conversionError } = await supabase.rpc<
        ConversionResult,
        void
    >("convert_all_records");

    if (conversionError) {
        console.error("Conversion error:", conversionError);
        return;
    }

    // 3. Display results
    console.log("Conversion completed!\n");
    console.log("Summary:");
    console.log("-----------------");
    console.log(`Total records: ${result.total_records}`);
    console.log(`Successfully converted: ${result.converted_count}`);
    console.log(`Failed conversions: ${result.failed_count}`);
    console.log(`Duration: ${result.duration_seconds} seconds`);
    console.log(`Started at: ${new Date(result.start_time).toLocaleString()}`);
    console.log(`Completed at: ${new Date(result.end_time).toLocaleString()}`);

    if (result.errors.length > 0) {
        console.log("\nErrors encountered:");
        result.errors.forEach((error: string, index: number) => {
            console.log(`${index + 1}. ${error}`);
        });
    }

    // 4. Verify results
    if (result.converted_count === result.total_records) {
        console.log("\nAll records converted successfully!");
    } else {
        console.log(
            "\nWarning: Some conversions failed. Please check the errors above."
        );
    }
}

convertAllRecords().catch(console.error);
