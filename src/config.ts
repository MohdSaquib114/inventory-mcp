import "dotenv/config";

export const config = {
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/inventory_mcp",
  port: Number(process.env.PORT ?? 3000),
};
