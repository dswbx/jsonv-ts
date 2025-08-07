import type { ObjectSchema } from "jsonv-ts";
import type { MiddlewareHandler, ValidationTargets } from "hono";
import type { DescribeRouteOptions } from "./openapi/types";

export const $symbol = Symbol.for("jsonv");

export type RouteHandler =
   | {
        type: "parameters";
        skip?: boolean;
        value: {
           target: keyof ValidationTargets;
           schema: ObjectSchema;
        };
     }
   | {
        type: "route-doc";
        value: DescribeRouteOptions;
     };

export const symbolize = (handler: MiddlewareHandler, opts: RouteHandler) => {
   return Object.assign(handler, {
      [$symbol]: opts,
   });
};
