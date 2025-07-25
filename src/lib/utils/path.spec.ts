import { test, describe, expect } from "bun:test";
import { fromJsonPointer, getJsonPath, getPath } from "./path";
import { toJsonPointer } from "./path";
import { number, object } from "..";

describe("path", () => {
   test("toJsonPointer", () => {
      expect(toJsonPointer(["a", "b", "c"])).toBe("/a/b/c");
      expect(toJsonPointer(["a", "b", "c"], "prefix")).toBe("/prefix/a/b/c");
   });

   test("fromJsonPointer", () => {
      expect(fromJsonPointer("/a/b/c")).toEqual(["a", "b", "c"]);
      expect(fromJsonPointer("/prefix/a/b/c")).toEqual([
         "prefix",
         "a",
         "b",
         "c",
      ]);
      expect(fromJsonPointer("#/a/b/c/1")).toEqual(["a", "b", "c", "1"]);
      expect(fromJsonPointer("#")).toEqual([]);
   });

   test("getPath", () => {
      expect(getPath({ a: { b: { c: 1 } } }, "a.b.c")).toBe(1);
      expect(getPath({ a: { b: { c: 1 } } }, "a.b.d")).toBe(undefined);

      /* console.log(
         "..",
         getPath(
            object({
               a: object({
                  b: object({
                     c: number(),
                  }),
               }),
            }),
            "properties.a.properties.b.properties.c"
         )
      ); */
   });

   test("getJsonPath", () => {
      expect(getJsonPath({ a: { b: { c: 1 } } }, "/a/b/c")).toBe(1);
      expect(getJsonPath({ a: { b: { c: 1 } } }, "/a/b/d")).toBe(undefined);
      expect(getJsonPath({ a: { b: { c: [1, 0] } } }, "/a/b/c/1")).toBe(0);
      expect(getJsonPath({ a: { b: 0 } }, "#")).toEqual({ a: { b: 0 } });
   });
});
