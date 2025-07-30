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

export type ResourceOptions = {
   mimeType?: string;
   title?: string;
   description?: string;
};

export type ResourceHandlerCtx<Context extends object = object> = {
   text: (text: string) => ResourceResponse;
   json: (json: object) => ResourceResponse;
   binary: (binary: Uint8Array) => ResourceResponse;
   context: Context;
   uri: TResourceUri;
   request: Request;
};

export type ResourceResponse = {
   mimeType?: string;
} & (
   | {
        text: string;
     }
   | { blob: string }
);

export class Resource<
   Name extends string,
   Uri extends TResourceUri,
   Context extends object = {},
   Params = Uri extends TResourceUri ? ExtractParams<Uri> : never
> {
   constructor(
      public readonly name: Name,
      public readonly uri: Uri,
      public readonly handler: (
         params: Params,
         ctx: ResourceHandlerCtx<Context>
      ) => Promise<ResourceResponse>,
      public readonly options: ResourceOptions = {
         mimeType: "text/plain",
      }
   ) {}

   isDynamic(): boolean {
      return this.uri.includes("{");
   }

   matches(uri: Uri): boolean {
      return matchPath(this.uri, uri);
   }

   async call(
      uri: TResourceUri,
      context: Context,
      request: Request
   ): Promise<ResourceResponse> {
      const params = extractParamValues(this.uri, uri) as Params;
      return await this.handler(params, {
         context,
         uri,
         request,
         text: (text: string) => ({
            mimeType: "text/plain",
            text: String(text),
         }),
         json: (json: object) => ({
            mimeType: "application/json",
            text: JSON.stringify(json),
         }),
         binary: (binary: File | Uint8Array) => ({
            mimeType:
               binary instanceof File
                  ? binary.type
                  : "application/octet-stream",
            blob: binary instanceof File ? binary : (new Blob([binary]) as any),
         }),
      });
   }

   async toJSONContent(
      context: Context,
      uri: TResourceUri = this.uri,
      request: Request = new Request(uri)
   ) {
      const { uriTemplate, ...rest } = this.toJSON();
      return {
         ...rest,
         uri,
         ...(await this.call(uri, context, request)),
      };
   }

   toJSON() {
      return {
         [this.isDynamic() ? "uriTemplate" : "uri"]: this.uri,
         name: this.name,
         title: this.options.title,
         description: this.options.description,
         mimeType: this.options.mimeType,
      };
   }
}

export type ResourceFactoryProps<
   Name extends string = string,
   Uri extends TResourceUri = TResourceUri,
   Context extends object = {},
   Params = Uri extends TResourceUri ? ExtractParams<Uri> : never
> = {
   name: Name;
   uri: Uri;
   handler: (
      params: Params,
      ctx: ResourceHandlerCtx<Context>
   ) => Promise<ResourceResponse>;
} & ResourceOptions;

export function resource<
   Name extends string = string,
   Uri extends TResourceUri = TResourceUri,
   Context extends object = {},
   Params = Uri extends TResourceUri ? ExtractParams<Uri> : never
>(opts: ResourceFactoryProps<Name, Uri, Context, Params>) {
   const { name, uri, handler, ...options } = opts;
   return new Resource(name, uri, handler, options);
}
