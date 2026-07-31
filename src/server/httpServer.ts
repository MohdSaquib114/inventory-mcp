import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./createMcpServer.js";
import { config } from "../config.js";

export function startHttpServer(): void {
  const app = express();
  app.use(express.json());

  app.post("/mcp", handleRequest);

  app.get("/mcp", (_req, res) => {
    res.status(405).json({ error: "Method not allowed: this server is stateless" });
  });
  app.delete("/mcp", (_req, res) => {
    res.status(405).json({ error: "Method not allowed: this server is stateless" });
  });

  app.listen(config.port || 3000, () => {
    console.log(`inventory-ops-mcp listening on port ${config.port || 3000}`);
  });
}

async function handleRequest(req: Request, res: Response): Promise<void> {

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
