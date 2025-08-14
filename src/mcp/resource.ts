import type {
   MaybePromise,
   ResourceCompletionResult,
   ResourceCompletionResultLike,
} from "./utils";

type ExtractParams<T> = T extends `${infer _Start}{${infer Param}}${infer Rest}`
   ? { [K in Param | keyof ExtractParams<Rest>]: string }
   : {};

export type TResourceUri = `${string}://${string}`;

export function extractParamValues(
   template: string,
   actual: string
): Record<string, string> {
   const regex = new RegExp(
      "^" +
         template.replace(/[{](.*?)[}]/g, (_, key) => `(?<${key}>[^/]+)`) +
         "$"
   );
   const match = actual.match(regex);
   return match?.groups ?? {};
}

export function matchPath(template: string, actual: string): boolean {
   const regex = new RegExp(
      "^" + template.replace(/[{](.*?)[}]/g, "[^/]+") + "$"
   );
   return regex.test(actual);
}

export type ResourceConfig = {
   mimeType?: string;
   title?: string;
   description?: string;
   size?: number;
   list?: MaybePromise<ResourceCompletionResultLike>;
   complete?: {
      [key: string]: (
         value: string,
         context: any
      ) => MaybePromise<ResourceCompletionResultLike>;
   };
   _meta?: {
      [key: string]: unknown;
   };
};

export type ResourceHandlerCtx<Context extends object = object> = {
   text: (text: string, opts?: ResourceResponse) => ResourceResponse;
   json: (json: object, opts?: ResourceResponse) => ResourceResponse;
   binary: (binary: Uint8Array, opts?: ResourceResponse) => ResourceResponse;
   context: Context;
   uri: TResourceUri;
   raw?: unknown;
};

export type ResourceHandler<
   Uri extends TResourceUri,
   Context extends object = {}
> = (
   ctx: ResourceHandlerCtx<Context>,
   params: Uri extends TResourceUri ? ExtractParams<Uri> : never
) => MaybePromise<ResourceResponse>;

export type ResourceResponse = {
   mimeType?: string;
   title?: string;
   description?: string;
} & (
   | {
        text?: string;
     }
   | { blob?: string }
);

export type ResourceJson = ReturnType<Resource["toJSON"]>;

export class Resource<
   Name extends string = string,
   Uri extends TResourceUri = TResourceUri,
   Context extends object = {},
   Params = Uri extends TResourceUri ? ExtractParams<Uri> : never
> {
   constructor(
      public readonly name: Name,
      public readonly uri: Uri,
      public readonly handler: (
         ctx: ResourceHandlerCtx<Context>,
         params: Params
      ) => MaybePromise<ResourceResponse>,
      public readonly options: ResourceConfig = {}
   ) {}

   isDynamic(): boolean {
      return this.uri.includes("{");
   }

   matches(uri: Uri): boolean {
      return matchPath(this.uri, uri);
   }

   async suggest(
      name: string,
      value: string,
      context: object
   ): Promise<ResourceCompletionResult> {
      let items: string[] = [];

      if (this.options.complete) {
         const complete = this.options.complete[name];
         if (complete) {
            const res = await complete(value, context);
            if (!Array.isArray(res)) {
               return res;
            }
            items = res;
         }
      }
      if (this.options.list) {
         const list = await this.options.list;
         if (!Array.isArray(list)) {
            return list;
         }
         items = list;
      }

      const values = items.filter((v) => v.startsWith(value));

      return {
         values,
         total: values.length,
         hasMore: false,
      };
   }

   async call(
      uri: TResourceUri,
      context: Context,
      raw?: unknown
   ): Promise<ResourceResponse> {
      const params = extractParamValues(this.uri, uri) as Params;
      return await this.handler(
         {
            context,
            uri,
            raw,
            text: (text: string, opts?: ResourceResponse) => ({
               mimeType: "text/plain",
               text: String(text),
               ...opts,
            }),
            json: (json: object, opts?: ResourceResponse) => ({
               mimeType: "application/json",
               text: JSON.stringify(json),
               ...opts,
            }),
            binary: (binary: File | Uint8Array, opts?: ResourceResponse) => ({
               mimeType:
                  binary instanceof File
                     ? binary.type
                     : "application/octet-stream",
               blob:
                  binary instanceof File ? binary : (new Blob([binary]) as any),
               ...opts,
            }),
         },
         params
      );
   }

   async toJSONContent(
      context: Context,
      uri: TResourceUri = this.uri,
      request: Request = new Request(uri)
   ) {
      const { uriTemplate, name, title, description, ...rest } = this.toJSON();
      const res = await this.call(uri, context, request);
      return {
         ...rest,
         uri,
         name: res.title?.trim() ?? name,
         ...res,
      };
   }

   toJSON() {
      return {
         [this.isDynamic() ? "uriTemplate" : "uri"]: this.uri,
         name: this.name,
         title: this.options.title,
         description: this.options.description,
         mimeType: this.options.mimeType,
         size: this.options.size,
         _meta: this.options._meta,
      };
   }
}
