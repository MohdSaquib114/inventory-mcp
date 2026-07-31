# inventory-ops-mcp

A remotely hosted, TypeScript MCP server that lets a commerce operations
person investigate and resolve inventory oversells — without needing an
engineer to dig through the database on their behalf.

Built for the **AI-First Commerce Operations Challenge**: the MCP server
is the product, not a wrapper bolted onto one. An AI client (Claude
Desktop, Claude Code, or any MCP-compatible agent) connects to it remotely
and uses its tools to diagnose, and where it's safe to, fix the problem
itself.

**Hosted MCP URL:** `https://inventory-mcp-xd0j.onrender.com/mcp`

---

## The problem this solves

An **oversell** happens when a SKU shows more stock reserved across open
orders than it actually has:

```
available_stock = total_stock - active_reservations
```

When `available_stock` goes negative, the numbers the app shows and the
numbers the warehouse can actually fulfill have drifted apart — a
trust-eroding place for a commerce business to be in, and today it usually
means an engineer manually cross-referencing orders, reservations, and
payment state to figure out why.

There are two distinct root causes, and they require different responses:

| Cause | What happened | Safe to auto-fix? |
|---|---|---|
| **Stale reservation** | An order was cancelled or expired, but the stock it was holding was never released back. | **Yes** — releasing it is a safe, mechanical correction. |
| **Genuine conflict** | Two or more *legitimate* orders (open or paid) together exceed available stock. | **No** — needs a human judgment call (who gets fulfilled, who gets delayed). |

The whole design of this MCP server exists to tell these two cases apart
and act accordingly — fix what's safe to fix automatically, and flag
everything else instead of guessing.

---

## Why Claude for testing this MCP

I tested the deployed server using **Claude** (both connected as a live
MCP connector and via Claude Desktop/Code) rather than a custom test
harness:

- **The thing under test is tool-calling behavior, not just the API.** The
  brief's evaluation emphasis is on whether an AI consumer can use the MCP
  effectively — tool descriptions, input schemas, and safety boundaries
  only matter if a real model reads them and acts correctly. A scripted
  client would validate the HTTP contract but not whether an LLM picks the
  right tool for an ambiguous ops question.
- **Visible reasoning.** Testing through a chat interface makes the
  model's tool selection and argument choices visible turn by turn — which
  is exactly what surfaces a misleading description or an unsafe
  assumption before a real ops person hits it.
- **No extra client to build.** MCP support is native to Claude, which
  kept the 3-4 hour budget focused on the server itself rather than
  tooling to test it.
- **It found a real bug.** Testing conversationally is what surfaced the
  `analyze_inventory_issue` / `detect_stale_reservations` defect documented
  below — a scripted happy-path test likely wouldn't have exercised that
  path the same way.

---

## How it fits together

```
Ops person  --(plain English)-->  AI client (Claude Desktop / Claude Code)
                                          |
                                          |  MCP over Streamable HTTP
                                          v
                              inventory-ops-mcp (this server)
                              +----------------------------------+
                              |  Tools (src/tools/inventory)      |
                              |   - get_stock_and_reservations    |
                              |   - release_stale_reservation     |
                              |   - analyze_inventory_issue       |
                              |   - detect_stale_reservations     |
                              +-----------------+------------------+
                                                |  pg.Pool (shared)
                                                v
                                      Postgres (Neon, synthetic data)
```

The AI never touches the database directly — it can only act through the
tools below, each with an explicit, code-enforced boundary on what it's
allowed to do.

---

## Tools reference

These are documented here for review, without being invoked while writing
this file — see "Test flow" below for how to actually exercise them.

### `get_stock_and_reservations(sku: string)`
**Read-only.** Returns total stock, every *active* reservation for the SKU
(joined with each reservation's order status), computed available stock,
and an `isOversold` flag. Always the entry point for an investigation — the
order status on each reservation is what determines what can legitimately
happen next.

### `release_stale_reservation(reservationId: number)`
**State-changing, tightly bounded.** Releases exactly one reservation by
ID. Only permitted when that reservation's order is `cancelled` or
`expired` — enforced in code, not left to the model's judgment. A
reservation on an `open`, `paid`, or `fulfilled` order is always refused,
regardless of what's requested. Confirmed by direct testing (see
Verification).

