import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    "https://drhgdchrqzidfmhgekva.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyaGdkY2hycXppZGZtaGdla3ZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU1OTg0NSwiZXhwIjoyMDUwMTM1ODQ1fQ.tiSqJZrt9_lSUd4Q9cI5VuPsE2Uj3yyEFXFPyA8SIOo"
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
