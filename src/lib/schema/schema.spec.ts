import { describe, expect, test } from "bun:test";
import { Schema } from "./schema";

describe("Schema", () => {
   test("basic", () => {
      const schema = new Schema();
      expect(schema.type).toBeUndefined();
      expect(schema.toJSON()).toEqual({});
   });
});
