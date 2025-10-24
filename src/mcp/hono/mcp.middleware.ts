import type { Context, MiddlewareHandler, Next } from "hono";
import {
   mcpServer,
   McpServer,
   type LogLevel,
   type McpServerInfo,
} from "../server";
import type { Tool } from "../tool";
import type { Resource } from "../resource";
import { streamableHttpTransport } from "../transports/streamable-http-transport";

export type McpServerInit =
   | {
        tools?: Tool<any, any, any | never>[];
        resources?: Resource<any, any, any, any | never>[];
        context?: object;
        serverInfo?: McpServerInfo;
     }
   | {
        server: McpServer;
     };

export interface McpOptionsBase {
   sessionsEnabled?: boolean;
   debug?: {
      historyEndpoint?: boolean;
      explainEndpoint?: boolean;
      logLevel?: LogLevel;
   };
   endpoint?: {
      transport?: "streamableHttp";
      path?: `/${string}`;
      _init?: RequestInit;
   };
}

export type McpOptionsStatic = McpOptionsBase &
   McpServerInit & {
      setup?: never;
   };

export interface McpOptionsSetup extends McpOptionsBase {
   setup: (c: Context) => Promise<McpServerInit>;
}

export type McpOptions = McpOptionsStatic | McpOptionsSetup;

export const mcp = (opts: McpOptions): MiddlewareHandler => {
   const mcpPath = opts?.endpoint?.path;
   const sessions = new Map<string, McpServer>();

   return async (c: Context, next: Next) => {
      const path = c.req.path;
      let sessionId = c.req.header("Mcp-Session-Id");

      if (mcpPath && mcpPath !== path) {
         if (
            sessionId &&
            opts?.debug?.historyEndpoint &&
            path === `${mcpPath}/__history`
         ) {
            const server = sessions.get(sessionId);
            if (server) {
               return c.json(Array.from(server.history.values()), 200);
            }
         }

         await next();
      } else {
         let server: McpServer | undefined;

         if (opts?.sessionsEnabled) {
            if (sessionId) {
               server = sessions.get(sessionId);
            } else {
               sessionId = crypto.randomUUID();
            }
         }

         if (!server) {
            const ctx =
               opts && "setup" in opts && opts?.setup
                  ? await opts?.setup(c)
                  : opts;

            if ("server" in ctx) {
               server = ctx.server.clone();
            } else {
               server = mcpServer({
                  serverInfo: ctx?.serverInfo,
                  context: ctx?.context,
                  tools: ctx?.tools,
                  resources: ctx?.resources,
               });
            }

            if (opts?.debug?.logLevel) {
               server.setLogLevel(opts.debug.logLevel);
            }

            if (opts?.sessionsEnabled) {
               sessions.set(sessionId!, server);
            }
         }

         if (opts?.debug?.explainEndpoint) {
            if (c.req.query("explain")) {
               return c.json(server.toJSON());
            }
         }

         const transport = streamableHttpTransport(server, {
            _init: opts?.endpoint?._init,
         });
         const res = await transport(c.req.raw);

         const headers = new Headers(res.headers);
         if (opts?.sessionsEnabled) {
            headers.set("Mcp-Session-Id", sessionId!);
         }
         return new Response(res.body, {
            status: res.status,
            headers,
         });
      }
   };
};
