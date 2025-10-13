import { test, expect, describe } from "bun:test";
import { s, fromSchema } from "jsonv-ts";
import { Hono } from "hono";
import { describeRoute, openAPISpecs, validator } from "jsonv-ts/hono";
import { schemaToSpec } from "../../hono/openapi/utils";
import * as t from "../../hono/openapi/types";
import v3_1 from "./2025-09-15.json";
import { Validator } from "@cfworker/json-schema";
import bkndOpenAPI from "./bknd.json";

const getspecs = async (hono: Hono) => {
   const path = "/openapi.json";
   hono.get(path, openAPISpecs(hono));
   const res = await hono.request(path);
   const json = await res.json();
   return json as t.Document;
};

describe("openapi", () => {
   const openapiSchema = new Validator(v3_1 as any);

   test("should be valid", async () => {
      const app = new Hono().get(
         "/",
         describeRoute({
            parameters: schemaToSpec(
               s.object({
                  name: s.string({ description: "name-description" }),
                  age: s.number().optional(),
               }),
               "query"
            ).parameters,
         }),
         validator(
            "query",
            s.object({
               name: s.string(),
               age: s.number().optional(),
            })
         )
      );
      const specs = await getspecs(app);
      expect(openapiSchema.validate(specs).valid).toBe(true);
   });

   test("bknd v0.18.0 sample", async () => {
      expect(openapiSchema.validate(bkndOpenAPI).valid).toBe(true);
   });
});
