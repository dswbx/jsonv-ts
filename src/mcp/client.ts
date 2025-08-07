import type {
   InitializeMessage,
   PingMessage,
   ToolsListMessage,
   ToolsCallMessage,
   ResourcesListMessage,
   ResourcesTemplatesListMessage,
   ResourcesReadMessage,
   LoggingMessage,
} from "./messages";
import type {
   RpcMessage,
   TRpcMessageParams,
   TRpcMessageResult,
   TRpcRawRequest,
   TRpcResponse,
} from "./rpc";
import { protocolVersion } from "./server";
import type { MaybePromise } from "./utils";

export interface McpClientConfig {
   name?: string;
   version?: string;
   transport?: "streamableHttp";
   url: string | URL;
   fetch?:
      | typeof fetch
      | ((
           url: string | RequestInfo | URL,
           options?: RequestInit
        ) => MaybePromise<Response>);
}

export class McpClient {
   private id = 1;
   private sessionId: string | undefined;

   constructor(readonly config: McpClientConfig) {}

   private get fetch() {
      return this.config.fetch ?? fetch;
   }

   private async request<Message extends RpcMessage>(
      method: string,
      params: TRpcMessageParams<Message>
   ) {
      const id = this.id++;
      const message = {
         jsonrpc: "2.0",
         id,
         method,
         params,
      } satisfies TRpcRawRequest;

      const headers = new Headers({
         "Content-Type": "application/json",
         Accept: "application/json",
      });
      if (this.sessionId) {
         headers.set("Mcp-Session-Id", this.sessionId);
      }

      const res = await this.fetch(this.config.url, {
         method: "POST",
         headers,
         body: JSON.stringify(message),
      });

      if (!this.sessionId) {
         this.sessionId = res.headers.get("Mcp-Session-Id") ?? undefined;
      }

      try {
         const data = (await res.json()) as TRpcResponse<
            TRpcMessageResult<Message>
         >;
         if (data.jsonrpc !== "2.0") {
            throw new Error("Invalid JSON-RPC version");
         }
         return data.result;
      } catch (e) {
         console.error(e);
         throw e;
      }
   }

   async connect() {
      return this.request<InitializeMessage>("initialize", {
         protocolVersion,
         capabilities: {},
         clientInfo: {
            name: this.config.name,
            version: this.config.version,
         },
      });
   }

   async ping() {
      return this.request<PingMessage>("ping", {});
   }

   async setLoggingLevel(level: TRpcMessageParams<LoggingMessage>["level"]) {
      return this.request<LoggingMessage>("logging/setLevel", { level });
   }

   async listResources() {
      return this.request<ResourcesListMessage>("resources/list", {});
   }

   async listResourceTemplates() {
      return this.request<ResourcesTemplatesListMessage>(
         "resources/templates/list",
         {}
      );
   }

   async readResource(message: TRpcMessageParams<ResourcesReadMessage>) {
      return this.request<ResourcesReadMessage>("resources/read", message);
   }

   async callTool(message: TRpcMessageParams<ToolsCallMessage>) {
      return this.request<ToolsCallMessage>("tools/call", message);
   }

   async listTools() {
      return this.request<ToolsListMessage>("tools/list", {});
   }

   //async registerCapabilities() {}
   //async assertCapability() {}
   //async getServerCapabilities() {}
   //async getServerVersion() {}
   //async getInstructions() {}
   //async complete() {}
   //async getPrompt() {}
   //async listPrompts() {}
   //async subscribeResource() {}
   //async unsubscribeResource() {}
   //async sendRootsListChanged() {}
}
