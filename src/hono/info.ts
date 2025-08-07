import type { Hono, ValidationTargets } from "hono";
import { $symbol, type RouteHandler } from "./shared";
import { merge, registerPath } from "./openapi/utils";
import type * as t from "./openapi/types";
import type { JSONSchemaDefinition, ObjectSchema } from "jsonv-ts";
import type { RouterRoute } from "hono/types";

export type RouteInfo<Options extends InfoOptions = InfoOptions> = {
   method: string;
   openAPI?: Options extends { skipOpenAPI: true }
      ? undefined
      : Partial<t.OperationObject>;
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
   const routes: Record<
      string,
      {
         [method: string]: RouteInfo<Options>;
      }
   > = {};

   for (const route of hono.routes) {
      const path = route.path;
      const method = route.method.toUpperCase();

      if (!routes[path]) {
         routes[path] = {};
      }

      if (!routes[path][method]) {
         routes[path][method] = {
            method,
         } as RouteInfo<Options>;
      }

      // always take the last handler
      if (route.handler) {
         routes[path][method].handler = route.handler;
      }

      if ($symbol in route.handler) {
         const routeHandler = route.handler[$symbol] as RouteHandler;
         if (routeHandler) {
            if (!options?.skipOpenAPI) {
               if (!routes[path][method].openAPI) {
                  routes[path][method].openAPI = {} as any;
               }
               const specs = {} as any;
               registerPath(specs, route, routeHandler);
               const specs2 = specs.paths[Object.keys(specs.paths)[0]!];

               merge(
                  routes[path][method].openAPI,
                  specs2[Object.keys(specs2)[0]!]
               );
            }

            if (routeHandler.type === "parameters") {
               if (!routes[path][method].validation) {
                  routes[path][method].validation = {};
               }

               if (
                  !routes[path][method].validation[routeHandler.value.target]
               ) {
                  // @ts-expect-error
                  routes[path][method].validation[routeHandler.value.target] =
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
