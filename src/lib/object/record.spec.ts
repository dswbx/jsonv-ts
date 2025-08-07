import { expectTypeOf } from "expect-type";
import type { Static, StaticCoerced } from "../static";
import { object } from "./object";
import { record } from "./record";
import { assertJson } from "../assert";
import { describe, expect, test } from "bun:test";
import { string, number, anyOf, any, array } from "../";
import { Schema, symbol } from "../schema";

describe("record", () => {
   test("simple", () => {
      // simple
      const simple = record(string());
      type Simple = Static<typeof simple>;
      expectTypeOf<Simple>().toEqualTypeOf<{ [key: string]: string }>();
      assertJson(simple, {
         type: "object",
         additionalProperties: { type: "string" },
      });

      const schema = record(
         object({
            name: string(),
            age: number().optional(),
         })
      );
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{
         [key: string]: { name: string; age?: number; [key: string]: unknown };
      }>();

      assertJson(schema, {
         type: "object",
         additionalProperties: {
            type: "object",
            properties: { name: { type: "string" }, age: { type: "number" } },
            required: ["name"],
         },
      });
   });

   test("with options", () => {
      const schema = record(object({ foo: string() }), {
         title: "test",
      });

      const ap = schema.additionalProperties;
      //    ^?
      expect(ap).toBeInstanceOf(Schema);
   });

   test("optional", () => {
      const schema = record(string());
      //    ^?
      const orap = schema.additionalProperties;
      //    ^?
      const optional = schema.optional();
      //    ^?
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{
         [key: string]: string;
      }>();

      const ap = optional.additionalProperties;
      //    ^?
      expect(ap).toBeInstanceOf(Schema);

      {
         const schema = object({
            records: record(string()).optional(),
         }).strict();
         type Inferred = Static<typeof schema>;
         //   ^?
         expectTypeOf<Inferred>().toEqualTypeOf<{
            records?: { [key: string]: string };
         }>();
      }

      {
         const ss = record(string()).optional();
         type SS = (typeof ss)[typeof symbol]["static"];
         //    ^?
         expectTypeOf<SS>().toEqualTypeOf<
            | {
                 [key: string]: string;
              }
            | undefined
         >();
      }
   });

   test("with union", () => {
      const n = number().optional();
      //    ^?

      const obj = object({
         name: string(),
         age: number().optional(),
      }).strict();
      type OInf = Static<typeof obj>;
      //   ^?
      expectTypeOf<OInf>().toEqualTypeOf<{
         name: string;
         age?: number;
      }>();

      const schema = anyOf([
         record(
            object({
               name: string(),
               age: number().optional(),
            })
         ),
         string(),
      ]);
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<
         | {
              [key: string]: {
                 name: string;
                 age?: number;
                 [key: string]: unknown;
              };
           }
         | string
      >();

      {
         // more complex
         const schema = object({
            what: anyOf([
               record(
                  object({
                     name: string(),
                     age: number().optional(),
                  })
               ).optional(),
               string(),
            ]),
         });
         type Inferred = Static<typeof schema>;
      }
   });

   test("with any", () => {
      const inner = any();
      type Inner = (typeof inner)["static"];
      //   ^?
      expectTypeOf<Inner>().toEqualTypeOf<any>();
      type InnerStatic = Static<typeof inner>;
      //   ^?
      expectTypeOf<InnerStatic>().toEqualTypeOf<any>();

      const schema = record(inner);
      type Inferred = Static<typeof schema>;
      //   ^?

      expectTypeOf<Inferred>().toEqualTypeOf<{
         [key: string]: any;
      }>();
   });

   test("template", () => {
      const schema = record(object({ name: string() }));
      expect(schema.template({})).toEqual({});
   });

   test("coerce", () => {
      const schema = record(string());
      type Inferred = Static<typeof schema>;
      //   ^?
      expectTypeOf<Inferred>().toEqualTypeOf<{
         [key: string]: string;
      }>();

      type Coerced = StaticCoerced<typeof schema>;
      //   ^?
      expectTypeOf<Coerced>().toEqualTypeOf<{
         [key: string]: string;
      }>();
   });

   test("maxProperties", () => {
      const schema = record(string(), { maxProperties: 1 });
      type Inferred = Static<typeof schema>;
      //   ^?
      expectTypeOf<Inferred>().toEqualTypeOf<{
         [key: string]: string;
      }>();

      expect(schema.validate({}).valid).toBe(true);
      expect(schema.validate({ a: "a" }).valid).toBe(true);
      expect(schema.validate({ a: "a", b: "b" }).valid).toBe(false);
   });
});
