INSERT INTO products (sku, name, total_stock)
SELECT 
  'SKU-BULK-' || i,
  'Bulk Product ' || i,
  (random() * 80 + 20)::int
FROM generate_series(1, 100) i;


INSERT INTO orders (order_id, sku, quantity, status)
SELECT
  'ORD-BULK-' || i,
  'SKU-BULK-' || ((i % 100) + 1),
  (random() * 6 + 1)::int,
  (
    ARRAY['open','paid','cancelled','expired','fulfilled']
  )[floor(random()*5)+1]::order_status
FROM generate_series(1, 600) i;


INSERT INTO reservations (order_id, sku, quantity, status)
SELECT
  o.order_id,
  o.sku,
  o.quantity,
  'active'::reservation_status
FROM orders o
WHERE o.status IN ('open'::order_status, 'paid'::order_status)
  AND random() > 0.2;


INSERT INTO reservations (order_id, sku, quantity, status)
SELECT
  o.order_id,
  o.sku,
  o.quantity,
  'active'::reservation_status
FROM orders o
WHERE o.status IN ('cancelled'::order_status, 'expired'::order_status)
  AND random() > 0.5;


INSERT INTO products (sku, name, total_stock) VALUES
  ('SKU-OVERSELL-001', 'Gaming Mouse', 10),
  ('SKU-OVERSELL-002', 'Gaming Headset', 15),
  ('SKU-OVERSELL-003', '4K Monitor', 8),
  ('SKU-OVERSELL-004', 'SSD Drive', 12),
  ('SKU-OVERSELL-005', 'Graphics Card', 5);


INSERT INTO orders (order_id, sku, quantity, status) VALUES
  ('ORD-OVR-1', 'SKU-OVERSELL-001', 6, 'paid'::order_status),
  ('ORD-OVR-2', 'SKU-OVERSELL-001', 7, 'open'::order_status),

  ('ORD-OVR-3', 'SKU-OVERSELL-002', 10, 'paid'::order_status),
  ('ORD-OVR-4', 'SKU-OVERSELL-002', 9, 'open'::order_status),

  ('ORD-OVR-5', 'SKU-OVERSELL-003', 5, 'paid'::order_status),
  ('ORD-OVR-6', 'SKU-OVERSELL-003', 6, 'open'::order_status),

  ('ORD-OVR-7', 'SKU-OVERSELL-004', 8, 'paid'::order_status),
  ('ORD-OVR-8', 'SKU-OVERSELL-004', 7, 'open'::order_status),

  ('ORD-OVR-9', 'SKU-OVERSELL-005', 3, 'paid'::order_status),
  ('ORD-OVR-10','SKU-OVERSELL-005', 4, 'open'::order_status);


INSERT INTO reservations (order_id, sku, quantity, status)
SELECT 
  order_id,
  sku,
  quantity,
  'active'::reservation_status
FROM orders
WHERE order_id LIKE 'ORD-OVR-%';


INSERT INTO products (sku, name, total_stock) VALUES
  ('SKU-MIXED-001', 'Smartphone', 20);


INSERT INTO orders (order_id, sku, quantity, status) VALUES
  ('ORD-MIX-1', 'SKU-MIXED-001', 8, 'open'::order_status),
  ('ORD-MIX-2', 'SKU-MIXED-001', 10, 'cancelled'::order_status),
  ('ORD-MIX-3', 'SKU-MIXED-001', 7, 'expired'::order_status);


INSERT INTO reservations (order_id, sku, quantity, status) VALUES
  ('ORD-MIX-1', 'SKU-MIXED-001', 8, 'active'::reservation_status),
  ('ORD-MIX-2', 'SKU-MIXED-001', 10, 'active'::reservation_status), -- stale
  ('ORD-MIX-3', 'SKU-MIXED-001', 7, 'active'::reservation_status); -- stale


INSERT INTO escalations (sku, reason, status)
SELECT 
  p.sku,
  'Auto-detected oversell during monitoring',
  'open'::escalation_status
FROM products p
WHERE random() > 0.85;


INSERT INTO audit_log (action_type, sku, order_id, reason)
SELECT
  (ARRAY['CHECK','RELEASE','ESCALATE'])[floor(random()*3)+1],
  'SKU-BULK-' || ((i % 100) + 1),
  'ORD-BULK-' || i,
  'System generated log'
FROM generate_series(1, 200) i;