import { describe, test, expect } from "bun:test";
import * as s from "../../lib";

describe("walk", () => {
   class SecretSchema extends s.StringSchema {}
   const secret = () => new SecretSchema();

   test("depth tracking", () => {
      const schema = s.object({
         name: s.string(),
         age: s.number(),
         address: s.object({
            street: secret(),
            city: s.string(),
            current: s.boolean(),
         }),
      });

      const data = {
         name: "John Doe",
         age: 30,
         address: {
            street: "123 Main St",
            city: "Anytown",
            current: true,
         },
      };

      const nodes = [...schema.walk({ data })].map((n) => ({
         ...n,
         schema: n.schema.constructor.name,
      }));

      // Check depth values (based on instancePath length - data nesting level)
      expect(nodes[0].depth).toBe(0); // root (instancePath: [])
      expect(nodes[1].depth).toBe(1); // name (instancePath: ["name"])
      expect(nodes[2].depth).toBe(1); // age (instancePath: ["age"])
      expect(nodes[3].depth).toBe(1); // address (instancePath: ["address"])
      expect(nodes[4].depth).toBe(2); // address.street (instancePath: ["address", "street"])
      expect(nodes[5].depth).toBe(2); // address.city (instancePath: ["address", "city"])
      expect(nodes[6].depth).toBe(2); // address.current (instancePath: ["address", "current"])
   });

   test("maxDepth limiting", () => {
      const schema = s.object({
         name: s.string(),
         age: s.number(),
         address: s.object({
            street: secret(),
            city: s.string(),
            current: s.boolean(),
         }),
      });

      const data = {
         name: "John Doe",
         age: 30,
         address: {
            street: "123 Main St",
            city: "Anytown",
            current: true,
         },
      };

      // Limit to depth 1, should stop before nested object properties
      const nodes = [...schema.walk({ data, maxDepth: 1 })];

      // Should have 4 nodes: root (depth 0), name (depth 1), age (depth 1), address (depth 1)
      // Should NOT have the nested address properties (depth 2)
      expect(nodes.length).toBe(4);
      expect(nodes.every((n) => n.depth <= 1)).toBe(true);

      // Check we have the expected nodes
      const paths = nodes.map((n) => n.instancePath.join(".") || "root");
      expect(paths).toEqual(["root", "name", "age", "address"]);
   });
});
