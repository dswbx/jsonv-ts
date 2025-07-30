import * as s from "jsonv-ts";
import { RpcMessage, type TRpcRequest } from "../rpc";

// currently just a placeholder to prevent errors

export class CompletionMessage extends RpcMessage {
   method = "completion/complete";
   params = s.strictObject({
      argument: s.strictObject({
         name: s.string(),
         value: s.string(),
      }),
      ref: s.oneOf([
         s.strictObject({
            type: s.literal("ref/resource"),
            uri: s.string(),
         }),
         s.strictObject({
            type: s.literal("ref/tool"),
            name: s.string(),
         }),
      ]),
   });

   override async respond(message: TRpcRequest<typeof this.params>) {
      return this.formatRespond(message, {
         completion: {
            values: [],
            total: 0,
            hasMore: false,
         },
      });
   }
}
