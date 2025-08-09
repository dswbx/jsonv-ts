import type { Env, MiddlewareHandler, ValidationTargets } from "hono/types";
import { Tool, type ToolConfig } from "../tool";
import { type ResourceConfig, type TResourceUri } from "../resource";
import type { Hono } from "hono";
import { info, type RouteInfo } from "jsonv-ts/hono";
import { invariant, isSchema, s, Schema, type ObjectSchema } from "jsonv-ts";
import { McpServer } from "../server";
import { mcp, type McpOptionsBase } from "./mcp.middleware";

const $symbol = Symbol("mcp-feature");

export type McpFeatureTool = {
   type: "tool";
   tool: {
      name: string;
      config: Omit<ToolConfig, "inputSchema"> & {
         inputSchema?: Partial<Record<keyof ValidationTargets, ObjectSchema>>;
         noErrorCodes?: number[];
      };
   };
};

export type McpFeatureResource = {
   type: "resource";
   resource: {
      name: string;
      uri: TResourceUri;
      config: ResourceConfig;
   };
};

export type McpFeature = McpFeatureTool | McpFeatureResource;

export type McpFeatureWithRouteInfo<T extends McpFeature = McpFeature> = T & {
   info: RouteInfo<{ useSchemas: true }>;
   path: string;
};

export const mcpTool = <E extends Env, P extends string>(
   name: string,
   config: McpFeatureTool["tool"]["config"] = {}
) => {
   const handler: MiddlewareHandler<E, P> = async (c, next) => {
      await next();
   };

   return Object.assign(handler, {
      [$symbol]: {
         type: "tool",
         tool: {
            name,
            config,
         },
      },
   });
};

export const mcpResource = <E extends Env, P extends string>(
   name: string,
   uri: TResourceUri,
   config: ResourceConfig = {}
) => {
   const handler: MiddlewareHandler<E, P> = async (c, next) => {
      await next();
   };

   return Object.assign(handler, {
      [$symbol]: {
         type: "resource",
         resource: {
            name,
            uri,
            config,
         },
      },
   });
};

// copied from hono src/client/utils.ts
export const replaceUrlParam = (
   urlString: string,
   params: Record<string, string | undefined>
) => {
   for (const [k, v] of Object.entries(params)) {
      const reg = new RegExp("/:" + k + "(?:{[^/]+})?\\??");
      urlString = urlString.replace(reg, v ? `/${v}` : "");
   }
   return urlString;
};

// @todo: json and form need their own key
export function infoValidationTargetsToSchema(
   validation: Partial<Record<keyof ValidationTargets, ObjectSchema>> = {},
   opts?: {
      noSpecialTargetKeys?: boolean;
   }
) {
   const count = Object.values(validation || {}).length;
   if (count === 0) return undefined;

   // if a target is not an object shape, we need to wrap it in a param
   for (const [target, schema] of Object.entries(validation)) {
      if (schema && !schema.type) {
         validation[target] = s.object({
            [target]: schema,
         });
      }
   }

   //const schemas = Object.values(validation || {});
   const schemas = Object.entries(validation || {}).reduce((acc, [k, v]) => {
      if (v.type === "object") {
         for (const [, v2] of Object.entries(v.properties || {})) {
            // @ts-ignore
            v2.$target = k;
         }
      }

      acc.push(v);
      return acc;
   }, [] as Schema[]);

   return s.allOf(schemas) as ObjectSchema;
}

export function payloadToValidationTargetPayload(
   payload: object,
   schema: Schema
) {
   invariant(isSchema(schema), "schema must be a schema", schema);
   invariant(
      schema.type === "object",
      "schema must be an object schema",
      schema
   );

   const props = (schema as ObjectSchema).properties;
   const result: Partial<Record<keyof ValidationTargets, Record<string, any>>> =
      {};

   for (const [k, v] of Object.entries(props)) {
      // @ts-ignore
      const target = v.$target;
      invariant(target, "target must be a string", v);
      result[target] = result[target] ?? {};
      result[target][k] = payload[k];
   }

   return result;
}

