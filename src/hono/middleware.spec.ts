import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import { validator as jsc } from "./middleware";
import * as s from "../lib";
import { expectTypeOf } from "expect-type";

describe("hono middleware", () => {
   test("should return the validated json", async () => {
      const app = new Hono();
      app.post(
         "/json",
         jsc(
            "json",
            s.object({
               name: s.string(),
               test: s.string().optional(),
            })
         ),
         (c) => {
            const json = c.req.valid("json");
            //    ^?
            return c.json(json);
         }
      );

      const req = async (input: object): Promise<any> => {
         const res = await app.request("http://localhost:3000/json", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
         });
         return await res.json();
      };

      expect(await req({ name: "John Doe" })).toEqual({
         name: "John Doe",
      });
      expect((await req({})).valid).toEqual(false);
   });

   test("query coercion", async () => {
      const app = new Hono();
      app.get(
         "/query",
         jsc(
            "query",
            s
               .object({
                  int: s.number(),
                  bool: s.boolean(),
                  str: s.string(),
               })
               .partial()
         ),
         (c) => {
            const json = c.req.valid("query");
            //    ^?
            return c.json(json);
         }
      );

      const req = async (input: object): Promise<any> => {
         const params = new URLSearchParams(input as any);
         const res = await app.request(
            "http://localhost:3000/query?" + params.toString(),
            {
               method: "GET",
            }
         );
         return await res.json();
      };

      expect(await req({ int: "123", bool: "true", str: "test" })).toEqual({
         int: 123,
         bool: true,
         str: "test",
      });
   });

   test("query coercion2", async () => {
      const app = new Hono();
      const schema = s.object({
         url: s
            .string({
               pattern: "^https?://",
               coerce: () => "what" as const,
            })
            .optional(),
         force: s.boolean({ coerce: () => true as const }),
      });
      type Inferred = s.Static<typeof schema>;
      //   ^?
      expectTypeOf<Inferred>().toEqualTypeOf<{
         url?: string;
         force: boolean;
         [key: string]: unknown;
      }>();
      type Coerced = s.StaticCoerced<typeof schema>;
      //   ^?
      expectTypeOf<Coerced>().toEqualTypeOf<{
         url?: "what";
         force: true;
         [key: string]: unknown;
      }>();
      app.get("/query", jsc("query", schema), (c) => {
         const json = c.req.valid("query");
         //    ^?
         expectTypeOf<typeof json>().toEqualTypeOf<{
            [key: string]: unknown;
            url?: "what";
            force: true;
         }>();
         return c.json(json);
      });

      app.get("/test", jsc("query", s.record(s.string())), (c) => {
         const json = c.req.valid("query");
         //    ^?
         expectTypeOf<typeof json>().toEqualTypeOf<{
            [key: string]: string;
         }>();
         return c.json(json);
      });

      const req = async (input: object): Promise<any> => {
         const params = new URLSearchParams(input as any);
         const res = await app.request(
            "http://localhost:3000/query?" + params.toString(),
            {
               method: "GET",
            }
         );
         return await res.json();
      };

      expect(await req({ force: false })).toEqual({
         force: true,
      });
   });

   test("coerce: drop unknown", async () => {
      const app = new Hono();
      app.get(
         "/query",
         jsc(
            "query",
            s.strictObject({
               name: s.string(),
               age: s.number(),
            }),
            {
               dropUnknown: true,
            }
         ),
         (c) => {
            const json = c.req.valid("query");
            //    ^?
            expectTypeOf<typeof json>().toEqualTypeOf<{
               name: string;
               age: number;
            }>();
            return c.json(json);
         }
      );

      const res = await app.request(
         "http://localhost:3000/query?name=John&age=30&unknown=123",
         {
            method: "GET",
         }
      );
      expect(await res.json()).toEqual({
         name: "John",
         age: 30,
      });
   });

   test("coerce: don't drop unknown on wide schema", async () => {
      const app = new Hono();
      app.post(
         "/query",
         jsc("json", s.anyOf([s.object({}), s.array(s.object({}))])),
         async (c) => {
            const json = c.req.valid("json");
            return c.json(json);
         }
      );

      const payload = {
         name: "John",
         age: 30,
         unknown: 123,
      };
      const res = await app.request("http://localhost:3000/query", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify(payload),
      });
      expect(await res.json()).toEqual(payload);
   });
});
