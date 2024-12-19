import { createClient } from "@supabase/supabase-js";
import { elizaLogger } from "@ai16z/eliza";

// Environment validation
if (
    !process.env.SUPABASE_PROJECT_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
    elizaLogger.error("Missing required Supabase environment variables");
    process.exit(1);
}

export const supabaseClient = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: { persistSession: false },
    }
);

// Connection test function
export async function testSupabaseConnection() {
    try {
        const { error } = await supabaseClient
            .from("vector_patterns")
            .select("count");

        if (error) throw error;
        elizaLogger.info("Supabase connection successful");
        return true;
    } catch (error) {
        elizaLogger.error("Supabase connection failed:", error);
        return false;
    }
}
