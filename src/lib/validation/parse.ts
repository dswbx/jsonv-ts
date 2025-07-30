import type { IAnySchema, Schema } from "../schema";
import { fromSchema } from "../schema/from-schema";
import type { Static } from "../static";
import type { StaticCoerced } from "../static";
import { mergeObject } from "../utils";
import type { ValidationResult } from "./validate";

export class ParseError extends Error {
   override name = "ParseError";

   constructor(public readonly result: ValidationResult) {
      const first = result.errors[0];
      super(first?.error ?? "Invalid value");
   }
}

export type ParseOptions = {
   withDefaults?: boolean;
   coerse?: boolean;
   clone?: boolean;
};

const cloneSchema = <S extends Schema>(schema: S): S => {
   const json = schema.toJSON();
   return fromSchema(json) as S;
};

export function parse<
   S extends IAnySchema,
   Opts extends ParseOptions = ParseOptions,
   Out = Opts extends { coerce: true } ? StaticCoerced<S> : Static<S>
>(_schema: S, v: unknown, opts: Opts = {} as Opts): Out {
   const schema = (
      opts.clone ? cloneSchema(_schema as any) : _schema
   ) as Schema;
   const value = opts.coerse !== false ? schema.coerce(v) : v;
   const result = schema.validate(value, {
      shortCircuit: true,
      ignoreUnsupported: true,
   });
   if (!result.valid) throw new ParseError(result);
   if (opts.withDefaults) {
      return mergeObject(schema.template({ withOptional: true }), value) as any;
   }

   return value as any;
}
