import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";

const app = new Hono().use(
   cors({
      origin: "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
   })
);
let id = 0;

app.get("/", async (c) => {
   console.log("sse", c.req.raw);
   const res = streamSSE(c, async (stream) => {
      while (true) {
         const message = `It is ${new Date().toISOString()}`;
         await stream.writeSSE({
            data: message,
            id: String(id++),
         });
         await stream.sleep(1000);
      }
   });
   console.log("res", res);
   return new Response(res.body, {
      status: res.status,
      headers: new Headers(res.headers),
   });
});

export default app;
