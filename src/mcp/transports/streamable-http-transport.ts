import { McpError } from "../error";
import type { TRpcRawRequest } from "../rpc";
import type { McpServer } from "../server";
import { streamSSE } from "hono/streaming";

export type StreamableHttpTransportOptions = {
   _init?: RequestInit;
   pollingIntervalMs?: number; // default: 500
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

const makeContext = ({ request }: { request: Request }) => {
   const headers: Headers = new Headers({
      "access-control-allow-origin": "*",
   });
   return {
      req: {
         raw: request,
      },
      header: (name: string, value: string) => {
         headers.set(name, value);
      },
      newResponse: (bla: any) => {
         const status = bla === null ? 202 : bla.status ?? 200;
         return new Response(bla, {
            status,
            headers: headers,
         });
      },
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
         ...opts?._init,
      });
   };

   return async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = toRequest(input, init);
      const c = makeContext({ request });

      const acceptsStream = request.headers
         .get("accept")
         ?.includes("text/event-stream");
      const acceptsJson = request.headers
         .get("accept")
         ?.includes("application/json");

      if (!acceptsStream && !acceptsJson) {
         return new Response("Not acceptable", { status: 406 });
      }

      if (acceptsStream && request.method === "GET") {
         const messages: TRpcRawRequest[] = [];
         server.onNotification(async (message) => {
            messages.push(message);
         });
         return streamSSE(c as any, async (s) => {
            let aborted = false;
            s.onAbort(() => {
               aborted = true;
            });
            while (!aborted) {
               await s.sleep(opts?.pollingIntervalMs ?? 500);
               if (aborted) break;
               if (messages.length > 0) {
                  while (messages.length > 0) {
                     const message = messages.shift();
                     if (message) {
                        await s.writeSSE({
                           data: JSON.stringify(message),
                           id: message.id ? String(message.id) : undefined,
                        });
                     }
                  }
               }
            }
         });
      } else if (request.method === "POST") {
         const body = await request.json();
         const id = body.id ? String(body.id) : undefined;
         const message = server.parseMessage(body);
         if (!message) {
            return new McpError("MethodNotFound", body).toResponse();
         }

         if (message) {
            if (message.isNotification()) {
               return new Response(null, { status: 202 });
            }
         }
         if (acceptsStream) {
            return streamSSE(c as any, async (s) => {
               try {
                  const res = await message.respond(body, request);

                  if (res !== null) {
                     await s.writeSSE({
                        data: JSON.stringify(res),
                        id: res.id ? String(res.id) : undefined,
                     });
                  }
               } catch (e) {
                  let data = new McpError("InternalError").setId(id).toJSON();
                  if (e instanceof McpError) {
                     data = e.setId(id).toJSON();
                  }

                  await s.writeSSE({
                     data: JSON.stringify(data),
                     id,
                  });
               }
            });
         }

         try {
            const res = await message.respond(body, request);
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
