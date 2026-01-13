import { messages } from "./messages";
import {
   RpcMessage,
   type TRpcId,
   type TRpcRawRequest,
   type TRpcResponse,
} from "./rpc";
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
   _id: string = crypto.randomUUID();
   protected logLevel: LogLevel = "warning";
   readonly history: Map<
      TRpcId,
      {
         request: TRpcRawRequest;
         response?: TRpcResponse;
      }
   > = new Map();
   protected onNotificationListener?: (message: TRpcRawRequest) => void;

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

   onNotification(handler: (message: TRpcRawRequest) => void) {
      this.onNotificationListener = handler;
      return this;
   }

   clone() {
      const server = new McpServer(
         this.serverInfo,
         this.context,
         this.tools,
         this.resources
      );
      server.setLogLevel(this.logLevel);
      server.onNotificationListener = this.onNotificationListener;
      return server;
   }

   setLogLevel(level: LogLevel) {
      this.logLevel = level;
      this.console.info("set log level", level);
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
      const logLevel = this.logLevel;
      const listener = this.onNotificationListener;
      return new Proxy(
         {},
         {
            get(t, prop) {
               if (prop in logLevels) {
                  return (...args: any[]) => {
                     const current = logLevelNames.indexOf(logLevel);
                     const target = logLevelNames.indexOf(String(prop) as any);
                     if (target > current) {
                        return;
                     }

                     if (listener) {
                        listener({
                           jsonrpc: "2.0",
                           method: "notification/message",
                           params: {
                              data: args,
                              level: logLevels[prop],
                           },
                        });
                     }
                  };
               }
            },
         }
      ) as unknown as {
         [K in keyof typeof logLevels]: (...args: any[]) => void;
      };
   }

   parseMessage(payload: TRpcRawRequest) {
      // @todo: parse message
      if (!RpcMessage.isValidMessage(payload)) {
         throw new McpError("ParseError", {
            payload,
         });
      }

      return this.messages.find((m) => m.is(payload));
   }

   async handle(payload: TRpcRawRequest, raw?: unknown): Promise<TRpcResponse> {
      try {
         this.console.debug("payload", payload);
         this.currentId = payload.id;

         if (this.currentId) {
            if (this.history.has(this.currentId)) {
               /* this.console.warning("duplicate request", this.currentId);
               throw new McpError("InvalidRequest", {
                  error: "Duplicate request",
               }); */
            } else {
               this.history.set(this.currentId, {
                  request: payload,
               });
            }
         }

         const message = this.parseMessage(payload);
         if (message) {
            if (message.isNotification()) {
               if (!message.isSenderAllowed("client")) {
                  throw new McpError("InvalidRequest", {
                     error: "Notification not allowed",
                  });
               }
            }

            const result = await message.respond(payload, raw);
            this.console.info("result", result);

            if (this.currentId) {
               this.history.set(this.currentId, {
                  request: payload,
                  response: result,
               });
            }

            return result;
         }

         throw new McpError("MethodNotFound", {
            method: payload.method,
            params: payload.params,
         });
      } catch (e) {
         if (e instanceof McpError) {
            this.console.error(e.toJSON());
            throw e;
         }

         this.console.error(e);
         throw new McpError("InternalError", { error: String(e) });
      }
   }

   toJSON() {
      return {
         serverInfo: this.serverInfo,
         tools: this.tools.map((t) => t.toJSON()),
         resources: this.resources.map((r) => r.toJSON()),
      };
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
