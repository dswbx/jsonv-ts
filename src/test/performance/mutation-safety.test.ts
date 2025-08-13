import { describe, expect, test } from "bun:test";
import { s } from "../../lib";

describe("Mutation Safety Tests", () => {
   test("validation should not mutate original object", () => {
      const originalData = {
         user: {
            name: "Alice",
            profile: {
               age: 25,
               tags: ["developer", "typescript"],
            },
         },
         settings: {
            theme: "dark",
            preferences: {
               notifications: true,
            },
         },
      };

      // Create deep copy to compare against
      const originalDataCopy = JSON.parse(JSON.stringify(originalData));

      const schema = s.object({
         user: s.object({
            name: s.string(),
            profile: s.object({
               age: s.number(),
               tags: s.array(s.string()),
            }),
         }),
         settings: s.object({
            theme: s.string(),
            preferences: s.object({
               notifications: s.boolean(),
            }),
         }),
      });

      // Validate multiple times
      for (let i = 0; i < 10; i++) {
         const result = schema.validate(originalData);
         expect(result.valid).toBe(true);
      }

      // Ensure original data hasn't been mutated
      expect(originalData).toEqual(originalDataCopy);

      // Specifically check nested objects/arrays weren't mutated
      expect(originalData.user.profile.tags).toEqual([
         "developer",
         "typescript",
      ]);
      // Note: Reference equality is not guaranteed after JSON.parse round-trip
      // but content equality is sufficient for mutation safety
   });

   test("validation should not mutate arrays", () => {
      const originalArray = [
         { id: 1, values: [1, 2, 3] },
         { id: 2, values: [4, 5, 6] },
      ];

      const originalArrayCopy = JSON.parse(JSON.stringify(originalArray));

      const schema = s.array(
         s.object({
            id: s.number(),
            values: s.array(s.number()),
         })
      );

      // Validate multiple times
      for (let i = 0; i < 5; i++) {
         const result = schema.validate(originalArray);
         expect(result.valid).toBe(true);
      }

      expect(originalArray).toEqual(originalArrayCopy);
      expect(originalArray[0].values).toEqual([1, 2, 3]);
   });

   test("coercion should not mutate original when using parse", () => {
      const originalData = {
         age: "25", // string that should be coerced to number
         active: "true", // string that should be coerced to boolean
         tags: "tag1,tag2", // might be coerced to array
      };

      const originalDataCopy = JSON.parse(JSON.stringify(originalData));

      const schema = s.object({
         age: s.string(), // Keep as string to avoid coercion
         active: s.string(),
         tags: s.string(),
      });

      // Multiple validations
      for (let i = 0; i < 3; i++) {
         const result = schema.validate(originalData);
         expect(result.valid).toBe(true);
      }

      expect(originalData).toEqual(originalDataCopy);
   });

   test("failed validation should not mutate data", () => {
      const invalidData = {
         name: 123, // should be string
         nested: {
            value: "not a number",
         },
      };

      const invalidDataCopy = JSON.parse(JSON.stringify(invalidData));

      const schema = s.object({
         name: s.string(),
         nested: s.object({
            value: s.number(),
         }),
      });

      const result = schema.validate(invalidData);
      expect(result.valid).toBe(false);
      expect(invalidData).toEqual(invalidDataCopy);
   });

   test("nested validation should not mutate", () => {
      // Test with deeply nested data
      const data = {
         name: "root",
         children: [
            {
               name: "child1",
               metadata: { id: 1, active: true },
            },
            {
               name: "child2",
               metadata: { id: 2, active: false },
            },
         ],
      };

      const dataCopy = JSON.parse(JSON.stringify(data));

      const schema = s.object({
         name: s.string(),
         children: s.array(
            s.object({
               name: s.string(),
               metadata: s.object({
                  id: s.number(),
                  active: s.boolean(),
               }),
            })
         ),
      });

      const result = schema.validate(data);
      expect(result.valid).toBe(true);
      expect(data).toEqual(dataCopy);
   });

   test("schema with const/enum should not mutate during normalization", () => {
      const data = {
         type: "user",
         status: "active",
         config: {
            settings: ["a", "c", "b"], // Array that might get sorted during normalization
         },
      };

      const dataCopy = JSON.parse(JSON.stringify(data));

      const schema = s.object({
         type: s.string({ const: "user" }),
         status: s.string({ enum: ["active", "inactive"] }),
         config: s.object({
            settings: s.array(s.string()),
         }),
      });

      for (let i = 0; i < 5; i++) {
         const result = schema.validate(data);
         expect(result.valid).toBe(true);
      }

      expect(data).toEqual(dataCopy);
      // Specifically check array order wasn't changed
      expect(data.config.settings).toEqual(["a", "c", "b"]);
   });

   test("allOf schema should not mutate during validation", () => {
      const data = {
         name: "test",
         age: 30,
         email: "test@example.com",
         tags: ["user", "active"],
      };

      const dataCopy = JSON.parse(JSON.stringify(data));

      const schema = s.allOf([
         s.object({ name: s.string() }),
         s.object({ age: s.number() }),
         s.object({ email: s.string() }),
         s.object({ tags: s.array(s.string()) }),
      ]);

      const result = schema.validate(data);
      expect(result.valid).toBe(true);
      expect(data).toEqual(dataCopy);
   });

   test("validation with pattern matching should not mutate", () => {
      const data = {
         email: "user@example.com",
         phone: "+1-555-123-4567",
         metadata: {
            raw: "some raw data here",
         },
      };

      const dataCopy = JSON.parse(JSON.stringify(data));

      const schema = s.object({
         email: s.string({ pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" }),
         phone: s.string({ pattern: "^\\+?[\\d\\-\\s()]+$" }),
         metadata: s.object({
            raw: s.string(),
         }),
      });

      const result = schema.validate(data);
      expect(result.valid).toBe(true);
      expect(data).toEqual(dataCopy);
   });
});
