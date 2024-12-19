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

async function createBackup() {
    console.log("Phase 1.2: Creating Backup\n");

    // 1. Create backup table using RPC
    console.log("1. Creating backup table...");
    const { data: createResult, error: createError } = await supabase.rpc(
        "create_vector_backup",
        {}
    );

    if (createError) {
        if (
            createError.message.includes(
                'function "create_vector_backup" does not exist'
            )
        ) {
            console.log("Creating backup table via direct SQL...");
            // Fall back to direct table creation
            const { data, error } = await supabase
                .from("vector_patterns_backup_embeddings")
                .insert(
                    await supabase
                        .from("vector_patterns")
                        .select("id, embedding")
                        .then(({ data }) => data || [])
                );

            if (error) {
                console.error("Error creating backup:", error);
                return;
            }
            console.log("Backup table created successfully via direct insert");
        } else {
            console.error("Error creating backup:", createError);
            return;
        }
    } else {
        console.log("Backup table created successfully via RPC");
    }

    // 2. Verify backup data
    console.log("\n2. Verifying backup...");
    const { count: originalCount } = await supabase
        .from("vector_patterns")
        .select("*", { count: "exact", head: true });

    const { count: backupCount } = await supabase
        .from("vector_patterns_backup_embeddings")
        .select("*", { count: "exact", head: true });

    console.log(`Original records: ${originalCount}`);
    console.log(`Backup records: ${backupCount}`);

    if (originalCount !== backupCount) {
        console.error("WARNING: Backup count doesn't match original!");
        return;
    }

    // 3. Sample verification
    console.log("\n3. Sampling backup data...");
    const { data: sampleBackup, error: sampleError } = await supabase
        .from("vector_patterns_backup_embeddings")
        .select("*")
        .limit(1);

    if (sampleError) {
        console.error("Error sampling backup:", sampleError);
        return;
    }

    if (sampleBackup && sampleBackup.length > 0) {
        console.log("Backup sample looks good:");
        console.log("- Has ID:", !!sampleBackup[0].id);
        console.log("- Has embedding:", !!sampleBackup[0].embedding);
        if (typeof sampleBackup[0].embedding === "string") {
            try {
                const parsed = JSON.parse(sampleBackup[0].embedding);
                console.log("- Embedding length:", parsed.length);
            } catch (e) {
                console.error("Error parsing backup embedding");
            }
        }
    }

    console.log("\nBackup process complete!");
}

createBackup().catch(console.error);
