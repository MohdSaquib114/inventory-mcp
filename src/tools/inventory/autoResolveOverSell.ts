import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getStockAndReservations,
  getStaleReservations,
  releaseReservation,
} from "../../db/queries/inventory.js";
import { logAction } from "../../db/queries/audit.js";
import { createEscalation } from "../../db/queries/inventory.js";

export function registerAutoResolveOversell(server: McpServer) {
  server.registerTool(
    "auto_resolve_oversell",
    {
      title: "Automatically resolve oversell for a SKU",
      description:
        "Attempts to automatically and safely resolve an OVERSOLD condition for a SKU. " +
        "This tool should only be used after confirming that the SKU is oversold, typically via " +
        "get_stock_and_reservations or analyze_inventory_issue. " +
        "It works by identifying stale reservations and releasing them one by one until the available stock " +
        "is no longer negative. It never releases reservations tied to valid (e.g., PAID or ACTIVE) orders. " +
        "If no safe reservations are available to release, the tool will escalate the issue for manual review " +
        "instead of making unsafe changes. " +
        "Use this tool to automate safe recovery from oversell scenarios, but rely on analyze_inventory_issue " +
        "first to understand the root cause.",
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

      if (!snapshot.isOversold) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  sku,
                  message: "No oversell detected. No action taken.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const staleReservations = await getStaleReservations(sku);

      if (staleReservations.length === 0) {
        const escalation = await createEscalation(
          sku,
          null,
          "Oversell detected but no stale reservations available for safe resolution",
        );

        await logAction({
          actionType: "auto_resolve_escalated",
          sku,
          reason: "No stale reservations found",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  sku,
                  action: "ESCALATED",
                  reason:
                    "No stale reservations found. Manual intervention required.",
                  escalation,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      let remainingOversell = Math.abs(snapshot.availableStock);
      const released: any[] = [];

      for (const r of staleReservations) {
        if (remainingOversell <= 0) break;

        const res = await releaseReservation(r.reservationId);
        if (res) {
          released.push(res);
          remainingOversell -= r.quantity;

          await logAction({
            actionType: "auto_release_stale_reservation",
            sku,
            orderId: r.orderId,
            reservationId: r.reservationId,
            reason: "Auto-resolving oversell",
          });
        }
      }

      const finalSnapshot = await getStockAndReservations(sku);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                sku,
                initialAvailable: snapshot.availableStock,
                finalAvailable: finalSnapshot?.availableStock,
                releasedCount: released.length,
                releasedReservations: released,
                status:
                  finalSnapshot && finalSnapshot.availableStock >= 0
                    ? "RESOLVED"
                    : "PARTIALLY_RESOLVED",
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