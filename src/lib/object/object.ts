import {
   Schema,
   symbol,
   type ISchemaOptions,
   type StrictOptions,
   booleanSchema,
   Node,
   type WalkOptions,
} from "../schema/schema";
import type {
   Merge,
   OptionalUndefined,
   Simplify,
   Static,
   StaticCoerced,
   Writeable,
} from "../static";
import {
   invariant,
   isObject,
   isSchema,
   isPlainObject,
   pickKeys,
   safeStructuredClone,
} from "../utils";
import { getPath } from "../utils/path";

export type TProperties = {
   [key: string]: Schema;
};
export type TProperties2<P extends object> = {
   [K in keyof P]: P[K] extends Schema ? P[K] : never;
};

export type ObjectStatic<T extends TProperties> = Simplify<
   OptionalUndefined<
      // this is adding the `[key: number]: unknown` signature
      Writeable<{
         [K in keyof T]: Static<T[K]>;
      }>
   >
>;

export type ObjectCoerced<T extends TProperties> = Simplify<
   OptionalUndefined<
      Writeable<{
         [K in keyof T]: StaticCoerced<T[K]>;
      }>
   >
>;

export type ObjectDefaults<T extends TProperties> = Simplify<
   OptionalUndefined<
      Writeable<{
         [K in keyof T]: T[K] extends {
            default: infer D;
         }
            ? D
            : T[K][typeof symbol]["static"];
      }>
   >
>;

export interface IObjectOptions extends ISchemaOptions {
   $defs?: Record<string, Schema>;
   patternProperties?: Record<string, Schema>;
   additionalProperties?: Schema | false;
   minProperties?: number;
   maxProperties?: number;
   propertyNames?: Schema;
}

// @todo: add base object type
// @todo: add generic coerce and template that also works with additionalProperties, etc.

export class ObjectSchema<
   const P extends TProperties = TProperties,
   const O extends IObjectOptions = IObjectOptions
> extends Schema<
   O,
   O extends { additionalProperties: false }
      ? ObjectStatic<P>
      : Simplify<Merge<ObjectStatic<P> & { [key: string]: unknown }>>,
   O extends { additionalProperties: false }
      ? ObjectCoerced<P>
      : Simplify<Merge<ObjectCoerced<P> & { [key: string]: unknown }>>
> {
   override readonly type = "object";
   properties: P;
   required: string[] | undefined;
   //additionalProperties: Schema | undefined;

   constructor(properties: P, o?: O) {
      let required: string[] | undefined = [];
      for (const [key, value] of Object.entries(properties || {})) {
         invariant(
            isSchema(value),
            "properties must be managed schemas",
            value
         );
         if (!value[symbol].optional) {
            required.push(key);
         }
      }

      const additionalProperties =
         o?.additionalProperties === false
            ? booleanSchema(false)
            : o?.additionalProperties;

      required = required.length > 0 ? required : undefined;
      super(
         {
            ...o,
            additionalProperties,
            properties,
            required,
         } as any,
         {
            template: (_value, opts) => {
               let value = structuredClone(isObject(_value) ? _value : {});
               const result: Record<string, unknown> = { ...value };

               if (this.properties) {
                  for (const [key, property] of Object.entries(
                     this.properties
                  )) {
                     const v = getPath(value, key);

                     if (property.isOptional()) {
                        if (
                           opts?.withOptional !== true &&
                           v === undefined &&
                           _value === undefined
                        ) {
                           continue;
                        }
                     }

                     const template = property.template(v, opts);
                     if (template !== undefined) {
                        result[key] = template;
                     }
                  }
               }

               if (
                  Object.keys(result).length === 0 &&
                  !opts?.withExtendedOptional
               ) {
                  return undefined;
               }

               return result;
            },
            coerce: (_value, opts) => {
               const propertyKeys = Object.keys(this.properties);
               let value = safeStructuredClone(_value);

               // schema can only be strict if there are properties
               // and all properties are not optional
               const is_strict =
                  propertyKeys.length > 0 &&
                  Object.values(this.properties).every(
                     (p) => !p[symbol].optional
                  );

               if (
                  isPlainObject(value) &&
                  // drop unknown if explicitly requested or if the schema is strict
                  (opts?.dropUnknown === true || is_strict)
               ) {
                  value = pickKeys(value, propertyKeys);
               }

               if (typeof value === "string") {
                  // if stringified object
                  if (value.match(/^\{/)) {
                     value = JSON.parse(value);
                  }
               }

               if (typeof value !== "object" || value === null) {
                  return undefined;
               }

               if (this.properties) {
                  for (const [key, property] of Object.entries(
                     this.properties
                  )) {
                     const v = value[key];
                     if (v !== undefined) {
                        // @ts-ignore
                        value[key] = property.coerce(v, opts);
                     }
                  }
               }

               // additional properties (current hack)
               // dropUnknown should be removed and rely on ap instead
               // @ts-expect-error
               const ap = this.additionalProperties as Schema | undefined;
               if (
                  opts?.dropUnknown !== true &&
                  (!ap || ap.validate(null).valid)
               ) {
                  const v = isObject(_value) ? _value : {};
                  const add_keys = Object.keys(v).filter(
                     (key) => !propertyKeys.includes(key)
                  );

                  for (const key of add_keys) {
                     value[key] = ap ? ap.coerce(v[key], opts) : v[key];
                  }
               }

               return value;
            },
         }
      );
      this.properties = properties;
      this.required = required;
   }

   strict() {
      // it's important to set properties on the active instance
      // because of potential inheritance

      // @ts-expect-error
      this.additionalProperties = booleanSchema(false);
      this[symbol].raw.additionalProperties = false;

      return this as unknown as ObjectSchema<
         P,
         Merge<O & { additionalProperties: false }>
      >;
   }

   partial() {
      // it's important to set properties on the active instance
      // because of potential inheritance

      for (const [, prop] of Object.entries(this.properties)) {
         prop[symbol].optional = true;
      }
      this.required = undefined;

      return this as unknown as ObjectSchema<
         {
            [Key in keyof P]: P[Key] extends Schema<infer O, infer T, infer C>
               ? Schema<
                    O,
                    P[Key][typeof symbol]["static"] | undefined,
                    P[Key][typeof symbol]["coerced"] | undefined
                 >
               : never;
         },
         O
      >;
   }

   override children(opts?: WalkOptions): Node[] {
      const nodes: Node[] = [];

      for (const [key, value] of Object.entries(this.properties)) {
         const node = new Node(value, opts);
         node.appendInstancePath([key]);
         node.appendKeywordPath(["properties", key]);
         nodes.push(node);
      }

      return nodes;
   }
}

// @todo: this is a hack to get the type inference to work
// cannot make P extends TProperties, destroys the type inference atm
export const object = <
   const P extends TProperties2<P>,
   const O extends IObjectOptions
>(
   properties: P,
   options?: StrictOptions<IObjectOptions, O>
): ObjectSchema<P, O> & O => new ObjectSchema(properties, options) as any;

export const strictObject = <
   const P extends TProperties2<P>,
   const O extends IObjectOptions
>(
   properties: P,
   options?: StrictOptions<IObjectOptions, O>
) => object(properties, options).strict();

export const partialObject = <
   const P extends TProperties2<P>,
   const O extends IObjectOptions
>(
   properties: P,
   options?: StrictOptions<IObjectOptions, O>
) => object(properties, options).partial();
