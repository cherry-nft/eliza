import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_KEY || ""
);

const testPattern = {
    id: "test-pattern-1",
    type: "movement",
    pattern_name: "Basic Movement",
    content: { code: 'console.log("test")' },
    embedding: new Array(1536).fill(0), // Dummy embedding
    effectiveness_score: 0.5,
    usage_count: 1,
};

async function insertTestPattern() {
    const { data, error } = await supabase
        .from("vector_patterns")
        .insert(testPattern)
        .select();

    if (error) {
        console.error("Insert failed:", error);
    } else {
        console.log("Insert successful:", data);
    }
}

insertTestPattern();
