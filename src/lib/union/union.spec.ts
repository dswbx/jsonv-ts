import { expectTypeOf } from "expect-type";
import type { Static, StaticCoerced } from "../static";
import { anyOf, oneOf, type StaticUnion, type StaticUnion2 } from "./union";
import { assertJson } from "../assert";
import { describe, expect, test } from "bun:test";
import { string } from "../string/string";
import { number, integer } from "../number/number";
import { object } from "../object/object";
import { array } from "../array/array";
import { any, literal } from "../schema/misc";
import type { Schema, symbol } from "../schema/schema";

describe("union", () => {
   test("anyOf", () => {
      const schema = anyOf([string(), number()]);
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<string | number>();

      assertJson(schema, {
         anyOf: [{ type: "string" }, { type: "number" }],
      });
   });

   test("anyOf with arrays", () => {
      const schema = anyOf([string(), number(), array(string())]);
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<string | number | string[]>();

      assertJson(schema, {
         anyOf: [
            { type: "string" },
            { type: "number" },
            { type: "array", items: { type: "string" } },
         ],
      });
   });

   test("anyOf with objects", () => {
      const one = object({
         type: string({ const: "ref/resource" }),
         uri: string().optional(),
      });
      type OneStatic = (typeof one)[typeof symbol]["static"];
      //   ^?
      type OneInferred = Static<typeof one>;
      //   ^?

      const aobj = array(object({ name: string() }));
      type AobjStatic = (typeof aobj)[typeof symbol]["static"];
      //   ^?
      type AobjInferred = Static<typeof aobj>;
      //   ^?

      const schema = anyOf([
         one,
         object({
            type: string({ const: "ref/tool" }),
            name: string(),
         }),
      ]);
      type AnyOfStatic = (typeof schema)[typeof symbol]["static"];
      //   ^?
      expectTypeOf<AnyOfStatic>().toEqualTypeOf<
         | {
              type: "ref/resource";
              uri?: string;
              [key: string]: unknown;
           }
         | {
              type: "ref/tool";
              name: string;
              [key: string]: unknown;
           }
      >();
      type AnyOfInferred = Static<typeof schema>;
      //   ^?
      expectTypeOf<AnyOfInferred>().toEqualTypeOf<
         | {
              type: "ref/resource";
              uri?: string;
              [key: string]: unknown;
           }
         | {
              type: "ref/tool";
              name: string;
              [key: string]: unknown;
           }
      >();
   });

   test("anyOf with objects and literals", () => {
      const schema = anyOf([
         literal("ref/resource"),
         object({ type: string({ const: "ref/tool" }), name: string() }),
         object({ type: literal("ref/another") }),
      ]);
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<
         | "ref/resource"
         | { type: "ref/tool"; name: string; [key: string]: unknown }
         | { type: "ref/another"; [key: string]: unknown }
      >();

      assertJson(schema, {
         anyOf: [
            { const: "ref/resource" },
            {
               type: "object",
               properties: {
                  type: { const: "ref/tool", type: "string" },
                  name: { type: "string" },
               },
               required: ["type", "name"],
            },
            {
               type: "object",
               properties: { type: { const: "ref/another" } },
               required: ["type"],
            },
         ],
      });
   });

   test("anyOf with objects as array", () => {
      const objects = {
         one: object({
            type: literal("one"),
            name: string(),
         }),
         two: object({
            type: literal("two"),
            name: string(),
            num: number(),
         }),
      } as const;
      const v = Object.values(objects);
      const schema = anyOf(v);
      type Inferred = Static<typeof schema>;
      //   ^?

      {
         const schema = anyOf([objects.one, objects.two]);
         type Inferred = Static<typeof schema>;
         //   ^?
      }
      {
         const v = [objects.one, objects.two];
         const schema = anyOf(v);
         type Inferred = Static<typeof schema>;
         //   ^?
      }
      {
         type Union2<T extends Schema[]> = {
            [K in keyof T]: T[K] extends Schema ? Static<T[K]> : never;
         }[number];
         type T2 = Union2<typeof v>;
         //   ^?
      }
   });

   test("anyOf with enum string, and string", () => {
      const arr = [
         string({ enum: ["entity", "relation", "media"] }),
         string({ pattern: "^template-" }),
      ];
      const action = string({ enum: ["entity", "relation", "media"] });
      type ActionInferred = Static<typeof action>;
      //   ^?

      const anyAction = string({ pattern: "^template-" });
      type AnyActionInferred = Static<typeof anyAction>;
      //   ^?

      const schemaAction = anyOf([
         string({ enum: ["entity", "relation", "media"] }),
         string({ pattern: "^template-" }),
      ]);
      type Inferred = Static<typeof schemaAction>;
      //   ^?
      type Inferred2 = StaticUnion2<typeof arr>;
   });

   test("oneOf", () => {
      const schema = oneOf([string(), number()]);
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<string | number>();

      assertJson(schema, {
         oneOf: [{ type: "string" }, { type: "number" }],
      });
   });

   // use with caution!

   test("template", () => {
      const schema = anyOf([string(), number()], { default: 1 });
      expect(schema.template()).toEqual(1);
   });

   test("validation", () => {
      const schema = anyOf([integer(), any({ minimum: 2 })]);
      expect(schema.validate(1).valid).toEqual(true);
      expect(schema.validate(2.5).valid).toEqual(true);
      expect(schema.validate(3).valid).toEqual(true);
      expect(schema.validate(1.5).valid).toEqual(false);
   });

   test("coerce", () => {
      const schema = anyOf([string(), array(string())], {
         coerce: function (this: any, value: unknown): string[] {
            //console.log("--calling custom coerce", { value, _this: this });
            if (typeof value === "string" && value.includes(",")) {
               return value.split(",");
            } else if (Array.isArray(value)) {
               return value.map(String);
            }
            return [String(value)];
         },
      });
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<string | string[]>();
      type Coerced = (typeof schema)[typeof symbol]["coerced"];
      expectTypeOf<Coerced>().toEqualTypeOf<string[]>();
      type Coerced2 = StaticCoerced<typeof schema>;
      expectTypeOf<Coerced2>().toEqualTypeOf<string[]>();

      expect(schema.coerce("test")).toEqual(["test"]);
      expect(schema.coerce("test,test2")).toEqual(["test", "test2"]);
      expect(schema.coerce(["test", "test2"])).toEqual(["test", "test2"]);
   });

   test("walk", () => {
      const schema = anyOf([string(), number()]);
      expect(
         [...schema.walk()].map((n) => ({
            ...n,
            schema: n.schema.constructor.name,
         }))
      ).toEqual([
         {
            schema: "UnionSchema",
            instancePath: [],
            keywordPath: [],
            data: undefined,
            depth: 0,
         },
         {
            schema: "StringSchema",
            instancePath: [],
            keywordPath: ["anyOf", 0],
            data: undefined,
            depth: 0,
         },
         {
            schema: "",
            instancePath: [],
            keywordPath: ["anyOf", 1],
            data: undefined,
            depth: 0,
         },
      ]);

      expect(
         [
            ...schema.walk({
               data: 1,
            }),
         ].map((n) => ({
            ...n,
            schema: n.schema.constructor.name,
         }))
      ).toEqual([
         {
            schema: "UnionSchema",
            instancePath: [],
            keywordPath: [],
            data: 1,
            depth: 0,
         },
         {
            schema: "StringSchema",
            instancePath: [],
            keywordPath: ["anyOf", 0],
            depth: 0,
         },
         {
            schema: "",
            instancePath: [],
            keywordPath: ["anyOf", 1],
            data: 1,
            depth: 0,
         },
      ]);
   });
});
