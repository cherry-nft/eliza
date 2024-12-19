import { createClient } from "@supabase/supabase-js";

// Use Vite's environment variable handling
const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing required Supabase environment variables");
}

export const supabaseClient = createClient(
    supabaseUrl || "",
    supabaseAnonKey || "",
    {
        auth: { persistSession: false },
    }
);

// Browser-safe connection test
export async function testSupabaseConnection() {
    try {
        const { error } = await supabaseClient
            .from("vector_patterns")
            .select("count");

        if (error) throw error;
        console.log("Supabase connection successful");
        return true;
    } catch (error) {
        console.error("Supabase connection failed:", error);
        return false;
    }
}
