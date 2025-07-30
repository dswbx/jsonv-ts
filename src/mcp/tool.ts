import * as s from "jsonv-ts";
import { McpError } from "./error";

const annotationSchema = s.partialObject({
   /**
    * A human-readable title for the tool.
    */
   title: s.string(),
   /**
    * If true, the tool does not modify its environment.
    */
   readOnlyHint: s.boolean(),
   /**
    * If true, the tool may perform destructive updates to its environment.
    * If false, the tool performs only additive updates.
    *
    * (This property is meaningful only when `readOnlyHint == false`)
    */
   destructiveHint: s.boolean({ default: true }),
   /**
    * If true, calling the tool repeatedly with the same arguments
    * will have no additional effect on the its environment.
    *
    * (This property is meaningful only when `readOnlyHint == false`)
    */
   idempotentHint: s.boolean(),
   /**
    * If true, this tool may interact with an "open world" of external
    * entities. If false, the tool's domain of interaction is closed.
    * For example, the world of a web search tool is open, whereas that
    * of a memory tool is not.
    */
   openWorldHint: s.boolean({ default: true }),
});

export type ToolAnnotation = s.Static<typeof annotationSchema>;

export type ToolHandlerCtx<Context extends object = object> = {
   text: (text: string) => any;
   json: (json: object) => any;
   context: Context;
   request: Request;
};

export type ToolResponse = {
   type: string;
};

export class Tool<
   Name extends string = string,
   Schema extends s.Schema | undefined = undefined,
   Params = Schema extends s.Schema ? s.Static<Schema> : object
> {
   constructor(
      readonly name: Name,
      readonly handler: (
         params: Params,
         ctx: ToolHandlerCtx
      ) => Promise<ToolResponse>,
      readonly schema: Schema,
      readonly options: {
         description?: string;
      } & ToolAnnotation = {}
   ) {
      const { description, ...annotations } = options;
      if (annotations && !annotationSchema.validate(annotations).valid) {
         throw new Error("Invalid tool annotation");
      }
   }

   async call(
      params: Params,
      context: object,
      request: Request
   ): Promise<ToolResponse> {
      if (this.schema) {
         const result = this.schema.validate(params);
         if (!result.valid) {
            throw new McpError("InvalidParams", {
               errors: result.errors,
               given: params,
            });
         }
      }

      return await this.handler(params, {
         context,
         request,
         text: (text) => ({
            type: "text",
            text,
         }),
         json: (json) => ({
            type: "text",
            text: JSON.stringify(json),
         }),
      });
   }

   toJSON() {
      const { description, ...annotations } = this.options;
      return {
         name: this.name,
         description,
         inputSchema: this.schema?.toJSON() ?? { type: "object" },
         annotations:
            Object.keys(annotations).length > 0 ? annotations : undefined,
      };
   }
}

export type ToolFactoryProps<
   Name extends string = string,
   Schema extends s.Schema | undefined = undefined,
   Context extends object = {},
   Params = Schema extends s.Schema ? s.Static<Schema> : object
> = {
   name: Name;
   handler: (
      params: Params,
      ctx: ToolHandlerCtx<Context>
   ) => Promise<ToolResponse>;
   schema?: Schema;
   description?: string;
} & ToolAnnotation;

export function tool<
   Name extends string = string,
   Schema extends s.Schema | undefined = undefined
>(opts: ToolFactoryProps<Name, Schema, object>) {
   const { name, handler, schema, description, ...annotations } = opts;
   return new Tool(name, handler, schema ?? undefined, {
      description,
      ...annotations,
   });
}