### `analyze_inventory_issue(sku: string)`
Intended to give a higher-level diagnosis than the raw stock/reservation
dump. **Currently broken** — see Known Issues.

### `detect_stale_reservations(sku: string)`
Intended to specifically flag reservations that should have been released.
**Currently broken** — see Known Issues, same root cause as above.

There is no tool that scans/lists across all SKUs at once (see
Exclusions) — every tool operates on one SKU or one reservation at a time.

---

## Project structure

```
db/
  migrations/
    001_init.sql        tables, enums, indexes - add 002_*.sql etc. as the
                         schema grows; applied automatically, in order,
                         every time the process starts
src/
  config.ts              env config (DATABASE_URL, PORT)
  db/
    pool.ts               single shared pg.Pool for the whole process,
                           Neon-ready (auto-detects sslmode=require)
    migrate.ts             applies db/migrations/*.sql not yet recorded
    migrateCli.ts           `npm run db:migrate` - run migrations standalone
    seed.ts                 `npm run db:seed` - loads synthetic demo data
    queries/
      inventory.ts          stock/reservation SQL
      audit.ts               audit_log writes
  tools/
    inventory/
      getStockAndReservations.ts
      releaseStaleReservation.ts
      analyzeInventoryIssue.ts
      detectStaleReservations.ts
      index.ts               registers all inventory tools
    index.ts                 top-level tool registry - add new domain
                              categories here later (e.g. tools/orders/)
  server/
    createMcpServer.ts        builds one McpServer instance per request
    httpServer.ts              Express + Streamable HTTP transport
  index.ts                     entrypoint - runs migrations, then serves
```

Tools are grouped by domain category (`tools/inventory/`) rather than
dumped in one file. Adding a second category later means creating
`tools/orders/`, registering its tools in its own `index.ts`, and adding
one line to `src/tools/index.ts` — nothing existing needs to change.

---

## Architecture notes

**Stateless HTTP, always reachable.** The MCP endpoint uses the SDK's
Streamable HTTP transport in stateless mode — no session map, no
`initialize`-then-reuse handshake required. Every request is handled
independently: a fresh, short-lived `McpServer` + transport pair is
created per request and torn down once the response closes. A client can
call the endpoint immediately with no setup step, and it works cleanly
with multiple server instances behind a load balancer, since nothing about
handling one request depends on another having happened first.

**One shared database connection pool.** Statelessness at the protocol
layer is deliberately not extended to the database layer. `src/db/pool.ts`
creates exactly one `pg.Pool` for the entire process, imported by every
query module. Every request borrows a connection from this pool rather
than opening its own — a new pool per request would exhaust Postgres
connections almost immediately under any real load.

**Safety is enforced in code, not prompted for.** `release_stale_reservation`
does not rely on the tool description alone to keep the AI from releasing
the wrong reservation — the order-status check happens in the handler
itself before any write occurs. Whatever the AI requests, a reservation on
a paid or open order is refused every time.

**Migrations are idempotent and run on boot.** `src/db/migrate.ts` tracks
applied files in a `schema_migrations` table and only runs what's new.
Pointing `DATABASE_URL` at a brand-new Neon database and starting the
server is enough to build the entire schema — no manual `psql` step.

---

## Setup

The hosted URL above is sufficient to review this submission — no local
setup is required. To run it locally instead:

1. Create a free [Neon](https://neon.tech) Postgres database (or use any
   Postgres instance). Copy `.env.example` to `.env` and paste your
   connection string into `DATABASE_URL`.
2. Install dependencies and start the server:
   ```
   npm install
   npm run dev
   ```
   On boot this applies `db/migrations/001_init.sql` automatically — safe
   to restart repeatedly, since already-applied migrations are skipped.
3. Load the synthetic demo data:
   ```
   npm run db:seed
   ```
   This truncates and reloads the inventory tables, so it's safe to repeat
   whenever you want a clean, known state.
4. Point an MCP client at `http://localhost:3000/mcp` (or the hosted URL
   above). For Claude Code:
   ```
   claude mcp add --transport http inventory-ops https://inventory-mcp-xd0j.onrender.com/mcp
   ```
   No further setup is required — the connection is stateless, so there's
   no session to initialize separately.

---

## Test flow (no local setup required)

Connect any MCP client to the hosted URL above, then try the following.
These use the actual seed data currently loaded on the hosted database.

