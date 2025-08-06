export {
   Schema,
   type ISchemaOptions,
   type StrictOptions,
   booleanSchema,
   type TSchemaTemplateOptions,
   type Node,
} from "./schema/schema";
export {
   any,
   literal,
   type IAnyOptions,
   type ILiteralOptions,
} from "./schema/misc";
export type {
   Static,
   Merge,
   OptionalUndefined,
   OptionallyOptional,
   StaticConstEnum,
   StaticCoerced,
   Writeable,
   DeepWriteable,
   RemoveUnknownAdditionalProperties,
   Simplify,
} from "./static";
export {
   object,
   ObjectSchema,
   type IObjectOptions,
   type TProperties,
   strictObject,
   partialObject,
   type ObjectStatic,
   type ObjectCoerced,
   type ObjectDefaults,
} from "./object/object";
export { record, RecordSchema, type IRecordOptions } from "./object/record";
export { string, StringSchema, type IStringOptions } from "./string/string";
export { number, type INumberOptions, integer } from "./number/number";
export { array, ArraySchema, type IArrayOptions } from "./array/array";
export { boolean, type IBooleanOptions } from "./boolean/boolean";
export { type IUnionOptions, anyOf, oneOf } from "./union/union";
export { allOf } from "./union/all-of";
export { fromSchema } from "./schema/from-schema";
export { RefType, ref, refId, recursive } from "./ref/ref";
export type {
   ValidationResult,
   ValidationOptions,
} from "./validation/validate";
export { error, type ErrorDetail, valid, makeOpts } from "./utils/details";
export { invariant, isSchema } from "./utils";
export { type CoercionOptions } from "./validation/coerce";
export {
   type ParseOptions,
   parse,
   InvalidSchemaError,
} from "./validation/parse";
export type { JSONSchemaDefinition } from "./types";

import { object, strictObject, partialObject } from "./object/object";
import { string } from "./string/string";
import { number, integer } from "./number/number";
import { boolean } from "./boolean/boolean";
import { array } from "./array/array";
import { record } from "./object/record";
import { literal, any } from "./schema/misc";
import { anyOf, oneOf } from "./union/union";
import { allOf } from "./union/all-of";
import { ref, refId, recursive } from "./ref/ref";

export const s = {
   boolean,
   any,
   literal,
   object,
   strictObject,
   partialObject,
   record,
   string,
   number,
   integer,
   array,
   anyOf,
   oneOf,
   allOf,
   ref,
   refId,
   recursive,
};
