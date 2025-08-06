import { describe, it, expect, mock, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import { mcp } from "../hono/mcp.middleware";
import { Tool } from "../tool";
import { Resource } from "../resource";
import * as s from "jsonv-ts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpClient } from "../client";

const test = new Tool(
   "test",
   {
      inputSchema: s.object(
         {
            name: s.string(),
            age: s.number().optional(),
         },
         {
            title: "...",
         }
      ),
   },
   async (params, c) => {
      if (params.age && params.age > 100) {
         throw new Error("yeah that's too old");
      }
      return c.text(`Hello, ${params.name}! Age: ${params.age ?? "unknown"}`);
   }
);

const test2 = new Tool(
   "test2",
   {
      inputSchema: s.object({
         name: s.string(),
         age: s.number().optional(),
      }),
   },
   async (params, c) => {
      return c.text(`Hello, ${params.name}! Age: ${params.age ?? "unknown"}`);
   }
);

const context = new Tool("context", {}, async (params, c) => {
   console.log("--context", {
      context: c.context,
      params,
   });
   return c.json({
      context: c.context,
   });
});

const staticResource = new Resource(
   "static",
   "users://123/profile",
   async (c) => c.text("hello world")
);
const staticResource2 = new Resource(
   "static2",
   "users://123/profile",
   async (c) => c.text("hello world")
);

const dynamicResource = new Resource(
   "dynamic",
   "users://{username}/profile",
   async (c, { username }) => c.text(`hello ${username}`)
);
const dynamicResource2 = new Resource(
   "dynamic2",
   "users://{username}/profile",
   async (c, { username }) => c.text(`hello ${username}`)
);

describe("mcp-client", async () => {
   let native: Client;
   let client: McpClient;

   const expectClients = <Results = any[]>(
      results: Results[],
      expected: any,
      preprocess?: (r: Results) => any
   ) => {
      const clean = (r: any) => JSON.parse(JSON.stringify(r));

      results.map((r) => {
         expect(clean(preprocess ? preprocess(r) : r)).toEqual(clean(expected));
      });
   };

   beforeAll(async () => {
      const app = new Hono().use(
         mcp({
            tools: [test, test2, context],
            resources: [
               staticResource,
               staticResource2,
               dynamicResource,
               dynamicResource2,
            ],
            debug: {
               logLevel: "warning",
            },
            sessionsEnabled: true,
         })
      );

      // @ts-ignore
      global.fetch = mock(app.request);
      const url = new URL("http://localhost:3001/sse");

      const transport = new StreamableHTTPClientTransport(url);

      native = new Client({
         name: "example-client",
         version: "1.0.0",
      });

      await native.connect(transport);

      client = new McpClient({
         url,
      });
      await client.connect();
   });

   afterAll(async () => {
      mock.restore();
   });

   it("pings", async () => {
      expectClients([await client.ping(), await native.ping()], {});
   });

   it("list tools", async () => {
      expectClients(
         [await client.listTools(), await native.listTools()],
         ["test", "test2", "context"],
         (r) => r?.tools.map((t) => t.name) ?? []
      );
   });

   it("calls tool", async () => {
      const message = {
         name: "test",
         arguments: {
            name: "John",
            age: 30,
         },
      };
      expectClients(
         [await client.callTool(message), await native.callTool(message)],
         {
            content: [
               {
                  type: "text",
                  text: "Hello, John! Age: 30",
               },
            ],
         }
      );
   });

   it("lists resources", async () => {
      expectClients(
         [await client.listResources(), await native.listResources()],
         {
            resources: [
               {
                  name: "static",
                  uri: "users://123/profile",
               },
               {
                  name: "static2",
                  uri: "users://123/profile",
               },
            ],
         }
      );
   });

   it("lists resource templates", async () => {
      expectClients(
         [
            await client.listResourceTemplates(),
            await native.listResourceTemplates(),
         ],
         {
            resourceTemplates: [
               {
                  name: "dynamic",
                  uriTemplate: "users://{username}/profile",
               },
               {
                  name: "dynamic2",
                  uriTemplate: "users://{username}/profile",
               },
            ],
         }
      );
   });

   it("returns resource", async () => {
      const message = {
         uri: "users://123/profile",
      };
      expectClients(
         [
            await client.readResource(message),
            await native.readResource(message),
         ],
         {
            contents: [
               {
                  uri: "users://123/profile",
                  name: "static",
                  text: "hello world",
                  mimeType: "text/plain",
               },
            ],
         }
      );
   });

   it("returns dynamic resource", async () => {
      const message = {
         uri: "users://john/profile",
      };
      expectClients(
         [
            await client.readResource(message),
            await native.readResource(message),
         ],
         {
            contents: [
               {
                  uri: "users://john/profile",
                  name: "dynamic",
                  text: "hello john",
                  mimeType: "text/plain",
               },
            ],
         }
      );
   });

   it("sets logging level", async () => {
      expectClients(
         [
            await client.setLoggingLevel("debug"),
            await native.setLoggingLevel("debug"),
         ],
         {}
      );
   });
});
