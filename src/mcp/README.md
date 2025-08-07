# MCP

This package also includes a Web-spec compliant MCP server and client implementation. Not all features are supported yet, see [STATUS.md](./src/mcp/STATUS.md) for the current status.

<!-- TOC depthfrom:2 updateonsave:true -->

-  [Hono MCP Middleware](#hono-mcp-middleware)
-  [MCP Client](#mcp-client)

<!-- /TOC -->

Here is a simple MCP server example:

```ts
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

// make a request to the server
const request = new Request("http://localhost", {
   method: "POST",
   body: JSON.stringify({
      jsonrpc: "2.0",
      method: "resources/read",
      params: {
         uri: "greeting://John",
      },
   }),
});

const response = await server.handle(request);
const data = await response.json();
console.log(data);
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
```

## Hono MCP Middleware

You can use the MCP server with any Web-spec compliant web framework. If you choose to use it with Hono, there is a built-in middleware that can be used to handle MCP requests.

```ts
import { Hono } from "hono";
import { mcp } from "jsonv-ts/mcp/hono";

// use the `server` from the example above
const app = new Hono().use(mcp({ server }));
```

Alternatively, you can use the middleware to specify MCP server options:

```ts
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
```

## MCP Client

You can use the MCP client to interact with MCP servers.

```ts
import { McpClient } from "jsonv-ts/mcp";

const client = new McpClient({ url: "http://localhost/sse" });

// list resources
const resources = await client.listResources();

// read a resource
const resource = await client.readResource({
   uri: "file:///example.txt",
});

// call a tool
const result = await client.callTool({
   name: "add",
   arguments: { a: 1, b: 2 },
});
```
