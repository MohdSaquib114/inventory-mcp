# inventory-ops-mcp

A remotely hosted MCP server that lets an ops person investigate and resolve
inventory oversells without engineer involvement.

## Workflow this solves

**Oversell**: a SKU shows more stock reserved across open orders than it
actually has (`available = total_stock - active_reservations` goes
negative). Root cause is usually one of two things:

- A **stale reservation** — an order was cancelled or expired, but its stock
  reservation was never released. Safe to auto-fix.
- A **genuine conflict** between paid/open orders. Not safe to auto-fix —
  gets escalated to a human with an audit trail instead.

## Project structure

```
db/
  schema.sql        tables, enums, indexes
  seed.sql          synthetic data covering all 4 demo scenarios
src/
  config.ts         env config
  db/
    pool.ts         single shared pg.Pool for the whole process
    queries/        raw SQL, grouped by domain (inventory, audit)
  tools/
    inventory/      one file per tool + an index.ts that registers them
    index.ts        top-level registry - add new categories here later
  server/
    createMcpServer.ts   builds one McpServer instance (per session)
    httpServer.ts        Streamable HTTP transport, session handling
  index.ts          entrypoint
```

Tools are grouped by domain category (`tools/inventory/`) rather than dumped
in one file, so a second category (e.g. `tools/orders/`) can be added later
without touching existing code — just create the folder, register its tools
in its own `index.ts`, and add one line to `src/tools/index.ts`.

## Architecture notes

- **One MCP server instance per client session** (Streamable HTTP,
  session-id based) — this is the SDK's own recommended pattern, since
  protocol/session state can't be safely shared across clients.
- **One shared `pg.Pool` for the entire process** — imported by the query
  modules, not created per session. Sessions are isolated at the protocol
  layer; the database connection is not.
- The resolution tool (`release_stale_reservation`) enforces its safety
  boundary in code, not by trusting the model: it refuses anything that
  isn't a cancelled/expired order's reservation, regardless of what the AI
  requests.

## Setup

1. Create a Postgres database and set `DATABASE_URL` in `.env` (copy
   `.env.example`).
2. Load the schema and synthetic data:
   ```
   npm run db:setup
   ```
3. Install dependencies and start the server:
   ```
   npm install
   npm run dev
   ```
4. Point an MCP client at `http://localhost:3000/mcp` (or your deployed
   Render URL). For Claude Code:
   ```
   claude mcp add --transport http inventory-ops http://localhost:3000/mcp
   ```

## Demo scenarios (seeded)

| SKU                    | Situation                                   | Expected tool path                          |
|------------------------|----------------------------------------------|----------------------------------------------|
| SKU-HEALTHY-001        | No issue                                      | `get_stock_and_reservations` shows no oversell |
| SKU-OVERSELL-PAID-002  | Oversold by paid + open orders                | must escalate — release refused               |
| SKU-STALE-CANCEL-003   | Oversold by a stale reservation (cancelled order) | `release_stale_reservation` resolves it    |
| SKU-STALE-EXPIRED-004  | Same, order expired instead of cancelled       | `release_stale_reservation` resolves it    |

## Out of scope (explicit)

- Stale physical-count reconciliation (a related but separate workflow) —
  not built in this pass; escalation for that case is created but not
  auto-resolved.
- Authentication, a frontend, and CI/CD — excluded per the assignment brief.
- Multi-SKU orders (one line item per order, to keep the schema simple).


