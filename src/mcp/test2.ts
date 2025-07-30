import { McpServer } from "jsonv-ts/mcp";
import { s } from "jsonv-ts";

const server = new McpServer({
   name: "demo-server",
   version: "1.0.0",
});

server.tool({
   name: "add",
   description: "Add two numbers",
   schema: s.object({
      a: s.number(),
      b: s.number(),
   }),
   handler: async ({ a, b }, ctx) => {
      return ctx.text(String(a + b));
   },
});

server.resource({
   name: "greeting",
   uri: "greeting://{name}",
   title: "Greeting Resource",
   description: "Dynamic greeting resource",
   handler: async ({ name }, ctx) => {
      return ctx.text(`Hello, ${name}!`);
   },
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
