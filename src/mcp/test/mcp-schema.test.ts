import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { mcp } from "../hono/mcp.middleware";
import * as s from "../../lib";
import { Tool, type ToolHandlerCtx } from "../tool";
import { set } from "lodash-es";

export class ToolObjectSchema<
   const P extends s.TProperties = s.TProperties,
   const O extends s.IObjectOptions = s.IObjectOptions
> extends s.ObjectSchema<P, O> {
   constructor(
      public name: string,
      properties: P,
      options?: s.StrictOptions<s.IObjectOptions, O>
   ) {
      super(properties, options);
      this.name = name;
   }

   getTool(node: s.Node<ToolObjectSchema>) {
      return new Tool(
         this.name,
         {
            inputSchema: this as unknown as s.ObjectSchema<P, O>,
         },
         async (params, ctx: ToolHandlerCtx<any>) => {
            set(ctx.context.value, node.instancePath, params);
            return ctx.text(`hello world at: ${node.instancePath.join(".")}`);
         }
      );
   }
}

export const toolObject = <
   const P extends s.TProperties = s.TProperties,
   const O extends s.IObjectOptions = s.IObjectOptions
>(
   name: string,
   properties: P,
   options?: s.StrictOptions<s.IObjectOptions, O>
): ToolObjectSchema<P, O> & O =>
   new ToolObjectSchema(name, properties, options) as any;

describe("mcp schema", () => {
   it("should boot", async () => {
      const schema = s.object({
         something: toolObject("something", {
            name: s.string(),
         }),
         else: s.string(),
      });
      const value = {
         something: {
            name: "test",
         },
         else: "else",
      };
      /* console.log(
         JSON.parse(JSON.stringify([...schema.walk({ data: value })], null, 2))
      ); */

      const toolNodes = [...schema.walk({ data: value })].filter(
         (n) => n.schema instanceof ToolObjectSchema
      );
      //console.log(JSON.parse(JSON.stringify(toolNodes, null, 2)));

      const app = new Hono().use(
         mcp({
            context: { value },
            // @ts-expect-error
            tools: toolNodes.map((n) => n.schema.getTool(n)),
         })
      );

      const res = await app.request("/sse", {
         method: "POST",
         body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/list",
            params: {},
         }),
      });
      const body = await res.json();
      //console.log(body);

      // call it
      {
         const res = await app.request("/sse", {
            method: "POST",
            body: JSON.stringify({
               jsonrpc: "2.0",
               id: 2,
               method: "tools/call",
               params: {
                  name: "something",
                  arguments: {
                     name: "new name",
                  },
               },
            }),
         });
         const body = await res.json();
         //console.log("called", body);
         //console.log("value", value);
         expect(value).toEqual({
            something: {
               name: "new name",
            },
            else: "else",
         });
      }
      /* expect(body).toEqual({
         jsonrpc: "2.0",
         id: 1,
         result: {
            tools: [
               {
                  name: "test",
                  inputSchema: {
                     type: "object",
                     properties: {},
                  },
               },
            ],
         },
      }); */
   });
});
