import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { mcp } from "../middleware";
import * as s from "jsonv-ts";
import { Tool } from "../tool";
import { Resource } from "../resource";
import { McpServer } from "../server";

describe("mcp base", () => {
   it("should work with the example", async () => {
      const server = new McpServer({
         name: "demo-server",
         version: "1.0.0",
      });

      server.addTool(
         new Tool(
            "add",
            {
               description: "Add two numbers",
               inputSchema: s.object({
                  a: s.number(),
                  b: s.number(),
               }),
            },
            async ({ a, b }, ctx) => {
               return ctx.text(String(a + b));
            }
         )
      );

      server.addResource(
         new Resource(
            "greeting",
            "greeting://{name}",
            async (c, { name }) => {
               return c.text(`Hello, ${name}!`);
            },
            {
               title: "Greeting Resource",
               description: "Dynamic greeting resource",
            }
         )
      );

      // make a request to the server
      const request = new Request("http://localhost/sse", {
         method: "POST",
         body: JSON.stringify({
            jsonrpc: "2.0",
            method: "resources/read",
            params: {
               uri: "greeting://John",
            },
         }),
      });

      const expected = {
         jsonrpc: "2.0",
         result: {
            contents: [
               {
                  name: "greeting",
                  mimeType: "text/plain",
                  uri: "greeting://John",
                  text: "Hello, John!",
               },
            ],
         },
      };

      const response = await server.handle(request.clone());
      const data = await response.json();
      expect(data).toEqual(expected);

      {
         // test with hono
         const app = new Hono().use(mcp({ server }));
         const res = await app.request(request.clone());
         expect(await res.json()).toEqual(expected);
      }
   });

   it("should boot", async () => {
      const app = new Hono().use(
         mcp({
            serverInfo: {
               name: "test-server",
               version: "1.0.0",
            },
            tools: [
               new Tool("test", undefined, async (params, ctx) => {
                  return ctx.text("hello world");
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
                  },
               },
            ],
         },
      });
   });
});
