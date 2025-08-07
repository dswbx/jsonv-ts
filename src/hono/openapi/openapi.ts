import type { Env, Hono } from "hono";
import type { MiddlewareHandler } from "hono/types";
import { $symbol, symbolize, type RouteHandler } from "../shared";
import { registerPath } from "./utils";
import * as t from "./types";

export const openAPISpecs = <E extends Env>(
   hono: Hono<E>,
   specs: Partial<t.Document> = {} as t.Document
) => {
   let initialized = false;

   return async (c) => {
      if (!initialized) {
         initialized = true;
         specs.paths = specs.paths ?? {};

         for (const route of hono.routes) {
            if ($symbol in route.handler) {
               const routeHandler = route.handler[$symbol] as RouteHandler;
               if (!("skip" in routeHandler) || routeHandler.skip !== true) {
                  registerPath(specs, route, routeHandler);
               }
            }
         }
      }

      return c.json({
         openapi: "3.1.0",
         info: {
            title: "API",
            version: "1.0.0",
            ...specs.info,
         },
         ...specs,
      });
   };
};

export const describeRoute = <E extends Env, P extends string>(
   specs?: t.DescribeRouteOptions
) => {
   const handler: MiddlewareHandler<E, P> = async (c, next) => {
      await next();
   };

   return symbolize(handler, {
      type: "route-doc",
      value: specs ?? {},
   });
};
