import type { Schema } from "../schema/schema";
import type { ErrorDetail } from "../utils/details";
import {
   _type,
   _const,
   _enum,
   maxLength,
   minLength,
   pattern,
   multipleOf,
   maximum,
   minimum,
   exclusiveMaximum,
   exclusiveMinimum,
   required,
   minProperties,
   maxProperties,
   minItems,
   maxItems,
   uniqueItems,
   contains,
   prefixItems,
   items,
   additionalProperties,
   patternProperties,
   properties,
   propertyNames,
   allOf,
   anyOf,
   oneOf,
   not,
   dependentRequired,
   dependentSchemas,
   ifThenElse,
} from "./keywords";
import { format } from "./format";
import { Resolver, type DynamicScopeFrame } from "./resolver";

type TKeywordFn = (
   schema: object,
   value: unknown,
   opts: Omit<ValidationOptions, "coerce">
) => ValidationResult;

export const keywords: Record<string, TKeywordFn> = {
   type: _type,
   const: _const,
   enum: _enum,
   allOf,
   anyOf,
   oneOf,
   not,
   minLength,
   maxLength,
   pattern,
   format,
   minimum,
   exclusiveMinimum,
   maximum,
   exclusiveMaximum,
   multipleOf,
   required,
   dependentRequired,
   dependentSchemas,
   minProperties,
   maxProperties,
   propertyNames,
   properties,
   patternProperties,
   additionalProperties,
   minItems,
   maxItems,
   uniqueItems,
   contains,
   prefixItems,
   items,
   if: ifThenElse,
};

export type ValidationOptions = {
   keywordPath?: string[];
   instancePath?: string[];
   coerce?: boolean;
   errors?: ErrorDetail[];
   shortCircuit?: boolean;
   ignoreUnsupported?: boolean;
   resolver?: Resolver;
   depth?: number;
   skipClone?: boolean;
   evaluatingRefs?: Set<string>;
   dynamicScopes?: DynamicScopeFrame[];
};
type CtxValidationOptions = Required<ValidationOptions>;

export type ValidationResult = {
   valid: boolean;
   errors: ErrorDetail[];
};

export function validate(
   s: Schema,
   _value: unknown,
   opts: ValidationOptions = {}
): ValidationResult {
   const resolver = opts.resolver || s.getResolver?.() || new Resolver(s);
   const ctx: CtxValidationOptions = {
      keywordPath: opts.keywordPath || [],
      instancePath: opts.instancePath || [],
      coerce: opts.coerce || false,
      errors: opts.errors || [],
      shortCircuit: opts.shortCircuit || false,
      ignoreUnsupported: opts.ignoreUnsupported || false,
      resolver,
      depth: opts.depth ? opts.depth + 1 : 0,
      skipClone: opts.skipClone || false,
      evaluatingRefs: opts.evaluatingRefs || new Set<string>(),
      dynamicScopes: withDynamicScope(s, resolver, opts.dynamicScopes),
   };

   let value: unknown;
   if (opts?.coerce && s.coerce) {
      // only clone when we're actually going to coerce (mutate) the value
      const coercedValue = s.coerce(_value, {
         resolver: ctx.resolver,
         depth: ctx.depth,
      });
      value = ctx.skipClone ? coercedValue : structuredClone(coercedValue);
   } else {
      // for read-only validation, no need to clone unless explicitly required
      value = ctx.skipClone ? _value : structuredClone(_value);
   }

   if (opts.ignoreUnsupported !== true) {
      // @todo: $ref
      const todo = [];
      for (const item of todo) {
         if (s[item]) {
            throw new Error(`${item} not implemented`);
         }
      }
   }

   // check $ref
   if (ctx.resolver.hasRef(s, value)) {
      const refSchema = ctx.resolver.resolve(s.$ref!, s);
      const result = validateResolvedRef(refSchema, value, ctx);
      if (result && !result.valid) {
         ctx.errors.push(...result.errors);
      }
   }

   if (ctx.resolver.hasDynamicRef(s, value)) {
      const refSchema = ctx.resolver.resolveDynamicRef(
         s.$dynamicRef!,
         s,
         ctx.dynamicScopes
      );
      const result = validateResolvedRef(refSchema, value, ctx);
      if (result && !result.valid) {
         ctx.errors.push(...result.errors);
      }
   }

   // create a reusable context object to avoid spreading on every keyword
   const keywordCtx = {
      keywordPath: ctx.keywordPath,
      instancePath: ctx.instancePath,
      coerce: ctx.coerce,
      errors: [] as any[],
      shortCircuit: ctx.shortCircuit,
      ignoreUnsupported: ctx.ignoreUnsupported,
      resolver: ctx.resolver,
      depth: ctx.depth,
      evaluatingRefs: ctx.evaluatingRefs,
      dynamicScopes: ctx.dynamicScopes,
   };

   // only check keywords that exist on the schema for better performance
   for (const keyword in s) {
      if (keyword === "type" && s.type !== undefined) {
         // skip type checking if value is undefined for certain cases
         if (value !== undefined) {
            const validator = keywords[keyword];
            if (validator) {
               keywordCtx.errors = []; // reset errors for this keyword
               const result = validator(s, value, keywordCtx);
               if (!result.valid) {
                  if (opts.shortCircuit) {
                     return result;
                  }
                  ctx.errors.push(...result.errors);
               }
            }
         }
      } else if (keyword in keywords && s[keyword] !== undefined) {
         // @todo: not entirely sure about this
         if (value === undefined) continue;
         const validator = keywords[keyword];
         if (validator) {
            keywordCtx.errors = []; // reset errors for this keyword
            const result = validator(s, value, keywordCtx);
            if (!result.valid) {
               if (opts.shortCircuit) {
                  return result;
               }
               ctx.errors.push(...result.errors);
            }
         }
      }
   }

   return {
      valid: ctx.errors.length === 0,
      errors: ctx.errors,
      // @ts-ignore
      //$refs: Object.fromEntries(ctx.cache.entries()),
   };
}

function validateResolvedRef(
   refSchema: Schema,
   value: unknown,
   ctx: CtxValidationOptions
): ValidationResult | undefined {
   const resolver = Resolver.ownerOf(refSchema) || ctx.resolver;
   const refKey = `${resolver.keyFor(refSchema)}@${ctx.instancePath.join("/")}`;
   if (ctx.evaluatingRefs.has(refKey)) return undefined;
   ctx.evaluatingRefs.add(refKey);
   const result = refSchema.validate(value, {
      ...ctx,
      resolver,
      errors: [],
   });
   ctx.evaluatingRefs.delete(refKey);
   return result;
}

export function withDynamicScope(
   schema: Schema,
   resolver: Resolver,
   dynamicScopes: DynamicScopeFrame[] = []
): DynamicScopeFrame[] {
   const resource = resolver.resourceFor(schema);
   const last = dynamicScopes[dynamicScopes.length - 1];
   if (last?.resolver === resolver && last.resource === resource) {
      return dynamicScopes;
   }
   return [...dynamicScopes, { resolver, resource }];
}
