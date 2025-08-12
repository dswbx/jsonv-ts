import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import { describeRoute, validator } from "../../hono";
import { parse, s } from "../../lib";
import {
   getMcpFeatures,
   mcpTool,
   infoValidationTargetsToSchema,
   payloadToValidationTargetPayload,
   getMcpServer,
   withMcp,
} from "./mcp-features.middleware";
import { Tool } from "../tool";
import { McpClient } from "../client";
import { mcp } from "./mcp.middleware";

const call = async (tool: Tool, params: any) => {
   const res = await tool.call(params, {}, new Request("http://localhost"));
   return JSON.parse((res as any).text);
};

describe("mcp features", () => {
   test("payloadToValidationTargetPayload", async () => {
      const targets = {
         query: s.object({
            limit: s.number().optional(),
            join: s.string().optional(),
         }),
         params: s.object({ name: s.string() }),
      };

      const schema = infoValidationTargetsToSchema(targets);
      expect(schema?.toJSON()).toEqual({
         type: "object",
         required: ["name"],
         properties: {
            join: {
               type: "string",
               $target: "query",
            },
            limit: {
               type: "number",
               $target: "query",
            },
            name: {
               type: "string",
               $target: "params",
            },
         },
      } as any);

      const payload = {
         limit: "1",
         name: "foo",
      };
      const parsed = parse(schema!, payload);
      expect(parsed).toEqual({
         limit: 1,
         name: "foo",
      });

      expect(payloadToValidationTargetPayload(parsed, schema!)).toEqual({
         query: {
            limit: 1,
            join: undefined,
         },
         params: {
            name: "foo",
         },
      } as any);
   });

   test("extract an empty tool", async () => {
      const hono = new Hono().get("/", mcpTool("get"), (c) =>
         c.json({ ok: true })
      );

      const features = getMcpFeatures(hono);

      expect(JSON.parse(JSON.stringify(features))).toEqual([
         {
            type: "tool",
            tool: {
               name: "get",
               config: {},
            },
            path: "/",
            info: {
               method: "GET",
            },
         },
      ]);
   });

   test("extract a simple tool", async () => {
      const hono = new Hono().get(
         "/",
         mcpTool("get"),
         validator("query", s.object({ num: s.number() })),
         (c) => c.json({ num: c.req.valid("query").num, hono: true })
      );

      const features = getMcpFeatures(hono);
      const expected = {
         type: "tool",
         tool: {
            name: "get",
            config: {},
         },
         path: "/",
         info: {
            method: "GET",
            openAPI: {
               responses: {},
               operationId: "getIndex",
               parameters: [
                  {
                     name: "num",
                     in: "query",
                     required: true,
                     schema: {
                        type: "number",
                     },
                  },
               ],
            },
            validation: {
               query: {
                  type: "object",
                  properties: {
                     num: {
                        type: "number",
                     },
                  },
                  required: ["num"],
               },
            },
         },
      };

      expect(JSON.parse(JSON.stringify(features))).toEqual([expected]);
   });

   test("feature extraction", async () => {
      const hono = new Hono()
         .get("/", mcpTool("get"), (c) =>
            c.json({ ok: true, message: "hi from get" })
         )
         .get(
            "/another",
            mcpTool("another"),
            validator("query", s.object({ query: s.string() })),
            (c) =>
               c.json({
                  ok: true,
                  message: `query: ${c.req.valid("query").query}`,
               })
         )
         .get(
            "/path/:name",
            mcpTool("path"),
            validator("param", s.object({ name: s.string() })),
            async (c) =>
               c.json({ ok: true, message: `path: ${c.req.param("name")}` })
         );

      const features = getMcpFeatures(hono);
      expect(JSON.parse(JSON.stringify(features))).toEqual([
         {
            type: "tool",
            tool: {
               name: "get",
               config: {},
            },
            path: "/",
            info: {
               method: "GET",
            },
         },
         {
            type: "tool",
            tool: {
               name: "another",
               config: {},
            },
            path: "/another",
            info: {
               method: "GET",
               openAPI: {
                  responses: {},
                  operationId: "getAnother",
                  parameters: [
                     {
                        name: "query",
                        in: "query",
                        required: true,
                        schema: {
                           type: "string",
                        },
                     },
                  ],
               },
               validation: {
                  query: {
                     type: "object",
                     properties: {
                        query: {
                           type: "string",
                        },
                     },
                     required: ["query"],
                  },
               },
            },
         },
         {
            type: "tool",
            tool: {
               name: "path",
               config: {},
            },
            path: "/path/:name",
            info: {
               method: "GET",
               openAPI: {
                  responses: {},
                  operationId: "getPathByName",
                  parameters: [
                     {
                        name: "name",
                        in: "path",
                        required: true,
                        schema: {
                           type: "string",
                        },
                     },
                  ],
               },
               validation: {
                  param: {
                     type: "object",
                     properties: {
                        name: {
                           type: "string",
                        },
                     },
                     required: ["name"],
                  },
               },
            },
         },
      ]);
   });

   test("multiple tools", async () => {
      const hono = new Hono()
         .get("/", mcpTool("get"), (c) =>
            c.json({ ok: true, message: "hi from get" })
         )
         .get(
            "/another",
            mcpTool("another"),
            validator("query", s.object({ query: s.string() })),
            (c) =>
               c.json({
                  ok: true,
                  message: `query: ${c.req.valid("query").query}`,
               })
         )
         .get(
            "/path/:name",
            mcpTool("path"),
            validator("param", s.object({ name: s.string() })),
            async (c) => {
               const name = c.req.valid("param").name;
               if (name === "error") {
                  return c.json(
                     {
                        ok: false,
                        error: "error",
                     },
                     400
                  );
               }

               return c.json({
                  ok: true,
                  message: `path: ${name}`,
               });
            }
         )
         .post(
            "/mixed",
            mcpTool("mixed"),
            validator("query", s.object({ entity: s.string() })),
            validator("json", s.object({})), // intentionally empty
            async (c) =>
               c.json({
                  ok: true,
                  message: `query: ${c.req.valid("query").entity}`,
                  json: c.req.valid("json"),
               })
         );

      const server = getMcpServer(hono);
      //    ^?

      const client = new McpClient({
         url: "http://localhost/sse",
         //fetch: new Hono().use(mcp(server)).request,
         fetch: withMcp(hono).request,
      });
      expect(server.tools.length).toBe(4);

      expect(
         await client.listTools().then((r) => r!.tools.map((t) => t.name))
      ).toEqual(["get", "another", "path", "mixed"]);

      expect(
         await client.callTool({
            name: "get",
         })
      ).toEqual({
         content: [
            {
               type: "text",
               text: '{"ok":true,"message":"hi from get"}',
            },
         ],
      });

      expect(
         await client.callTool({
            name: "another",
            arguments: { query: "hello" },
         })
      ).toEqual({
         content: [
            {
               type: "text",
               text: '{"ok":true,"message":"query: hello"}',
            },
         ],
      });

      expect(
         await client.callTool({
            name: "path",
            arguments: { name: "world" },
         })
      ).toEqual({
         content: [
            {
               type: "text",
               text: '{"ok":true,"message":"path: world"}',
            },
         ],
      });

      expect(
         await client.callTool({
            name: "path",
            arguments: { name: "error" },
         })
      ).toEqual({
         content: [
            {
               type: "text",
               text: 'Error: {"ok":false,"error":"error"}',
            },
         ],
         isError: true,
      });

      expect(
         await client.callTool({
            name: "mixed",
            arguments: { entity: "entity", json: { name: "name" } },
         })
      ).toEqual({
         content: [
            {
               type: "text",
               text: '{"ok":true,"message":"query: entity","json":{"name":"name"}}',
            },
         ],
      });
   });

   test("tools details", async () => {
      const hono = new Hono().get(
         "/",
         mcpTool("get", {
            title: "MCP GET",
            description: "MCP GET description",
            annotations: {
               destructiveHint: true,
            },
         }),
         (c) => c.json({ ok: true, message: "hi from get" })
      );

      const server = getMcpServer(hono);
      expect(server.toJSON().tools[0]).toEqual({
         name: "get",
         title: "MCP GET",
         description: "MCP GET description",
         inputSchema: {
            type: "object",
         },
         outputSchema: undefined,
         annotations: {
            destructiveHint: true,
         },
         _meta: undefined,
      });

      {
         // if no title given, use openAPI summary
         const hono = new Hono().get(
            "/",
            describeRoute({
               summary: "MCP GET",
            }),
            mcpTool("get"),
            (c) => c.json({ ok: true, message: "hi from get" })
         );

         const server = getMcpServer(hono);
         expect(server.tools[0]?.toJSON()["description"]).toBe("MCP GET");
      }
   });

   test("multiple tools, same path, different methods", async () => {
      const hono = new Hono()
         .get("/", mcpTool("get"), (c) =>
            c.json({ ok: true, message: "hi from get" })
         )
         .post("/", mcpTool("post"), (c) =>
            c.json({ ok: true, message: "hi from post" })
         );

      const server = getMcpServer(hono);
      expect(server.tools.length).toBe(2);

      const client = new McpClient({
         url: "http://localhost/sse",
         fetch: withMcp(hono).request,
      });

      expect(
         await client.listTools().then((r) => r!.tools.map((t) => t.name))
      ).toEqual(["get", "post"]);

      expect(
         await client.callTool({
            name: "get",
         })
      ).toEqual({
         content: [
            {
               type: "text",
               text: '{"ok":true,"message":"hi from get"}',
            },
         ],
      });

      expect(
         await client.callTool({
            name: "post",
            arguments: {
               message: "hi from post",
            },
         })
      ).toEqual({
         content: [
            {
               type: "text",
               text: '{"ok":true,"message":"hi from post"}',
            },
         ],
      });
   });
});
