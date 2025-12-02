import { McpError } from "../error";
import type { McpServer } from "../server";

export type StreamableHttpTransportOptions = {
   _init?: RequestInit;
   authentication?:
      | {
           type: "bearer";
           token: string;
        }
      | {
           type: "basic";
           username: string;
           password: string;
        };
};

export function streamableHttpTransport(
   server: McpServer,
   opts?: StreamableHttpTransportOptions
) {
   const toRequest = (input: RequestInfo | URL, init?: RequestInit) => {
      let r: Request;
      let headers: Headers;
      if (input instanceof Request) {
         r = input;
         headers = new Headers(r.headers);
      } else {
         r = new Request(input, init);
         headers = new Headers(init?.headers);
      }

      switch (opts?.authentication?.type) {
         case "bearer":
            if (!headers.get("Authorization")) {
               headers.set(
                  "Authorization",
                  `Bearer ${opts.authentication.token}`
               );
            }
            break;
      }

      return new Request(r.url, {
         method: r.method,
         body: r.body,
         headers,
         cache: r.cache,
         credentials: r.credentials,
         keepalive: r.keepalive,
         mode: r.mode,
         signal: r.signal,
         ...(r.body && r.body instanceof ReadableStream
            ? { duplex: "half" }
            : {}),
         ...opts?._init,
      });
   };

   return async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = toRequest(input, init);

      if (request.method === "POST") {
         try {
            const body = await request.json();
            const res = await server.handle(body, request);

            if (res === null) {
               return new Response(null, { status: 202 });
            }

            return Response.json(res, { status: 200 });
         } catch (e) {
            if (e instanceof McpError) {
               return Response.json(e.toJSON(), {
                  status: e.statusCode,
               });
            }

            return Response.json(new McpError("InternalError").toJSON(), {
               status: 500,
            });
         }
      }

      return new Response("Method not allowed", { status: 405 });
   };
}
