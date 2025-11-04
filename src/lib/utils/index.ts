import { InvariantError } from "../errors";
import type { PropertyName, JSONSchemaDefinition } from "../types";
import { Schema, type ISchemaOptions } from "../schema/schema";
import { schemaSymbol } from "../shared";

export function isNull(value: unknown): value is null {
   return value === null;
}

export function isDefined(value: unknown): value is NonNullable<unknown> {
   return typeof value !== "undefined";
}

export function isObject(value: unknown): value is Record<string, unknown> {
   return !Array.isArray(value) && typeof value === "object" && value !== null;
}

export function isPlainObject(
   value: unknown
): value is Record<string, unknown> {
   return Object.prototype.toString.call(value) === "[object Object]";
}

export function isString(value: unknown): value is string {
   return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
   return typeof value === "number";
}

export function isInteger(value: unknown): value is number {
   return typeof value === "number" && Number.isInteger(value);
}

export function isBoolean(value: unknown): value is boolean {
   return typeof value === "boolean";
}

export function isArray(value: unknown): value is unknown[] {
   return Array.isArray(value);
}

export function isValidPropertyName(value: unknown): value is PropertyName {
   return typeof value === "string" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

export function isNonBooleanRawSchema(
   schema: unknown
): schema is Exclude<JSONSchemaDefinition, boolean> {
   return typeof schema !== "boolean";
}

export function isTypeSchema(
   schema: unknown
): schema is { type: string | string[] } {
   return (
      schema !== undefined && isNonBooleanRawSchema(schema) && "type" in schema
   );
}

export function isSchema(schema: unknown): schema is Schema & ISchemaOptions {
   return schema !== undefined && isObject(schema) && schemaSymbol in schema;
   //return schema instanceof Schema;
}

export function isBooleanSchema(
   schema: unknown
): schema is Schema & { toJSON: () => boolean } {
   return isSchema(schema) && typeof schema.toJSON() === "boolean";
}

export function matchesPattern(pattern: string, value: string): boolean {
   const match = pattern.match(/^\/(.+)\/([gimuy]*)$/);
   const [, p, f] = match || [null, pattern, ""];
   return new RegExp(p, f).test(value);
}

export function invariant(
   condition: unknown,
   message: string,
   value?: unknown
): asserts condition {
   if (!condition) {
      throw new InvariantError(message, value);
   }
}

export function normalizeString(value: unknown) {
   if (!isString(value)) return value;
   return value.normalize("NFC");
}

// borrowed from https://github.com/cfworker/cfworker/blob/main/packages/json-schema/src/deep-compare-strict.ts
export function deepCompareStrict(a: any, b: any): boolean {
   const typeofa = typeof a;
   if (typeofa !== typeof b) {
      return false;
   }
   if (Array.isArray(a)) {
      if (!Array.isArray(b)) {
         return false;
      }
      const length = a.length;
      if (length !== b.length) {
         return false;
      }
      for (let i = 0; i < length; i++) {
         if (!deepCompareStrict(a[i], b[i])) {
            return false;
         }
      }
      return true;
   }
   if (typeofa === "object") {
      if (!a || !b) {
         return a === b;
      }
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      const length = aKeys.length;
      if (length !== bKeys.length) {
         return false;
      }
      for (const k of aKeys) {
         if (!deepCompareStrict(a[k], b[k])) {
            return false;
         }
      }
      return true;
   }
   return a === b;
}

// lodash-es compatible `pick` with perfect type inference
export function pickKeys<T extends object, K extends keyof T>(
   obj: T,
   keys: K[]
): Pick<T, K> {
   return keys.reduce((acc, key) => {
      if (key in obj) {
         acc[key] = obj[key];
      }
      return acc;
   }, {} as Pick<T, K>);
}

export function safeStructuredClone<T>(value: T): T {
   try {
      return structuredClone(value);
   } catch (e) {
      return value;
   }
}

/**
 * Lodash's merge implementation caused issues in Next.js environments
 * From: https://thescottyjam.github.io/snap.js/#!/nolodash/merge
 * NOTE: This mutates `object`. It also may mutate anything that gets attached to `object` during the merge.
 * @param object
 * @param sources
 */
export function mergeObject(object, ...sources) {
   for (const source of sources) {
      for (const [key, value] of Object.entries(source)) {
         if (value === undefined) {
            continue;
         }

         // These checks are a week attempt at mimicking the various edge-case behaviors
         // that Lodash's `_.merge()` exhibits. Feel free to simplify and
         // remove checks that you don't need.
         if (!isPlainObject(value) && !Array.isArray(value)) {
            object[key] = value;
         } else if (Array.isArray(value) && !Array.isArray(object[key])) {
            object[key] = value;
         } else if (!isObject(object[key])) {
            object[key] = value;
         } else {
            mergeObject(object[key], value);
         }
      }
   }

   return object;
}
