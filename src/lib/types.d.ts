export type JSONSchemaTypeName =
   | "string"
   | "number"
   | "integer"
   | "boolean"
   | "object"
   | "array"
   | "null";

export type JSONSchemaDefinition = JSONSchema | boolean;
export type PropertyName = string;

export type BaseJSONSchema = {
   $id?: string;
   $ref?: string;
   $schema?: string;
   title?: string;
   description?: string;
   default?: any;
   readOnly?: boolean;
   writeOnly?: boolean;
   $comment?: string;
   $defs?: { [key: string]: JSONSchemaDefinition };

   // Data types
   type?: JSONSchemaTypeName | JSONSchemaTypeName[];
   enum?: readonly any[] | any[];
   const?: any;
};

export type StringSchema = BaseJSONSchema & {
   maxLength?: number;
   minLength?: number;
   pattern?: string;
   format?: string;
};

export type NumberSchema = BaseJSONSchema & {
   multipleOf?: number;
   maximum?: number;
   exclusiveMaximum?: number;
   minimum?: number;
   exclusiveMinimum?: number;
};

export type BooleanSchema = BaseJSONSchema;

export type ArraySchema<
   Items = JSONSchemaDefinition,
   Contains = JSONSchemaDefinition
> = BaseJSONSchema & {
   items?: Items | boolean;
   uniqueItems?: boolean;
   maxItems?: number;
   minItems?: number;
   contains?: Contains;
   minContains?: number;
   maxContains?: number;
   prefixItems?: Contains[];
};

export type ObjectSchema<
   P = BaseJSONSchema,
   PP = P,
   AP = P,
   DP = P,
   PN = P
> = BaseJSONSchema & {
   properties?: { [key in PropertyName]: P };
   patternProperties?: { [key: string]: PP };
   additionalProperties?: AP | boolean;
   required?: PropertyName[];
   maxProperties?: number;
   minProperties?: number;
   dependencies?: {
      [key in PropertyName]: P | PropertyName[];
   };
   propertyNames?: PN | boolean;
};

export interface JSONSchema<S = BaseJSONSchema>
   extends BaseJSONSchema,
      StringSchema,
      NumberSchema,
      BooleanSchema,
      ArraySchema<S, S>,
      ObjectSchema<S> {
   // Combining schemas
   allOf?: S[];
   anyOf?: S[];
   oneOf?: S[];
   not?: S;
   if?: S;
   then?: S;
   else?: S;

   // catch-all for custom extensions
   [key: string | symbol]: any;
}
