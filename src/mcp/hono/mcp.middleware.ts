import type { Context, MiddlewareHandler, Next } from "hono";
import {
   mcpServer,
   McpServer,
   type LogLevel,
   type McpServerInfo,
} from "../server";
import type { Tool } from "../tool";
import type { Resource } from "../resource";

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
      enableHistoryEndpoint?: boolean;
      logLevel?: LogLevel;
   };
   endpoint?: {
      transport?: "streamableHttp";
      path: `/${string}`;
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
   const mcpPath = opts?.endpoint?.path ?? "/sse";
   const sessions = new Map<string, McpServer>();

   return async (c: Context, next: Next) => {
      const path = c.req.path;
      let sessionId = c.req.header("Mcp-Session-Id");

      if (mcpPath !== path) {
         if (
            sessionId &&
            opts?.debug?.enableHistoryEndpoint &&
            path === `${mcpPath}/__history`
         ) {
            const server = sessions.get(sessionId);
            if (server) {
               return c.json(Array.from(server.history.values()), 200);
            }
         }
         //console.log("not mcp path", path, mcpPath);
         await next();
      } else {
         let server: McpServer | undefined;

         if (opts?.sessionsEnabled) {
            if (sessionId) {
               //console.log("using existing session", sessionId);
               server = sessions.get(sessionId);
            } else {
               sessionId = crypto.randomUUID();
               //console.log("creating new session", sessionId);
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

         const res = await server.handle(c.req.raw);
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
