import { McpServer } from "../server";
import { stdioTransport } from "../transports/stdio-transport";

const server = new McpServer()
   .tool("test", {}, async (params, c) => {
      return c.text("Hello, world!");
   })
   .tool("test2", {}, async (params, c) => {
      return c.text("Hello, world!");
   });

stdioTransport(server, {
   stdin: process.stdin,
   stdout: process.stdout,
   stderr: process.stderr,
});