export function featureInfoToRequest(
   feature: McpFeatureWithRouteInfo,
   params: any,
   opts?: {
      headers?: Record<string, string | undefined>;
      inputSchema?: ObjectSchema;
   }
) {
   const inputSchema =
      opts?.inputSchema ??
      infoValidationTargetsToSchema(feature.info.validation);
   const targets = inputSchema
      ? payloadToValidationTargetPayload(params, inputSchema)
      : {};

   const url = new URL("https://localhost");
   const method = feature.info.method ?? "GET";
   const headers: Record<string, string | undefined> = opts?.headers ?? {};
   const searchParams: Record<string, string> = {};
   let body: any = undefined;

   url.pathname = targets.param
      ? replaceUrlParam(feature.path, targets.param)
      : feature.path;

   if (targets.query) {
      for (const [k, v] of Object.entries(targets.query)) {
         if (v !== undefined && v !== null) {
            searchParams[k] = v;
         }
      }
   }

   if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      if (targets.json) {
         headers["content-type"] = "application/json";
         body = JSON.stringify(targets.json);
      } else if (targets.form) {
         body = new FormData();
         for (const [k, v] of Object.entries(targets.form)) {
            body.append(k, v);
         }
      }
   } else if (method === "GET") {
      if (targets.form) {
         headers["content-type"] = "application/x-www-form-urlencoded";
         for (const [k, v] of Object.entries(targets.form)) {
            searchParams[k] = v;
         }
      }
   }

   if (targets.header) {
      for (const [k, v] of Object.entries(targets.header)) {
         headers[k] = v;
      }
   }

   url.search = new URLSearchParams(searchParams).toString();

   // @todo: cookies

   return new Request(url.toString(), {
      method,
      headers: Object.fromEntries(
         Object.entries(headers).filter(([, v]) => v !== undefined)
      ) as HeadersInit,
      body,
   });
}

export function getMcpFeatures(hono: Hono<any>) {
   const opts = { useSchemas: true };
   const details = info(hono, opts);
   const features: McpFeatureWithRouteInfo[] = [];

   for (const route of hono.routes) {
      if ($symbol in route.handler) {
         const feature = route.handler[$symbol] as McpFeature;
         const method = route.method.toUpperCase();
         const routeDetails = details[route.path]?.[method];

         if (!routeDetails || !routeDetails.handler) {
            throw new Error(`Route ${route.path} has no handler`);
         }

         // @todo: check if there are validation key overlaps

         features.push({
            ...feature,
            path: route.path,
            info: routeDetails as any,
         });
      }
   }

   return features;
}

function sortInputSchema(inputSchema: ObjectSchema) {
   inputSchema.properties = Object.fromEntries(
      Object.entries(inputSchema.properties).sort(([, a], [, b]) => {
         const getPriority = (prop: Schema) => {
            const isPath = (prop as any).$target === "param";
            const isRequired = !prop.isOptional();

            if (isPath && isRequired) return 1; // path && required
            if (isPath) return 2; // path
            if (isRequired) return 3; // required
            return 4; // everything else
         };

         return getPriority(a) - getPriority(b);
      })
   );

   return inputSchema;
}

export function getMcpServer(hono: Hono<any>) {
   const features = getMcpFeatures(hono);
   const server = new McpServer();

   for (const feature of features) {
      if (feature.type === "tool") {
         let inputSchema = infoValidationTargetsToSchema(
            feature.tool.config.inputSchema ?? feature.info.validation
         );

         if (inputSchema) {
            inputSchema = sortInputSchema(inputSchema);
         }

         const tool = new Tool(
            feature.tool.name,
            {
               description: feature.info.openAPI?.summary,
               ...feature.tool.config,
               inputSchema,
            },
            async (params, c) => {
               const headers = {
                  authorization:
                     c.raw instanceof Request
                        ? c.raw.headers.get("authorization") ?? undefined
                        : undefined,
               };

               const request = featureInfoToRequest(feature, params, {
                  inputSchema,
                  headers,
               });
               const response = await hono.request(request);
               if (
                  !response.ok &&
                  !feature.tool.config.noErrorCodes?.includes(response.status)
               ) {
                  let error = `HTTP ${response.status} ${response.statusText}`;
                  try {
                     const json = await response.json();
                     if (json) {
                        error = JSON.stringify(json);
                     }
                  } catch (e) {}

                  throw new Error(error);
               }

               if (
                  response.headers
                     .get("content-type")
                     ?.includes("application/json")
               ) {
                  return c.json(await response.json());
               }

               return c.text(await response.text());
            }
         );

         server.addTool(tool);
      }
   }

   return server;
}

export function withMcp<H extends Hono<any>>(
   hono: H,
   opts: Omit<McpOptionsBase, "server"> = {}
) {
   const server = getMcpServer(hono);
   return hono.use(
      mcp({
         server,
         ...opts,
      })
   );
}
