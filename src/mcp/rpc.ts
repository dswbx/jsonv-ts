import * as s from "jsonv-ts";
import { McpError } from "./error";
import type { McpServer } from "./server";

const anyObject = s.object({});

const rpcBase = s.object({
   jsonrpc: s.string({ const: "2.0" }),
   id: s.oneOf([s.string(), s.number()]).optional(),
});

const rpcRequest = s.object({
   ...rpcBase.properties,
   method: s.string(),
   params: s.any().optional(),
});

const rpcResponse = s.object({
   ...rpcBase.properties,
   result: anyObject.optional(),
   error: s.object({}).optional(),
});

export type TRpcRawRequest = s.Static<typeof rpcRequest>;
export interface TRpcRequest<S extends s.Schema | unknown = unknown>
   extends Omit<TRpcRawRequest, "params"> {
   params: S extends s.Schema ? s.Static<S> : S;
}

export type TRpcResponse<Result = object> = Omit<
   s.Static<typeof rpcResponse>,
   "result"
> & {
   result?: Result;
};
export type TRpcMessage = TRpcRawRequest | TRpcResponse;
export type TRpcId = string | number;

export type TRpcMessageResponse<T extends RpcMessage> = Awaited<
   ReturnType<T["respond"]>
>;
export type TRpcMessageResult<T extends RpcMessage> =
   TRpcMessageResponse<T> extends TRpcResponse<infer R> ? R : never;

export type TRpcMessageParams<T extends RpcMessage> = T extends RpcMessage<
   any,
   infer P
>
   ? s.Static<P>
   : never;

export const rpc = <Method extends string, Params extends object>(
   method: Method,
   params: Params,
   id?: TRpcId
): TRpcResponse<Params> => ({
   jsonrpc: "2.0",
   id,
   method,
   params,
});

export abstract class RpcMessage<
   Method extends string = string,
   Params extends s.Schema = s.Schema
> {
   abstract readonly method: Method;
   abstract readonly params: Params;

   constructor(protected readonly server: McpServer) {}

   static isValidMessage(message: unknown): message is TRpcRawRequest {
      try {
         const baseResult = rpcBase.validate(structuredClone(message));
         return baseResult.valid;
      } catch (e) {
         return false;
      }
   }

   isNotification(): this is RpcNotification {
      return this.method.startsWith("notifications/");
   }

   is(message: TRpcRawRequest) {
      if (message.jsonrpc !== "2.0") {
         throw new McpError(
            "InvalidRequest",
            {
               expected: "2.0",
               actual: message.jsonrpc,
            },
            "Invalid JSON-RPC version"
         );
      }
      if (message.method !== this.method) {
         return false;
      }
      const result = this.params.validate(message.params);
      if (!result.valid) {
         throw new McpError("InvalidParams", {
            method: this.method,
            errors: result.errors,
         });
      }
      return true;
   }

   abstract respond(
      message: TRpcRequest | TRpcRawRequest,
      raw?: unknown
   ): Promise<TRpcResponse>;

   protected formatRespond<Result extends object = object>(
      message: TRpcRequest,
      result: Result
   ): TRpcResponse<Result> {
      return {
         jsonrpc: "2.0",
         id: message.id,
         result,
      };
      return rpc(this.method, result, message.id as any);
   }
}

export abstract class RpcNotification<
   Method extends string = string
> extends RpcMessage<Method> {
   override readonly params = s.any();

   constructor(server: McpServer) {
      super(server);
   }

   abstract handle(
      message: TRpcRequest | TRpcRawRequest,
      raw?: unknown
   ): Promise<void>;

   allowedSenders() {
      return ["client", "server"];
   }

   isSenderAllowed(sender: "client" | "server") {
      return this.allowedSenders().includes(sender);
   }

   override async respond(
      message: TRpcRequest | TRpcRawRequest,
      raw?: unknown
   ) {
      await this.handle(message, raw);
      return null as any;
   }
}

export const rpcNotification = <Method extends string, Params extends object>(
   params: Params,
   method: Method = "notification/message" as Method
) => rpc(method, params);
