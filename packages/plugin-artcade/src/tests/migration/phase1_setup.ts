import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../../../.env") });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function setupBackupFunction() {
    console.log("Phase 1.1: Setting up backup function\n");

    // Read the SQL file
    const sqlPath = resolve(
        __dirname,
        "../../../migrations/06_create_backup_function.sql"
    );
    const sql = readFileSync(sqlPath, "utf8");

    // Execute the SQL
    const { data, error } = await supabase.rpc("exec_sql", { sql_string: sql });

    if (error) {
        if (error.message.includes('function "exec_sql" does not exist')) {
            console.error("Error: Cannot execute SQL directly via RPC.");
            console.log(
                "Please execute the SQL file manually in your database:"
            );
            console.log("\nSQL Contents:");
            console.log(sql);
            return;
        }
        console.error("Error setting up backup function:", error);
        return;
    }

    console.log("Backup function created successfully!");
    console.log(
        "\nYou can now run 'pnpm migration:backup' to create the backup."
    );
}

setupBackupFunction().catch(console.error);
