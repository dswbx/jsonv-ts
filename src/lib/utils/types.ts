import {
   ArraySchema,
   isSchema,
   RecordSchema,
   ObjectSchema,
   type Schema,
   type TProperties,
} from "../";
import { isBooleanSchema } from "../utils";

function value(value: unknown): string {
   if (typeof value === "string") {
      return `"${value}"`;
   } else if (value === null) {
      return "null";
   }

   return String(value);
}

export type ToSchemaOptions = {
   indent?: string;
   currentIndent?: number;
   fallback?: string;
   generateChild?: (schema: Schema, opts?: ToSchemaOptions) => string;
};

export type ToTypesOptions = ToSchemaOptions & {
   type?: "type" | "interface";
   export?: boolean;
};

export type ToDefinitionOptions = ToTypesOptions & {
   generateName?: (schema: Schema) => string;
};

const comment = (schema: Schema) => {
   return schema.description ? `/**\n * ${schema.description}\n */\n` : "";
};

function toValidTypeIdentifier(str: string): string {
   // valid TypeScript identifiers: letters, digits, _, $, but cannot start with digit
   let s = str
      .replace(/^[^a-zA-Z_$]+/, "") // starting chars
      .replace(/ /g, "") // replace white spaces
      .replace(/[^a-zA-Z0-9_$]/g, "_"); // replace special characters with "_"

   // if the string is now empty or starts with a digit, prepend "_"
   if (!s || /^[0-9]/.test(s)) {
      s = "_" + s;
   }

   if (!s || s.length === 0) return s;
   return s.charAt(0).toUpperCase() + s.slice(1);
}

const generateName = (schema: Schema) => {
   if (schema.title) return toValidTypeIdentifier(schema.title);
   return "Schema";
};

const isPrimitiveSchema = ({ type }: Schema) => {
   return ["string", "number", "boolean", "null", "undefined"].includes(
      type ?? ""
   );
};

export function toDefinition(
   schema: Schema,
   _name?: string,
   opts: ToDefinitionOptions = {}
): string {
   let cache = new Map<
      string,
      {
         name: string;
         type: string;
      }
   >();
   const $generateName = opts.generateName ?? generateName;
   const name = _name ?? $generateName(schema);
   const generateChild = (schema: Schema, childOpts: ToSchemaOptions = {}) => {
      if (!schema.title || isPrimitiveSchema(schema)) {
         return schemaToTypes(schema, {
            ...childOpts,
            generateChild,
         });
      }

      const json = JSON.stringify(schema);
      if (cache.has(json)) {
         return cache.get(json)!.name;
      }

      const name = $generateName(schema);
      const type = toTypes(schema, name, {
         ...opts,
         ...childOpts,
         currentIndent: 0,
         generateChild,
      });
      // @todo: check for name collisions
      cache.set(json, {
         name,
         type,
      });
      return name;
   };

   const main = toTypes(schema, name, {
      ...opts,
      generateChild,
   });

   return [...cache.values().map((v) => v.type), main].join("\n\n");
}

export function toTypes(
   schema: Schema,
   _name?: string,
   opts: ToTypesOptions = {}
): string {
   const { type, export: _export, ...rest } = opts;
   const name = _name ?? schema.title ?? "Schema";
   const prefix =
      type === "interface" ? `interface ${name} ` : `type ${name} = `;

   return `${comment(schema)}${
      _export ? "export " : ""
   }${prefix}${schemaToTypes(schema, rest)}`;
}

export function schemaToTypes(
   schema: Schema,
   _opts: ToSchemaOptions = {}
): string {
   const opts = {
      indent: _opts.indent ?? "  ",
      currentIndent: _opts.currentIndent ?? 0,
      fallback: _opts.fallback ?? "unknown",
      generateChild: _opts.generateChild ?? schemaToTypes,
   };

   if (!isSchema(schema)) {
      return opts.fallback;
   }

   const indent = (str: string, times = 0) =>
      str
         .split("\n")
         .map((line) => opts.indent.repeat(times) + line)
         .join("\n");
   const current = opts.currentIndent;

   if (schema instanceof ObjectSchema) {
      const properties = schema.properties as TProperties;
      if (Object.keys(properties).length === 0) {
         return "{}";
      }

      return (
         indent("{\n") +
         Object.entries(properties)
            .map(([key, property]) => {
               const add = property.isOptional() ? "?" : "";
               return indent(
                  `${comment(property)}${key}${add}: ${opts.generateChild(
                     property,
                     opts
                  )}`,
                  current + 1
               );
            })
            .join(",\n") +
         "\n" +
         indent("}", current)
      );
   } else if (schema instanceof RecordSchema) {
      return `Record<string, ${opts.generateChild(
         schema.additionalProperties,
         opts
      )}>`;
   } else if (schema instanceof ArraySchema) {
      return opts.generateChild(schema.items) + "[]";
   } else if ("anyOf" in schema && Array.isArray(schema.anyOf)) {
      return schema.anyOf.map((s) => opts.generateChild(s)).join(" | ");
   } else if ("oneOf" in schema && Array.isArray(schema.oneOf)) {
      return schema.oneOf.map((s) => opts.generateChild(s)).join(" | ");
   } else if (isBooleanSchema(schema)) {
      return schema.toJSON() ? "any" : "never";
   }

   if ("const" in schema && typeof schema.const !== "undefined") {
      return value(schema.const);
   } else if ("enum" in schema && typeof schema.enum !== "undefined") {
      return schema.enum.map((e) => value(e)).join(" | ") ?? opts.fallback;
   }

   return schema.type ?? opts.fallback;
}
