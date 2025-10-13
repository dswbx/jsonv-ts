import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { describeRoute, openAPISpecs } from "./openapi";
import { validator } from "../middleware";
import * as s from "../../lib";
import { schemaToSpec } from "./utils";
import * as t from "./types";

const getspecs = async (hono: Hono) => {
   const path = "/openapi.json";
   hono.get(path, openAPISpecs(hono));
   const res = await hono.request(path);
   const json = await res.json();
   return json as t.Document;
};

describe("openapi", () => {
   test("should generate openapi specs", async () => {
      const app = new Hono().get(
         "/",
         describeRoute({
            summary: "hello-summary",
            description: "hello-description",
            tags: ["hello-tag"],
         })
      );

      const specs = await getspecs(app);
      expect(specs).toEqual({
         openapi: "3.1.0",
         info: {
            title: "API",
            version: "1.0.0",
         },
         paths: {
            "/": {
               get: {
                  responses: {
                     "200": {
                        description: "Success",
                     },
                  },
                  operationId: "getIndex",
                  summary: "hello-summary",
                  description: "hello-description",
                  tags: ["hello-tag"],
               },
            },
         },
      });
   });

   test("query parameters", async () => {
      const app = new Hono().get(
         "/",
         validator(
            "query",
            s.object({
               name: s.string(),
               age: s.number().optional(),
            })
         )
      );
      const specs = await getspecs(app);
      expect(specs.paths).toEqual({
         "/": {
            get: {
               responses: {
                  "200": {
                     description: "Success",
                  },
               },
               operationId: "getIndex",
               parameters: [
                  {
                     name: "name",
                     in: "query",
                     required: true,
                     schema: {
                        type: "string",
                     },
                  },
                  {
                     name: "age",
                     in: "query",
                     schema: {
                        type: "number",
                     },
                  },
               ],
            },
         },
      });
   });

   test("deduplicate describe and validator", async () => {
      const app = new Hono().get(
         "/",
         describeRoute({
            parameters: schemaToSpec(
               s.object({
                  // expect describeRoute to have precedence over validator
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
      expect(specs.paths).toEqual({
         "/": {
            get: {
               responses: {
                  "200": {
                     description: "Success",
                  },
               },
               operationId: "getIndex",
               parameters: [
                  {
                     name: "name",
                     in: "query",
                     required: true,
                     description: "name-description",
                     schema: {
                        type: "string",
                        description: "name-description",
                     },
                  },
                  {
                     name: "age",
                     in: "query",
                     schema: {
                        type: "number",
                     },
                  },
               ],
            },
         },
      });
   });

   test("required and path should be moved up", async () => {
      const app = new Hono().get(
         "/test/:id",
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
         ),
         validator(
            "param",
            s.object({
               id: s.number(),
            })
         )
      );
      const specs = await getspecs(app);
      expect(specs.paths).toEqual({
         "/test/{id}": {
            get: {
               responses: {
                  "200": {
                     description: "Success",
                  },
               },
               operationId: "getTestById",
               parameters: [
                  {
                     name: "id",
                     in: "path",
                     required: true,
                     schema: {
                        type: "number",
                     },
                  },
                  {
                     name: "name",
                     in: "query",
                     required: true,
                     description: "name-description",
                     schema: {
                        type: "string",
                        description: "name-description",
                     },
                  },
                  {
                     name: "age",
                     in: "query",
                     schema: {
                        type: "number",
                     },
                  },
               ],
            },
         },
      });
   });

   test("allow describeRoute without config", async () => {
      const app = new Hono().get("/", describeRoute());
      const specs = await getspecs(app);
   });

   test.skip("optional path parameter", async () => {
      const app = new Hono().get(
         "/test/:type",
         validator(
            "param",
            s.object({
               type: s.string().optional(),
            })
         )
      );
      const specs = await getspecs(app);
      console.log(specs);
   });
});
