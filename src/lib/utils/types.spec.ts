import { describe, expect, test } from "bun:test";
import { toTypes, schemaToTypes, toDefinition } from "./types";
import * as s from "../";

describe("types", () => {
   describe("schemaToTypes", () => {
      test("should handle primitive types", () => {
         expect(schemaToTypes(s.string())).toBe("string");
         expect(schemaToTypes(s.number())).toBe("number");
         expect(schemaToTypes(s.boolean())).toBe("boolean");
         expect(schemaToTypes(s.any())).toBe("unknown");
      });

      test("should handle literal values", () => {
         expect(schemaToTypes(s.literal("user"))).toBe('"user"');
         expect(schemaToTypes(s.literal(42))).toBe("42");
         expect(schemaToTypes(s.literal(true))).toBe("true");
         expect(schemaToTypes(s.literal(false))).toBe("false");
         expect(schemaToTypes(s.literal(null))).toBe("null");
      });

      test("should handle boolean schemas", () => {
         expect(schemaToTypes(s.booleanSchema(true))).toBe("any");
         expect(schemaToTypes(s.booleanSchema(false))).toBe("never");
      });

      test("should handle enum values", () => {
         expect(schemaToTypes(s.string({ enum: ["active", "inactive"] }))).toBe(
            '"active" | "inactive"'
         );
         expect(schemaToTypes(s.number({ enum: [1, 2, 3] }))).toBe("1 | 2 | 3");
      });

      test("should handle arrays", () => {
         expect(schemaToTypes(s.array(s.string()))).toBe("string[]");
         expect(schemaToTypes(s.array(s.number()))).toBe("number[]");
         expect(schemaToTypes(s.array(s.literal("test")))).toBe('"test"[]');
      });

      test("should handle simple objects", () => {
         const result = schemaToTypes(
            s.object({
               name: s.string(),
               age: s.number().optional(),
            })
         );

         expect(result).toBe(`{
  name: string,
  age?: number
}`);
      });

      test("should handle nested objects", () => {
         const result = schemaToTypes(
            s.object({
               user: s.object({
                  name: s.string(),
                  age: s.number().optional(),
               }),
            })
         );

         expect(result).toBe(`{
  user: {
    name: string,
    age?: number
  }
}`);
      });

      test("should handle arrays of objects", () => {
         const result = schemaToTypes(s.array(s.object({ name: s.string() })));
         expect(result).toBe(`{
  name: string
}[]`);
      });

      test("should handle union types", () => {
         expect(schemaToTypes(s.anyOf([s.string(), s.number()]))).toBe(
            "string | number"
         );
         expect(
            schemaToTypes(s.anyOf([s.literal("active"), s.literal("inactive")]))
         ).toBe('"active" | "inactive"');
         expect(
            schemaToTypes(s.anyOf([s.literal(1), s.literal(2), s.literal(3)]))
         ).toBe("1 | 2 | 3");
      });

      test("should handle complex nested structures", () => {
         const result = schemaToTypes(
            s.object({
               name: s.string(),
               type: s.literal("user"),
               numbers: s.anyOf([s.literal(1), s.literal(2), s.literal(3)]),
               alwaysTrue: s.literal(true),
               acceptAny: s.booleanSchema(true),
               acceptNever: s.booleanSchema(false),
               age: s.number().optional(),
               nested: s.object({
                  name: s.string(),
                  age: s.number().optional(),
               }),
               tags: s.array(s.string()),
               isActive: s.boolean(),
               status: s.anyOf([s.literal("active"), s.literal("inactive")]),
               status2: s.string({ enum: ["active", "inactive"] }),
            })
         );

         expect(result).toBe(`{
  name: string,
  type: "user",
  numbers: 1 | 2 | 3,
  alwaysTrue: true,
  acceptAny: any,
  acceptNever: never,
  age?: number,
  nested: {
    name: string,
    age?: number
  },
  tags: string[],
  isActive: boolean,
  status: "active" | "inactive",
  status2: "active" | "inactive"
}`);
      });

      test("should handle custom fallback", () => {
         expect(schemaToTypes(s.any(), { fallback: "any" })).toBe("any");
         expect(schemaToTypes(s.any(), { fallback: "custom" })).toBe("custom");
      });

      test("should handle custom indentation", () => {
         const result = schemaToTypes(
            s.object({
               name: s.string(),
               age: s.number(),
            }),
            { indent: "    " }
         );

         expect(result).toBe(`{
    name: string,
    age: number
}`);
      });

      test("should handle empty objects", () => {
         const result = schemaToTypes(s.object({}));
         expect(result).toBe(`{}`);
      });

      test("should return empty string for non-schema input", () => {
         expect(schemaToTypes(null as any)).toBe("unknown");
         expect(schemaToTypes(undefined as any)).toBe("unknown");
         expect(schemaToTypes("not a schema" as any)).toBe("unknown");
      });

      test("should handle complex schema", () => {
         const schema = s.fromSchema({
            type: "object",
            required: ["entity"],
            properties: {
               user: {
                  type: "object",
                  properties: {
                     id: { type: "number", $field: "primary" },
                     email: { type: "string", $field: "text" },
                     role: {
                        type: "string",
                        $field: "enum",
                        enum: ["guest", "admin", "member"],
                     },
                  },
               },
               entity: { type: "string" },
               id: { anyOf: [{ type: "number" }, { type: "string" }] },
            },
         });
         expect(schemaToTypes(schema)).toBe(`{
  user?: {
    id?: number,
    email?: string,
    role?: "guest" | "admin" | "member"
  },
  entity: string,
  id?: number | string
}`);
      });
   });

   describe("toTypes", () => {
      test("should generate type declarations", () => {
         const result = toTypes(s.string(), "MyString");
         expect(result).toBe("type MyString = string");
      });

      test("should generate interface declarations", () => {
         const result = toTypes(s.string(), "MyString", { type: "interface" });
         expect(result).toBe("interface MyString string");
      });

      test("should generate complex type declarations", () => {
         const result = toTypes(
            s.object({
               name: s.string(),
               type: s.literal("user"),
               age: s.number().optional(),
               nested: s.object({
                  name: s.string(),
                  age: s.number().optional(),
               }),
               tags: s.array(s.string()),
               isActive: s.boolean(),
               status: s.anyOf([s.literal("active"), s.literal("inactive")]),
               status2: s.string({ enum: ["active", "inactive"] }),
               unknown: s.any(),
            }),
            "MyType",
            { fallback: "any" }
         );

         expect(result).toBe(`type MyType = {
  name: string,
  type: "user",
  age?: number,
  nested: {
    name: string,
    age?: number
  },
  tags: string[],
  isActive: boolean,
  status: "active" | "inactive",
  status2: "active" | "inactive",
  unknown: any
}`);
      });

      test("should pass through options to schemaToTypes", () => {
         const result = toTypes(
            s.object({
               name: s.string(),
               age: s.number(),
            }),
            "User",
            { indent: "    " }
         );

         expect(result).toBe(`type User = {
    name: string,
    age: number
}`);
      });

      test("should handle interface type with objects", () => {
         const result = toTypes(
            s.object({
               name: s.string(),
               age: s.number(),
            }),
            "User",
            { type: "interface" }
         );

         expect(result).toBe(`interface User {
  name: string,
  age: number
}`);
      });

      test("should generate records", () => {
         const schema = s.object({
            data: s.object({
               entities: s.record(
                  s.object({
                     name: s.string(),
                     config: s.object({
                        label: s.string(),
                     }),
                  })
               ),
            }),
         });

         expect(toTypes(schema, "Schema")).toBe(`type Schema = {
  data: {
    entities: Record<string, {
      name: string,
      config: {
        label: string
      }
    }>
  }
}`);
      });

      test("extract title", () => {
         expect(toTypes(s.string())).toBe("type Schema = string");
         expect(toTypes(s.string(), "CustomName")).toBe(
            "type CustomName = string"
         );
         expect(toTypes(s.string({ title: "CustomTitle" }), "CustomName")).toBe(
            "type CustomName = string"
         );
      });
   });

   describe("toDefinition", () => {
      test("should generate definition", () => {
         const entity = s.object(
            {
               name: s.string(),
               config: s.object({
                  label: s.string(),
               }),
            },
            { title: "Data Entity" }
         );
         const entities = s.record(entity, { description: "The entities" });

         const data = s.object(
            {
               entities,
            },
            { title: "Data" }
         );

         const schema = s.object(
            {
               data,
            },
            { title: "Schema", description: "The schema" }
         );

         expect(toDefinition(schema, undefined, { export: true }))
            .toBe(`export type DataEntity = {
  name: string,
  config: {
    label: string
  }
}

export type Data = {
  /**
   * The entities
   */
  entities: Record<string, DataEntity>
}

/**
 * The schema
 */
export type Schema = {
  data: Data
}`);
      });
   });
});
