import type { Schema } from "../schema/schema";
import { InvalidTypeError } from "../errors";
import {
   isArray,
   isBoolean,
   isInteger,
   isNull,
   isNumber,
   isObject,
   isString,
   normalize,
   isSchema,
   isBooleanSchema,
} from "../utils";
import { error, makeOpts, tmpOpts, valid } from "../utils/details";
import type { ValidationOptions } from "./validate";

export type KeywordResult = string | boolean;
type Opts = ValidationOptions;

/**
 * Default keywords
 */
export const _type = (
   { type }: { type?: string | string[] },
   value: unknown,
   opts: Opts = {}
) => {
   if (type === undefined) return valid();
   // @todo: not entirely sure about this
   if (value === undefined) return valid();

   let msg: string | undefined;
   const types = {
      string: isString,
      number: isNumber,
      integer: isInteger,
      object: isObject,
      array: isArray,
      boolean: isBoolean,
      null: isNull,
   };

   if (Array.isArray(type)) {
      for (const t of type) {
         if (!(t in types)) {
            throw new InvalidTypeError(`Unknown type: ${t}`);
         }
         if (types[t](value)) return valid();
      }
      msg = `Expected one of: ${type.join(", ")}`;
   } else {
      if (!(type in types)) {
         throw new InvalidTypeError(`Unknown type: ${type}`);
      }
      if (!types[type](value)) msg = `Expected ${type}`;
   }
   if (msg) return error(opts, "type", msg, value);
   return valid();
};

export const _const = (
   { const: _constValue }: { const?: unknown },
   _value: unknown,
   opts: Opts = {}
) => {
   const constValue = JSON.stringify(normalize(_constValue));
   const value = JSON.stringify(normalize(_value));
   if (constValue !== value) {
      return error(opts, "const", `Expected const: ${constValue}`, value);
   }
   return valid();
};

export const _enum = (
   { enum: _enumValues = [] }: { enum?: unknown[] },
   _value: unknown,
   opts: Opts = {}
) => {
   const enumValues = JSON.stringify(_enumValues.map(normalize));
   const value = JSON.stringify(normalize(_value));
   if (!enumValues.includes(value)) {
      return error(opts, "enum", `Expected enum: ${enumValues}`, _value);
   }
   return valid();
};

export function matches<T extends Schema[]>(
   schemas: T,
   value: unknown,
   opts: Opts = {}
): Schema[] {
   return schemas
      .map((s) => (s.validate(value, tmpOpts(opts)).valid ? s : undefined))
      .filter(Boolean) as Schema[];
}

export const anyOf = (
   { anyOf = [] }: { anyOf?: Schema[] },
   value: unknown,
   opts: Opts = {}
) => {
   if (matches(anyOf, value, opts).length > 0) return valid();
   return error(opts, "anyOf", "Expected at least one to match", value);
};

export const oneOf = (
   { oneOf = [] }: { oneOf?: Schema[] },
   value: unknown,
   opts: Opts = {}
) => {
   if (matches(oneOf, value).length === 1) return valid();
   return error(opts, "oneOf", "Expected exactly one to match", value);
};

export const allOf = (
   { allOf = [] }: { allOf?: Schema[] },
   value: unknown,
   opts: Opts = {}
) => {
   if (matches(allOf, value, opts).length === allOf.length) return valid();
   return error(opts, "allOf", "Expected all to match", value);
};

export const not = (
   { not }: { not?: Schema },
   value: unknown,
   opts: Opts = {}
) => {
   // not spec relevant, but if no value given, it's always valid
   if (value === undefined) return valid();

   if (isSchema(not) && not.validate(value, opts).valid) {
      return error(opts, "not", "Expected not to match", value);
   }
   return valid();
};

export const ifThenElse = (
   {
      if: _if,
      then: _then,
      else: _else,
   }: { if?: Schema; then?: Schema; else?: Schema },
   value: unknown,
   opts: Opts = {}
) => {
   if (_if && (_then || _else)) {
      if (_if.validate(value, tmpOpts(opts)).valid) {
         if (_then) {
            return _then.validate(value, tmpOpts(opts));
         }
         return valid();
      } else if (_else) {
         return _else.validate(value, tmpOpts(opts));
      }
   }
   return valid();
};

/**
 * Strings
 */
export const pattern = (
   { pattern = "" }: { pattern?: string | RegExp },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isString(value)) return valid();
   if (pattern instanceof RegExp) {
      if (pattern.test(value)) return valid();
   } else {
      if (new RegExp(pattern, "u").test(value)) return valid();
   }
   return error(
      opts,
      "pattern",
      `Expected string matching pattern ${pattern}`,
      value
   );
};

export const minLength = (
   { minLength = 0 }: { minLength?: number },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isString(value)) return valid();
   const normalizedValue = normalize(value);
   const length = [...(normalizedValue as string)].length;
   if (length >= minLength) return valid();
   return error(
      opts,
      "minLength",
      `Expected string with minimum length of ${minLength}`,
      value
   );
};

