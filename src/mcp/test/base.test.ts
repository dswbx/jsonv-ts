import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { mcp } from "../middleware";
import * as s from "../../lib";
import { tool } from "../tool";

describe("mcp base", () => {
   it("should boot", async () => {
      const app = new Hono().use(
         mcp({
            tools: [
               tool({
                  name: "test",
                  handler: async (params, ctx) => {
                     return ctx.text("hello world");
                  },
               }),
            ],
         })
      );

      const res = await app.request("/sse", {
         method: "POST",
         body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/list",
            params: {},
         }),
      });
      const body = await res.json();
      expect(body).toEqual({
         jsonrpc: "2.0",
         id: 1,
         result: {
            tools: [
               {
                  name: "test",
                  inputSchema: {
                     type: "object",
                     properties: {},
                  },
               },
            ],
         },
      });
   });
});
