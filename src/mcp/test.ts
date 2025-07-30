import { Hono } from "hono";
import { McpServer } from "./server";
import { Tool, tool } from "./tool";
import * as s from "jsonv-ts";
import { mcp } from "./middleware";
import { resource, Resource } from "./resource";

const test = new Tool(
   "test",
   async (params, c) => {
      if (params.age && params.age > 100) {
         throw new Error("yeah that's too old");
      }
      return c.text(`Hello, ${params.name}! Age: ${params.age ?? "unknown"}`);
   },
   s.object(
      {
         name: s.string(),
         age: s.number().optional(),
      },
      {
         title: "...",
      }
   )
);

const test2 = tool({
   name: "test2",
   schema: s.object({
      name: s.string(),
      age: s.number().optional(),
   }),
   handler: async (params, c) => {
      return c.text(`Hello, ${params.name}! Age: ${params.age ?? "unknown"}`);
   },
});

const context = new Tool(
   "context",
   async (params, c) => {
      console.log("--context", {
         context: c.context,
         params,
      });
      return c.json({
         context: c.context,
      });
   },
   undefined
);

const staticResource = new Resource(
   "static",
   "users://123/profile",
   async () => {
      return {
         text: "hello world",
      };
   }
);
const staticResource2 = resource({
   name: "static2",
   uri: "users://123/profile",
   handler: async () => {
      return {
         text: "hello world",
      };
   },
});

const dynamicResource = new Resource(
   "dynamic",
   "users://{username}/profile",
   async ({ username }) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return {
         text: `hello ${username}`,
      };
   }
);
const dynamicResource2 = resource({
   name: "dynamic2",
   uri: "users://{username}/profile",
   handler: async ({ username }) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return {
         text: `hello ${username}`,
      };
   },
});

const app = new Hono().use(
   mcp({
      context: {
         random: "bla bla",
      },
      tools: [test, test2, context],
      resources: [
         staticResource,
         staticResource2,
         dynamicResource,
         dynamicResource2,
      ],
      debug: {
         logLevel: "debug",
      },
   })
);

const srv = new McpServer(
   {
      name: "mcp-test",
      version: "0.0.1",
   },
   {
      foo: "bar",
   }
).tool({
   name: "test",
   schema: s.object({
      name: s.string(),
   }),
   handler: async (params, c) => {
      return c.text(`Hello, ${c.context.foo}! ${params.name}`);
   },
});

app.all("/mcp_test", async (c) => {
   const server = new McpServer(
      {
         name: "mcp-test",
         version: "0.0.1",
      },
      {
         foo: "bar1",
      }
   );
   server.registerTool(test);
   server.registerTool(test2);
   server.registerTool(context);
   return await server.handle(c.req.raw);
});

export default {
   fetch: app.fetch,
   port: 3001,
};
