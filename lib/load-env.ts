import { config as loadEnv } from "dotenv";

/**
 * Import this first in any standalone script (seed, demo, export, import, the
 * MCP server). Next.js loads .env.local automatically; plain Node does not, and
 * that is where the Supabase credentials live.
 *
 * dotenv does not overwrite variables that are already set, so real environment
 * variables (Vercel, CI) always win.
 */
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });
