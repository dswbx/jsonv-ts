import type { IAnySchema, Schema } from "../schema";
import { fromSchema } from "../schema/from-schema";
import type { Static } from "../static";
import type { StaticCoerced } from "../static";
import type { ErrorDetail } from "../utils/details";

export class InvalidSchemaError extends Error {
   constructor(
      public schema: Schema,
      public value: unknown,
      public errors: ErrorDetail[] = []
   ) {
      super(
         `Invalid schema given for ${JSON.stringify(value, null, 2)}\n\n` +
            `Error: ${JSON.stringify(errors[0], null, 2)}`
      );
   }

   first() {
      return this.errors[0]!;
   }

   firstToString() {
      const first = this.first();
      return `${first.error} at ${first.instanceLocation}`;
   }
}

export type ParseOptions = {
   withDefaults?: boolean;
   withExtendedDefaults?: boolean;
   coerce?: boolean;
   coerceDropUnknown?: boolean;
   clone?: boolean;
   onError?: (errors: ErrorDetail[]) => void;
};

const cloneSchema = <S extends Schema>(schema: S): S => {
   const json = schema.toJSON();
   return fromSchema(json) as S;
};

export function parse<
   S extends Schema,
   Options extends ParseOptions = ParseOptions
>(
   _schema: S,
   v: unknown,
   opts?: Options
): Options extends { coerce: true } ? StaticCoerced<S> : Static<S> {
   const schema = (
      opts?.clone ? cloneSchema(_schema as any) : _schema
   ) as Schema;
   let value =
      opts?.coerce !== false
         ? schema.coerce(v, { dropUnknown: opts?.coerceDropUnknown ?? false })
         : v;
   if (opts?.withDefaults !== false) {
      value = schema.template(value, {
         withOptional: true,
         withExtendedOptional: opts?.withExtendedDefaults ?? false,
      });
   }

   const result = _schema.validate(value, {
      shortCircuit: true,
      ignoreUnsupported: true,
   });
   if (!result.valid) {
      if (opts?.onError) {
         opts.onError(result.errors);
      } else {
         throw new InvalidSchemaError(schema, v, result.errors);
      }
   }

   return value as any;
}
