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
   dependencies,
   unevaluatedItems,
   unevaluatedProperties,
   ifThenElse,
} from "./keywords";
import { format } from "./format";
import { Resolver, type DynamicScopeFrame } from "./resolver";
import { toJsonPointer } from "../utils/path";

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
   dependencies,
   minProperties,
   maxProperties,
   propertyNames,
   properties,
   patternProperties,
   additionalProperties,
   unevaluatedProperties,
   minItems,
   maxItems,
   uniqueItems,
   contains,
   prefixItems,
   items,
   unevaluatedItems,
   if: ifThenElse,
};

export type EvaluatedLocations = {
   properties: Map<string, Set<string>>;
   items: Map<string, Set<number>>;
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
   evaluated?: EvaluatedLocations;
   localEvaluatedBase?: EvaluatedLocations;
   assertFormat?: boolean;
   disableValidationVocab?: boolean;
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
      evaluated: opts.evaluated || createEvaluatedLocations(),
      localEvaluatedBase: opts.localEvaluatedBase || createEvaluatedLocations(),
      assertFormat: opts.assertFormat ?? true,
      disableValidationVocab:
         opts.disableValidationVocab ??
         resolver.disablesValidationVocabulary(s),
   };
   const localEvaluatedBase = cloneEvaluated(ctx.evaluated);

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
      evaluated: ctx.evaluated,
      localEvaluatedBase,
      assertFormat: ctx.assertFormat,
      disableValidationVocab: ctx.disableValidationVocab,
   };

   // only check keywords that exist on the schema for better performance
   for (const keyword in s) {
      if (keyword === "unevaluatedItems" || keyword === "unevaluatedProperties")
         continue;
      if (shouldSkipKeyword(keyword, s, ctx)) continue;
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

   for (const keyword of ["unevaluatedItems", "unevaluatedProperties"]) {
      if (!(keyword in s) || s[keyword] === undefined) continue;
      if (shouldSkipKeyword(keyword, s, ctx)) continue;
      const validator = keywords[keyword];
      if (!validator || value === undefined) continue;
      keywordCtx.errors = [];
      const result = validator(s, value, keywordCtx);
      if (!result.valid) {
         if (opts.shortCircuit) {
            return result;
         }
         ctx.errors.push(...result.errors);
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

function shouldSkipKeyword(
   keyword: string,
   schema: Schema,
   opts: CtxValidationOptions
) {
   if (keyword === "prefixItems" && opts.resolver.draftFor(schema) === "2019-09")
      return true;
   return opts.disableValidationVocab && validationVocabularyKeywords.has(keyword);
}

const validationVocabularyKeywords = new Set([
   "type",
   "const",
   "enum",
   "multipleOf",
   "maximum",
   "exclusiveMaximum",
   "minimum",
   "exclusiveMinimum",
   "maxLength",
   "minLength",
   "pattern",
   "format",
   "maxItems",
   "minItems",
   "uniqueItems",
   "maxContains",
   "minContains",
   "maxProperties",
   "minProperties",
   "required",
   "dependentRequired",
]);

export function createEvaluatedLocations(): EvaluatedLocations {
   return {
      properties: new Map(),
      items: new Map(),
   };
}

export function cloneEvaluated(
   evaluated: EvaluatedLocations = createEvaluatedLocations()
): EvaluatedLocations {
   return {
      properties: new Map(
         [...evaluated.properties.entries()].map(([path, props]) => [
            path,
            new Set(props),
         ])
      ),
      items: new Map(
         [...evaluated.items.entries()].map(([path, items]) => [
            path,
            new Set(items),
         ])
      ),
   };
}

export function mergeEvaluated(
   target: EvaluatedLocations,
   source: EvaluatedLocations
) {
   for (const [path, props] of source.properties.entries()) {
      const targetProps = target.properties.get(path) || new Set<string>();
      for (const prop of props) targetProps.add(prop);
      target.properties.set(path, targetProps);
   }
   for (const [path, items] of source.items.entries()) {
      const targetItems = target.items.get(path) || new Set<number>();
      for (const item of items) targetItems.add(item);
      target.items.set(path, targetItems);
   }
}

export function markEvaluatedProperty(opts: ValidationOptions, property: string) {
   const evaluated = opts.evaluated || createEvaluatedLocations();
   opts.evaluated = evaluated;
   const path = instanceKey(opts);
   const props = evaluated.properties.get(path) || new Set<string>();
   props.add(property);
   evaluated.properties.set(path, props);
}

export function markEvaluatedItem(opts: ValidationOptions, index: number) {
   const evaluated = opts.evaluated || createEvaluatedLocations();
   opts.evaluated = evaluated;
   const path = instanceKey(opts);
   const items = evaluated.items.get(path) || new Set<number>();
   items.add(index);
   evaluated.items.set(path, items);
}

export function evaluatedProperties(opts: ValidationOptions): Set<string> {
   return opts.evaluated?.properties.get(instanceKey(opts)) || new Set();
}

export function evaluatedItems(opts: ValidationOptions): Set<number> {
   return opts.evaluated?.items.get(instanceKey(opts)) || new Set();
}

export function instanceKey(opts: ValidationOptions) {
   return toJsonPointer(opts.instancePath || []);
}
