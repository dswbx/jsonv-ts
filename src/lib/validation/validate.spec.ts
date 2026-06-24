import { describe, expect, test } from "bun:test";
import * as s from "../";
import { booleanSchema } from "../schema";
import { fromSchema } from "../";
import { Resolver } from "./resolver";

describe("validate", () => {
   test("error count", () => {
      const result = s.string({ minLength: 10, pattern: "/a/" }).validate("b");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]?.keywordLocation).toBe("/minLength");
      expect(result.errors[1]?.keywordLocation).toBe("/pattern");

      // console.log(s.string().validate(1));
   });

   test("boolean schema", () => {
      const falsy = booleanSchema(false).validate(undefined);
      expect(falsy.valid).toBe(false);
      expect(falsy.errors.length).toBe(1);
      expect(falsy.errors[0]?.error).toBe("Always fails");

      const truthy = booleanSchema(true).validate(undefined);
      expect(truthy.valid).toBe(true);
      expect(truthy.errors.length).toBe(0);
   });

   test("multiple vs single errors", () => {
      const result = s
         .string({ minLength: 10, pattern: "^[0-9]+$" })
         .validate("what");

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]?.keywordLocation).toBe("/minLength");
      expect(result.errors[1]?.keywordLocation).toBe("/pattern");

      {
         const result = s
            .string({ minLength: 10, pattern: "^[0-9]+$" })
            .validate("what", {
               shortCircuit: true,
            });
         expect(result.valid).toBe(false);
         expect(result.errors.length).toBe(1);
         expect(result.errors[0]?.keywordLocation).toBe("/minLength");
      }
   });

   test("multiple types", () => {
      const multi = fromSchema({ type: ["string", "number"] });
      expect(multi.validate("hello").valid).toBe(true);
      expect(multi.validate(1).valid).toBe(true);
      expect(multi.validate(true).errors[0]?.keywordLocation).toBe("/type");
   });

   test("$defs is a schema container, not an assertion", () => {
      const schema = fromSchema({
         type: "number",
         $defs: {
            string: { type: "string" },
         },
      });

      expect(schema.validate(1).valid).toBe(true);
      expect(schema.validate("1").valid).toBe(false);
   });

   test("$ref validates alongside sibling keywords", () => {
      const schema = fromSchema({
         $ref: "#/$defs/stringArray",
         maxItems: 2,
         $defs: {
            stringArray: {
               type: "array",
               items: { type: "string" },
            },
         },
      });

      expect(schema.validate(["a", "b"]).valid).toBe(true);
      expect(schema.validate(["a", "b", "c"]).valid).toBe(false);
      expect(schema.validate(["a", 1]).valid).toBe(false);
   });

   test("$id resolves refs against the nearest resource", () => {
      const schema = fromSchema({
         $id: "http://example.com/root.json",
         $defs: {
            parent: {
               $id: "folder/parent.json",
               $defs: {
                  child: { type: "integer" },
               },
               properties: {
                  value: { $ref: "parent.json#/$defs/child" },
               },
            },
         },
         $ref: "folder/parent.json",
      });

      expect(schema.validate({ value: 1 }).valid).toBe(true);
      expect(schema.validate({ value: "1" }).valid).toBe(false);
   });

   test("$anchor resolves within the current base URI", () => {
      const schema = fromSchema({
         $id: "http://example.com/root.json",
         $defs: {
            int: {
               $anchor: "target",
               type: "integer",
            },
         },
         $ref: "#target",
      });

      expect(schema.validate(1).valid).toBe(true);
      expect(schema.validate("1").valid).toBe(false);
   });

   test("remote refs resolve from the registered resolver registry", () => {
      Resolver.clearRemotes();
      Resolver.registerRemote(
         "http://localhost:1234/remote/integer.json",
         fromSchema({
            $id: "http://localhost:1234/remote/integer.json",
            type: "integer",
         })
      );

      const schema = fromSchema({
         $ref: "http://localhost:1234/remote/integer.json",
      });

      expect(schema.validate(1).valid).toBe(true);
      expect(schema.validate("1").valid).toBe(false);
      Resolver.clearRemotes();
   });

   test("ref", () => {
      const schema = s.object({
         foo: s.refId("#").optional(),
      });

      expect(
         schema.validate(
            { foo: { foo: {} } },
            {
               ignoreUnsupported: true,
            }
         ).valid
      ).toBe(true);
      expect(schema.toJSON()).toEqual({
         type: "object",
         properties: {
            foo: { $ref: "#" },
         },
      });
   });
});
