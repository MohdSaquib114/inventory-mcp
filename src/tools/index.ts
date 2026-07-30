import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerInventoryTools } from "./inventory/index.js";
// Future categories go here, e.g.:
// import { registerOrderTools } from "./orders/index.js";

export function registerAllTools(server: McpServer) {
  registerInventoryTools(server);
}
