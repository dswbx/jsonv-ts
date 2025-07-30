import { s } from "jsonv-ts";
import { RpcMessage, type TRpcRequest } from "../rpc";
import { logLevelNames } from "../server";

// https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/logging
export class LoggingMessage extends RpcMessage {
   method = "logging/setLevel";
   params = s.object({
      level: s.string({
         enum: logLevelNames,
      }),
   });

   override async respond(message: TRpcRequest<typeof this.params>) {
      this.server.setLogLevel(message.params.level);
      return this.formatRespond(message, {});
   }
}
