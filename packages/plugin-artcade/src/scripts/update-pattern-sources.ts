import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = "https://drhgdchrqzidfmhgekva.supabase.co";
const SUPABASE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyaGdkY2hycXppZGZtaGdla3ZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU1OTg0NSwiZXhwIjoyMDUwMTM1ODQ1fQ.tiSqJZrt9_lSUd4Q9cI5VuPsE2Uj3yyEFXFPyA8SIOo";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const patternSources = {
    "geometry-rush.html": [
        "1616b927-9aec-41d7-bc02-4a37b7303d16",
        "492ccf08-af70-4dd8-b34f-904374d6c983",
        "4e3067cc-1fd8-435f-a1a8-e1e16c1174f0",
        "56929568-1623-4c99-8d7b-26b673dc359f",
        "94732a14-755c-4804-9633-3a9a6d9a3abc",
        "bcdd9cb1-e301-4920-8e9c-fc9cbcf1e625",
    ],
    "night-synth.html": [
        "38f8731f-9fab-454b-ba8d-72f2b416fefb",
        "74e8166e-e826-4844-96e4-f93dc5d8f119",
        "a6556bb2-fd7e-4fd5-96db-04ee43086974",
        "b9c914ee-b928-437c-87df-ab5efbc8c439",
        "c63272c2-5aa4-469b-b8a3-48b22d7efc3a",
        "f500569a-6819-4684-99b9-8051cd98635b",
    ],
    "webdaw-sequencer.html": [
        "0fb40843-1878-487d-90bc-10c09cdb15b6",
        "4d249b91-2384-4ba8-bc81-0f52e238763e",
        "8e930a62-20ce-43e5-a302-55f7b8db6d43",
    ],
};

async function updatePatternSources() {
    try {
        for (const [filename, patternIds] of Object.entries(patternSources)) {
            console.log(`Updating patterns for ${filename}...`);

            // Read the source file content
            const sourceCode = readFileSync(
                join(__dirname, "../../embeddings", filename),
                "utf-8"
            );
            console.log(
                `Read source code for ${filename}, length: ${sourceCode.length} characters`
            );

            for (const id of patternIds) {
                const { error } = await supabase
                    .from("vector_patterns")
                    .update({
                        user_id: filename,
                        agent_id: sourceCode,
                    })
                    .eq("id", id);

                if (error) {
                    console.error(`Error updating pattern ${id}:`, error);
                } else {
                    console.log(
                        `Updated pattern ${id} with source: ${filename}`
                    );
                }
            }
        }

        console.log("Finished updating pattern sources");
    } catch (err) {
        console.error("Error in updatePatternSources:", err);
    }
}

updatePatternSources();
