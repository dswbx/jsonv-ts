import { expectTypeOf } from "expect-type";
import { describe, it, expect } from "bun:test";
import { Tool } from "./tool";
import { s } from "../lib";
import { McpServer } from "./server";

describe("tool", () => {
   it("should produce valid tool json", () => {
      const tool = new Tool(
         "test",
         {
            inputSchema: s.object({
               foo: s.string(),
            }),
            annotations: {
               destructiveHint: true,
               idempotentHint: true,
               openWorldHint: true,
               readOnlyHint: true,
               title: "annotation title",
            },
            title: "title",
            description: "description",
         },
         async (a, ctx) => {
            return ctx.text("hello");
         }
      );

      expect(tool.toJSON()).toEqual({
         name: "test",
         title: "title",
         description: "description",
         inputSchema: {
            type: "object",
            properties: {
               foo: {
                  type: "string",
               },
            },
            required: ["foo"],
         },
         annotations: {
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: true,
            readOnlyHint: true,
            title: "annotation title",
         },
      } as any);
   });

   it("should work with factory", () => {
      const config = {
         title: "test",
         inputSchema: s.object({
            name: s.string(),
         }),
      };

      const tool1 = new Tool("test", config, async ({ name }, ctx) => {
         expectTypeOf<typeof name>().toEqualTypeOf<string>();
         return ctx.text("hello");
      });

      const server = new McpServer(undefined as any, {
         foo: "bar",
      });
      server.tool("test", config, async ({ name }, ctx) => {
         expectTypeOf<typeof name>().toEqualTypeOf<string>();
         expectTypeOf<(typeof ctx)["context"]>().toEqualTypeOf<{
            foo: string;
         }>();
         return ctx.text("hello");
      });

      expect(tool1.toJSON()).toEqual(server.tools[0]?.toJSON() as any);
   });
});