export const maxLength = (
   { maxLength = 0 }: { maxLength?: number },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isString(value)) return valid();
   const normalizedValue = normalize(value);
   const length = [...(normalizedValue as string)].length;
   if (length <= maxLength) return valid();
   return error(
      opts,
      "maxLength",
      `Expected string with maximum length of ${maxLength}`,
      value
   );
};

/**
 * Numbers
 */
export const multipleOf = (
   { multipleOf = 0 }: { multipleOf?: number },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isNumber(value)) return valid();
   // Spec guard – multipleOf must be > 0 and both numbers finite
   if (
      !(Number.isFinite(value) && Number.isFinite(multipleOf)) ||
      multipleOf <= 0
   ) {
      throw new InvalidTypeError("number");
   }

   // Division first, then check "integer-ness" with a relative epsilon.
   // Machine-epsilon scaled to the magnitude of the quotient
   const quotient = value / multipleOf;
   const EPS = Number.EPSILON * Math.max(1, Math.abs(quotient));

   // Valid when quotient is within EPS of the nearest integer
   if (Math.abs(quotient - Math.round(quotient)) <= EPS) return valid();

   return error(
      opts,
      "multipleOf",
      `Expected number being a multiple of ${multipleOf}`,
      value
   );
};

export const maximum = (
   { maximum = 0 }: { maximum?: number },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isNumber(value) || value <= maximum) return valid();
   return error(
      opts,
      "maximum",
      `Expected number less than or equal to ${maximum}`,
      value
   );
};

export const exclusiveMaximum = (
   { exclusiveMaximum = 0 }: { exclusiveMaximum?: number },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isNumber(value) || value < exclusiveMaximum) return valid();
   return error(
      opts,
      "exclusiveMaximum",
      `Expected number less than ${exclusiveMaximum}`,
      value
   );
};

export const minimum = (
   { minimum = 0 }: { minimum?: number },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isNumber(value) || value >= minimum) return valid();
   return error(
      opts,
      "minimum",
      `Expected number greater than or equal to ${minimum}`,
      value
   );
};

export const exclusiveMinimum = (
   { exclusiveMinimum = 0 }: { exclusiveMinimum?: number },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isNumber(value) || value > exclusiveMinimum) return valid();
   return error(
      opts,
      "exclusiveMinimum",
      `Expected number greater than ${exclusiveMinimum}`,
      value
   );
};

/**
 * Objects
 */
export const properties = (
   { properties = {} }: { properties?: Record<string, Schema> },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isObject(value)) return valid();
   for (const [key, keyValue] of Object.entries(value)) {
      const schema = properties[key];
      // missing schema will be validated by additionalProperties
      if (!isSchema(schema)) continue;
      const result = schema.validate(
         keyValue,
         makeOpts(opts, ["properties", key], key)
      );
      if (!result.valid) return result;
   }
   return valid();
};

export const additionalProperties = (
   {
      properties = {},
      additionalProperties,
      patternProperties,
   }: {
      properties?: Record<string, Schema>;
      additionalProperties?: Schema | false;
      patternProperties?: Record<string, Schema>;
   },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isObject(value)) return valid();
   if (!isSchema(additionalProperties)) {
      throw new InvalidTypeError(
         "additionalProperties must be a boolean or a managed schema"
      );
   }
   const props = Object.keys(properties);
   const pattern = isObject(patternProperties)
      ? Object.keys(value).filter((key) =>
           Object.keys(patternProperties).some((pattern) =>
              new RegExp(pattern).test(key)
           )
        )
      : [];
   const extra = Object.keys(value).filter(
      (key) => !props.includes(key) && !pattern.includes(key)
   );
   if (extra.length > 0) {
      if (isBooleanSchema(additionalProperties)) {
         if (additionalProperties.toJSON() === true) {
            return valid();
         }
         const extraObj = extra.reduce((acc, key) => {
            acc[key] = value[key];
            return acc;
         }, {} as Record<string, unknown>);

         return error(
            opts,
            "additionalProperties",
            "Additional properties are not allowed",
            extraObj
         );
      } else if (isSchema(additionalProperties)) {
         for (const key of extra) {
            const result = additionalProperties.validate(
               value[key],
               makeOpts(opts, ["additionalProperties"], key)
            );
            if (!result.valid) return result;
         }
      }
   }
   return valid();
};

export const dependentRequired = (
   { dependentRequired }: { dependentRequired?: Record<string, string[]> },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isObject(value)) return valid();
   const keys = Object.keys(value).filter(
      (key) => typeof value[key] !== "function"
   );
   if (isObject(dependentRequired)) {
      for (const [key, deps] of Object.entries(dependentRequired)) {
         if (keys.includes(key)) {
            for (const dep of deps) {
               if (!keys.includes(dep)) {
                  return error(
                     opts,
                     "dependentRequired",
                     `Expected dependent required property ${dep}`,
                     value
                  );
               }
            }
         }
      }
   }
   return valid();
};

