import * as lib from "..";
import { InvalidRawSchemaError } from "../errors";
import type { JSONSchema } from "../types";
import { isArray, isBoolean, isObject, isTypeSchema } from "../utils";

function eachArray<T>(array: any | any[], fn: (item: any) => T): T[] {
   return Array.isArray(array)
      ? array.map(fn)
      : array !== undefined
      ? [fn(array)]
      : [];
}

function eachObject<T>(
   object: Record<string, any>,
   fn: (item: any, key: string) => T,
   cb: (s: T, key: string) => T | Omit<T, "optional"> = (s) => s
): Record<string, T> {
   return Object.fromEntries(
      Object.entries(object).map(([key, value]) => [
         key,
         cb(fn(value, key), key),
      ])
   ) as Record<string, T>;
}

const schemaKeys = new Set([
   "$id",
   "$ref",
   "$schema",
   "$anchor",
   "$dynamicAnchor",
   "$dynamicRef",
   "type",
   "properties",
   "patternProperties",
   "additionalProperties",
   "unevaluatedProperties",
   "items",
   "prefixItems",
   "unevaluatedItems",
   "contains",
   "allOf",
   "anyOf",
   "oneOf",
   "not",
   "if",
   "then",
   "else",
   "required",
   "dependentRequired",
   "dependentSchemas",
   "dependencies",
   "$defs",
]);

function looksLikeSchema(value: unknown): value is Record<string, unknown> {
   return isObject(value) && Object.keys(value).some((key) => schemaKeys.has(key));
}

export type AnySchema<Type = unknown> = lib.Schema<any, Type> &
   JSONSchema<lib.Schema> &
   lib.ISchemaFn;

export function fromSchema<Type = unknown>(_schema: any): AnySchema<Type> {
   if (isBoolean(_schema)) {
      return lib.booleanSchema(_schema) as any;
   }

   const schema = structuredClone(_schema);

   if (!isObject(schema)) {
      throw new InvalidRawSchemaError(
         "non-object schemas cannot be converted to a schema",
         schema
      );
   }

   if ("properties" in schema && schema.properties) {
      schema.properties = eachObject(
         schema.properties,
         (item, key) => {
            try {
               return fromSchema(item);
            } catch (e) {
               throw new Error(
                  `Couldn't schemaize property "${key}": ${String(e)}`
               );
            }
         },
         (s, key) => {
            if (
               "required" in schema &&
               Array.isArray(schema.required) &&
               schema.required.includes(key)
            ) {
               return s;
            }
            return s.optional() as any;
         }
      );
   }
   const records = ["patternProperties", "dependentSchemas", "$defs"];
   for (const key of records) {
      if (key in schema && schema[key]) {
         schema[key] = eachObject(schema[key], fromSchema);
      }
   }

   if ("dependencies" in schema && schema.dependencies) {
      schema.dependencies = eachObject(schema.dependencies, (value) =>
         Array.isArray(value) ? value : fromSchema(value)
      );
   }

   const schemaize = [
      "additionalProperties",
      "unevaluatedProperties",
      "items",
      "prefixItems",
      "unevaluatedItems",
      "propertyNames",
      "contains",
      "not",
      "if",
      "then",
      "else",
   ];
   for (const key of schemaize) {
      if (key in schema && typeof schema[key] !== "undefined") {
         if (isArray(schema[key])) {
            schema[key] = eachArray(schema[key], fromSchema);
         } else {
            schema[key] = fromSchema(schema[key]);
         }
      }
   }

   const unions = ["anyOf", "oneOf", "allOf"];
   for (const union of unions) {
      if (union in schema) {
         // @ts-ignore
         const { [union]: _schemas } = schema;
         schema[union] = eachArray(_schemas, fromSchema);
      }
   }

   for (const [key, value] of Object.entries(schema)) {
      if (
         key === "const" ||
         key === "enum" ||
         key === "default" ||
         schemaize.includes(key) ||
         records.includes(key) ||
         key === "properties" ||
         key === "dependencies" ||
         key === "anyOf" ||
         key === "oneOf" ||
         key === "allOf"
      ) {
         continue;
      }
      if (looksLikeSchema(value)) {
         schema[key] = fromSchema(value);
      } else if (Array.isArray(value)) {
         schema[key] = value.map((item) =>
            looksLikeSchema(item) ? fromSchema(item) : item
         );
      }
   }

   if (isTypeSchema(schema)) {
      switch (schema.type) {
         case "string":
            return lib.string(schema) as any;
         case "number":
            return lib.number(schema) as any;
         case "integer":
            return lib.integer(schema) as any;
         case "boolean":
            return lib.boolean(schema) as any;
         case "object": {
            // @ts-ignore
            const { properties, ...rest } = schema;
            return lib.object(properties as any, rest as any) as any;
         }
         case "array": {
            // @ts-ignore
            const { items, ...rest } = schema;
            return lib.array(items as any, rest as any) as any;
         }
      }
   }

   return lib.any(schema as any);
}
