import * as s from "jsonv-ts";
import { McpServer } from "../server";
import { streamableHttpTransport } from "../transports/streamable-http-transport";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { mcp } from "../hono/mcp.middleware";

const server = new McpServer()
   .tool(
      "test",
      {
         inputSchema: s.object({
            name: s.string(),
            age: s.number().optional(),
         }),
      },
      async (params, c) => {
         console.log("params", params);
         if (params.age && params.age > 100) {
            throw new Error("yeah that's too old");
         }
         return c.text(
            `Hello, ${params.name}! Age: ${params.age ?? "unknown"}`
         );
      }
   )
   .tool("json", {}, async (params, c) => {
      return c.json({
         name: "test",
         age: 20,
      });
   });

/* export default {
   fetch: new Hono()
      .use(async (c, next) => {
         console.log("[req]", c.req.method, c.req.raw.headers);
         await next();
      })
      .use(
         cors({
            origin: (o) => o,
            allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowHeaders: [
               "Content-Type",
               "Authorization",
               "mcp-protocol-version",
               "mcp-session-id",
               "accept",
            ],
         })
      )
      .use(mcp({ server, sessionsEnabled: true })).fetch,
   idleTimeout: 0,
}; */

const transport = streamableHttpTransport(server);
export default {
   fetch: new Hono()
      .use(async (c, next) => {
         console.log("[req]", c.req.method /* , c.req.raw.headers */);
         await next();
         console.log("[res]", c.res.status /* , c.res.headers */);
      })
      .use(
         cors({
            origin: (o) => o,
            allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowHeaders: [
               "Content-Type",
               "Authorization",
               "Mcp-Protocol-Version",
               "Mcp-Session-Id",
               "Accept",
            ],
         })
      )
      .all("*", async (c) => {
         return await transport(c.req.raw);
      }).fetch,
   idleTimeout: 0,
};

/*const transport = streamableHttpTransport(server);

 export default {
   fetch: new Hono()
      .use(
         cors({
            origin: (o) => o,
            allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowHeaders: [
               "Content-Type",
               "Authorization",
               "mcp-protocol-version",
               "accept",
            ],
         })
      )
      .all("*", async (c) => {
         console.log(
            "[req]",
            c.req.raw.method,
            c.req.raw.headers.get("accept")
         );
         return await transport(c.req.raw);
      }).fetch,
   idleTimeout: 0,
};
 */
/* const res = await transport(
   new Request("http://localhost/sse", {
      method: "POST",
      body: JSON.stringify({
         jsonrpc: "2.0",
         method: "tools/call",
         params: {
            arguments: {
               name: "test",
               age: 20,
            },
            name: "test",
         },
      }),
   })
);

console.log(await res.json()); */
