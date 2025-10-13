import { describe, expect, test } from "bun:test";
import * as tb from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { Check, Default } from "@sinclair/typebox/value";
import * as s from "../lib";
import { expectTypeOf } from "expect-type";

const StringEnum = <const T extends readonly string[]>(
   values: T,
   options?: tb.StringOptions
) =>
   tb.Type.Unsafe<T[number]>({
      [tb.Kind]: "StringEnum",
      type: "string",
      enum: values,
      ...options,
   });

tb.TypeRegistry.Set("StringEnum", (schema: any, value: any) => {
   return typeof value === "string" && schema.enum.includes(value);
});

const StringRecord = <T extends tb.TSchema>(
   properties: T,
   options?: tb.ObjectOptions
) =>
   tb.Type.Object(
      {},
      { ...options, additionalProperties: properties }
   ) as unknown as tb.TRecord<tb.TString, typeof properties>;

function tbParse<Schema extends tb.TSchema>(schema: Schema, data: unknown) {
   const parsed = Default(schema, data);

   if (Check(schema, parsed)) {
      return parsed as tb.Static<typeof schema>;
   }

   throw new Error("Invalid data");
}

function jsParse<Schema extends s.Schema>(schema: Schema, data: unknown) {
   let value = schema.template(data, {
      withOptional: true,
   });

   const result = schema.validate(value, {
      shortCircuit: true,
      ignoreUnsupported: true,
   });
   if (!result.valid) {
      console.error(result.errors);
      throw new Error("Invalid data");
   }

   return value as any;
}

export function omitKeys(obj: any, keys_: readonly string[] = []): any {
   const keys = new Set(keys_);
   const result = {} as any;
   for (const [key, value] of Object.entries(obj)) {
      if (!keys.has(key)) {
         (result as any)[key] = value;
      }
   }
   return result;
}

function runTests(
   tb: tb.TSchema,
   jv: s.Schema,
   opts?: {
      ignore?: string[];
   }
) {
   const tbt = Default(tb, {});
   const jvt = jv.template({});
   expect(omitKeys(jvt, opts?.ignore)).toEqual(omitKeys(tbt, opts?.ignore));

   const jvpt = jsParse(jv, {});
   const tbpt = tbParse(tb, {});

   expect(omitKeys(jvpt, opts?.ignore)).toEqual(omitKeys(tbpt, opts?.ignore));
}

