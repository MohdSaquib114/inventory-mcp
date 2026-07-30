import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getStaleReservations } from "../../db/queries/inventory.js";

export function registerDetectStaleReservations(server: McpServer) {
  server.registerTool(
    "detect_stale_reservations",
    {
      title: "Detect stale reservations for a SKU",
      description:
            "Identifies reservations for a SKU that are no longer valid and are safe candidates for release. " +
            "A reservation is considered stale if it is still ACTIVE but its associated order is CANCELLED, FAILED, " +
            "or has exceeded the allowed time window without completion. " +
            "Use this tool when diagnosing oversell issues or when you need to determine which reservations " +
            "can be safely released without impacting valid customer orders. " +
            "Do NOT assume all returned reservations should be released blindly—use release_stale_reservation " +
            "to enforce safety checks before making changes.",
      inputSchema: {
        sku: z.string(),
      },
    },
    async ({ sku }) => {
      const stale = await getStaleReservations(sku);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                sku,
                count: stale.length,
                reservations: stale,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}