import {
   ArraySchema,
   isSchema,
   ObjectSchema,
   type Schema,
   type TProperties,
} from "../";
import { UnionSchema } from "../union/union";
import { isBooleanSchema } from "../utils";

function value(value: unknown): string {
   if (typeof value === "string") {
      return `"${value}"`;
   } else if (value === null) {
      return "null";
   }

   return String(value);
}

export type ToTypesOptions = {
   indent?: string;
   currentIndent?: number;
   fallback?: string;
};

export function toTypes(
   schema: Schema,
   name: string,
   opts: ToTypesOptions & {
      type?: "type" | "interface";
   } = {}
): string {
   const { type, ...rest } = opts;
   const prefix =
      opts.type === "interface" ? `interface ${name} ` : `type ${name} = `;
   return `${prefix}${schemaToTypes(schema, rest)}`;
}

export function schemaToTypes(
   schema: Schema,
   _opts: ToTypesOptions = {}
): string {
   const opts = {
      indent: _opts.indent ?? "  ",
      currentIndent: _opts.currentIndent ?? 0,
      fallback: _opts.fallback ?? "unknown",
   };

   if (!isSchema(schema)) {
      return opts.fallback;
   }

   const indent = (str: string, times = 0) => opts.indent.repeat(times) + str;
   const current = opts.currentIndent;

   if (schema instanceof ObjectSchema) {
      const properties = schema.properties as TProperties;
      return (
         indent("{\n") +
         Object.entries(properties)
            .map(([key, property]) => {
               const add = property.isOptional() ? "?" : "";
               return indent(
                  `${key}${add}: ${schemaToTypes(property, {
                     ...opts,
                     currentIndent: current + 1,
                  })}`,
                  current + 1
               );
            })
            .join(",\n") +
         "\n" +
         indent("}", current)
      );
   } else if (schema instanceof ArraySchema) {
      return schemaToTypes(schema.items) + "[]";
   } else if ("anyOf" in schema && Array.isArray(schema.anyOf)) {
      return schema.anyOf.map((s) => schemaToTypes(s)).join(" | ");
   } else if ("oneOf" in schema && Array.isArray(schema.oneOf)) {
      return schema.oneOf.map((s) => schemaToTypes(s)).join(" | ");
   } else if (isBooleanSchema(schema)) {
      return schema.toJSON() ? "true" : "false";
   }

   if ("const" in schema && typeof schema.const !== "undefined") {
      return value(schema.const);
   } else if ("enum" in schema && typeof schema.enum !== "undefined") {
      return schema.enum.map((e) => value(e)).join(" | ") ?? opts.fallback;
   }

   return schema.type ?? opts.fallback;
}
