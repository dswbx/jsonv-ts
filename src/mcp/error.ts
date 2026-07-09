import type { TRpcId, TRpcResponse } from "./rpc";

export const codes = {
   // SDK error codes
   ConnectionClosed: {
      code: -32000,
      message: "Connection closed",
   },
   RequestTimeout: {
      code: -32001,
      message: "Request timeout",
   },

   // Standard JSON-RPC error codes
   ParseError: {
      code: -32700,
      message: "Parse error",
   },
   InvalidRequest: {
      code: -32600,
      message: "Invalid request",
   },
   MethodNotFound: {
      code: -32601,
      message: "Method not found",
   },
   InvalidParams: {
      code: -32602,
      message: "Invalid params",
   },
   InternalError: {
      code: -32603,
      message: "Internal error",
      statusCode: 500,
   },
} as const;

export class McpError extends Error {
   readonly jsonrpc = "2.0";
   public id: TRpcId | undefined;

   static get codes() {
      return Object.fromEntries(
         Object.entries(codes).map(([key, value]) => [key, key])
      ) as Record<keyof typeof codes, keyof typeof codes>;
   }

   constructor(
      public readonly code: keyof typeof codes,
      public readonly data?: any,
      message?: string
   ) {
      super(message ?? codes[code].message);
   }

   setId(id: TRpcId | undefined) {
      this.id = id;
      return this;
   }

   get statusCode() {
      return (codes[this.code] as any)?.statusCode ?? 400;
   }

   toJSON(): TRpcResponse {
      return {
         jsonrpc: this.jsonrpc,
         id: this.id,
         error: {
            code: codes[this.code].code,
            message: this.message,
            data: this.data,
         },
      };
   }

   toResponse() {
      return new Response(JSON.stringify(this.toJSON()), {
         status: this.statusCode,
      });
   }

   override toString() {
      return `MCP Error (${codes[this.code].code} ${this.code}): ${
         this.message
      }`;
   }
}
