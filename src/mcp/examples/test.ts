import { Hono } from "hono";
import { Tool } from "../tool";
import * as s from "jsonv-ts";
import { mcp } from "../hono/mcp.middleware";
import { Resource } from "../resource";

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
      description: "test2 description1",
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
   async () => {
      return {
         text: "hello world",
      };
   }
);
const staticResource2 = new Resource(
   "static2",
   "users://123/profile",
   async () => {
      return {
         text: "hello world",
      };
   }
);

const dynamicResource = new Resource(
   "dynamic12",
   "users://{username}/profile",
   async (c, params) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return c.text(`hello ${params.username}`);
   },
   {
      list: ["123", "456"],
      /* complete: {
         username: async (value, context) => {
            console.log("complete: dynamic", { value, context });
            return ["123", "456"];
         },
      }, */
   }
);
const dynamicResource2 = new Resource(
   "dynamic2",
   "users://{username}/profile",
   async (c, { username }) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return c.text(`hello ${username}`);
   }
);

const app = new Hono().use(
   mcp({
      serverInfo: {
         name: "mcp-test",
         version: "0.0.1",
      },
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

export default {
   fetch: app.fetch,
   port: 3001,
};
