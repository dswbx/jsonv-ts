import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import { validator as jsc } from "./middleware";
import * as s from "../lib";
import { describeRoute } from "./openapi/openapi";
import { info } from "./info";

describe("hono info", () => {
   test("basic info", async () => {
      const app = new Hono()
         .get(
            "/some",
            describeRoute({
               summary: "Some route",
               description: "Some description",
               tags: ["some"],
            }),
            jsc("query", s.object({ ok: s.boolean().optional() })),
            async (c) => {
               return c.json({ ok: true });
            }
         )
         .get("/another", (c) => c.json({ ok: true }));

      expect(JSON.parse(JSON.stringify(info(app)))).toEqual({
         "/some": {
            GET: {
               method: "GET",
               openAPI: {
                  responses: {},
                  description: "Some description",
                  summary: "Some route",
                  operationId: "getSome",
                  parameters: [
                     {
                        name: "ok",
                        in: "query",
                        schema: {
                           type: "boolean",
                        },
                     },
                  ],
                  tags: ["some"],
               },
               validation: {
                  query: {
                     type: "object",
                     properties: {
                        ok: {
                           type: "boolean",
                        },
                     },
                  },
               },
            },
         },
         "/another": {
            GET: {
               method: "GET",
            },
         },
      });
   });
});
