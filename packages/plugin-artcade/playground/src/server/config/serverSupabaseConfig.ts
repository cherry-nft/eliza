import { createClient } from "@supabase/supabase-js";
import { elizaLogger } from "@ai16z/eliza";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Environment validation
if (
    !process.env.SUPABASE_PROJECT_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
    elizaLogger.error("Missing required Supabase environment variables");
    process.exit(1);
}

export const serverSupabaseClient = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: { persistSession: false },
    }
);

// Connection test function
export async function testServerSupabaseConnection() {
    try {
        const { error } = await serverSupabaseClient
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
