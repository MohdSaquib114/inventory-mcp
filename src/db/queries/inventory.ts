import { pool } from "../pool.js";

export interface ReservationRow {
  reservationId: number;
  orderId: string;
  quantity: number;
  status: string;
  orderStatus: string;
}

export interface StockSnapshot {
  sku: string;
  name: string;
  totalStock: number;
  activeReservedQuantity: number;
  availableStock: number;
  isOversold: boolean;
  activeReservations: ReservationRow[];
}

export async function getStockAndReservations(
  sku: string,
): Promise<StockSnapshot | null> {
  const productResult = await pool.query(
    `SELECT sku, name, total_stock FROM products WHERE sku = $1`,
    [sku],
  );
  if (productResult.rowCount === 0) return null;
  const product = productResult.rows[0];

  const reservationsResult = await pool.query(
    `SELECT r.reservation_id, r.order_id, r.quantity, r.status,
            o.status AS order_status
     FROM reservations r
     JOIN orders o ON o.order_id = r.order_id
     WHERE r.sku = $1 AND r.status = 'active'
     ORDER BY r.created_at ASC`,
    [sku],
  );

  const activeReservations: ReservationRow[] = reservationsResult.rows.map(
    (r) => ({
      reservationId: r.reservation_id,
      orderId: r.order_id,
      quantity: r.quantity,
      status: r.status,
      orderStatus: r.order_status,
    }),
  );

  const activeReservedQuantity = activeReservations.reduce(
    (sum, r) => sum + r.quantity,
    0,
  );
  const availableStock = product.total_stock - activeReservedQuantity;

  return {
    sku: product.sku,
    name: product.name,
    totalStock: product.total_stock,
    activeReservedQuantity,
    availableStock,
    isOversold: availableStock < 0,
    activeReservations,
  };
}

export async function getStaleReservations(
  sku: string,
  staleMinutes: number = 15,
): Promise<ReservationRow[]> {
  const result = await pool.query(
    `
    SELECT r.reservation_id, r.order_id, r.quantity, r.status,
           o.status AS order_status
    FROM reservations r
    JOIN orders o ON o.order_id = r.order_id
    WHERE r.sku = $1
      AND r.status = 'active'
      AND (
        -- Orders already invalid
        o.status IN ('cancelled', 'expired')

        -- OR open but too old (abandoned)
        OR (
          o.status = 'open'
          AND r.created_at < NOW() - ($2 * INTERVAL '1 minute')
        )
      )
    ORDER BY r.created_at ASC
    `,
    [sku, staleMinutes],
  );

  return result.rows.map((r) => ({
    reservationId: r.reservation_id,
    orderId: r.order_id,
    quantity: r.quantity,
    status: r.status,
    orderStatus: r.order_status,
  }));
}

export async function getReservationWithOrder(reservationId: number) {
  const result = await pool.query(
    `SELECT r.reservation_id, r.order_id, r.sku, r.quantity, r.status,
            o.status AS order_status
     FROM reservations r
     JOIN orders o ON o.order_id = r.order_id
     WHERE r.reservation_id = $1`,
    [reservationId],
  );

  return result.rows[0] ?? null;
}

export async function releaseReservation(reservationId: number) {
  const result = await pool.query(
    `UPDATE reservations
     SET status = 'released', released_at = now()
     WHERE reservation_id = $1 AND status = 'active'
     RETURNING reservation_id, order_id, sku, quantity`,
    [reservationId],
  );

  return result.rows[0] ?? null;
}

export async function createEscalation(
  sku: string,
  orderId: string | null,
  reason: string,
) {
  const result = await pool.query(
    `INSERT INTO escalations (sku, order_id, reason)
     VALUES ($1, $2, $3)
     RETURNING id, sku, order_id, reason, status, created_at`,
    [sku, orderId, reason],
  );

  return result.rows[0];
}