import { describe, expect, test } from "bun:test";
import { Schema } from "./schema";
import { fromSchema } from "./from-schema";

const expectType = (
   schema: Schema,
   type: string,
   additional: Record<string, any> = {}
) => {
   expect(schema.type).toEqual(type);

   const keys = Object.keys(additional);
   for (const key of keys) {
      expect(schema[key], `expected ${key} to be ${additional[key]}`).toEqual(
         additional[key]
      );
   }
};

describe("fromSchema", () => {
   test("base", () => {
      expectType(fromSchema({ type: "string" }), "string");
      expectType(
         fromSchema({
            type: "string",
            maxLength: 10,
            minLength: 1,
            pattern: "/a/",
         }),
         "string",
         {
            maxLength: 10,
            minLength: 1,
            pattern: "/a/",
         }
      );
      expectType(fromSchema({ type: "number" }), "number");
      expectType(
         fromSchema({
            type: "number",
            exclusiveMaximum: 1,
            multipleOf: 1,
            minimum: 1,
            exclusiveMinimum: 1,
            maximum: 2,
         }),
         "number",
         {
            exclusiveMaximum: 1,
            multipleOf: 1,
            minimum: 1,
            maximum: 2,
            exclusiveMinimum: 1,
         }
      );
      expectType(fromSchema({ type: "integer" }), "integer");
      expectType(fromSchema({ type: "boolean" }), "boolean");
   });

   test("any", () => {
      expect(fromSchema({ minimum: 2 }).minimum).toEqual(2);
   });

   test("objects", () => {
      expectType(
         fromSchema({
            type: "object",
            properties: { name: { type: "string" } },
         }),
         "object"
      );
   });

   test("arrays", () => {
      const schema = fromSchema({
         type: "array",
         items: { type: "string" },
      });

      expectType(schema, "array");
      // @ts-ignore
      expectType(schema.items, "string");

      expectType(
         fromSchema({
            type: "array",
            contains: { type: "string" },
         }).contains!,
         "string"
      );
   });

   test("boolean schema", () => {
      {
         const s = fromSchema(true);
         expect(s.validate(true).valid).toBe(true);
         expect(s.validate(false).valid).toBe(true);
      }
      {
         const s = fromSchema(false);
         expect(s.validate(true).valid).toBe(false);
         expect(s.validate(false).valid).toBe(false);
      }
   });

   test("object with required/optional", () => {
      const s = fromSchema({
         type: "object",
         properties: { name: { type: "string" }, age: { type: "number" } },
         required: ["name"],
      });
      expect(s.properties?.name?.type).toEqual("string");
      expect(s.properties?.age?.type).toEqual("number");
      expect(s.required).toEqual(["name"]);
   });

   test("examples", () => {
      {
         const s = fromSchema({
            $schema: "https://json-schema.org/draft/2020-12/schema",
            properties: { foo: {}, bar: {} },
            patternProperties: { "^v": {} },
            additionalProperties: false,
         }) as any;
         expect(s.properties?.foo).toBeInstanceOf(Schema);
         expect(s.properties?.bar).toBeInstanceOf(Schema);
         expect(s.patternProperties?.["^v"]).toBeInstanceOf(Schema);
         expect(s.additionalProperties).toBeInstanceOf(Schema);
      }

      {
         const s = fromSchema({
            properties: {
               bar: true,
               baz: true,
            },
            required: ["bar"],
         }) as any;
         expect(s.properties?.bar).toBeInstanceOf(Schema);
         expect(s.properties?.baz).toBeInstanceOf(Schema);
         expect(s.required).toEqual(["bar"]);
      }

      {
         const s = fromSchema({
            $schema: "https://json-schema.org/draft/2020-12/schema",
            oneOf: [
               {
                  properties: {
                     bar: true,
                     baz: true,
                  },
                  required: ["bar"],
               },
               {
                  properties: {
                     foo: true,
                  },
                  required: ["foo"],
               },
            ],
         });
         // @ts-ignore
         expect(s.oneOf?.[0]?.properties?.bar).toBeInstanceOf(Schema);
         // @ts-ignore
         expect(s.oneOf?.[0]?.properties?.baz).toBeInstanceOf(Schema);
         // @ts-ignore
         expect(s.oneOf?.[0]?.required).toEqual(["bar"]);
         // @ts-ignore
         expect(s.oneOf?.[1]?.properties?.foo).toBeInstanceOf(Schema);
         // @ts-ignore
         expect(s.oneOf?.[1]?.required).toEqual(["foo"]);
      }

      {
         const s = fromSchema({
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            properties: {
               alpha: {
                  type: "number",
                  maximum: 3,
                  default: 5,
               },
            },
         }) as any;
         expect(s.properties?.alpha?.type).toEqual("number");
         expect(s.properties?.alpha?.default).toEqual(5);
         // @ts-ignore
         expect(s.properties?.alpha?.maximum).toEqual(3);
      }

      {
         const s = fromSchema({
            not: { type: "integer" },
         });
         expect(s.validate("foo").valid).toBe(true);
         expect(s.validate(123).valid).toBe(false);
      }

      /* {
         const s = fromSchema({
            $schema: "https://json-schema.org/draft/2020-12/schema",
            allOf: [{ multipleOf: 2 }],
         }) as any;
         console.log(JSON.stringify(s, null, 2));
         expect(s.multipleOf).toEqual(2);
      } */
      {
         const s = fromSchema({
            $schema: "https://json-schema.org/draft/2020-12/schema",
            anyOf: [{ multipleOf: 3 }],
         }) as any;
         expect(s.anyOf?.[0]?.multipleOf).toEqual(3);
      }
      {
         const s = fromSchema({
            $schema: "https://json-schema.org/draft/2020-12/schema",
            oneOf: [{ multipleOf: 5 }],
         }) as any;
         expect(s.oneOf?.[0]?.multipleOf).toEqual(5);
      }
   });
});
