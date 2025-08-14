import {
   createSchema,
   Schema,
   type ISchemaOptions,
   type StrictOptions,
} from "../schema/schema";
import { isNumber, isString } from "../utils";

export interface IStringOptions extends ISchemaOptions {
   maxLength?: number;
   minLength?: number;
   pattern?: string | RegExp;
   format?: string;
}

export class StringSchema<
   const O extends IStringOptions = IStringOptions
> extends Schema<O, string> {
   override readonly type = "string";

   constructor(o?: O) {
      super(o, {
         template: (value, opts) => {
            if (!opts?.withExtendedOptional) return value;
            if (value === undefined || !isString(value)) return "";
            return value;
         },
         coerce: (value) => {
            if (isNumber(value)) return String(value);
            return value as string;
         },
      });
   }

   override toJSON() {
      const { pattern, "~standard": _, _resolver, ...rest } = this as any;
      return JSON.parse(
         JSON.stringify({
            ...rest,
            pattern: pattern instanceof RegExp ? pattern.source : pattern,
         })
      );
   }
}

export const string = <const O extends IStringOptions>(
   o?: StrictOptions<IStringOptions, O>
): StringSchema<O> & O => new StringSchema(o) as any;

export const string1 = <const O extends IStringOptions>(
   o?: StrictOptions<IStringOptions, O>
): Schema<O, string> & O => new StringSchema(o) as any;

export const string2 = <const O extends IStringOptions>(
   o?: StrictOptions<IStringOptions, O>
): Schema<O, string> & O =>
   createSchema("string", o, {
      template: (value) => value ?? "",
      coerce: (value) => {
         if (isNumber(value)) return String(value);
         return value as string;
      },
   }) as any;
