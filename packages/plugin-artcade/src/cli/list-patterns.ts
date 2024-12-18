const fs = require("fs");
const path = require("path");

async function listPatterns() {
    try {
        // Read patterns from a local JSON file
        const patternsPath = path.join(
            __dirname,
            "..",
            "data",
            "patterns.json"
        );
        const patternsData = fs.readFileSync(patternsPath, "utf8");
        const patterns = JSON.parse(patternsData);

        console.log("\nStored Game Patterns:");
        console.log("====================\n");

        patterns.forEach((pattern: any, index: number) => {
            console.log(`${index + 1}. ${pattern.pattern_name}`);
            console.log(`   Type: ${pattern.type}`);
            console.log(
                `   Effectiveness Score: ${pattern.effectiveness_score}`
            );
            console.log(`   Usage Count: ${pattern.usage_count}`);
            console.log(`   Context: ${pattern.content?.context || "N/A"}`);
            if (pattern.content?.metadata) {
                console.log(
                    `   Metadata:`,
                    JSON.stringify(pattern.content.metadata, null, 2)
                );
            }
            console.log("\n");
        });
    } catch (error: any) {
        if (error.code === "ENOENT") {
            console.log("No patterns found. The patterns database is empty.");
        } else {
            console.error("Error listing patterns:", error);
        }
    }
}

// Run if called directly
if (require.main === module) {
    listPatterns();
}
