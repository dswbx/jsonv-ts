import * as s from "jsonv-ts";
import { RpcMessage, type TRpcRequest } from "../rpc";

export class PingMessage extends RpcMessage {
   method = "ping";
   params = s.record(s.any());

   override async respond(message: TRpcRequest) {
      return this.formatRespond(message, {});
   }
}
