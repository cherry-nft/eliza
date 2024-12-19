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

async function verifyCurrentState() {
    console.log("Phase 1: Preparation - Current State Verification\n");

    // 1. Check table structure
    console.log("1. Checking table structure...");
    const { data: tableInfo, error: tableError } = await supabase
        .from("vector_patterns")
        .select("*")
        .limit(1);

    if (tableError) {
        console.error("Error accessing table:", tableError);
        return;
    }

    if (tableInfo && tableInfo.length > 0) {
        console.log("Table columns:", Object.keys(tableInfo[0]).join(", "));
    }

    // 2. Count total records
    const { count: totalCount, error: countError } = await supabase
        .from("vector_patterns")
        .select("*", { count: "exact", head: true });

    if (countError) {
        console.error("Error getting count:", countError);
        return;
    }

    console.log("\n2. Record counts:");
    console.log(`Total records: ${totalCount}`);

    // 3. Check embedding format of first record
    const { data: sampleData, error: sampleError } = await supabase
        .from("vector_patterns")
        .select("embedding")
        .limit(1);

    if (sampleError) {
        console.error("Error getting sample:", sampleError);
        return;
    }

    if (sampleData && sampleData.length > 0) {
        console.log("\n3. Sample embedding format:");
        console.log("Type:", typeof sampleData[0].embedding);
        if (typeof sampleData[0].embedding === "string") {
            try {
                const parsed = JSON.parse(sampleData[0].embedding);
                console.log("Parsed length:", parsed.length);
                console.log("First few values:", parsed.slice(0, 3));
            } catch (e) {
                console.log("Failed to parse embedding");
            }
        }
    }

    // 4. Verify backup table doesnt exist
    const { data: backupCheck, error: backupError } = await supabase
        .from("vector_patterns_backup_embeddings")
        .select("count(*)", { count: "exact", head: true });

    console.log("\n4. Backup table status:");
    if (backupError && backupError.code === "PGRST204") {
        console.log("Backup table does not exist - Ready for creation");
    } else if (backupCheck) {
        console.log("Warning: Backup table already exists with data");
    }
}

verifyCurrentState().catch(console.error);
