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

   test("$dynamicRef resolves to the active dynamic anchor through $ref", () => {
      const schema = fromSchema({
         $id: "https://test.json-schema.org/typical-dynamic-resolution/root",
         $ref: "list",
         $defs: {
            foo: { $dynamicAnchor: "items", type: "string" },
            list: {
               $id: "list",
               type: "array",
               items: { $dynamicRef: "#items" },
               $defs: {
                  items: {
                     $dynamicAnchor: "items",
                  },
               },
            },
         },
      });

      expect(schema.validate(["a", "b"]).valid).toBe(true);
      expect(schema.validate(["a", 1]).valid).toBe(false);
   });

   test("$dynamicRef ignores intermediate scopes without matching anchors", () => {
      const schema = fromSchema({
         $id: "https://test.json-schema.org/dynamic-resolution-with-intermediate-scopes/root",
         $ref: "intermediate-scope",
         $defs: {
            foo: { $dynamicAnchor: "items", type: "string" },
            "intermediate-scope": {
               $id: "intermediate-scope",
               $ref: "list",
            },
            list: {
               $id: "list",
               type: "array",
               items: { $dynamicRef: "#items" },
               $defs: {
                  items: {
                     $dynamicAnchor: "items",
                  },
               },
            },
         },
      });

      expect(schema.validate(["a"]).valid).toBe(true);
      expect(schema.validate([1]).valid).toBe(false);
   });

   test("$dynamicRef does not use plain $anchor for dynamic scope", () => {
      const schema = fromSchema({
         $id: "https://test.json-schema.org/dynamic-resolution-ignores-anchors/root",
         $ref: "list",
         $defs: {
            foo: { $anchor: "items", type: "string" },
            list: {
               $id: "list",
               type: "array",
               items: { $dynamicRef: "#items" },
               $defs: {
                  items: {
                     $dynamicAnchor: "items",
                  },
               },
            },
         },
      });

      expect(schema.validate(["a", 1, null]).valid).toBe(true);
   });

   test("$dynamicRef does not keep dynamic anchors from inactive branches", () => {
      const schema = fromSchema({
         $id: "https://test.json-schema.org/dynamic-ref-leaving-dynamic-scope/main",
         if: {
            $id: "first_scope",
            $defs: {
               thingy: {
                  $dynamicAnchor: "thingy",
                  type: "number",
               },
            },
         },
         then: {
            $id: "second_scope",
            $ref: "start",
            $defs: {
               thingy: {
                  $dynamicAnchor: "thingy",
                  type: "null",
               },
            },
         },
         $defs: {
            start: {
               $id: "start",
               $dynamicRef: "inner_scope#thingy",
            },
            thingy: {
               $id: "inner_scope",
               $dynamicAnchor: "thingy",
               type: "string",
            },
         },
      });

      expect(schema.validate("a string").valid).toBe(false);
      expect(schema.validate(42).valid).toBe(false);
      expect(schema.validate(null).valid).toBe(true);
   });

   test("$dynamicRef resolves through a remote schema using the caller dynamic anchor", () => {
      Resolver.clearRemotes();
      Resolver.registerRemote(
         "http://localhost:1234/draft2020-12/extendible-dynamic-ref.json",
         fromSchema({
            $id: "http://localhost:1234/draft2020-12/extendible-dynamic-ref.json",
            type: "object",
            properties: {
               elements: {
                  type: "array",
                  items: { $dynamicRef: "#elements" },
               },
            },
            required: ["elements"],
            additionalProperties: false,
            $defs: {
               elements: { $dynamicAnchor: "elements" },
            },
         })
      );

      const schema = fromSchema({
         $id: "http://localhost:1234/draft2020-12/strict-extendible.json",
         $ref: "extendible-dynamic-ref.json",
         $defs: {
            elements: {
               $dynamicAnchor: "elements",
               properties: { a: true },
               required: ["a"],
               additionalProperties: false,
            },
         },
      });

      expect(schema.validate({ elements: [{ a: 1 }] }).valid).toBe(true);
      expect(schema.validate({ elements: [{ b: 1 }] }).valid).toBe(false);
      Resolver.clearRemotes();
   });

   test("$ref resolves pointer fragments across embedded resource boundaries", () => {
      const schema = fromSchema({
         $id: "https://test.json-schema.org/dynamic-ref-skips-intermediate-resource/optional/main",
         type: "object",
         properties: {
            "bar-item": { $ref: "bar#/$defs/item" },
         },
         $defs: {
            bar: {
               $id: "bar",
               type: "array",
               items: { $ref: "item" },
               $defs: {
                  item: {
                     $id: "item",
                     type: "object",
                     properties: {
                        content: { $dynamicRef: "#content" },
                     },
                     $defs: {
                        defaultContent: {
                           $dynamicAnchor: "content",
                           type: "integer",
                        },
                     },
                  },
                  content: {
                     $dynamicAnchor: "content",
                     type: "string",
                  },
               },
            },
         },
      });

      expect(schema.validate({ "bar-item": { content: 1 } }).valid).toBe(true);
      expect(schema.validate({ "bar-item": { content: "x" } }).valid).toBe(
         false
      );
   });

   test("$ref can target schema-shaped unknown keyword values", () => {
      const schema = fromSchema({
         "unknown-keyword": {
            type: "integer",
         },
         properties: {
            value: {
               $ref: "#/unknown-keyword",
            },
         },
      });

      expect(schema.validate({ value: 1 }).valid).toBe(true);
      expect(schema.validate({ value: "1" }).valid).toBe(false);
   });

   test("$ref resolves JSON Pointer fragments through $defs", () => {
      const schema = fromSchema({
         $ref: "#/$defs/R",
         $defs: {
            R: { type: "string" },
         },
      });

      expect(schema.validate("x").valid).toBe(true);
      expect(schema.validate(1).valid).toBe(false);
   });

   test("$ref resolves JSON Pointer fragments through components/schemas", () => {
      const schema = fromSchema({
         $ref: "#/components/schemas/R",
         components: {
            schemas: {
               R: { type: "string" },
            },
         },
      });

      expect(schema.validate("x").valid).toBe(true);
      expect(schema.validate(1).valid).toBe(false);
   });

   test("$ref resolves arbitrary JSON Pointer targets", () => {
      const emptyTarget = fromSchema({
         properties: {
            value: { $ref: "#/components/schemas/Anything" },
         },
         components: {
            schemas: {
               Anything: {},
            },
         },
      });

      const booleanTarget = fromSchema({
         properties: {
            value: { $ref: "#/vendor/schemas/Never" },
         },
         vendor: {
            schemas: {
               Never: false,
            },
         },
      });

      expect(emptyTarget.validate({ value: "x" }).valid).toBe(true);
      expect(emptyTarget.validate({ value: 1 }).valid).toBe(true);
      expect(booleanTarget.validate({ value: "x" }).valid).toBe(false);
   });

   test("$ref resolves nested components/schemas refs from lazy targets", () => {
      const schema = fromSchema({
         $ref: "#/components/schemas/Wrapper",
         components: {
            schemas: {
               Wrapper: {
                  type: "object",
                  properties: {
                     value: { $ref: "#/components/schemas/Value" },
                  },
                  required: ["value"],
               },
               Value: { type: "integer" },
            },
         },
      });

      expect(schema.validate({ value: 1 }).valid).toBe(true);
      expect(schema.validate({ value: "1" }).valid).toBe(false);
   });

   test("unevaluatedProperties sees allOf annotations but not cousin annotations", () => {
      const schema = fromSchema({
         allOf: [
            {
               properties: {
                  foo: true,
               },
            },
         ],
         unevaluatedProperties: false,
      });

      expect(schema.validate({ foo: 1 }).valid).toBe(true);
      expect(schema.validate({ foo: 1, bar: 2 }).valid).toBe(false);

      const cousin = fromSchema({
         allOf: [
            {
               properties: {
                  foo: true,
               },
            },
            {
               unevaluatedProperties: false,
            },
         ],
      });

      expect(cousin.validate({ foo: 1 }).valid).toBe(false);
   });

   test("legacy dependencies validates required and schema dependencies", () => {
      const schema = fromSchema({
         dependencies: {
            bar: ["foo"],
            baz: {
               properties: {
                  baz: { type: "integer" },
               },
            },
         },
      });

      expect(schema.validate({ foo: 1, bar: 2, baz: 3 }).valid).toBe(true);
      expect(schema.validate({ bar: 2 }).valid).toBe(false);
      expect(schema.validate({ baz: "3" }).valid).toBe(false);
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