export const required = (
   { required = [] }: { required?: string[] },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isObject(value)) return valid();
   const keys = Object.keys(value).filter(
      (key) => typeof value[key] !== "function"
   );
   if (required.every((key) => keys.includes(key))) return valid();
   return error(
      opts,
      "required",
      `Expected object with required properties ${required.join(", ")}`,
      value
   );
};

export const dependentSchemas = (
   { dependentSchemas }: { dependentSchemas?: Record<string, Schema> },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isObject(value)) return valid();
   const keys = Object.keys(value).filter(
      (key) => typeof value[key] !== "function"
   );
   if (isObject(dependentSchemas)) {
      for (const [key, depSchema] of Object.entries(dependentSchemas)) {
         if (keys.includes(key)) {
            const result = depSchema.validate(value, opts);
            if (!result.valid) return result;
         }
      }
   }
   return valid();
};

export const minProperties = (
   { minProperties = 0 }: { minProperties?: number },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isObject(value)) return valid();
   if (Object.keys(value).length >= minProperties) return valid();
   return error(
      opts,
      "minProperties",
      `Expected object with at least ${minProperties} properties`,
      value
   );
};

export const maxProperties = (
   { maxProperties = 0 }: { maxProperties?: number },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isObject(value) || Object.keys(value).length <= maxProperties)
      return valid();
   return error(
      opts,
      "maxProperties",
      `Expected object with at most ${maxProperties} properties`,
      value
   );
};

export const patternProperties = (
   { patternProperties = {} }: { patternProperties?: Record<string, Schema> },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isObject(value)) return valid();
   if (!isObject(patternProperties)) {
      throw new InvalidTypeError("patternProperties must be an object");
   }

   for (const [_key, _value] of Object.entries(value)) {
      for (const [pattern, schema] of Object.entries(patternProperties)) {
         if (new RegExp(pattern, "u").test(_key)) {
            const result = schema.validate(
               _value,
               makeOpts(opts, ["patternProperties"], _key)
            );
            if (!result.valid) return result;
         }
      }
   }
   return valid();
};

export const propertyNames = (
   { propertyNames }: { propertyNames?: Schema },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isObject(value) || propertyNames === undefined) return valid();
   if (!isSchema(propertyNames)) {
      throw new InvalidTypeError("propertyNames must be a managed schema");
   }
   for (const key of Object.keys(value)) {
      const result = propertyNames.validate(
         key,
         makeOpts(opts, ["propertyNames"], key)
      );
      if (!result.valid) return result;
   }
   return valid();
};

/**
 * Arrays
 */
export const items = (
   { items, prefixItems = [] }: { items?: Schema; prefixItems?: Schema[] },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isArray(value) || items === undefined) return valid();
   if (!isSchema(items)) {
      throw new InvalidTypeError("items must be a managed schema");
   }
   // skip prefix items
   for (const [index, item] of value.slice(prefixItems.length).entries()) {
      const result = items.validate(
         item,
         makeOpts(opts, ["items"], String(index))
      );
      if (!result.valid) return result;
   }
   return valid();
};

export const minItems = (
   { minItems = 0 }: { minItems?: number },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isArray(value) || value.length >= minItems) return valid();
   return error(
      opts,
      "minItems",
      `Expected array with at least ${minItems} items`,
      value
   );
};

export const maxItems = (
   { maxItems = 0 }: { maxItems?: number },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isArray(value) || value.length <= maxItems) return valid();
   return error(
      opts,
      "maxItems",
      `Expected array with at most ${maxItems} items`,
      value
   );
};

export const uniqueItems = (
   { uniqueItems = false }: { uniqueItems?: boolean },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isArray(value) || !uniqueItems) return valid();
   const normalizedValues = value.map(normalize);
   if (
      new Set(normalizedValues.map((v) => JSON.stringify(v))).size ===
      value.length
   ) {
      return valid();
   }
   return error(opts, "uniqueItems", "Expected array with unique items", value);
};

export const contains = (
   {
      contains,
      minContains,
      maxContains,
   }: { contains?: Schema; minContains?: number; maxContains?: number },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isSchema(contains)) {
      throw new Error("contains must be a managed schema");
   }
   if (!isArray(value)) return valid();
   const occ = value.filter((item) => contains.validate(item).valid).length;
   if (occ < (minContains ?? 1)) {
      return error(
         opts,
         minContains ? "minContains" : "contains",
         `Expected array to contain at least ${
            minContains ?? 1
         }, but found ${occ}`,
         value
      );
   }
   if (maxContains !== undefined && occ > maxContains) {
      return error(
         opts,
         "maxContains",
         `Expected array to contain at most ${maxContains}, but found ${occ}`,
         value
      );
   }
   return valid();
};

export const prefixItems = (
   { prefixItems = [] }: { prefixItems?: Schema[] },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isArray(value)) return valid();
   for (let i = 0; i < value.length; i++) {
      const result = prefixItems[i]?.validate(
         value[i],
         makeOpts(opts, String(i), String(i))
      );
      if (result && result?.valid !== true) {
         return result;
      }
   }
   return valid();
};
