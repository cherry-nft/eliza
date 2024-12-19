import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../../../.env") });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface ConversionResult {
    successful_conversions: number;
    failed_conversions: number;
    error_messages: string[];
}

async function testConversion() {
    console.log("Phase 2: Vector Conversion Test\n");

    // 1. First, try a dry run
    console.log("1. Running dry-run conversion...");
    const { data: dryRunResult, error: dryRunError } =
        await supabase.rpc<ConversionResult>("convert_all_embeddings", {
            dry_run: true,
        });

    if (dryRunError) {
        console.error("Dry-run error:", dryRunError);
        return;
    }

    if (!dryRunResult) {
        console.error("No result returned from dry run");
        return;
    }

    console.log("Dry run results:");
    console.log(
        `- Successful validations: ${dryRunResult.successful_conversions}`
    );
    console.log(`- Failed validations: ${dryRunResult.failed_conversions}`);
    if (dryRunResult.error_messages?.length > 0) {
        console.log("\nValidation errors:");
        dryRunResult.error_messages.forEach((msg: string) =>
            console.log(`- ${msg}`)
        );
    }

    // 2. If dry run successful, try converting a single record
    if (dryRunResult.failed_conversions === 0) {
        console.log("\n2. Testing single record conversion...");

        // Get first record ID
        const { data: firstRecord } = await supabase
            .from("vector_patterns")
            .select("id")
            .limit(1)
            .single();

        if (firstRecord) {
            const { data: conversionResult, error: conversionError } =
                await supabase.rpc("convert_single_embedding", {
                    input_id: firstRecord.id,
                });

            if (conversionError) {
                console.error("Single conversion error:", conversionError);
                return;
            }

            console.log("Single conversion result:");
            console.log(conversionResult);

            // Verify the converted record
            const { data: verifyData } = await supabase
                .from("vector_patterns")
                .select("embedding")
                .eq("id", firstRecord.id)
                .single();

            if (verifyData) {
                console.log("\nVerifying converted embedding:");
                console.log("- Type:", typeof verifyData.embedding);
                if (Array.isArray(verifyData.embedding)) {
                    console.log("- Length:", verifyData.embedding.length);
                    console.log(
                        "- First few values:",
                        verifyData.embedding.slice(0, 3)
                    );
                }
            }
        }
    } else {
        console.log("\nSkipping actual conversion due to validation errors.");
    }
}

testConversion().catch(console.error);
