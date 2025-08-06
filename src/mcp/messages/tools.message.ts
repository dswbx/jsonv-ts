import * as s from "jsonv-ts";
import { McpError } from "../error";
import { RpcMessage, type TRpcRequest } from "../rpc";

export class ToolsListMessage extends RpcMessage {
   method = "tools/list";
   params = s.object({});

   override async respond(message: TRpcRequest) {
      return this.formatRespond(message, {
         tools: this.server.tools.map((tool) => tool.toJSON()),
      });
   }
}

export class ToolsCallMessage extends RpcMessage {
   method = "tools/call";
   params = s.object({
      name: s.string(),
      arguments: s.record(s.any()).optional(),
   });

   override async respond(
      message: TRpcRequest<typeof this.params>,
      request: Request
   ) {
      const tool = this.server.tools.find(
         (t) => t.name === message.params.name
      );
      if (!tool) {
         throw new McpError(
            "InvalidParams",
            {
               tool: message.params.name,
            },
            "Tool not found"
         );
      }

      try {
         const result = await tool.call(
            message.params.arguments,
            this.server.context,
            request
         );
         return this.formatRespond(message, {
            content: Array.isArray(result) ? result : [result],
         });
      } catch (e) {
         return this.formatRespond(message, {
            content: [
               {
                  type: "text",
                  text: String(e),
               },
            ],
            isError: true,
         });
      }
   }
}
