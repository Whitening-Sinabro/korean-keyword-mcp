#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

// Validate required environment variables
const REQUIRED_ENV = [
  "NAVER_SEARCHAD_CUSTOMER_ID",
  "NAVER_SEARCHAD_API_KEY",
  "NAVER_SEARCHAD_SECRET_KEY",
  "NAVER_CLIENT_ID",
  "NAVER_CLIENT_SECRET",
] as const;

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables:\n  ${missing.join("\n  ")}`);
  console.error("\nSee: https://github.com/Whitening-Sinabro/korean-keyword-mcp#setup");
  process.exit(1);
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("korean-keyword-mcp server error:", err);
  process.exit(1);
});
