import { Resolver } from "./resolver";
import type { Schema } from "../schema/schema";

export type CoercionOptions = {
   dropUnknown?: boolean;
   resolver?: Resolver;
   depth?: number;
};

// placeholder file
export function coerce(
   s: Schema,
   _value: unknown,
   opts: CoercionOptions = {}
): unknown {
   let value = _value;
   try {
      value = structuredClone(_value);
   } catch (e) {
      value = JSON.parse(JSON.stringify(_value));
   }

   const ctx: Required<CoercionOptions> = {
      resolver: opts.resolver || new Resolver(s),
      depth: opts.depth || 0,
      // should be removed in favor of additionalProperties
      dropUnknown: opts.dropUnknown ?? false,
   };

   if (ctx.resolver.hasRef(s, value)) {
      return ctx.resolver.resolve(s.$ref).coerce(value, {
         ...ctx,
         depth: ctx.depth + 1,
      });
   }

   return value;
}
