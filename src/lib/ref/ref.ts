import { Schema, type ISchemaOptions } from "../schema/schema";
import type { Static, StaticCoerced } from "../static";
import type { CoercionOptions } from "../validation/coerce";
import { isSchema } from "../utils";

export type TRefType = Schema & { $id: string };

export class RefType<
   const T extends TRefType | unknown | undefined,
   const Ref extends string | undefined,
   Out = T extends TRefType ? Static<T> : T,
   Coerced = T extends TRefType ? StaticCoerced<T> : T
   // @todo: should be "O"
> extends Schema<ISchemaOptions, Out, Coerced> {
   override readonly $ref: Ref;

   constructor(ref: T, $ref: Ref) {
      if (!$ref && !isSchema(ref)) {
         throw new Error("Ref not set");
      } else if (isSchema(ref) && !ref.$id) {
         throw new Error("Ref must have an $id");
      }

      // @ts-expect-error
      const _ref = $ref ?? ref?.$id;

      super(
         {
            $ref: _ref,
         },
         {
            coerce: (value: unknown, opts?: CoercionOptions) => {
               const ref = opts?.resolver?.resolve(this.$ref!, this);
               if (!isSchema(ref)) {
                  throw new Error(`Ref not found: ${this.$ref}`);
               }
               return ref.coerce(value, opts);
            },
         }
      );
      this.$ref = _ref;
   }
}

export const ref = <const T extends TRefType, const Ref extends string>(
   ref: T,
   $ref?: Ref
) => {
   return new RefType<T, Ref>(ref, $ref!);
};

export const refId = <T = unknown, const Ref extends string = string>(
   $ref: Ref
): RefType<T, Ref> => {
   return new RefType<T, Ref>(undefined!, $ref!);
};

// @todo: only # refs supported for now
export const recursive = <const T extends Schema>(
   cb: (thisSchema: Schema) => T
) => {
   const self = new Schema({
      $ref: "#",
      coerce: (value: unknown, opts?: CoercionOptions) => {
         const ref = opts?.resolver?.resolve("#", self);
         if (!isSchema(ref)) {
            throw new Error(`Ref not found: #`);
         }
         return ref.coerce(value, opts);
      },
   });
   return cb(self) as T;
};
