import { describe, expect, test } from "bun:test";
import { McpServer } from "./server";
import { streamableHttpTransport } from "./transports/streamable-http-transport";
import { McpClient } from "./client";

describe("mcpServer", () => {
   test("authentication", async () => {
      const server = new McpServer();
      server.tool("headers", undefined, async (p, c) => {
         if (c.raw instanceof Request) {
            // @ts-expect-error
            return c.json(Object.fromEntries(c.raw.headers.entries()));
         }

         return c.json({});
      });

      const client = new McpClient({
         url: "http://localhost",
         fetch: streamableHttpTransport(server),
      });

      expect(
         await client
            .callTool({
               name: "headers",
            })
            .then((r) => JSON.parse(r!.content[0]!.text))
      ).toEqual({
         accept: "application/json",
         "content-type": "application/json",
      });

      // now set token
      {
         const client = new McpClient({
            url: "http://localhost",
            fetch: streamableHttpTransport(server.clone(), {
               authentication: {
                  type: "bearer",
                  token: "test",
               },
            }),
         });
         const res = await client.callTool({
            name: "headers",
         });
         expect(JSON.parse(res!.content[0]!.text)).toEqual({
            accept: "application/json",
            authorization: "Bearer test",
            "content-type": "application/json",
         });
      }
   });
});
