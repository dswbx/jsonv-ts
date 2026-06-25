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
   normalizeString,
   isSchema,
   isBooleanSchema,
   deepCompareStrict,
} from "../utils";
import { error, makeOpts, tmpOpts, valid } from "../utils/details";
import {
   cloneEvaluated,
   evaluatedItems,
   evaluatedProperties,
   markEvaluatedItem,
   markEvaluatedProperty,
   mergeEvaluated,
   type ValidationOptions,
} from "./validate";

export type KeywordResult = string | boolean;
type Opts = ValidationOptions;

function ecmaPattern(pattern: string | RegExp): RegExp {
   if (pattern instanceof RegExp) return pattern;
   return new RegExp(pattern.replace(/\\p\{digit\}/gi, "\\p{Decimal_Number}"), "u");
}

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
   if (!deepCompareStrict(_constValue, _value)) {
      return error(opts, "const", `Expected const: ${_constValue}`, _value);
   }
   return valid();
};

export const _enum = (
   { enum: enumValues = [] }: { enum?: unknown[] },
   _value: unknown,
   opts: Opts = {}
) => {
   if (!enumValues.some((v) => deepCompareStrict(v, _value))) {
      return error(
         opts,
         "enum",
         `Expected enum: ${JSON.stringify(enumValues)}`,
         _value
      );
   }
   return valid();
};

export function matches<T extends Schema[]>(
   schemas: T,
   value: unknown,
   opts: Opts = {}
): Schema[] {
   return schemas.filter((schema) => {
      const branch = tmpOpts({
         ...opts,
         evaluated: cloneEvaluated(opts.evaluated),
      });
      const result = schema.validate(value, branch);
      if (result.valid && opts.evaluated && branch.evaluated) {
         mergeEvaluated(opts.evaluated, branch.evaluated);
      }
      return result.valid;
   }) as T;
}

export const anyOf = (
   { anyOf = [] }: { anyOf?: Schema[] },
   value: unknown,
   opts: Opts = {}
) => {
   const base = cloneEvaluated(opts.localEvaluatedBase || opts.evaluated);
   let count = 0;
   for (const schema of anyOf) {
      const branch = tmpOpts({ ...opts, evaluated: cloneEvaluated(base) });
      const result = schema.validate(value, branch);
      if (result.valid) {
         count++;
         if (opts.evaluated && branch.evaluated) {
            mergeEvaluated(opts.evaluated, branch.evaluated);
         }
      }
   }
   if (count > 0) return valid();
   return error(opts, "anyOf", "Expected at least one to match", value);
};

export const oneOf = (
   { oneOf = [] }: { oneOf?: Schema[] },
   value: unknown,
   opts: Opts = {}
) => {
   const base = cloneEvaluated(opts.localEvaluatedBase || opts.evaluated);
   let match: ValidationOptions | undefined;
   let count = 0;
   for (const schema of oneOf) {
      const branch = tmpOpts({ ...opts, evaluated: cloneEvaluated(base) });
      const result = schema.validate(value, branch);
      if (result.valid) {
         count++;
         match = branch;
      }
   }
   if (count === 1) {
      if (opts.evaluated && match?.evaluated) {
         mergeEvaluated(opts.evaluated, match.evaluated);
      }
      return valid();
   }
   return error(opts, "oneOf", "Expected exactly one to match", value);
};

export const allOf = (
   { allOf = [] }: { allOf?: Schema[] },
   value: unknown,
   opts: Opts = {}
) => {
   const base = cloneEvaluated(opts.localEvaluatedBase || opts.evaluated);
   const branches: ValidationOptions[] = [];
   for (const schema of allOf) {
      const branch = tmpOpts({
         ...opts,
         evaluated: cloneEvaluated(base),
      });
      const result = schema.validate(value, branch);
      if (!result.valid) {
         return error(opts, "allOf", "Expected all to match", value);
      }
      branches.push(branch);
   }
   for (const branch of branches) {
      if (opts.evaluated && branch.evaluated) {
         mergeEvaluated(opts.evaluated, branch.evaluated);
      }
   }
   return valid();
};

export const not = (
   { not }: { not?: Schema },
   value: unknown,
   opts: Opts = {}
) => {
   // not spec relevant, but if no value given, it's always valid
   if (value === undefined) return valid();

   if (
      isSchema(not) &&
      not.validate(value, {
         ...opts,
         errors: [],
         evaluated: cloneEvaluated(opts.localEvaluatedBase || opts.evaluated),
      }).valid
   ) {
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
   if (_if) {
      const ifOpts = tmpOpts({
         ...opts,
         evaluated: cloneEvaluated(opts.localEvaluatedBase || opts.evaluated),
      });
      if (_if.validate(value, ifOpts).valid) {
         if (opts.evaluated && ifOpts.evaluated) {
            mergeEvaluated(opts.evaluated, ifOpts.evaluated);
         }
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
   if (ecmaPattern(pattern).test(value)) return valid();
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
   const normalizedValue = normalizeString(value);
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
   const normalizedValue = normalizeString(value);
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
   const quotient = value / multipleOf;

   // Valid when quotient is within EPS of the nearest integer
   if (Number.isFinite(quotient) && isNearlyInteger(quotient)) return valid();

   if (
      !Number.isFinite(quotient) &&
      Number.isInteger(value) &&
      isNearlyInteger(1 / multipleOf)
   ) {
      return valid();
   }

   return error(
      opts,
      "multipleOf",
      `Expected number being a multiple of ${multipleOf}`,
      value
   );
};

function isNearlyInteger(value: number): boolean {
   const EPS = Number.EPSILON * Math.max(1, Math.abs(value));
   return Math.abs(value - Math.round(value)) <= EPS;
}

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
      markEvaluatedProperty(opts, key);
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
              ecmaPattern(pattern).test(key)
           )
        )
      : [];
   const extra = Object.keys(value).filter(
      (key) => !props.includes(key) && !pattern.includes(key)
   );
   if (extra.length > 0) {
      if (isBooleanSchema(additionalProperties)) {
         if (additionalProperties.toJSON() === true) {
            for (const key of extra) markEvaluatedProperty(opts, key);
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
            markEvaluatedProperty(opts, key);
         }
      }
   }
   return valid();
};

