import * as s from "jsonv-ts";
import { RpcMessage, type TRpcRequest } from "../rpc";
import { McpError } from "../error";

// currently just a placeholder to prevent errors

export class CompletionMessage extends RpcMessage {
   method = "completion/complete";
   params = s.object({
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
      const ref = message.params.ref;
      if (ref.type === "ref/resource") {
         const resource = this.server.resources.find((r) => r.uri === ref.uri);
         if (!resource) {
            throw new McpError("InvalidParams", {
               uri: ref.uri,
            });
         }

         return this.formatRespond(message, {
            completion: await resource.suggest(
               message.params.argument.name,
               message.params.argument.value,
               {}
            ),
         });
      }

      return this.formatRespond(message, {
         completion: {
            values: [],
            total: 0,
            hasMore: false,
         },
      });
   }
}