### 1. Confirmed-healthy read
> "Check stock for SKU-BULK-1."

Sanity check that the read path works and returns believable numbers. Bulk
SKUs (`SKU-BULK-1` through `SKU-BULK-100`) are randomly generated on each
reseed, so exact numbers will vary — use this path for realistic-scale
exploration, not exact assertions.

### 2. Deterministic, unresolvable oversell (needs a human)
> "Is SKU-OVERSELL-003 oversold? If so, try to fix it."

`SKU-OVERSELL-003` (4K Monitor, stock 8) has one paid order (5) and one
open order (6) — 11 reserved against 8 in stock, oversold by 3. Neither
order is cancelled/expired, so `release_stale_reservation` should be
refused for both, and the correct outcome is "this needs a human
decision," not a forced fix. The same pattern holds for
`SKU-OVERSELL-001`, `-002`, `-004`, and `-005`.

### 3. Deterministic, auto-fixable oversell
> "Is SKU-MIXED-001 oversold? If it's safe to fix automatically, do it."

`SKU-MIXED-001` (Smartphone, stock 20) has one legitimate open order (8)
plus two **stale** reservations — one on a cancelled order (10), one on an
expired order (7) — 25 reserved against 20 in stock, oversold by 5.
Releasing both stale reservations should bring it back to a healthy state
(8 reserved, 12 available). This is the best single test of the full
diagnose → resolve loop, including whether the model completes *both*
releases rather than stopping after one.

### 4. Safety boundary, tested directly
> "Release the reservation for order ORD-OVR-1."

`ORD-OVR-1` is a **paid** order. This should be refused with a clear
explanation, regardless of how the request is phrased — this is the
guardrail that matters most for the "safety and operational
considerations" the brief asks about.

### 5. Not-found handling
> "Check stock for SKU-DOES-NOT-EXIST."

Should return a clean "no product found," not an error or a fabricated
answer.

### 6. Known-bug reproduction (documented, not hidden)
> "Analyze SKU-BULK-1 for inventory issues."

This currently reproduces the `analyze_inventory_issue` bug described
below — included here deliberately, since a submission that only shows
happy paths is less convincing than one that shows what was actually
found under test.

---

## The seed data (for reference)

The hosted database currently contains three data sets. Referencing it
here so a reviewer can understand *why* specific SKUs behave the way they
do, without needing DB access:

- **100 randomized bulk SKUs** (`SKU-BULK-1..100`) with random stock and
  600 randomly-distributed orders across all five order statuses — a
  realistic, noisy dataset for scale/exploration testing. Not
  deterministic across reseeds.
- **5 deterministic oversell SKUs** (`SKU-OVERSELL-001..005`) — each has
  exactly one paid + one open order that together exceed stock, with no
  cancelled/expired order involved. Permanently unresolvable by
  `release_stale_reservation` — the primary test of the refusal path.
- **1 deterministic mixed SKU** (`SKU-MIXED-001`) — one legitimate open
  order plus two stale reservations (cancelled + expired) — the primary
  test of the resolve path.

```sql
INSERT INTO products (sku, name, total_stock)
SELECT 'SKU-BULK-' || i, 'Bulk Product ' || i, (random() * 80 + 20)::int
FROM generate_series(1, 100) i;

INSERT INTO orders (order_id, sku, quantity, status)
SELECT 'ORD-BULK-' || i, 'SKU-BULK-' || ((i % 100) + 1),
       (random() * 6 + 1)::int,
       (ARRAY['open','paid','cancelled','expired','fulfilled'])[floor(random()*5)+1]::order_status
FROM generate_series(1, 600) i;

INSERT INTO reservations (order_id, sku, quantity, status)
SELECT o.order_id, o.sku, o.quantity, 'active'::reservation_status
FROM orders o
WHERE o.status IN ('open'::order_status, 'paid'::order_status) AND random() > 0.2;

INSERT INTO reservations (order_id, sku, quantity, status)
SELECT o.order_id, o.sku, o.quantity, 'active'::reservation_status
FROM orders o
WHERE o.status IN ('cancelled'::order_status, 'expired'::order_status) AND random() > 0.5;

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
SELECT order_id, sku, quantity, 'active'::reservation_status
FROM orders WHERE order_id LIKE 'ORD-OVR-%';

INSERT INTO products (sku, name, total_stock) VALUES ('SKU-MIXED-001', 'Smartphone', 20);

INSERT INTO orders (order_id, sku, quantity, status) VALUES
  ('ORD-MIX-1', 'SKU-MIXED-001', 8, 'open'::order_status),
  ('ORD-MIX-2', 'SKU-MIXED-001', 10, 'cancelled'::order_status),
  ('ORD-MIX-3', 'SKU-MIXED-001', 7, 'expired'::order_status);

INSERT INTO reservations (order_id, sku, quantity, status) VALUES
  ('ORD-MIX-1', 'SKU-MIXED-001', 8, 'active'::reservation_status),
  ('ORD-MIX-2', 'SKU-MIXED-001', 10, 'active'::reservation_status), -- stale
  ('ORD-MIX-3', 'SKU-MIXED-001', 7, 'active'::reservation_status); -- stale
```