export const dependencies = (
   { dependencies }: { dependencies?: Record<string, Schema | string[]> },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isObject(value) || !isObject(dependencies)) return valid();
   const keys = Object.keys(value).filter(
      (key) => typeof value[key] !== "function"
   );
   for (const [key, dependency] of Object.entries(dependencies)) {
      if (!keys.includes(key)) continue;
      if (Array.isArray(dependency)) {
         for (const dep of dependency) {
            if (!keys.includes(dep)) {
               return error(
                  opts,
                  "dependencies",
                  `Expected dependent required property ${dep}`,
                  value
               );
            }
         }
      } else if (isSchema(dependency)) {
         const result = dependency.validate(value, opts);
         if (!result.valid) return result;
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
         if (ecmaPattern(pattern).test(_key)) {
            const result = schema.validate(
               _value,
               makeOpts(opts, ["patternProperties"], _key)
            );
            if (!result.valid) return result;
            markEvaluatedProperty(opts, _key);
         }
      }
   }
   return valid();
};

export const unevaluatedProperties = (
   { unevaluatedProperties }: { unevaluatedProperties?: Schema | false },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isObject(value) || unevaluatedProperties === undefined) return valid();
   if (!isSchema(unevaluatedProperties)) {
      throw new InvalidTypeError(
         "unevaluatedProperties must be a boolean or managed schema"
      );
   }
   const evaluated = evaluatedProperties(opts);
   const unevaluated = Object.keys(value).filter((key) => !evaluated.has(key));
   if (unevaluated.length === 0) return valid();

   if (isBooleanSchema(unevaluatedProperties)) {
      if (unevaluatedProperties.toJSON() === true) {
         for (const key of unevaluated) markEvaluatedProperty(opts, key);
         return valid();
      }
      const extraObj = unevaluated.reduce((acc, key) => {
         acc[key] = value[key];
         return acc;
      }, {} as Record<string, unknown>);
      return error(
         opts,
         "unevaluatedProperties",
         "Unevaluated properties are not allowed",
         extraObj
      );
   }

   for (const key of unevaluated) {
      const result = unevaluatedProperties.validate(
         value[key],
         makeOpts(opts, ["unevaluatedProperties"], key)
      );
      if (!result.valid) return result;
      markEvaluatedProperty(opts, key);
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
   for (const [offset, item] of value.slice(prefixItems.length).entries()) {
      const index = prefixItems.length + offset;
      const result = items.validate(
         item,
         makeOpts(opts, ["items"], String(index))
      );
      if (!result.valid) return result;
      markEvaluatedItem(opts, index);
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

   for (let i = 0; i < value.length; i++) {
      const a = value[i];
      for (let j = 0; j < value.length; j++) {
         if (i === j) continue;
         const b = value[j];
         if (deepCompareStrict(a, b)) {
            return error(
               opts,
               "uniqueItems",
               `Duplicated items at index ${i} and ${j}`,
               value
            );
         }
      }
   }
   return valid();
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
   const matched: number[] = [];
   for (const [index, item] of value.entries()) {
      const result = contains.validate(
         item,
         makeOpts(
            {
               ...opts,
               errors: [],
               evaluated: cloneEvaluated(opts.evaluated),
            },
            ["contains"],
            String(index)
         )
      );
      if (result.valid) matched.push(index);
   }
   const occ = matched.length;
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
   for (const index of matched) markEvaluatedItem(opts, index);
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
      if (result?.valid === true) markEvaluatedItem(opts, i);
   }
   return valid();
};

export const unevaluatedItems = (
   { unevaluatedItems }: { unevaluatedItems?: Schema | false },
   value: unknown,
   opts: Opts = {}
) => {
   if (!isArray(value) || unevaluatedItems === undefined) return valid();
   if (!isSchema(unevaluatedItems)) {
      throw new InvalidTypeError(
         "unevaluatedItems must be a boolean or managed schema"
      );
   }
   const evaluated = evaluatedItems(opts);
   const unevaluated = value
      .map((_, index) => index)
      .filter((index) => !evaluated.has(index));
   if (unevaluated.length === 0) return valid();

   if (isBooleanSchema(unevaluatedItems)) {
      if (unevaluatedItems.toJSON() === true) {
         for (const index of unevaluated) markEvaluatedItem(opts, index);
         return valid();
      }
      return error(
         opts,
         "unevaluatedItems",
         "Unevaluated items are not allowed",
         unevaluated.map((index) => value[index])
      );
   }

   for (const index of unevaluated) {
      const result = unevaluatedItems.validate(
         value[index],
         makeOpts(opts, ["unevaluatedItems"], String(index))
      );
      if (!result.valid) return result;
      markEvaluatedItem(opts, index);
   }
   return valid();
};
