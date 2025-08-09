import { McpServer } from "jsonv-ts/mcp";
import { s } from "jsonv-ts";

const server = new McpServer({
   name: "demo-server",
   version: "1.0.0",
});

server.tool(
   "add",
   {
      name: "add",
      description: "Add two numbers",
      inputSchema: s.object({
         a: s.number(),
         b: s.number(),
      }),
   },
   ({ a, b }, c) => c.text(String(a + b))
);

server.resource("greeting", "greeting://{name}", async (c, { name }) => {
   return c.text(`Hello, ${name}!`, {
      title: "Greeting Resource",
      description: "Dynamic greeting resource",
   });
});

// send a message to the server
const response = await server.handle({
   jsonrpc: "2.0",
   method: "resources/read",
   params: {
      uri: "greeting://John",
   },
});
console.log(response);
// {
//   jsonrpc: "2.0",
//   result: {
//     contents: [
//       {
//         name: "greeting",
//         title: "Greeting Resource",
//         description: "Dynamic greeting resource",
//         mimeType: "text/plain",
//         uri: "greeting://John",
//         text: "Hello, John!",
//       }
//     ],
//   },
// }

import { Hono } from "hono";
import { mcp, Tool, Resource } from "jsonv-ts/mcp";

const add = new Tool(
   "add",
   {
      inputSchema: s.object({ a: s.number(), b: s.number() }),
   },
   ({ a, b }, c) => c.text(String(a + b))
);
const greeting = new Resource("greeting", "greeting://{name}", (c, { name }) =>
   c.text(`Hello, ${name}!`)
);

const app = new Hono().use(
   mcp({
      // optionally specify the server info
      serverInfo: { name: "my-server", version: "1.0.0" },
      // register tools and resources
      tools: [add],
      resources: [greeting],
      // optionally enable sessions
      sessionsEnabled: true,
      // optionally specify the path to the MCP endpoint
      endpoint: {
         path: "/mcp",
      },
   })
);
