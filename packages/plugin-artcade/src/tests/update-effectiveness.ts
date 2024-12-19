import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://drhgdchrqzidfmhgekva.supabase.co";
const SUPABASE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyaGdkY2hycXppZGZtaGdla3ZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU1OTg0NSwiZXhwIjoyMDUwMTM1ODQ1fQ.tiSqJZrt9_lSUd4Q9cI5VuPsE2Uj3yyEFXFPyA8SIOo";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateWebDawEffectiveness() {
    try {
        // Get all WebDaw patterns
        const { data: patterns, error } = await supabase
            .from("vector_patterns")
            .select("id, pattern_name")
            .ilike("pattern_name", "%WebDAW%");

        if (error) {
            console.error("Error fetching WebDaw patterns:", error);
            return;
        }

        if (!patterns || patterns.length === 0) {
            console.log("No WebDaw patterns found");
            return;
        }

        console.log(`Found ${patterns.length} WebDaw patterns`);

        // Update each pattern with a high effectiveness score
        for (const pattern of patterns) {
            const { error: updateError } = await supabase
                .from("vector_patterns")
                .update({ effectiveness_score: 0.85 })
                .eq("id", pattern.id);

            if (updateError) {
                console.error(
                    `Error updating pattern ${pattern.pattern_name}:`,
                    updateError
                );
            } else {
                console.log(
                    `Updated effectiveness score for pattern: ${pattern.pattern_name}`
                );
            }
        }

        console.log("Finished updating effectiveness scores");
    } catch (err) {
        console.error("Error in updateWebDawEffectiveness:", err);
    }
}

updateWebDawEffectiveness();
