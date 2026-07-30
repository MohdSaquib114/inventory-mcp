import { pool } from "../pool.js";

export interface LogActionParams {
  actionType: string;
  sku?: string | null;
  orderId?: string | null;
  reservationId?: number | null;
  reason?: string | null;
  actor?: string;
}

export async function logAction(params: LogActionParams): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (action_type, sku, order_id, reservation_id, actor, reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.actionType,
      params.sku ?? null,
      params.orderId ?? null,
      params.reservationId ?? null,
      params.actor ?? "ai",
      params.reason ?? null,
    ],
  );
}
