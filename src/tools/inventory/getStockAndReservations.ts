import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getStockAndReservations as fetchStockAndReservations } from "../../db/queries/inventory.js";

export function registerGetStockAndReservations(server: McpServer) {
  server.registerTool(
    "get_stock_and_reservations",
    {
      title: "Get stock and reservations for a SKU",
      description:
        "Looks up a product's total stock and its active reservations, and computes " +
        "available stock as total stock minus active reservations. Flags the SKU as " +
        "oversold when available stock is negative. Always call this first when " +
        "investigating why a SKU looks oversold - it returns each active reservation's " +
        "order status, which determines what can be done about it next.",
      inputSchema: {
        sku: z
          .string()
          .describe('The product SKU to investigate, e.g. "SKU-OVERSELL-PAID-002"'),
      },
    },
    async ({ sku }) => {
      const snapshot = await fetchStockAndReservations(sku);
      if (!snapshot) {
        return {
          content: [{ type: "text", text: `No product found with SKU "${sku}".` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }],
      };
    },
  );
}
