import { test, expect, describe } from "bun:test";
import {
   format as $format,
   getFormats,
   getFormatAssertionDefault,
   registerFormat,
   setFormatAssertionDefault,
   unregisterFormat,
} from "./format";

const format = (format: string, value: string) => {
   // @ts-ignore
   return $format({ format }, value);
};

const runTests = (fm: string, tests: any[]) => {
   for (const [value, expected] of tests) {
      expect(
         format(fm, value).valid,
         `expected '${value}' to be ${expected}`
      ).toBe(expected as any);
   }
};

describe("format", () => {
   test("regex", () => {
      runTests("regex", [
         [1, true],
         ["([abc])+\\s+$", true],
         ["^(abc]", false],
      ]);
   });

   test("date", () => {
      runTests("date", [
         [1, true],
         ["2025-01-01", true],
         ["2020-01-31", true],
         ["2020-01-32", false],
         ["2021-02-28", true],
         ["2021-02-29", false],
         ["06/19/1963", false],
         ["1963-06-1৪", false],
      ]);
   });

   test("email", () => {
      runTests("email", [
         [1, true],
         ["test@example.com", true],
         ["~test@example.com", true],
         ['"joe bloggs"@example.com', true],
      ]);
   });

   test("format assertion can be disabled", () => {
      expect(format("email", "not an email").valid).toBe(false);
      expect(
         $format({ format: "email" }, "not an email", {
            assertFormat: false,
         }).valid
      ).toBe(true);

      const original = getFormatAssertionDefault();
      setFormatAssertionDefault(false);
      expect(format("email", "not an email").valid).toBe(true);
      setFormatAssertionDefault(original);
      expect(format("email", "not an email").valid).toBe(false);
   });

   test("register format", () => {
      const count = getFormats().length;
      registerFormat("identifier", (input) =>
         /^(?:[a-zA-Z_$][\\w$]*)(?:[a-zA-Z_$][\\w$]*)*$/.test(input)
      );
      expect(getFormats().length).toBe(count + 1);

      expect(format("identifier", "abc").valid).toBe(true);
      expect(format("identifier", "a bc").valid).toBe(false);

      unregisterFormat("identifier");
      expect(getFormats().length).toBe(count);
   });
});