describe("bknd schema", () => {
   test("AppMedia", () => {
      const tb = Type.Object(
         {
            enabled: Type.Boolean({ default: false }),
            basepath: Type.String({ default: "/api/media" }),
            entity_name: Type.String({ default: "media" }),
            storage: Type.Object(
               {
                  body_max_size: Type.Optional(
                     Type.Number({
                        description:
                           "Max size of the body in bytes. Leave blank for unlimited.",
                     })
                  ),
               },
               { default: {} }
            ),
            adapter: Type.Optional(
               Type.Object({
                  type: Type.String({ enum: ["local", "s3"] }),
                  config: Type.Object({}),
               })
            ),
         },
         {
            additionalProperties: false,
         }
      );

      type TBStatic = tb.Static<typeof tb>;

      const jv = s.strictObject(
         {
            enabled: s.boolean({ default: false }),
            basepath: s.string({ default: "/api/media" }),
            entity_name: s.string({ default: "media" }),
            storage: s.strictObject(
               {
                  body_max_size: s
                     .number({
                        description:
                           "Max size of the body in bytes. Leave blank for unlimited.",
                     })
                     .optional(),
               },
               { default: {} }
            ),
            adapter: s
               .anyOf([
                  s.strictObject({
                     type: s.string(), // typebox doesn't support enum
                     config: s.strictObject({}),
                  }),
               ])
               .optional(),
         },
         {
            default: {},
         }
      );

      type JVStatic = s.Static<typeof jv>;

      expectTypeOf<JVStatic>().toEqualTypeOf<TBStatic>();
      runTests(tb, jv);
   });

   test("AppAuth", () => {
      const defaultCookieExpires = 60 * 60 * 24 * 7; // 1 week in seconds

      const tb = (() => {
         const cookieConfig = Type.Partial(
            Type.Object({
               path: Type.String({ default: "/" }),
               sameSite: StringEnum(["strict", "lax", "none"], {
                  default: "lax",
               }),
               secure: Type.Boolean({ default: true }),
               httpOnly: Type.Boolean({ default: true }),
               expires: Type.Number({ default: defaultCookieExpires }), // seconds
               renew: Type.Boolean({ default: true }),
               pathSuccess: Type.String({ default: "/" }),
               pathLoggedOut: Type.String({ default: "/" }),
            }),
            { default: {}, additionalProperties: false }
         );
         const jwtConfig = Type.Object(
            {
               // @todo: autogenerate a secret if not present. But it must be persisted from AppAuth
               secret: Type.String({ default: "" }),
               alg: Type.Optional(
                  StringEnum(["HS256", "HS384", "HS512"], { default: "HS256" })
               ),
               expires: Type.Optional(Type.Number()), // seconds
               issuer: Type.Optional(Type.String()),
               fields: Type.Array(Type.String(), {
                  default: ["id", "email", "role"],
               }),
            },
            {
               default: {},
               additionalProperties: false,
            }
         );

         const strategiesSchema = Type.Object({ type: Type.String() });

         const guardConfigSchema = Type.Object({
            enabled: Type.Optional(Type.Boolean({ default: false })),
         });
         const guardRoleSchema = Type.Object(
            {
               permissions: Type.Optional(Type.Array(Type.String())),
               is_default: Type.Optional(Type.Boolean()),
               implicit_allow: Type.Optional(Type.Boolean()),
            },
            { additionalProperties: false }
         );

         return Type.Object(
            {
               enabled: Type.Boolean({ default: false }),
               basepath: Type.String({ default: "/api/auth" }),
               entity_name: Type.String({ default: "users" }),
               allow_register: Type.Optional(Type.Boolean({ default: true })),
               jwt: jwtConfig,
               cookie: cookieConfig,
               strategies: Type.Optional(
                  StringRecord(strategiesSchema, {
                     title: "Strategies",
                     default: {
                        password: {
                           type: "password",
                        },
                     },
                  })
               ),
               guard: Type.Optional(guardConfigSchema),
               roles: Type.Optional(
                  StringRecord(guardRoleSchema, { default: {} })
               ),
            },
            {
               title: "Authentication",
               additionalProperties: false,
            }
         );
      })();

      type TB = tb.Static<typeof tb>;

      const jv = (() => {
         const cookieConfig = s
            .strictObject(
               {
                  path: s.string({ default: "/" }),
                  sameSite: s.string({
                     enum: ["strict", "lax", "none"],
                     default: "lax",
                  }),
                  secure: s.boolean({ default: true }),
                  httpOnly: s.boolean({ default: true }),
                  expires: s.number({ default: defaultCookieExpires }), // seconds
                  renew: s.boolean({ default: true }),
                  pathSuccess: s.string({ default: "/" }),
                  pathLoggedOut: s.string({ default: "/" }),
               },
               { default: {} }
            )
            .partial();

         const jwtConfig = s.strictObject(
            {
               // @todo: autogenerate a secret if not present. But it must be persisted from AppAuth
               secret: s.string({ default: "" }),
               alg: s
                  .string({
                     enum: ["HS256", "HS384", "HS512"],
                     default: "HS256",
                  })
                  .optional(),
               expires: s.number().optional(), // seconds
               issuer: s.string().optional(),
               fields: s.array(s.string(), {
                  default: ["id", "email", "role"],
               }),
            },
            {
               default: {},
            }
         );

         const strategiesSchema = s.strictObject({ type: s.string() });

         const guardConfigSchema = s.strictObject({
            enabled: s.boolean({ default: false }).optional(),
         });
         const guardRoleSchema = s.strictObject({
            permissions: s.array(s.string()).optional(),
            is_default: s.boolean().optional(),
            implicit_allow: s.boolean().optional(),
         });

         return s.strictObject(
            {
               enabled: s.boolean({ default: false }),
               basepath: s.string({ default: "/api/auth" }),
               entity_name: s.string({ default: "users" }),
               allow_register: s.boolean({ default: true }).optional(),
               jwt: jwtConfig,
               cookie: cookieConfig,
               strategies: s
                  .record(strategiesSchema, {
                     title: "Strategies",
                     default: {
                        password: {
                           type: "password",
                           // partial removed for tests
                        },
                     },
                  })
                  .optional(),
               guard: guardConfigSchema.optional(),
               roles: s.record(guardRoleSchema, { default: {} }).optional(),
            },
            {
               title: "Authentication",
            }
         );
      })();

      type JV = s.Static<typeof jv>;

      expectTypeOf<JV>().toEqualTypeOf<TB>();
      // tb is actually wrong on "guard"
      runTests(tb, jv, { ignore: ["guard"] });
   });
});
