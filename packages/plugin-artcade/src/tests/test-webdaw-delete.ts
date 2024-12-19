import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../../.env") });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function deleteWebDawPatterns() {
    console.log("Deleting WebDaw patterns...");

    const patternNames = [
        "Modern Dark Sequencer Grid",
        "Step Sequencer Core Logic",
        "Web Audio Drum Synthesis",
    ];

    for (const name of patternNames) {
        const { error } = await supabase
            .from("vector_patterns")
            .delete()
            .eq("pattern_name", name);

        if (error) {
            console.error(`Failed to delete pattern ${name}:`, error.message);
        } else {
            console.log(`Successfully deleted pattern: ${name}`);
        }
    }

    console.log("Deletion complete!");
}

// Use import.meta.url for ESM module detection
if (import.meta.url === `file://${process.argv[1]}`) {
    deleteWebDawPatterns().catch(console.error);
}

export { deleteWebDawPatterns };
