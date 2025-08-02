import * as messages from "./messages";
import type { RpcMessage, TRpcId, TRpcRawRequest, TRpcResponse } from "./rpc";
import * as s from "jsonv-ts";
import { Tool, type ToolConfig, type ToolHandler } from "./tool";
import { McpError } from "./error";
import {
   Resource,
   type ResourceConfig,
   type ResourceHandler,
   type TResourceUri,
} from "./resource";

const serverInfoSchema = s.strictObject({
   name: s.string(),
   version: s.string(),
});
export type McpServerInfo = s.Static<typeof serverInfoSchema>;

export const logLevels = {
   emergency: "error",
   alert: "error",
   critical: "error",
   error: "error",
   warning: "warn",
   notice: "log",
   info: "info",
   debug: "debug",
};
export type LogLevel = keyof typeof logLevels;
export const logLevelNames = Object.keys(logLevels) as LogLevel[];
export const protocolVersion = "2025-06-18";

export class McpServer<
   ServerContext extends object = {},
   Tools extends Tool<any, any, any | never>[] = Tool<any, any, any | never>[],
   Resources extends Resource<any, any, any, any>[] = Resource<
      any,
      any,
      any,
      any
   >[]
> {
   protected readonly messages: RpcMessage<string, s.Schema>[] = [];
   readonly version = protocolVersion;
   protected currentId: TRpcId | undefined;
   protected logLevel: LogLevel = "warning";
   readonly history: Map<
      TRpcId,
      {
         request: TRpcRawRequest;
         response?: TRpcResponse;
      }
   > = new Map();

   constructor(
      readonly serverInfo: s.Static<typeof serverInfoSchema> = {
         name: "mcp-server",
         version: "0.0.0",
      },
      readonly context: ServerContext = {} as ServerContext,
      public tools: Tools = [] as unknown as Tools,
      public resources: Resources = [] as unknown as Resources
   ) {
      this.messages = Object.values(messages).map(
         (Message) => new Message(this)
      );
   }

   clone() {
      return new McpServer(
         this.serverInfo,
         this.context,
         this.tools,
         this.resources
      );
   }

   setLogLevel(level: LogLevel) {
      this.console.info("set log level", level);
      this.logLevel = level;
   }

   addTool<T extends Tool<any, any, any | never>>(tool: T) {
      this.tools.push(tool);
      return this;
   }

   tool<Name extends string, Config extends ToolConfig | undefined = undefined>(
      name: Name,
      config: Config,
      handler: ToolHandler<Config, ServerContext>
   ) {
      this.tools.push(new Tool(name, config, handler));
      return this;
   }

   addResource<R extends Resource<any, any, any, any>>(resource: R) {
      this.resources.push(resource);
      return this;
   }

   resource<
      Name extends string,
      Uri extends TResourceUri,
      Handler extends ResourceHandler<Uri, ServerContext>,
      Config extends ResourceConfig | undefined = undefined
   >(name: Name, uri: Uri, handler: Handler, config?: Config) {
      this.resources.push(new Resource(name, uri, handler, config));
      return this;
   }

   get console() {
      const _args = (...args: any[]) =>
         args.map((arg) => {
            if (typeof arg === "object") {
               return JSON.parse(JSON.stringify(arg, null, 2));
            }
            return arg;
         });

      const logLevel = this.logLevel;
      return new Proxy(
         {},
         {
            get(t, prop) {
               if (prop in logLevels) {
                  return (...args: any[]) => {
                     const current = logLevelNames.indexOf(logLevel);
                     const target = logLevelNames.indexOf(String(prop) as any);
                     if (target > current) return;

                     console[logLevels[prop]](
                        `[MCP:${String(prop)}]`,
                        ..._args(...args)
                     );
                  };
               }
            },
         }
      ) as unknown as {
         [K in keyof typeof logLevels]: (...args: any[]) => void;
      };
   }

   async handle(request: Request): Promise<Response> {
      try {
         const method = request.method;

         if (method === "POST") {
            let body: TRpcRawRequest | undefined;
            try {
               body = (await request.json()) as TRpcRawRequest;
               this.currentId = body.id;
            } catch (e) {
               this.console.error(e);
               throw new McpError("ParseError", {
                  error: String(e),
               });
            }

            if (this.currentId) {
               if (this.history.has(this.currentId)) {
                  this.console.warning("duplicate request", this.currentId);
                  throw new McpError("InvalidRequest", {
                     error: "Duplicate request",
                  });
               } else {
                  this.history.set(this.currentId, {
                     request: body,
                  });
               }
            }

            this.console.info("message", body);

            const message = this.messages.find((m) => m.is(body));
            if (message) {
               const result = await message.respond(body, request);
               this.console.info("result", result);

               if (result === null) {
                  return new Response(null, { status: 202 });
               }

               if (this.currentId) {
                  this.history.set(this.currentId, {
                     request: body,
                     response: result,
                  });
               }

               return Response.json(result, { status: 200 });
            }

            throw new McpError("MethodNotFound", {
               method: body.method,
               params: body.params,
            });
         }

         return new Response("Method not allowed", { status: 405 });
      } catch (e) {
         this.console.error(e);
         if (e instanceof McpError) {
            return Response.json(e.setId(this.currentId).toJSON(), {
               status: e.statusCode,
            });
         }

         return Response.json(new McpError("InternalError").toJSON(), {
            status: 500,
         });
      }
   }
}

export interface McpServerOptions {
   tools?: Tool<any, any, any | never>[];
   resources?: Resource<any, any, any | never>[];
   context?: object;
   serverInfo?: McpServerInfo;
   logLevel?: LogLevel;
}

export function mcpServer<Opts extends McpServerOptions>(opts: Opts) {
   const server = new McpServer(
      opts.serverInfo,
      opts.context,
      opts.tools,
      opts.resources
   );

   if (opts.logLevel) {
      server.setLogLevel(opts.logLevel);
   }

   return server;
}
