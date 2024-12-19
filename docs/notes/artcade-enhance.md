# Artcade Database Connection Update

## Goal

Switch from direct PostgreSQL connection to Supabase while maintaining existing functionality.

## Implementation Plan

### 1. Environment Configuration (5 min)

File: `packages/plugin-artcade/playground/.env`

```env
# Required Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Existing Configuration (unchanged)
OPENAI_API_KEY=your_openai_key
```

Verification:

- Check if `.env` file exists
- Add Supabase variables if missing
- Keep existing variables unchanged

### 2. Supabase Configuration (10 min)

File: `packages/plugin-artcade/playground/src/config/supabaseConfig.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { elizaLogger } from "@ai16z/eliza";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    elizaLogger.error("Missing required Supabase environment variables");
    process.exit(1);
}

export const supabaseClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: { persistSession: false },
    },
);

// Add connection test function
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
```

Verification:

- Ensure imports are available
- Verify environment variable checks
- Test connection function works

### 3. Server Update (15 min)

File: `packages/plugin-artcade/playground/src/server/index.ts`

```typescript
import { elizaLogger } from "@ai16z/eliza";
import {
    supabaseClient,
    testSupabaseConnection,
} from "../config/supabaseConfig";
import { VectorSupabase } from "../../../src/services/VectorSupabase";

// Remove PostgresDatabaseAdapter import and initialization
// const databaseAdapter = new PostgresDatabaseAdapter(...);

// Initialize VectorSupabase
const vectorDb = new VectorSupabase(process.env.SUPABASE_URL!);

// Update server initialization
app.listen(PORT, async () => {
    try {
        // Test Supabase connection first
        const isConnected = await testSupabaseConnection();
        if (!isConnected) {
            throw new Error("Failed to connect to Supabase");
        }

        elizaLogger.info(`Server running on port ${PORT}`);
    } catch (error) {
        elizaLogger.error("Server initialization failed:", error);
        process.exit(1);
    }
});

// Add health check endpoint
app.get("/health", async (req, res) => {
    try {
        const isConnected = await testSupabaseConnection();
        res.json({
            status: isConnected ? "healthy" : "error",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
```

Verification:

- Server starts successfully
- Health check endpoint responds
- Vector operations work through Supabase

## Testing Steps

1. Environment Check:

```bash
cat packages/plugin-artcade/playground/.env
# Verify Supabase variables are present
```

2. Start Server:

```bash
cd packages/plugin-artcade/playground
pnpm dev
```

3. Test Connection:

```bash
curl http://localhost:3000/health
# Should return {"status":"healthy","timestamp":"..."}
```

## Rollback Plan

If issues occur:

1. Keep a backup of the original `.env` file
2. Add feature flag in `.env`:

```env
USE_SUPABASE=false
```

3. Add conditional initialization:

```typescript
const useSupabase = process.env.USE_SUPABASE === "true";
const db = useSupabase
    ? new VectorSupabase(process.env.SUPABASE_URL!)
    : new PostgresDatabaseAdapter(/* ... */);
```

## Success Criteria

- Server starts without database connection errors
- Health check returns healthy status
- Pattern operations (search, store, retrieve) work through Supabase
