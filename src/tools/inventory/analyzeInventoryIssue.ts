import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getStockAndReservations,
  getStaleReservations,
} from "../../db/queries/inventory.js";

export function registerAnalyzeInventoryIssue(server: McpServer) {
  server.registerTool(
    "analyze_inventory_issue",
    {
      title: "Analyze inventory issues for a SKU",
      description:
            "Primary diagnostic tool for investigating inventory problems for a SKU. " +
            "Use this after fetching stock data (or directly when unsure) to determine whether " +
            "the SKU has issues such as OVERSOLD or STALE_RESERVATIONS. " +
            "This tool analyzes current stock levels and reservation states to identify the root cause " +
            "of the problem and classify its severity. " +
            "It also provides a clear recommendation on what action to take next, such as releasing stale " +
            "reservations or escalating the issue. " +
            "Always prefer this tool before taking any corrective action, as it encapsulates the decision logic " +
            "and prevents unsafe operations.",
      inputSchema: {
        sku: z.string(),
      },
    },
    async ({ sku }) => {
      const snapshot = await getStockAndReservations(sku);

      if (!snapshot) {
        return {
          content: [{ type: "text", text: `SKU ${sku} not found` }],
          isError: true,
        };
      }

      const stale = await getStaleReservations(sku);

      const issues: string[] = [];
      let rootCause = "";
      let recommendation = "";
      let severity: "low" | "medium" | "high" = "low";

      if (snapshot.isOversold) {
        issues.push("OVERSOLD");
        severity = "high";

        if (stale.length > 0) {
          rootCause =
            "Oversell caused by stale or cancelled reservations not being released";

          recommendation =
            "Release stale reservations to restore available stock";
        } else {
          rootCause =
            "Oversell caused by legitimate active orders exceeding stock";

          recommendation =
            "Do NOT release reservations. Escalate to operations team";
        }
      }

      if (!snapshot.isOversold && stale.length > 0) {
        issues.push("STALE_RESERVATIONS");
        severity = "medium";

        rootCause =
          "Stale reservations are blocking inventory but not yet causing oversell";

        recommendation =
          "Safe to release stale reservations to improve availability";
      }

      if (issues.length === 0) {
        issues.push("HEALTHY");
        rootCause = "No inventory issues detected";
        recommendation = "No action needed";
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                sku,
                summary: {
                  totalStock: snapshot.totalStock,
                  reserved: snapshot.activeReservedQuantity,
                  available: snapshot.availableStock,
                },
                issues,
                severity,
                staleReservationsCount: stale.length,
                rootCause,
                recommendation,
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