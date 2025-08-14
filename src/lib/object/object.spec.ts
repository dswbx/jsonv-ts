import { expectTypeOf } from "expect-type";
import type { Static, StaticCoerced } from "../static";
import {
   object,
   type ObjectDefaults,
   ObjectSchema,
   partialObject,
   strictObject,
} from "./object";
import { assertJson } from "../assert";
import { describe, expect, test } from "bun:test";
import { string } from "../string/string";
import { number } from "../number/number";
import { boolean } from "../boolean/boolean";
import { array } from "../array/array";
import { any } from "../schema/misc";
import type { Schema, symbol } from "../schema/schema";

describe("object", () => {
   test("basic", () => {
      const schema = object({});

      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{ [key: string]: unknown }>();
      assertJson(object({}), { type: "object", properties: {} });
   });

   test("types", () => {
      const one = object({
         type: string({ const: "ref/resource" }),
         uri: string().optional(),
      });
      type OneStatic = (typeof one)[typeof symbol]["static"];
      //   ^?
      expectTypeOf<OneStatic>().toEqualTypeOf<{
         type: "ref/resource";
         uri?: string;
         [key: string]: unknown;
      }>();

      type OneInferred = Static<typeof one>;
      //   ^?
      expectTypeOf<OneInferred>().toEqualTypeOf<{
         type: "ref/resource";
         uri?: string;
         [key: string]: unknown;
      }>();

      type OneCoerced = StaticCoerced<typeof one>;
      expectTypeOf<OneCoerced>().toEqualTypeOf<{
         type: "ref/resource";
         uri?: string;
         [key: string]: unknown;
      }>();

      {
         // with additionalProperties false
         const schema = object(
            {
               name: string(),
               age: number(),
            },
            { additionalProperties: false }
         );
         type Inferred = Static<typeof schema>;
         expectTypeOf<Inferred>().toEqualTypeOf<{
            name: string;
            age: number;
         }>();
         assertJson(schema, {
            type: "object",
            properties: {
               name: { type: "string" },
               age: { type: "number" },
            },
            required: ["name", "age"],
            additionalProperties: false,
         });
      }

      {
         // ensure it's all schemas
         expect(() =>
            object({
               name: string(),
               age: number(),
               // @ts-expect-error
               invalid: 1,
            })
         ).toThrow();
      }

      {
         type T = Static<ObjectSchema>;
         //   ^?
         expectTypeOf<T>().toEqualTypeOf<{
            [key: string]: unknown;
            [key: number]: unknown;
         }>();

         /* type C = StaticCoerced<ObjectSchema>;
         //   ^?
         expectTypeOf<C>().toEqualTypeOf<{
            [key: string]: unknown;
         }>(); */
      }
   });
   test("with properties", () => {
      const name = string();
      const schema = object({
         name: string(),
         age: number({ minimum: 1 }).optional(),
      });
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{
         name: string;
         age?: number;
         [key: string]: unknown;
      }>();
      type Coerced = StaticCoerced<typeof schema>;
      expectTypeOf<Coerced>().toEqualTypeOf<{
         name: string;
         age?: number;
         [key: string]: unknown;
      }>();
   });

   test("with properties", () => {
      const schema = object(
         {
            name: string(),
            age: number({ minimum: 1 }).optional(),
         },
         {
            propertyNames: string(),
         }
      );

      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{
         name: string;
         age?: number;
         [key: string]: unknown;
      }>();
      expectTypeOf<
         Static<(typeof schema)["properties"]["name"]>
      >().toEqualTypeOf<string>();
      expectTypeOf<
         Static<(typeof schema)["propertyNames"]>
      >().toEqualTypeOf<string>();

      assertJson(schema, {
         type: "object",
         properties: {
            name: { type: "string" },
            age: { type: "number", minimum: 1 },
         },
         propertyNames: { type: "string" },
         required: ["name"],
      });
   });

   test("strictObject", () => {
      const schema = object({
         name: string({ maxLength: 1 }),
         age: number(),
      }).strict();
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{
         name: string;
         age: number;
      }>();

      assertJson(schema, {
         type: "object",
         properties: {
            name: { type: "string", maxLength: 1 },
            age: { type: "number" },
         },
         required: ["name", "age"],
         additionalProperties: false,
      });

      {
         // using strictObject
         const schema = strictObject({
            name: string({ maxLength: 1 }),
            age: number(),
         });
         type Inferred = Static<typeof schema>;
         expectTypeOf<Inferred>().toEqualTypeOf<{
            name: string;
            age: number;
         }>();

         assertJson(schema, {
            type: "object",
            properties: {
               name: { type: "string", maxLength: 1 },
               age: { type: "number" },
            },
            required: ["name", "age"],
            additionalProperties: false,
         });
      }
   });

   test("partialObject", () => {
      const schema = object({
         name: string(),
         age: number(),
      }).partial();
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{
         name?: string;
         age?: number;
         [key: string]: unknown;
      }>();

      assertJson(schema, {
         type: "object",
         properties: {
            name: { type: "string" },
            age: { type: "number" },
         },
      });

      {
         // partialObject with additionalProperties false
         const schema = object(
            {
               name: string(),
               age: number(),
            },
            { additionalProperties: false }
         ).partial();
         type Inferred = Static<typeof schema>;
         expectTypeOf<Inferred>().toEqualTypeOf<{
            name?: string;
            age?: number;
         }>();
         assertJson(schema, {
            type: "object",
            properties: {
               name: { type: "string" },
               age: { type: "number" },
            },
            additionalProperties: false,
         });

         type Coerced = StaticCoerced<typeof schema>;
         type C =
            (typeof schema)["properties"]["name"][typeof symbol]["coerced"];

         expectTypeOf<Coerced>().toEqualTypeOf<{
            name?: string;
            age?: number;
         }>();
      }

      {
         const schema = object({
            name: string({ const: "what" }),
         });
         type Inferred = Static<typeof schema>;
         expectTypeOf<Inferred>().toEqualTypeOf<{
            [key: string]: unknown;
            name: "what";
         }>();
         type Coerced = StaticCoerced<typeof schema>;
         expectTypeOf<Coerced>().toEqualTypeOf<{
            name: "what";
            [key: string]: unknown;
         }>();
      }

      {
         const schema = object({
            name: string({ coerce: (v) => v as "what" }),
            age: number(),
         });
         type Inferred = Static<typeof schema>;
         expectTypeOf<Inferred>().toEqualTypeOf<{
            name: string;
            age: number;
            [key: string]: unknown;
         }>();
         type Coerced = StaticCoerced<typeof schema>;
         expectTypeOf<Coerced>().toEqualTypeOf<{
            name: "what";
            age: number;
            [key: string]: unknown;
         }>();
      }

      {
         const schema = object({
            name: string({ coerce: (v) => v as "what" }).optional(),
            age: number(),
         });
         type Inferred2 = (typeof schema)[typeof symbol]["static"];
         expectTypeOf<Inferred2>().toEqualTypeOf<{
            name?: string;
            age: number;
            [key: string]: unknown;
         }>();
         type Inferred = Static<typeof schema>;
         expectTypeOf<Inferred>().toEqualTypeOf<{
            name?: string;
            age: number;
            [key: string]: unknown;
         }>();
         type Coerced2 = (typeof schema)[typeof symbol]["coerced"];
         expectTypeOf<Coerced2>().toEqualTypeOf<{
            name?: "what";
            age: number;
            [key: string]: unknown;
         }>();
         type Coerced = StaticCoerced<typeof schema>;
         expectTypeOf<Coerced>().toEqualTypeOf<{
            name?: "what";
            age: number;
            [key: string]: unknown;
         }>();
      }

      {
         // partial with coerce
         const schema = object({
            name: string({ coerce: (v) => v as string }),
            age: number(),
         }).partial();
         type Inferred = Static<typeof schema>;
         expectTypeOf<Inferred>().toEqualTypeOf<{
            name?: string;
            age?: number;
            [key: string]: unknown;
         }>();
         type Coerced2 = (typeof schema)[typeof symbol]["coerced"];
         expectTypeOf<Coerced2>().toEqualTypeOf<{
            name?: string;
            age?: number;
            [key: string]: unknown;
         }>();
         type Coerced = StaticCoerced<typeof schema>;
         expectTypeOf<Coerced>().toEqualTypeOf<{
            name?: string;
            age?: number;
            [key: string]: unknown;
         }>();
      }

      {
         // partial object with strict
         const schema = object({
            name: string(),
            age: number(),
         })
            .partial()
            .strict();
         type Inferred = Static<typeof schema>;
         expectTypeOf<Inferred>().toEqualTypeOf<{
            name?: string;
            age?: number;
         }>();
         assertJson(schema, {
            type: "object",
            properties: {
               name: { type: "string" },
               age: { type: "number" },
            },
            additionalProperties: false,
         });
      }

      {
         // partial object with optional props
         const schema = object({
            name: string(),
            // expect this to be non-influential
            age: number().optional(),
         }).partial();

         type Inferred = Static<typeof schema>;
         expectTypeOf<Inferred>().toEqualTypeOf<{
            name?: string;
            age?: number;
            [key: string]: unknown;
         }>();
         assertJson(schema, {
            type: "object",
            properties: {
               name: { type: "string" },
               age: { type: "number" },
            },
         });
      }
   });

   test("objects of objects", () => {
      const schema = object({
         name: string(),
         age: number(),
         address: object({
            street: string(),
            city: string(),
         }),
      });
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{
         [key: string]: unknown;
         name: string;
         age: number;
         address: { [key: string]: unknown; street: string; city: string };
      }>();

      assertJson(schema, {
         type: "object",
         properties: {
            name: { type: "string" },
            age: { type: "number" },
            address: {
               type: "object",
               properties: {
                  street: { type: "string" },
                  city: { type: "string" },
               },
               required: ["street", "city"],
            },
         },
         required: ["name", "age", "address"],
      });
   });

   test("with optional", () => {
      const schema = object({
         name: string(),
         age: number().optional(),
      });
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{
         name: string;
         age?: number;
         [key: string]: unknown;
      }>();

      assertJson(schema, {
         type: "object",
         properties: {
            name: { type: "string" },
            age: { type: "number" },
         },
         required: ["name"],
      });
   });

   test("merging", () => {
      const schema1 = object({ string: string() });
      const schema2 = object({ number: number().optional() });

      // expect properties to be accessible
      expect(schema1.properties.string.type).toEqual("string");

      const merged = object({
         ...schema1.properties,
         ...schema2.properties,
      });

      expect(Object.keys(merged.properties)).toEqual(["string", "number"]);
      assertJson(merged, {
         type: "object",
         properties: {
            string: { type: "string" },
            number: { type: "number" },
         },
         required: ["string"],
      });
   });

   describe("validate", () => {
      test("base", () => {
         const schema = object({});
         expect(schema.validate({}).valid).toBe(true);
         expect(schema.validate(1).errors[0]?.error).toEqual("Expected object");
      });

      test("properties", () => {
         const schema = object({
            name: string(),
            age: number(),
         });
         expect(schema.validate({ name: "John", age: 30 }).valid).toBe(true);
         expect(schema.validate({ name: "John" }).errors[0]?.error).toEqual(
            "Expected object with required properties name, age"
         );
         expect(
            schema.validate({ name: "John", age: "30" }).errors[0]?.error
         ).toEqual("Expected number");
         expect(schema.validate({}).errors[0]?.error).toEqual(
            "Expected object with required properties name, age"
         );

         {
            // patternProperties ignores additionalProperties
            const result = object(
               { a: number() },
               {
                  patternProperties: { "^b": string() },
               }
            )
               .strict()
               .validate({ a: 11, b: "2" });
            expect(result.valid).toBe(true);
         }

         {
            // an additional invalid property is invalid
            const schema = object(
               {
                  foo: any(),
                  bar: any(),
               },
               {
                  additionalProperties: boolean(),
               }
            );
            const result = schema.validate({
               foo: 1,
               bar: 2,
               quux: 12,
            });
            expect(result.valid).toBe(false);
            expect(result.errors[0]?.error).toEqual("Expected boolean");
         }
      });

      test("with optional prop as undefined", () => {
         const schema = object({
            name: string(),
            type: string().optional(),
         });
         expect(schema.validate({ name: "John" }).valid).toBe(true);
         expect(schema.validate({ name: "John", type: undefined }).valid).toBe(
            true
         );
      });

      /* test("template", () => {
         const schema = object({
            name: string(),
            surname: string({ default: "Doe" }).optional(),
         }).strict();
         expect(schema.template()).toEqual({ name: "" });
         expect(schema.template({}, { withOptional: true })).toEqual({
            name: "",
            surname: "",
         });

         type Defaults = ObjectDefaults<(typeof schema)["properties"]>;
         //   ^?

         const schema2 = partialObject({
            name: string(),
            surname: string({ default: "Doe" }),
         });
         type Defaults2 = ObjectDefaults<(typeof schema2)["properties"]>;
         //   ^?

         // object in object
         {
            const schema = object({
               nested: object({
                  name: string().optional(),
               }).optional(),
            });
            expect(schema.template({}, { withOptional: true })).toEqual({
               nested: {
                  name: "",
               },
            });
         }
      }); */
   });

   test("typing", () => {
      const schema = object({
         url: string({
            pattern: "^https?://",
            coerce: () => "what" as const,
         }),
         force: boolean({ coerce: () => true as const }).optional(),
      });
      type HelperStatic<S extends Schema> = Static<S>;
      type HelperCoerced<S extends Schema> = StaticCoerced<S>;
      type Out = HelperStatic<typeof schema>;
      //   ^?
      expectTypeOf<Out>().toEqualTypeOf<{
         url: string;
         force?: boolean;
         [key: string]: unknown;
      }>();
      type OutCoerced = HelperCoerced<typeof schema>;
      //   ^?
      expectTypeOf<OutCoerced>().toEqualTypeOf<{
         url: "what";
         force?: true;
         [key: string]: unknown;
      }>();
   });

   test("coerce", () => {
      const schema = object({
         name: string(),
         age: number(),
      });
      expect(schema.coerce("{}")).toEqual({} as any);
      expect(schema.coerce('{"name": "John", "age": "30"}')).toEqual({
         name: "John",
         age: 30,
      });
      expect(schema.coerce({ name: "John", age: "30" })).toEqual({
         name: "John",
         age: 30,
      });

      {
         const s = string({ coerce: () => "asdf" as const });
         const schema = object({
            name: s,
         });
         type StringCoerced = StaticCoerced<typeof s>;
         expectTypeOf<StringCoerced>().toEqualTypeOf<"asdf">();
         type Coerced = StaticCoerced<typeof schema>;
         expectTypeOf<Coerced>().toEqualTypeOf<{
            name: "asdf";
            [key: string]: unknown;
         }>();
      }

      {
         const a = array(
            string({
               pattern: "/^https?:///",
               coerce: () => "asdf" as const,
            })
         );
         type Coerced = StaticCoerced<typeof a>;
         expectTypeOf<Coerced>().toEqualTypeOf<"asdf"[]>();
      }

      {
         const s = object({
            url: string({
               pattern: "/^https?:///",
               coerce: (value) => "asdf" as const,
            }),
            force: boolean().optional(),
         });
         type Inferred = Static<typeof s>;
         expectTypeOf<Inferred>().toEqualTypeOf<{
            url: string;
            force?: boolean;
            [key: string]: unknown;
         }>();
         type Coerced = StaticCoerced<typeof s>;
         expectTypeOf<Coerced>().toEqualTypeOf<{
            url: "asdf";
            force?: boolean;
            [key: string]: unknown;
         }>();
      }
   });

   test("coerce drop unknown", () => {
      const schema = object({
         name: string(),
         age: number(),
      });
      expect(
         schema.coerce(
            { name: "John", age: 30, unknown: "what" },
            { dropUnknown: true }
         )
      ).toEqual({
         name: "John",
         age: 30,
      });
   });

   test("template", () => {
      const schema = object({
         obj: object({
            name: string(),
         }),
      });

      expect(schema.template({ obj: { name: "what" } })).toEqual({
         obj: { name: "what" },
      });

      {
         // precedence is
         // 1. const
         // 2. template initial
         // 3. parent default
         // 4. child default
         const schema = object({
            obj: object(
               {
                  name: string({ default: "child" }),
               },
               {
                  default: { name: "parent" },
               }
            ),
         });
         expect(schema.template({ obj: { name: "initial" } })).toEqual({
            obj: { name: "initial" },
         });
         expect(schema.template()).toEqual({ obj: { name: "parent" } });

         const schema2 = object({
            obj: object({
               name: string({ default: "child" }),
            }),
         });
         expect(schema2.template({ obj: { name: "initial" } })).toEqual({
            obj: { name: "initial" },
         });
         expect(schema2.template()).toEqual({ obj: { name: "child" } });
      }
   });

   test("walk", () => {
      const schema = object(
         {
            name: string(),
            tags: array(string()),
            type: string().optional(),
         },
         {
            propertyNames: string(),
         }
      );

      expect(
         [...schema.walk()].map((n) => ({
            ...n,
            schema: n.schema.constructor.name,
         }))
      ).toEqual([
         {
            schema: "ObjectSchema",
            instancePath: [],
            keywordPath: [],
            depth: 0,
            data: undefined,
         },
         {
            schema: "StringSchema",
            instancePath: ["name"],
            keywordPath: ["properties", "name"],
            depth: 1,
            data: undefined,
         },
         {
            schema: "ArraySchema",
            instancePath: ["tags"],
            keywordPath: ["properties", "tags"],
            depth: 1,
            data: undefined,
         },
         {
            schema: "StringSchema",
            instancePath: ["tags"],
            keywordPath: ["properties", "tags", "items"],
            depth: 1,
            data: undefined,
         },
         {
            schema: "StringSchema",
            instancePath: ["type"],
            keywordPath: ["properties", "type"],
            depth: 1,
            data: undefined,
         },
      ]);

      expect(
         [
            ...schema.walk({
               data: { name: "john", tags: ["a", "b"], type: "what" },
            }),
         ].map((n) => ({
            ...n,
            schema: n.schema.constructor.name,
         }))
      ).toEqual([
         {
            schema: "ObjectSchema",
            instancePath: [],
            keywordPath: [],
            data: { name: "john", tags: ["a", "b"], type: "what" },
            depth: 0,
         },
         {
            schema: "StringSchema",
            instancePath: ["name"],
            keywordPath: ["properties", "name"],
            data: "john",
            depth: 1,
         },
         {
            schema: "ArraySchema",
            instancePath: ["tags"],
            keywordPath: ["properties", "tags"],
            data: ["a", "b"],
            depth: 1,
         },
         {
            schema: "StringSchema",
            instancePath: ["tags"],
            keywordPath: ["properties", "tags", "items"],
            data: undefined,
            depth: 1,
         },
         {
            schema: "StringSchema",
            instancePath: ["type"],
            keywordPath: ["properties", "type"],
            data: "what",
            depth: 1,
         },
      ]);
   });
});
