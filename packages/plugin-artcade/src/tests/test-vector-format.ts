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

async function testVectorFormat() {
    try {
        // Create test table using raw SQL
        const { error: createError } = await supabase
            .from("vector_patterns")
            .select("embedding")
            .limit(1);

        if (createError) {
            console.error("Error accessing vector_patterns:", createError);
            return;
        }

        // Test vector
        const testVector = [0.1, 0.2, 0.3];

        // Try different formats
        console.log("\nTesting vector formats...");

        // Format 1: Direct array
        const insert1 = await supabase
            .from("vector_patterns")
            .insert({
                type: "test",
                pattern_name: "test_direct_array",
                content: { test: true },
                embedding: testVector,
                room_id: "00000000-0000-0000-0000-000000000000",
                user_id: "00000000-0000-0000-0000-000000000000",
                agent_id: "00000000-0000-0000-0000-000000000000",
            })
            .select();
        console.log("Format 1 (direct array):", insert1.error || "Success");

        // Format 2: Array string
        const insert2 = await supabase
            .from("vector_patterns")
            .insert({
                type: "test",
                pattern_name: "test_array_string",
                content: { test: true },
                embedding: `[${testVector.join(",")}]`,
                room_id: "00000000-0000-0000-0000-000000000000",
                user_id: "00000000-0000-0000-0000-000000000000",
                agent_id: "00000000-0000-0000-0000-000000000000",
            })
            .select();
        console.log("Format 2 (array string):", insert2.error || "Success");

        // Query the results
        const { data, error } = await supabase
            .from("vector_patterns")
            .select("*")
            .eq("type", "test")
            .limit(2);

        if (error) {
            console.error("Error querying results:", error);
            return;
        }

        console.log("\nStored vectors:");
        if (data && data.length > 0) {
            data.forEach((row, i) => {
                console.log(`\nRow ${i + 1}:`);
                console.log("Pattern name:", row.pattern_name);
                console.log("Embedding type:", typeof row.embedding);
                console.log("Embedding value:", row.embedding);
                if (Array.isArray(row.embedding)) {
                    console.log("Embedding length:", row.embedding.length);
                }
            });
        } else {
            console.log("No data found");
        }

        // Clean up test data
        await supabase.from("vector_patterns").delete().eq("type", "test");
    } catch (error) {
        console.error("Test error:", error);
    }
}

testVectorFormat().catch(console.error);
