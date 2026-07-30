import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getReservationWithOrder,
  releaseReservation,
} from "../../db/queries/inventory.js";
import { logAction } from "../../db/queries/audit.js";

const RELEASABLE_ORDER_STATUSES = new Set(["cancelled", "expired"]);

export function registerReleaseStaleReservation(server: McpServer) {
  server.registerTool(
    "release_stale_reservation",
    {
      title: "Release a stale reservation",
      description:
        "Releases a single reservation, freeing its quantity back into available stock. " +
        "Only permitted when the reservation's order is CANCELLED or EXPIRED - reservations " +
        "on open or paid orders are always refused. Use this to resolve an oversell that is " +
        "caused by a reservation that should have been released when its order was cancelled " +
        "or expired, but was not. For anything else (paid orders, physical count issues), use " +
        "escalate_discrepancy instead.",
      inputSchema: {
        reservationId: z
          .number()
          .int()
          .describe(
            "The reservation ID to release, taken from get_stock_and_reservations output",
          ),
      },
    },
    async ({ reservationId }) => {
      const reservation = await getReservationWithOrder(reservationId);
      if (!reservation) {
        return {
          content: [
            { type: "text", text: `No reservation found with id ${reservationId}.` },
          ],
          isError: true,
        };
      }

      if (reservation.status !== "active") {
        return {
          content: [
            {
              type: "text",
              text: `Reservation ${reservationId} is already "${reservation.status}"; nothing to do.`,
            },
          ],
        };
      }

      if (!RELEASABLE_ORDER_STATUSES.has(reservation.order_status)) {
        return {
          content: [
            {
              type: "text",
              text:
                `Refusing to release reservation ${reservationId}: its order ` +
                `(${reservation.order_id}) has status "${reservation.order_status}", ` +
                `not cancelled/expired. Use escalate_discrepancy instead.`,
            },
          ],
          isError: true,
        };
      }

      const released = await releaseReservation(reservationId);
      await logAction({
        actionType: "release_stale_reservation",
        sku: reservation.sku,
        orderId: reservation.order_id,
        reservationId,
        reason: `Order status was "${reservation.order_status}"`,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ released }, null, 2) }],
      };
    },
  );
}
