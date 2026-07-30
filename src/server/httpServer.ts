import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./createMcpServer.js";
import { config } from "../config.js";

const transports: Record<string, StreamableHTTPServerTransport> = {};

export function startHttpServer(): void {
  const app = express();
  app.use(express.json());

  app.post("/mcp", handlePost);
  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

  app.listen(config.port || 3000, () => {
    console.log(`inventory-ops-mcp listening on port ${config.port || 3000}`);
  });
}

async function handlePost(req: Request, res: Response): Promise<void> {
  let sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),

      onsessioninitialized: (newSessionId) => {
        console.log("New MCP session created:", newSessionId);
        transports[newSessionId] = transport;
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        console.log("Session closed:", transport.sessionId);
        delete transports[transport.sessionId];
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
  }

  await transport.handleRequest(req, res, req.body);
}

async function handleSessionRequest(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = sessionId ? transports[sessionId] : undefined;

  if (!transport) {
    res.status(204).end();
    return;
  }

  await transport.handleRequest(req, res);
}