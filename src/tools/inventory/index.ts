import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetStockAndReservations } from "./getStockAndReservations.js";
import { registerReleaseStaleReservation } from "./releaseStaleReservation.js";
import { registerDetectStaleReservations } from "./detectStaleReservation.js";
import { registerAnalyzeInventoryIssue } from "./analyzeInventoryIssue.js";

export function registerInventoryTools(server: McpServer) {
  registerGetStockAndReservations(server);
  registerReleaseStaleReservation(server);
  registerDetectStaleReservations(server);
  registerAnalyzeInventoryIssue(server);
}
