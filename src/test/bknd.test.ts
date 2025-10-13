import { describe, expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import * as s from "../lib";
import { assertJson } from "../lib/assert";
import { type CoercionOptions } from "../lib";
import { isObject } from "../lib/utils";
import * as tb from "@sinclair/typebox";
import { Type, Static as TbStatic } from "@sinclair/typebox";
import { Default } from "@sinclair/typebox/value";

describe("Field", () => {
   const ActionContext = ["create", "read", "update", "delete"] as const;
   const TmpContext = [
      "create",
      "read",
      "update",
      "delete",
      "form",
      "table",
      "submit",
   ] as const;

   const DEFAULT_REQUIRED = false;
   const DEFAULT_FILLABLE = true;
   const DEFAULT_HIDDEN = false;

   const baseFieldConfig = s
      .object(
         {
            label: s.string(),
            description: s.string(),
            required: s.boolean({ default: DEFAULT_REQUIRED }),
            virtual: s.boolean({ default: false }),
            default_value: s.any(),
            fillable: s.anyOf(
               [
                  s.boolean({ title: "Boolean", default: DEFAULT_FILLABLE }),
                  s.array(s.string({ enum: ActionContext, title: "Context" }), {
                     uniqueItems: true,
                  }),
               ],
               {
                  default: DEFAULT_FILLABLE,
               }
            ),
            hidden: s.anyOf(
               [
                  s.boolean({ title: "Boolean", default: DEFAULT_HIDDEN }),
                  s.array(s.string({ enum: TmpContext, title: "Context" }), {
                     uniqueItems: true,
                  }),
               ],
               {
                  default: DEFAULT_HIDDEN,
               }
            ),
         },
         {
            additionalProperties: false,
         }
      )
      .partial();
   type InferredBaseFieldConfig = s.Static<typeof baseFieldConfig>;

   test("BaseField config", () => {
      expectTypeOf<InferredBaseFieldConfig>().toEqualTypeOf<{
         label?: string;
         description?: string;
         required?: boolean;
         virtual?: boolean;
         default_value?: any;
         fillable?: boolean | ("create" | "read" | "update" | "delete")[];
         hidden?:
            | boolean
            | (
                 | "create"
                 | "read"
                 | "update"
                 | "delete"
                 | "form"
                 | "table"
                 | "submit"
              )[];
      }>();

      expect(baseFieldConfig.template()).toEqual(undefined as any);
      expect(baseFieldConfig.template({}, { withOptional: true })).toEqual({
         required: false,
         virtual: false,
         fillable: true,
         hidden: false,
      });
   });

   test("NumberField config", () => {
      const schema = s
         .object({
            default_value: s.number(),
            minimum: s.number(),
            maximum: s.number(),
            exclusiveMinimum: s.boolean(),
            exclusiveMaximum: s.boolean(),
            multipleOf: s.number(),
         })
         .partial();
      type Inferred = s.Static<typeof schema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{
         default_value?: number;
         minimum?: number;
         maximum?: number;
         exclusiveMinimum?: boolean;
         exclusiveMaximum?: boolean;
         multipleOf?: number;
         [key: string]: unknown;
      }>();

      assertJson(schema, {
         type: "object",
         properties: {
            default_value: { type: "number" },
            minimum: { type: "number" },
            maximum: { type: "number" },
            exclusiveMinimum: { type: "boolean" },
            exclusiveMaximum: { type: "boolean" },
            multipleOf: { type: "number" },
         },
      });

      const combined = s
         .object({
            ...baseFieldConfig.properties,
            ...schema.properties,
         })
         .partial();
      type CombinedInferred = s.Static<typeof combined>;
      expectTypeOf<CombinedInferred>().toEqualTypeOf<{
         [key: string]: unknown;
         default_value?: number;
         minimum?: number;
         maximum?: number;
         exclusiveMinimum?: boolean;
         exclusiveMaximum?: boolean;
         multipleOf?: number;
         label?: string;
         description?: string;
         required?: boolean;
         virtual?: boolean;
         fillable?: boolean | ("create" | "read" | "update" | "delete")[];
         hidden?:
            | boolean
            | (
                 | "create"
                 | "read"
                 | "update"
                 | "delete"
                 | "form"
                 | "table"
                 | "submit"
              )[];
      }>();
   });

   test("TextField", () => {
      const textFieldConfigSchema = s
         .strictObject({
            default_value: s.string(),
            minLength: s.number(),
            maxLength: s.number(),
            pattern: s.string(),
            html_config: s.object({
               element: s.string({ default: "input" }),
               props: s.record(
                  s.anyOf([
                     s.string({ title: "String" }),
                     s.number({ title: "Number" }),
                  ])
               ),
            }),
         })
         .partial();

      /* console.log("template", textFieldConfigSchema.template());
      console.log(
         "template",
         textFieldConfigSchema.template({}, { withOptional: true })
      ); */
   });

   test.skip("walk", () => {
      console.log(
         [...baseFieldConfig.walk()].map((n) => ({
            ...n,
            schema: n.schema.constructor.name,
         }))
      );
   });
});

describe("AppServer", () => {
   const schema = s
      .object({
         cors: s
            .object(
               {
                  origin: s.string({ default: "*" }),
                  allow_methods: s.array(
                     s.string({ enum: ["GET", "POST", "PUT", "DELETE"] }),
                     {
                        uniqueItems: true,
                     }
                  ),
                  allow_headers: s.array(s.string(), { uniqueItems: true }),
               },
               { default: {} }
            )
            .strict(),
      })
      .strict();
   type Inferred = s.Static<typeof schema>;
   expectTypeOf<Inferred>().toEqualTypeOf<{
      cors: {
         origin: string;
         allow_methods: ("GET" | "POST" | "PUT" | "DELETE")[];
         allow_headers: string[];
      };
   }>();

   assertJson(schema, {
      type: "object",
      properties: {
         cors: {
            type: "object",
            default: {},
            additionalProperties: false,
            properties: {
               origin: { type: "string", default: "*" },
               allow_methods: {
                  type: "array",
                  items: {
                     type: "string",
                     enum: ["GET", "POST", "PUT", "DELETE"],
                  },
                  uniqueItems: true,
               },
               allow_headers: {
                  type: "array",
                  items: { type: "string" },
                  uniqueItems: true,
               },
            },
            required: ["origin", "allow_methods", "allow_headers"],
         },
      },
      required: ["cors"],
      additionalProperties: false,
   });
});

describe("misc", () => {
   test("RepoQuery", () => {
      const numberOrString = (c: s.INumberOptions = {}) =>
         s.anyOf([s.number(c), s.string()], {
            coerce: Number,
         });
      const n = numberOrString();
      type NumberOrStringCoerced = s.StaticCoerced<typeof n>;
      expectTypeOf<NumberOrStringCoerced>().toEqualTypeOf<number>();

      const stringArray = s.anyOf(
         [
            s.string(),
            s.array(s.string(), {
               uniqueItems: true,
            }),
         ],
         {
            coerce: (v): string[] => {
               if (Array.isArray(v)) {
                  return v;
               }
               return [String(v)];
            },
         }
      );
      type StringArrayIn = s.Static<typeof stringArray>;
      expectTypeOf<StringArrayIn>().toEqualTypeOf<string | string[]>();
      type StringArrayOut = s.StaticCoerced<typeof stringArray>;
      expectTypeOf<StringArrayOut>().toEqualTypeOf<string[]>();

      const sortObj = s
         .object({
            by: s.string(),
            dir: s.string({ enum: ["asc", "desc"] }),
         })
         .strict();
      type SortObj = s.Static<typeof sortObj>;
      expectTypeOf<SortObj>().toEqualTypeOf<{
         by: string;
         dir: "asc" | "desc";
      }>();

      const sort = s.anyOf([s.string(), sortObj], {
         coerce: (v): SortObj => {
            if (typeof v === "string") {
               return { by: v, dir: "asc" };
            }
            return v as SortObj;
         },
      });
      type SortIn = s.Static<typeof sort>;
      expectTypeOf<SortIn>().toEqualTypeOf<
         | string
         | {
              by: string;
              dir: "asc" | "desc";
           }
      >();
      type SortOut = s.StaticCoerced<typeof sort>;
      expectTypeOf<SortOut>().toEqualTypeOf<{
         by: string;
         dir: "asc" | "desc";
      }>();

      const repoQuery = s
         .object({
            limit: numberOrString({ default: 10 }),
            offset: numberOrString({ default: 0 }),
            sort,
            select: stringArray,
            join: stringArray,
         })
         .partial();
      type RepoQueryIn = s.Static<typeof repoQuery>;
      expectTypeOf<RepoQueryIn>().toEqualTypeOf<{
         [key: string]: unknown;
         limit?: number | string;
         offset?: number | string;
         sort?: string | { by: string; dir: "asc" | "desc" };
         select?: string | string[];
         join?: string | string[];
      }>();

      type RepoQueryOut = s.StaticCoerced<typeof repoQuery>;
      expectTypeOf<RepoQueryOut>().toEqualTypeOf<{
         limit?: number;
         offset?: number;
         sort?: { by: string; dir: "asc" | "desc" };
         select?: string[];
         join?: string[];
         [key: string]: unknown;
      }>();

      expect(repoQuery.coerce({ limit: "11", select: "id" })).toEqual({
         limit: 11,
         select: ["id"],
      });
   });

   test("RepoQuery2", () => {
      // -------
      // helpers
      const stringIdentifier = s.string({
         // allow "id", "id,title" – but not "id," or "not allowed"
         pattern: "^(?:[a-zA-Z_$][\\w$]*)(?:,[a-zA-Z_$][\\w$]*)*$",
      });
      const numberOrString = (c: s.INumberOptions = {}) =>
         s.anyOf([s.number(c), s.string()], {
            coerce: Number,
         });
      const stringArray = s.anyOf(
         [
            stringIdentifier,
            s.array(stringIdentifier, {
               uniqueItems: true,
            }),
         ],
         {
            coerce: (v): string[] => {
               if (Array.isArray(v)) {
                  return v;
               } else if (typeof v === "string") {
                  if (v.includes(",")) {
                     return v.split(",");
                  }
                  return [v];
               }
               return [];
            },
         }
      );

      // -------
      // sorting
      const sortDefault = { by: "id", dir: "asc" };
      const sortSchema = s.object({
         by: s.string(),
         dir: s.string({ enum: ["asc", "desc"] }).optional(),
      });
      type SortSchema = s.Static<typeof sortSchema>;
      const sort = s.anyOf([s.string(), sortSchema], {
         default: sortDefault,
         coerce: (v): SortSchema => {
            if (typeof v === "string") {
               if (/^-?[a-zA-Z_][a-zA-Z0-9_.]*$/.test(v)) {
                  const dir = v[0] === "-" ? "desc" : "asc";
                  return { by: dir === "desc" ? v.slice(1) : v, dir } as any;
               } else if (/^{.*}$/.test(v)) {
                  return JSON.parse(v) as any;
               }

               return sortDefault as any;
            }
            return v as any;
         },
      });

      // ------
      // filter
      const where = s.anyOf([s.string(), s.object({})], {
         coerce: (value: unknown) => {
            const q = typeof value === "string" ? JSON.parse(value) : value;
            return { [Symbol("where")]: q };
         },
      });
      type WhereSchemaIn = s.Static<typeof where>;
      type WhereSchema = s.StaticCoerced<typeof where>;

      // ------
      // with
      // @todo: waiting for recursion support
      type RepoWithSchema = Record<
         string,
         Omit<RepoQueryIn, "with"> & {
            with?: unknown;
         }
      >;

      const withSchema = s.anyOf(
         [
            stringIdentifier,
            s.array(stringIdentifier),
            s.refId<RepoQueryIn>("#"),
         ],
         {
            coerce: function (
               // @ts-expect-error need to fix
               this: TAnyOf<any>,
               _value: unknown,
               opts: CoercionOptions = {}
            ) {
               let value: any = _value;

               if (typeof value === "string") {
                  // if stringified object
                  if (value.match(/^\{/) || value.match(/^\[/)) {
                     value = JSON.parse(value) as RepoWithSchema;
                  } else if (value.includes(",")) {
                     value = value.split(",");

                     // if single string
                  } else {
                     value = [value];
                  }
               }

               if (!isObject(value)) {
                  value = value.reduce((acc, v) => {
                     acc[v] = {};
                     return acc;
                  }, {} as any) as RepoWithSchema;
               }

               const ref = opts?.resolver?.resolve("#")!;
               for (const k in value) {
                  value[k] = ref.coerce(value[k], opts);
               }

               return value;
            },
         }
      );

      // ==========
      // REPO QUERY
      const repoQuery = s
         .object({
            limit: numberOrString({ default: 10 }),
            offset: numberOrString({ default: 0 }),
            sort,
            where,
            select: stringArray,
            join: stringArray,
            with: withSchema,
         })
         .partial();
      type RepoQueryIn = {
         limit?: number;
         offset?: number;
         sort?: string | { by: string; dir: "asc" | "desc" };
         select?: string[];
         with?: string | string[] | Record<string, RepoQueryIn>;
         join?: string[];
         where?: any;
      };
      type RepoQuery = s.StaticCoerced<typeof repoQuery>;
   });

   test("RepoQuery2", () => {
      // -------
      // helpers
      const stringIdentifier = s.string({
         // allow "id", "id,title" – but not "id," or "not allowed"
         pattern: "^(?:[a-zA-Z_$][\\w$]*)(?:,[a-zA-Z_$][\\w$]*)*$",
      });
      const stringArray = s.anyOf(
         [
            stringIdentifier,
            s.array(stringIdentifier, {
               uniqueItems: true,
            }),
         ],
         {
            coerce: (v): string[] => {
               if (Array.isArray(v)) {
                  return v;
               } else if (typeof v === "string") {
                  if (v.includes(",")) {
                     return v.split(",");
                  }
                  return [v];
               }
               return [];
            },
         }
      );

      // -------
      // sorting
      const sortDefault = { by: "id", dir: "asc" };
      const sortSchema = s.object({
         by: s.string(),
         dir: s.string({ enum: ["asc", "desc"] }).optional(),
      });
      type SortSchema = s.Static<typeof sortSchema>;
      const sort = s.anyOf([s.string(), sortSchema], {
         default: sortDefault,
         coerce: (v): SortSchema => {
            if (typeof v === "string") {
               if (/^-?[a-zA-Z_][a-zA-Z0-9_.]*$/.test(v)) {
                  const dir = v[0] === "-" ? "desc" : "asc";
                  return { by: dir === "desc" ? v.slice(1) : v, dir } as any;
               } else if (/^{.*}$/.test(v)) {
                  return JSON.parse(v) as any;
               }

               return sortDefault as any;
            }
            return v as any;
         },
      });

      // ------
      // filter
      const where = s.anyOf([s.string(), s.object({})], {
         coerce: (value: unknown) => {
            const q = typeof value === "string" ? JSON.parse(value) : value;
            return { [Symbol("where")]: q };
         },
      });
      type WhereSchemaIn = s.Static<typeof where>;
      type WhereSchema = s.StaticCoerced<typeof where>;

      // ------
      // with
      // @todo: waiting for recursion support
      type RepoWithSchema = Record<
         string,
         Omit<RepoQueryIn, "with"> & {
            with?: unknown;
         }
      >;

      const withSchema = <In, Out = In>(self: s.Schema): any =>
         s.anyOf([stringIdentifier, s.array(stringIdentifier), self], {
            coerce: function (_value: unknown, opts: CoercionOptions = {}) {
               let value: any = _value;

               if (typeof value === "string") {
                  // if stringified object
                  if (value.match(/^\{/) || value.match(/^\[/)) {
                     value = JSON.parse(value);
                  } else if (value.includes(",")) {
                     value = value.split(",");

                     // if single string
                  } else {
                     value = [value];
                  }
               }

               if (!isObject(value)) {
                  value = value.reduce((acc, v) => {
                     acc[v] = {};
                     return acc;
                  }, {} as any);
               }

               for (const k in value) {
                  value[k] = self.coerce(value[k], opts);
               }

               return value as unknown as any;
            },
         }) as any;

      // ==========
      // REPO QUERY
      const repoQuery = s
         .recursive((self) =>
            s.object({
               limit: s.number({ default: 10 }),
               offset: s.number({ default: 0 }),
               sort,
               where,
               select: stringArray,
               join: stringArray,
               // ts-expect-error need to fix
               with: withSchema<RepoWithSchema>(self),
            })
         )
         .partial();
      type RepoQueryIn = {
         limit?: number;
         offset?: number;
         sort?: string | { by: string; dir: "asc" | "desc" };
         select?: string[];
         with?: string | string[] | Record<string, RepoQueryIn>;
         join?: string[];
         where?: any;
      };
      type RepoQuery = s.StaticCoerced<typeof repoQuery>;

      expect(
         repoQuery.coerce({
            limit: 1,
            with: {
               posts: { limit: "1", with: ["comments"] },
            },
         })
      ).toEqual({
         limit: 1,
         with: {
            posts: { limit: 1, with: { comments: {} } },
         },
      });
      /*console.log("coerced", repoQuery.coerce({ limit: "10" }));
      console.log("coerced2", s.number().coerce(false)); */

      /* console.log("parse", repoQuery.coerce(example));
      console.log(
         "validate",
         repoQuery.validate(example, {
            ignoreUnsupported: true,
         })
      ); */
   });

   test("schema object additional properties", () => {
      const schema = s.strictObject({
         s: s.strictObject(
            {
               a: s.string({ default: "b" }),
               b: s.strictObject(
                  {
                     c: s.string({ default: "d" }),
                     e: s.string({ default: "f" }),
                  },
                  { default: {} }
               ),
            },
            { default: {} }
         ),
      });
   });
});

describe("schemas", () => {
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

   test("AppServer", () => {
      const serverMethods = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;
      const schemas = {
         jsonv: s
            .object({
               cors: s
                  .object({
                     origin: s.string({ default: "*" }),
                     allow_methods: s.array(s.string({ enum: serverMethods }), {
                        default: serverMethods,
                        uniqueItems: true,
                     }),
                     allow_headers: s.array(s.string(), {
                        default: [
                           "Content-Type",
                           "Content-Length",
                           "Authorization",
                           "Accept",
                        ],
                     }),
                  })
                  .strict(),
            })
            .strict(),
         typebox: Type.Object(
            {
               cors: Type.Object(
                  {
                     origin: Type.String({ default: "*" }),
                     allow_methods: Type.Array(StringEnum(serverMethods), {
                        default: serverMethods,
                        uniqueItems: true,
                     }),
                     allow_headers: Type.Array(Type.String(), {
                        default: [
                           "Content-Type",
                           "Content-Length",
                           "Authorization",
                           "Accept",
                        ],
                     }),
                  },
                  { default: {}, additionalProperties: false }
               ),
            },
            {
               additionalProperties: false,
            }
         ),
      };

      expect(schemas.jsonv.template()).toEqual({
         cors: {
            origin: "*",
            allow_methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
            allow_headers: [
               "Content-Type",
               "Content-Length",
               "Authorization",
               "Accept",
            ],
         },
      });
      expect(
         schemas.jsonv.template({
            cors: {
               origin: "https",
               allow_methods: ["GET", "POST"],
            },
         })
      ).toEqual({
         cors: {
            origin: "https",
            allow_methods: ["GET", "POST"],
            allow_headers: [
               "Content-Type",
               "Content-Length",
               "Authorization",
               "Accept",
            ],
         },
      });
   });

   test("AppMedia partial", async () => {
      const schema = s.strictObject(
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
            adapter: s.any().optional(),
         },
         {
            default: {},
         }
      );

      const payload = {
         enabled: true,
         storage: {},
         adapter: { type: "local", config: { path: "./" } },
      };
   });
});
