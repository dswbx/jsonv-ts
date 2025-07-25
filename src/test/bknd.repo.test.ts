import { describe, test, expect } from "bun:test";

import { s } from "../lib";
import type {
   anyOf,
   CoercionOptions,
   Schema,
   Static,
   StaticCoerced,
} from "../lib";
import { isObject } from "../lib/utils";

const $console = console;
class WhereBuilder {
   static convert(value: unknown) {
      return value;
   }
}
type WhereQuery = ReturnType<typeof WhereBuilder.convert>;

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
      default: [],
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
const sortSchema = s
   .object({
      by: s.string(),
      dir: s.string({ enum: ["asc", "desc"] }).optional(),
   })
   .strict();
type SortSchema = Static<typeof sortSchema>;
const sort = s.anyOf([s.string(), sortSchema], {
   default: sortDefault,
   coerce: (v): SortSchema => {
      if (typeof v === "string") {
         if (/^-?[a-zA-Z_][a-zA-Z0-9_.]*$/.test(v)) {
            const dir = v[0] === "-" ? "desc" : "asc";
            return { by: dir === "desc" ? v.slice(1) : v, dir } as any;
         } else if (/^{.*}$/.test(v)) {
            return {
               ...sortDefault,
               ...JSON.parse(v),
            } as any;
         }

         $console.warn(`Invalid sort given: '${JSON.stringify(v)}'`);
         return sortDefault as any;
      } else if (isObject(v)) {
         return {
            ...sortDefault,
            ...v,
         } as any;
      }
      return v as any;
   },
});

// ------
// filter
const where = s.anyOf([s.string(), s.object({})], {
   default: {},
   examples: [
      {
         attribute: {
            $eq: 1,
         },
      },
   ],
   coerce: (value: unknown) => {
      const q = typeof value === "string" ? JSON.parse(value) : value;
      return WhereBuilder.convert(q);
   },
});
//type WhereSchemaIn = s.Static<typeof where>;
//type WhereSchema = s.StaticCoerced<typeof where>;

// ------
// with
// @todo: waiting for recursion support
export type RepoWithSchema = Record<
   string,
   Omit<RepoQueryIn, "with"> & {
      with?: unknown;
   }
>;

const withSchema = <Type = unknown>(self: Schema): Schema<{}, Type, Type> =>
   s.anyOf([stringIdentifier, s.array(stringIdentifier), self], {
      coerce: function (
         this: typeof anyOf,
         _value: unknown,
         opts: CoercionOptions = {}
      ) {
         let value: any = _value;

         if (typeof value === "string") {
            // if stringified object
            if (value.match(/^\{/) || value.match(/^\[/)) {
               value = JSON.parse(value);
            } else if (value.includes(",")) {
               value = value.split(",");
            } else {
               value = [value];
            }
         }

         // Convert arrays to objects
         if (Array.isArray(value)) {
            value = value.reduce((acc, v) => {
               acc[v] = {};
               return acc;
            }, {} as any);
         }

         // Handle object case
         if (isObject(value)) {
            for (const k in value) {
               value[k] = self.coerce(value[k], opts);
            }
         }

         return value as unknown as any;
      },
   }) as any;

// ==========
// REPO QUERY
export const repoQuery = s.recursive((self) =>
   s
      .object({
         limit: s.number({ default: 10 }),
         offset: s.number({ default: 0 }),
         sort,
         where,
         select: stringArray,
         join: stringArray,
         with: withSchema<RepoWithSchema>(self),
      })
      .partial()
);
export const getRepoQueryTemplate = () =>
   repoQuery.template(
      {},
      {
         withOptional: true,
      }
   ) as Required<RepoQuery>;

export type RepoQueryIn = {
   limit?: number;
   offset?: number;
   sort?: string | { by: string; dir: "asc" | "desc" };
   select?: string[];
   with?: string | string[] | Record<string, RepoQueryIn>;
   join?: string[];
   where?: WhereQuery;
};
export type RepoQuery = StaticCoerced<typeof repoQuery> & {
   sort: SortSchema;
};

//export type RepoQuery = s.StaticCoerced<typeof repoQuery>;
// @todo: CURRENT WORKAROUND
/* export type RepoQuery = {
   limit?: number;
   offset?: number;
   sort?: { by: string; dir: "asc" | "desc" };
   select?: string[];
   with?: Record<string, RepoQuery>;
   join?: string[];
   where?: WhereQuery;
}; */

describe("bknd.repo", () => {
   test("query", () => {
      const input = {
         select: ["title"],
         limit: 100000,
         offset: 0,
         sort: "id",
      };

      /* console.log(repoQuery.coerce(input));
      console.log(
         repoQuery.coerce(input, {
            dropUnknown: true,
         })
      ); */
   });
});
