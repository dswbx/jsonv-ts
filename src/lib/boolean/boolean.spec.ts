import { expectTypeOf } from "expect-type";
import { $kind, type Static, type TSchema } from "../base";
import { boolean } from "./boolean";
import { assertJson } from "../assert";
import { describe, expect, test } from "bun:test";

describe("number", () => {
   test("basic", () => {
      const schema = boolean();
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<boolean>();

      expect<any>(boolean()[$kind]).toEqual("boolean");
      assertJson(boolean(), { type: "boolean" });
   });

   test("with const", () => {
      const schema = boolean({ const: true });
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<true>();

      assertJson(boolean({ const: true }), {
         type: "boolean",
         const: true,
      });
   });

   // weird but allowed
   test("with enum", () => {
      const schema = boolean({ enum: [true, false] });
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<true | false>();

      assertJson(boolean({ enum: [true, false] }), {
         type: "boolean",
         enum: [true, false],
      });
   });

   test("boolean schema", () => {
      assertJson(boolean({ const: true }), {
         type: "boolean",
         const: true,
      });
      assertJson(boolean({ const: false }), {
         type: "boolean",
         const: false,
      });
   });

   test("template", () => {
      expect(boolean({ default: true }).template()).toEqual(true);
      expect(boolean({ default: false }).template()).toEqual(false);
   });
});
