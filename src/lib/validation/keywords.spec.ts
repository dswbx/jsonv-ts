import { describe, expect, test } from "bun:test";
import { booleanSchema } from "../schema";
import { fromSchema } from "../schema/from-schema";
import * as kw from "./keywords";
import { number } from "../number/number";
import { boolean } from "../boolean/boolean";
import { string } from "../string/string";
import { any } from "../schema/misc";

describe("keywords", () => {
   describe("base", () => {
      test("type", () => {
         const values = {
            string: ["hello"],
            number: [1, 1.1],
            boolean: [true, false],
            object: [{ a: 1 }],
            array: [[1, 2, 3]],
         };
         const types = Object.keys(values);
         for (const type of types) {
            for (const value of values[type]) {
               const result = kw._type({ type } as any, value);
               expect(
                  result.valid,
                  `type ${type} should be valid for ${JSON.stringify(
                     value
                  )}, but got ${result}`
               ).toBe(true);
            }
            for (const [key, value] of Object.entries(values)) {
               if (key === type) continue;
               for (const v of value) {
                  const result = kw._type({ type } as any, v);
                  expect(
                     result.valid,
                     `type ${type} should be invalid for ${JSON.stringify(
                        v
                     )}, but got '${result}'`
                  ).toBe(false);
               }
            }
         }
      });

      test("const", () => {
         expect(kw._const({ const: "hello" }, "hello").valid).toBe(true);
         expect(kw._const({ const: "hello" }, "world").valid).toBe(false);
         expect(kw._const({ const: 42 }, 42).valid).toBe(true);
         expect(kw._const({ const: 42 }, "42").valid).toBe(false);
         expect(kw._const({ const: true }, true).valid).toBe(true);
         expect(kw._const({ const: false }, true).valid).toBe(false);
         expect(kw._const({ const: null }, null).valid).toBe(true);
         expect(kw._const({ const: null }, undefined).valid).toBe(false);

         // looks same, but isn't
         expect(kw._const({ const: "ä" }, "ä").valid).toBe(true);
         expect(kw._const({ const: "ä" }, "ä").valid).toBe(false);
      });

      test("enum", () => {
         expect(kw._enum({ enum: ["a", "b", "c"] }, "a").valid).toBe(true);
         expect(kw._enum({ enum: ["a", "b", "c"] }, "d").valid).toBe(false);
         expect(kw._enum({ enum: [1, 2, 3] }, 1).valid).toBe(true);
         expect(kw._enum({ enum: [1, 2, 3] }, 4).valid).toBe(false);
         expect(kw._enum({ enum: [true, false] }, true).valid).toBe(true);
         expect(kw._enum({ enum: [true, false] }, null).valid).toBe(false);
      });

      test("not", () => {
         expect(kw.not({ not: string() }, "hello").valid).toBe(false);
         expect(kw.not({ not: string() }, 123).valid).toBe(true);
         expect(kw.not({ not: string() }, null).valid).toBe(true);
         expect(kw.not({ not: string() }, undefined).valid).toBe(true);
      });
   });

   describe("string", () => {
      test("pattern", () => {
         /* expect(kw.pattern(any({ pattern: "/^[a-z]+$/" }), "hello").valid).toBe(
            true
         );
         expect(kw.pattern(any({ pattern: "/^[a-z]+$/" }), "Hello").valid).toBe(
            false
         );
         expect(kw.pattern(any({ pattern: "/\\d+/" }), "123").valid).toBe(true);
         expect(kw.pattern(any({ pattern: "/\\d+/" }), "abc").valid).toBe(
            false
         );
         expect(kw.pattern(any({ pattern: "/invalid" }), 123).valid).toBe(true); */
      });

      test("minLength", () => {
         expect(kw.minLength({ minLength: 3 }, "hello").valid).toBe(true);
         expect(kw.minLength({ minLength: 3 }, "hi").valid).toBe(false);
         expect(kw.minLength({ minLength: 0 }, "").valid).toBe(true);
         expect(kw.minLength({ minLength: 3 }, 123).valid).toBe(true);
      });

      test("maxLength", () => {
         expect(kw.maxLength({ maxLength: 5 }, "hello").valid).toBe(true);
         expect(kw.maxLength({ maxLength: 5 }, "hello world").valid).toBe(
            false
         );
         expect(kw.maxLength({ maxLength: 0 }, "").valid).toBe(true);
         expect(kw.maxLength({ maxLength: 5 }, 123).valid).toBe(true);
      });
   });

   describe("number", () => {
      test("multipleOf", () => {
         expect(kw.multipleOf({ multipleOf: 2 }, 4).valid).toBe(true);
         expect(kw.multipleOf({ multipleOf: 2 }, 5).valid).toBe(false);
         expect(kw.multipleOf({ multipleOf: 0.5 }, 1.5).valid).toBe(true);
         expect(kw.multipleOf({ multipleOf: 0.5 }, 1.7).valid).toBe(false);
         expect(kw.multipleOf({ multipleOf: 2 }, "4").valid).toBe(true);
      });

      test("maximum", () => {
         expect(kw.maximum({ maximum: 5 }, 4).valid).toBe(true);
         expect(kw.maximum({ maximum: 5 }, 5).valid).toBe(true);
         expect(kw.maximum({ maximum: 5 }, 6).valid).toBe(false);
         expect(kw.maximum({ maximum: 5 }, "4").valid).toBe(true);
      });

      test("exclusiveMaximum", () => {
         expect(kw.exclusiveMaximum({ exclusiveMaximum: 5 }, 4).valid).toBe(
            true
         );
         expect(kw.exclusiveMaximum({ exclusiveMaximum: 5 }, 5).valid).toBe(
            false
         );
         expect(kw.exclusiveMaximum({ exclusiveMaximum: 5 }, 6).valid).toBe(
            false
         );
         expect(kw.exclusiveMaximum({ exclusiveMaximum: 5 }, "4").valid).toBe(
            true
         );
      });

      test("minimum", () => {
         expect(kw.minimum({ minimum: 5 }, 6).valid).toBe(true);
         expect(kw.minimum({ minimum: 5 }, 5).valid).toBe(true);
         expect(kw.minimum({ minimum: 5 }, 4).valid).toBe(false);
         expect(kw.minimum({ minimum: 5 }, "6").valid).toBe(true);
      });

      test("exclusiveMinimum", () => {
         expect(kw.exclusiveMinimum({ exclusiveMinimum: 5 }, 6).valid).toBe(
            true
         );
         expect(kw.exclusiveMinimum({ exclusiveMinimum: 5 }, 5).valid).toBe(
            false
         );
         expect(kw.exclusiveMinimum({ exclusiveMinimum: 5 }, 4).valid).toBe(
            false
         );
         expect(kw.exclusiveMinimum({ exclusiveMinimum: 5 }, "6").valid).toBe(
            true
         );
      });
   });

   describe("object", () => {
      test("properties", () => {
         {
            const result = kw.properties(
               { properties: { a: number() } },
               {
                  a: 1,
               }
            );
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
         }
         {
            const result = kw.properties(
               { properties: { a: number() } },
               {
                  a: "1",
               }
            );
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
         }

         expect(
            kw.properties({ properties: { a: number() } }, { a: 1, b: 2 }).valid
         ).toBe(true);
         expect(
            kw.properties({ properties: { a: number() } }, "not an object")
               .valid
         ).toBe(true);
      });

      test("required", () => {
         expect(
            kw.required({ required: ["a", "b"] }, { a: 1, b: 2 }).valid
         ).toBe(true);
         expect(kw.required({ required: ["a", "b"] }, { a: 1 }).valid).toBe(
            false
         );
         expect(kw.required({ required: [] }, {}).valid).toBe(true);
         expect(kw.required({ required: ["a"] }, "not an object").valid).toBe(
            true
         );
      });

      test("minProperties", () => {
         expect(
            kw.minProperties({ minProperties: 2 }, { a: 1, b: 2 }).valid
         ).toBe(true);
         expect(kw.minProperties({ minProperties: 2 }, { a: 1 }).valid).toBe(
            false
         );
         expect(kw.minProperties({ minProperties: 0 }, {}).valid).toBe(true);
         expect(
            kw.minProperties({ minProperties: 2 }, "not an object").valid
         ).toBe(true);
      });

      test("maxProperties", () => {
         expect(
            kw.maxProperties({ maxProperties: 2 }, { a: 1, b: 2 }).valid
         ).toBe(true);
         expect(
            kw.maxProperties({ maxProperties: 2 }, { a: 1, b: 2, c: 3 }).valid
         ).toBe(false);
         expect(kw.maxProperties({ maxProperties: 0 }, {}).valid).toBe(true);
         expect(
            kw.maxProperties({ maxProperties: 2 }, "not an object").valid
         ).toBe(true);
      });

      test("patternProperties", () => {
         expect(
            kw.patternProperties(
               {
                  patternProperties: { "^a": number({ minimum: 10 }) },
               },
               { a: 11, b: 2 }
            ).valid
         ).toBe(true);
         expect(
            kw.patternProperties(
               {
                  patternProperties: { "^a": string() },
               },
               { a: 11, b: 2 }
            ).valid
         ).toBe(false);
      });

      test("propertyNames", () => {
         expect(
            kw.propertyNames({ propertyNames: string() }, { a: 1, b: 2 }).valid
         ).toBe(true);
         expect(
            kw.propertyNames(
               {
                  propertyNames: string({
                     pattern: "^a+$",
                  }),
               },
               { a: 1, b: 2 }
            ).valid
         ).toBe(false);
         expect(
            kw.propertyNames(
               {
                  propertyNames: string({
                     maxLength: 3,
                  }),
               },
               { foo: {}, foobar: {} }
            ).valid
         ).toBe(false);
         expect(
            kw.propertyNames(
               {
                  propertyNames: booleanSchema(false),
               },
               { foo: 1 }
            ).valid
         ).toBe(false);
      });
   });

   describe("array", () => {
      test("items", () => {
         expect(kw.items({ items: number() }, [1, 2, 3]).valid).toBe(true);
         expect(kw.items({ items: number() }, ["a", "b"]).valid).toBe(false);
         expect(kw.items({ items: number() }, "not an array").valid).toBe(true);
      });

      test("minItems", () => {
         expect(kw.minItems({ minItems: 2 }, [1, 2]).valid).toBe(true);
         expect(kw.minItems({ minItems: 2 }, [1]).valid).toBe(false);
         expect(kw.minItems({ minItems: 0 }, []).valid).toBe(true);
         expect(kw.minItems({ minItems: 2 }, "not an array").valid).toBe(true);
      });

      test("maxItems", () => {
         expect(kw.maxItems({ maxItems: 2 }, [1, 2]).valid).toBe(true);
         expect(kw.maxItems({ maxItems: 2 }, [1, 2, 3]).valid).toBe(false);
         expect(kw.maxItems({ maxItems: 0 }, []).valid).toBe(true);
         expect(kw.maxItems({ maxItems: 2 }, "not an array").valid).toBe(true);
      });

      test("uniqueItems", () => {
         expect(kw.uniqueItems({ uniqueItems: true }, [1, 2, 3]).valid).toBe(
            true
         );
         expect(kw.uniqueItems({ uniqueItems: true }, [1, 1, 2]).valid).toBe(
            false
         );
         expect(kw.uniqueItems({ uniqueItems: false }, [1, 1, 2]).valid).toBe(
            true
         );
         expect(
            kw.uniqueItems({ uniqueItems: true }, [
               { foo: "bar" },
               { foo: "bar" },
            ]).valid
         ).toBe(false);
         expect(
            kw.uniqueItems({ uniqueItems: true }, "not an array").valid
         ).toBe(true);

         expect(kw.uniqueItems({ uniqueItems: true }, ["ä", "ä"]).valid).toBe(
            false
         );
         // looks same, but isn't
         expect(kw.uniqueItems({ uniqueItems: true }, ["ä", "ä"]).valid).toBe(
            true
         );
      });

      test("contains", () => {
         const s = number();
         expect(kw.contains({ contains: s }, [1, "a", 2]).valid).toBe(true);
         expect(kw.contains({ contains: s }, ["a", "b"]).valid).toBe(false);
         expect(kw.contains({ contains: s }, "not an array").valid).toBe(true);

         expect(
            kw.contains({ contains: number(), minContains: 2 }, [1, 2, "a"])
               .valid
         ).toBe(true);
         expect(
            kw.contains({ contains: number(), minContains: 2 }, [1]).valid
         ).toBe(false);
         expect(
            kw.contains({ contains: number(), minContains: 2 }, "not an array")
               .valid
         ).toBe(true);

         /* expect(
            kw.contains(any({ contains: number(), maxContains: 2 }), [
               1,
               2,
               "a",
            ]).valid
         ).toBe(false); */
         expect(
            kw.contains({ contains: number(), maxContains: 2 }, [1]).valid
         ).toBe(true);
         expect(
            kw.contains({ contains: number(), maxContains: 2 }, "not an array")
               .valid
         ).toBe(true);
      });

      test("prefixItems", () => {
         const s = number();
         expect(kw.prefixItems({ prefixItems: [s, s] }, [1, 2]).valid).toBe(
            true
         );
         expect(kw.prefixItems({ prefixItems: [s, s] }, [1]).valid).toBe(true);
         expect(kw.prefixItems({ prefixItems: [s, s] }, [1, ""]).valid).toBe(
            false
         );

         {
            // prefixItems with items false
            const s = any({
               items: booleanSchema(false),
               prefixItems: [boolean(), boolean()],
            });
            expect(s.validate([true, false]).valid).toBe(true);
            expect(s.validate([true]).valid).toBe(true);
            expect(s.validate([true, false, 1]).valid).toBe(false);
         }
      });
   });

   test("dependentRequired", () => {
      const s = fromSchema({
         dependentRequired: {
            bar: ["foo"],
         },
      });

      expect(s.validate({}).valid).toBe(true);
      expect(s.validate({ bar: 2 }).valid).toBe(false);
   });

   test("ifThenElse", () => {
      {
         const s = fromSchema({
            if: {
               exclusiveMaximum: 0,
            },
            then: {
               minimum: -10,
            },
         });

         expect(s.validate(-1).valid).toBe(true);
         expect(s.validate(-100).valid).toBe(false);
         expect(s.validate(3).valid).toBe(true);
      }

      {
         const s = fromSchema({
            if: {
               exclusiveMaximum: 0,
            },
            else: {
               multipleOf: 2,
            },
         });

         expect(s.validate(-1).valid).toBe(true);
         expect(s.validate(4).valid).toBe(true);
         expect(s.validate(3).valid).toBe(false);
      }
   });

   test("dependentSchemas", () => {
      const s = fromSchema({
         $schema: "https://json-schema.org/draft/2020-12/schema",
         dependentSchemas: {
            bar: {
               properties: {
                  foo: { type: "integer" },
                  bar: { type: "integer" },
               },
            },
         },
      });

      expect(s.validate({ foo: 1, bar: 2 }).valid).toBe(true);
      expect(s.validate({ foo: "quux" }).valid).toBe(true);
      expect(s.validate({ foo: "quux", bar: 2 }).valid).toBe(false);
      expect(s.validate({ foo: 2, bar: "quux" }).valid).toBe(false);
   });
});
