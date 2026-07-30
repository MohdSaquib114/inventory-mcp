CREATE TYPE order_status AS ENUM ('open', 'paid', 'cancelled', 'expired', 'fulfilled');
CREATE TYPE reservation_status AS ENUM ('active', 'released');
CREATE TYPE escalation_status AS ENUM ('open', 'resolved');

CREATE TABLE products (
  sku VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  total_stock INTEGER NOT NULL CHECK (total_stock >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  order_id VARCHAR(64) PRIMARY KEY,
  sku VARCHAR(64) NOT NULL REFERENCES products(sku),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status order_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reservations (
  reservation_id SERIAL PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  sku VARCHAR(64) NOT NULL REFERENCES products(sku),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status reservation_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,

  CONSTRAINT unique_active_reservation_per_order
  UNIQUE (order_id, status)
  DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_reservations_sku_status 
ON reservations (sku, status);

CREATE INDEX idx_orders_sku_status 
ON orders (sku, status);

CREATE INDEX idx_reservations_order_id 
ON reservations (order_id);

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(64) NOT NULL,
  sku VARCHAR(64),
  order_id VARCHAR(64),
  reservation_id INTEGER,
  actor VARCHAR(32) NOT NULL DEFAULT 'ai',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE escalations (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(64) NOT NULL REFERENCES products(sku),
  order_id VARCHAR(64) REFERENCES orders(order_id),
  reason TEXT NOT NULL,
  status escalation_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE VIEW inventory_status AS
SELECT 
  p.sku,
  p.name,
  p.total_stock,

  COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'active'), 0) AS reserved,

  p.total_stock 
    - COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'active'), 0) 
    AS available,

  CASE 
    WHEN p.total_stock 
         - COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'active'), 0) < 0
    THEN TRUE
    ELSE FALSE
  END AS is_oversold

FROM products p
LEFT JOIN reservations r ON r.sku = p.sku
GROUP BY p.sku, p.name, p.total_stock;

CREATE VIEW stale_reservations AS
SELECT 
  r.reservation_id,
  r.order_id,
  r.sku,
  r.quantity,
  o.status AS order_status,
  r.created_at
FROM reservations r
JOIN orders o ON o.order_id = r.order_id
WHERE 
  r.status = 'active'
  AND o.status IN ('cancelled', 'expired');