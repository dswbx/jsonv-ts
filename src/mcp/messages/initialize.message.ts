import * as s from "jsonv-ts";
import { RpcMessage, RpcNotification, type TRpcRequest } from "../rpc";

export class InitializeMessage extends RpcMessage {
   method = "initialize";
   params = s.object({
      protocolVersion: s.string(),
      capabilities: s.object({}),
      clientInfo: s.object({}).optional(),
      serverInfo: s.object({}).optional(),
      instructions: s.string().optional(),
   });

   override async respond(message: TRpcRequest) {
      return this.formatRespond(message, {
         protocolVersion: this.server.version,
         capabilities: {
            tools: this.server.tools.length > 0 ? {} : undefined,
            resources: this.server.resources.length > 0 ? {} : undefined,
            logging: {},
            completions: {},
         },
         serverInfo: this.server.serverInfo,
      });
   }
}

export class InitializedNotificationMessage extends RpcNotification {
   method = "notifications/initialized";

   override async handle(message: TRpcRequest) {
      //console.log("initialized", message);
   }
}
