import type { Hono, ValidationTargets } from "hono";
import { $symbol, type RouteHandler } from "./shared";
import { registerPath } from "./openapi/utils";
import type * as t from "./openapi/types";
import type { JSONSchemaDefinition, ObjectSchema } from "jsonv-ts";
import type { RouterRoute } from "hono/types";

export type RouteInfo<Options extends InfoOptions = InfoOptions> = {
   methods: string[];
   openAPI?: Options extends { skipOpenAPI: true }
      ? undefined
      : Partial<t.Document>;
   validation?: Partial<
      Record<
         keyof ValidationTargets,
         Options extends { useSchemas: true }
            ? ObjectSchema
            : JSONSchemaDefinition
      >
   >;
   handler?: RouterRoute["handler"];
} & (Options extends { extra: (route: RouterRoute) => infer T } ? T : {});

export type InfoOptions = {
   // returns schema instance instead of JSON schema definition
   useSchemas?: boolean;
   // skip openapi extraction for this route
   skipOpenAPI?: boolean;
   // extra properties to add to the route info
   extra?: (route: RouterRoute) => Record<string, any>;
};

export function info<Options extends InfoOptions = InfoOptions>(
   hono: Hono<any>,
   options?: Options
) {
   const routes: Record<string, RouteInfo<Options>> = {};

   for (const route of hono.routes) {
      const path = [route.basePath, route.path]
         .filter(Boolean)
         .join("/")
         .replace(/\/+/g, "/");

      if (!routes[path]) {
         routes[path] = {
            methods: [],
         } as RouteInfo<Options>;
      }

      const method = route.method.toUpperCase();
      routes[path].methods = Array.from(
         new Set([...routes[path].methods, method])
      );

      // always take the last handler
      if (route.handler) {
         routes[path].handler = route.handler;
      }

      if ($symbol in route.handler) {
         const routeHandler = route.handler[$symbol] as RouteHandler;
         if (routeHandler) {
            if (!options?.skipOpenAPI) {
               if (!routes[path].openAPI) {
                  routes[path].openAPI = {} as any;
               }
               registerPath(routes[path].openAPI as any, route, routeHandler);
            }

            if (routeHandler.type === "parameters") {
               if (!routes[path].validation) {
                  routes[path].validation = {};
               }

               if (!routes[path].validation[routeHandler.value.target]) {
                  // @ts-expect-error
                  routes[path].validation[routeHandler.value.target] =
                     options?.useSchemas
                        ? routeHandler.value.schema
                        : routeHandler.value.schema.toJSON();
               }
            }
         }
      }
   }

   return routes;
}
