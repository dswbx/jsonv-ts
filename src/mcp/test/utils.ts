import { Hono } from "hono";
import { mcp, type McpOptions } from "../middleware";

export function createMcp(opts?: McpOptions) {
   return new Hono().use(mcp(opts));
}
