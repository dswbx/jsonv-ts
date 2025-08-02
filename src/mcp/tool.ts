import * as s from "jsonv-ts";
import { McpError } from "./error";

const annotationSchema = s
   .object({
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
   })
   .partial()
   .strict();

export type ToolAnnotation = s.Static<typeof annotationSchema>;

export type ToolConfig = {
   title?: string;
   description?: string;
   inputSchema?: s.ObjectSchema<any, any>;
   outputSchema?: s.ObjectSchema<any, any>;
   annotations?: ToolAnnotation;
};

export type ToolHandler<
   Config extends ToolConfig | undefined = undefined,
   Context extends object = {}
> = (
   params: Config extends ToolConfig
      ? Config["inputSchema"] extends s.Schema
         ? s.Static<Config["inputSchema"]>
         : never
      : never,
   ctx: ToolHandlerCtx<Context>
) => Promise<ToolResponse>;

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
   Config extends ToolConfig | undefined = undefined,
   InputSchema = Config extends ToolConfig ? Config["inputSchema"] : undefined,
   Params = InputSchema extends s.Schema ? s.Static<InputSchema> : object
> {
   constructor(
      readonly name: Name,
      readonly config: Config,
      readonly handler: (
         params: Params,
         ctx: ToolHandlerCtx<any>
      ) => Promise<ToolResponse>
   ) {
      if (
         config &&
         config?.annotations &&
         !annotationSchema.validate(config?.annotations).valid
      ) {
         throw new Error("Invalid tool annotation");
      }
   }

   async call(
      params: Params,
      context: object,
      request: Request
   ): Promise<ToolResponse> {
      if (this.config?.inputSchema) {
         const result = this.config.inputSchema.validate(params);
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
      return {
         name: this.name,
         title: this.config?.title,
         description: this.config?.description,
         inputSchema: this.config?.inputSchema?.toJSON() ?? { type: "object" },
         outputSchema: this.config?.outputSchema?.toJSON(),
         annotations:
            Object.keys(this.config?.annotations ?? {}).length > 0
               ? this.config?.annotations
               : undefined,
      };
   }
}
