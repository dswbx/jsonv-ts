import { describe, expect, test } from "bun:test";
import { any, literal, type TLiteral } from "./misc";
import { expectTypeOf } from "expect-type";
import type { Static, StaticCoerced } from "../static";
import { $kind } from "../symbols";
import { assertJson } from "../assert";
import { object } from "../object/object";
import type { TCustomType } from ".";
import { string } from "../string/string";
import { array } from "../array/array";

describe("any", () => {
   test("base", () => {
      const schema = any();
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<any>();
      type Coerced = StaticCoerced<typeof schema>;
      expectTypeOf<Coerced>().toEqualTypeOf<any>();

      expect<any>(schema[$kind]).toEqual("any");

      assertJson(schema, {});
   });

   test("optional in object", () => {
      const schema = object({
         name: any().optional(),
      });
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{
         name?: any;
         [key: string]: unknown;
      }>();
      type Coerced = StaticCoerced<typeof schema>;
      expectTypeOf<Coerced>().toEqualTypeOf<{ name?: any }>();

      assertJson(schema, {
         type: "object",
         properties: {
            name: {},
         },
      });
   });
});

describe("literal", () => {
   test("base", () => {
      const schema = literal(1);
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<1>();
      type Coerced = StaticCoerced<typeof schema>;
      expectTypeOf<Coerced>().toEqualTypeOf<1>();
      assertJson(schema, { const: 1 });
   });

   test("primitives", () => {
      const o = literal({ name: "hello" });
      expectTypeOf<Static<typeof o>>().toEqualTypeOf<{
         readonly name: "hello";
      }>();
      const n = literal(null);
      expectTypeOf<Static<typeof n>>().toEqualTypeOf<null>();
      const u = literal(undefined);
      expectTypeOf<Static<typeof u>>().toEqualTypeOf<undefined>();
      const bt = literal(true);
      expectTypeOf<Static<typeof bt>>().toEqualTypeOf<true>();
      const bf = literal(false);
      expectTypeOf<Static<typeof bf>>().toEqualTypeOf<false>();
      const s = literal("hello");
      expectTypeOf<Static<typeof s>>().toEqualTypeOf<"hello">();
      const a = literal([1, "2", true]);
      expectTypeOf<Static<typeof a>>().toEqualTypeOf<readonly [1, "2", true]>();
   });

   test("with props", () => {
      // @ts-expect-error const should not be reused
      literal(1, { const: 1 });

      const schema = literal(1, {
         title: "number",
      });
      type Props<T> = T extends TLiteral<infer A, infer P extends TCustomType>
         ? P
         : never;
      type SchemaProps = Props<typeof schema>;
      expectTypeOf<SchemaProps>().toEqualTypeOf<{ readonly title: "number" }>();
      type Inferred = Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<1>();
      type Coerced = StaticCoerced<typeof schema>;
      expectTypeOf<Coerced>().toEqualTypeOf<1>();

      assertJson(schema, { const: 1, title: "number" });
   });

   test("prevent exotic", () => {
      // @ts-expect-error only primitives allowed
      literal(object({ name: string() }));
      // @ts-expect-error only primitives allowed
      literal(array(string()));
   });
});