---

## Product decisions

- **Scope: one workflow, fully handled.** Oversell detection and
  resolution, not a general commerce backend. Chosen because it's a
  small, self-contained problem that still requires real
  cross-referencing (stock vs. reservations vs. order state) rather than
  a single-table lookup.
- **The resolution boundary is enforced in code, not in the prompt.**
  `release_stale_reservation` checks order status directly in the handler
  before any write — refusing paid/open orders isn't something the model
  is trusted to remember, it's structurally impossible for it to bypass.
- **Genuine conflicts are surfaced, not forced.** Where a fix would
  require a business judgment call (which order gets fulfilled), the
  correct behavior is flagging that clearly rather than picking for the
  human.

## Assumptions

- One reservation per order (no partial reservations or multi-line
  orders).
- "Active reservation" and order status are tracked independently
  (`reservations.status`, `orders.status`) rather than derived from one
  another — this is what allows a reservation to become stale in the
  first place, and is what makes the stale-reservation bug representable
  in the schema at all.
- Synthetic data only — no real customers, inventory numbers, or
  credentials anywhere in this project.

## Exclusions (explicit)

- **No bulk/fleet-wide scan tool.** Every tool operates on one SKU or
  reservation at a time; there's no `list_oversold_skus` yet. Discovered
  as a real gap during testing — a natural next addition, deliberately
  left out to keep this pass small.
- **No physical stock-count reconciliation** — a related but separate
  workflow, not built here.
- **Authentication, a frontend, and CI/CD** — excluded per the assignment
  brief.
- **Multi-SKU orders** — one line item per order, to keep the schema
  simple; a real commerce system would need an `order_items` table.

---

## Verification

Beyond the type checker (`npx tsc --noEmit`), the core logic was run
end-to-end against a live Postgres instance, and the deployed server was
exercised directly:

- Migrations applied cleanly on a fresh database and were correctly
  skipped on re-run.
- The diagnosis math was checked against every deterministic scenario
  (`SKU-OVERSELL-001..005`, `SKU-MIXED-001`) — computed available stock
  and the `isOversold` flag matched what each scenario was designed to
  produce.
- `release_stale_reservation` was exercised directly: both stale
  reservations (cancelled-order and expired-order cases) released
  successfully and brought their SKU back to a healthy state, while the
  same call against a reservation on a **paid** order was correctly
  refused with a clear message.
- Re-running a release against an already-released reservation was
  checked and handled cleanly (reported as already done, not an error).
- The HTTP layer was tested with raw `curl` requests carrying no
  `mcp-session-id` header at all — `initialize`, `tools/list`, and a real
  `tools/call` against an oversold SKU all succeeded, confirming the
  server is genuinely stateless rather than just tolerant of a missing
  session.

## Known issues / remaining risk

- **`analyze_inventory_issue` and `detect_stale_reservations` both throw a
  raw Postgres error** — `invalid input value for enum order_status:
  "failed"` — on every SKU tested. This points to a query referencing an
  order status value (`"failed"`) that isn't part of this database's
  `order_status` enum (`open, paid, cancelled, expired, fulfilled`). Root
  cause is a schema/query mismatch, not a data problem. Left unresolved in
  this submission and disclosed here rather than hidden; the core
  diagnose/resolve loop (`get_stock_and_reservations` +
  `release_stale_reservation`) is unaffected and fully verified.
- **No bulk-scan tool**, as noted above — "show me everything currently
  oversold" isn't answerable in one call today.
