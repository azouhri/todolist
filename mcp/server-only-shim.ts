/**
 * The domain layer is marked `server-only` so it can never be pulled into a
 * client bundle by the Next app. That guard throws in a plain Node process,
 * and the MCP server *is* server-side, so mcp/tsconfig.json maps the import
 * here instead.
 */
export {};
