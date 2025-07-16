import type { Context, Env, Input, ValidationTargets } from "hono";
import type { BlankEnv, MiddlewareHandler } from "hono/types";
import { validator as honoValidator } from "hono/validator";
import type {
   Static,
   StaticCoerced,
   Schema,
   RemoveUnknownAdditionalProperties,
   Simplify,
} from "jsonv-ts";
import { $symbol } from "./shared";

export type Options = {
   coerce?: boolean;
   dropUnknown?: boolean;
   includeSchema?: boolean;
   skipOpenAPI?: boolean;
};

type ValidationResult = {
   valid: boolean;
   errors: {
      keywordLocation: string;
      instanceLocation: string;
      error: string;
      data?: unknown;
   }[];
};

export type Hook<T, E extends Env, P extends string> = (
   result: { result: ValidationResult; data: T },
   c: Context<E, P>
) => Response | Promise<Response> | void;

export const validator = <
   S extends Schema,
   Target extends keyof ValidationTargets,
   P extends string,
   E extends Env = BlankEnv,
   Opts extends Options = Options,
   Out = Opts extends { coerce: false } ? Static<S> : StaticCoerced<S>,
   I extends Input = {
      in: { [K in Target]: Static<S> };
      out: {
         [K in Target]: Opts extends { dropUnknown: false }
            ? Out
            : Simplify<RemoveUnknownAdditionalProperties<Out>>;
      };
   }
>(
   target: Target,
   schema: S,
   options?: Opts,
   hook?: Hook<Out, E, P>
): MiddlewareHandler<E, P, I> => {
   const middleware = honoValidator(target, async (_value, c) => {
      const value =
         options?.coerce !== false
            ? schema.coerce(_value, {
                 dropUnknown: options?.dropUnknown ?? true,
              })
            : _value;
      // @ts-ignore
      const result = schema.validate(value);
      if (!result.valid) {
         return c.json({ ...result, schema }, 400);
      }

      if (hook) {
         const hookResult = hook({ result, data: value as Out }, c);
         if (hookResult) {
            return hookResult;
         }
      }

      return value as Out;
   });

   if (options?.skipOpenAPI) {
      return middleware as any;
   }

   return Object.assign(middleware, {
      [$symbol]: {
         type: "parameters",
         value: {
            target,
            schema,
         },
      },
   }) as any;
};
