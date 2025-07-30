import * as s from "jsonv-ts";
import { McpError } from "../error";
import { RpcMessage, type TRpcRequest } from "../rpc";

export class ResourcesListMessage extends RpcMessage {
   method = "resources/list";
   params = s.object({});

   override async respond(message: TRpcRequest) {
      const staticResources = this.server.resources
         .filter((r) => !r.isDynamic())
         .map((r) => r.toJSON());

      return this.formatRespond(message, {
         resources: [...staticResources],
      });
   }
}

export class ResourcesTemplatesListMessage extends RpcMessage {
   method = "resources/templates/list";
   params = s.object({});

   override async respond(message: TRpcRequest) {
      const dynamicResources = this.server.resources
         .filter((r) => r.isDynamic())
         .map((r) => r.toJSON());

      return this.formatRespond(message, {
         resourceTemplates: [...dynamicResources],
      });
   }
}

export class ResourcesReadMessage extends RpcMessage {
   method = "resources/read";
   params = s.object({
      uri: s.string(),
   });

   override async respond(
      message: TRpcRequest<typeof this.params>,
      request: Request
   ) {
      const uri = message.params.uri;
      const resource = this.server.resources.find((r) => r.matches(uri as any));
      if (!resource) {
         throw new McpError("MethodNotFound", `Resource not found: ${uri}`);
      }

      return this.formatRespond(message, {
         contents: [
            await resource.toJSONContent(
               this.server.context,
               message.params.uri as any,
               request
            ),
         ],
      });
   }
}
