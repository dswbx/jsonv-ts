import { describe, expect, test } from "bun:test";
import { McpServer } from "./server";

describe("mcpServer", () => {
   test("authentication", async () => {
      const server = new McpServer();
      server.tool("headers", undefined, async (p, c) => {
         // @ts-expect-error
         return c.json(Object.fromEntries(c.request.headers.entries()));
      });

      const client = server.getClient();

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
      server.setAuthentication({ type: "bearer", token: "test" });
      expect(
         await client
            .callTool({
               name: "headers",
            })
            .then((r) => JSON.parse(r!.content[0]!.text))
      ).toEqual({
         accept: "application/json",
         authorization: "Bearer test",
         "content-type": "application/json",
      });
   });
});
