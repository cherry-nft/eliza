import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://drhgdchrqzidfmhgekva.supabase.co";
const SUPABASE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyaGdkY2hycXppZGZtaGdla3ZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU1OTg0NSwiZXhwIjoyMDUwMTM1ODQ1fQ.tiSqJZrt9_lSUd4Q9cI5VuPsE2Uj3yyEFXFPyA8SIOo";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Pattern-specific effectiveness scores based on content analysis
const patternScores = {
    "Modern Dark Sequencer Grid": 0.9, // Good UI, responsive, well-themed
    "Step Sequencer Core Logic": 0.95, // Excellent core functionality, reliable tempo sync
    "Web Audio Drum Synthesis": 0.8, // Good quality but limited sound set
};

async function updateWebDawEffectiveness() {
    try {
        // Get all WebDaw patterns by filename
        const { data: patterns, error } = await supabase
            .from("vector_patterns")
            .select("id, pattern_name")
            .eq("user_id", "webdaw-sequencer.html");

        if (error) {
            console.error("Error fetching WebDaw patterns:", error);
            return;
        }

        if (!patterns || patterns.length === 0) {
            console.log("No WebDaw patterns found");
            return;
        }

        console.log(`Found ${patterns.length} WebDaw patterns`);

        // Update each pattern with its specific effectiveness score
        for (const pattern of patterns) {
            const score = patternScores[pattern.pattern_name];
            if (!score) {
                console.warn(
                    `No score defined for pattern: ${pattern.pattern_name}`
                );
                continue;
            }

            const { error: updateError } = await supabase
                .from("vector_patterns")
                .update({ effectiveness_score: score })
                .eq("id", pattern.id);

            if (updateError) {
                console.error(
                    `Error updating pattern ${pattern.pattern_name}:`,
                    updateError
                );
            } else {
                console.log(
                    `Updated effectiveness score for pattern: ${pattern.pattern_name} to ${score}`
                );
            }
        }

        console.log("Finished updating effectiveness scores");
    } catch (err) {
        console.error("Error in updateWebDawEffectiveness:", err);
    }
}

updateWebDawEffectiveness();
