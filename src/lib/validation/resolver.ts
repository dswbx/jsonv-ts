import type { Schema } from "../schema/schema";
import { fromJsonPointer, getJsonPath, toJsonPointer } from "../utils/path";
import { isSchema, isString } from "../utils";

type SchemaMeta = {
   resource: string;
   pointer: string;
   key: string;
   draft: "2019-09" | "2020-12";
   validationVocabulary: boolean;
};

export type DynamicScopeFrame = {
   resolver: Resolver;
   resource: string;
};

export class Resolver {
   private static remotes = new Map<string, Schema>();
   private static owners = new WeakMap<Schema, Resolver>();
   private refs: Map<string, Schema>;
   private meta: WeakMap<Schema, SchemaMeta>;

   constructor(readonly root: Schema) {
      this.refs = new Map<string, Schema>();
      this.meta = new WeakMap<Schema, SchemaMeta>();
      this.index(
         root,
         [],
         this.resourceId(root.$id || ""),
         root.$id || "",
         this.draftFromSchema(root.$schema),
         this.hasValidationVocabulary(root)
      );
   }

   hasRef<S extends Schema>(s: S, value: unknown): s is S & { $ref: string } {
      return value !== undefined && "$ref" in s && isString(s.$ref);
   }

   hasDynamicRef<S extends Schema>(
      s: S,
      value: unknown
   ): s is S & { $dynamicRef: string } {
      return (
         value !== undefined && "$dynamicRef" in s && isString(s.$dynamicRef)
      );
   }

   resolve(ref: string, from: Schema = this.root): Schema {
      const base = this.meta.get(from)?.resource || this.meta.get(this.root)?.resource || "";
      const normalized = this.normalizeRef(ref, base);
      const refSchema = this.refs.get(normalized);
      if (refSchema) {
         return refSchema;
      }

      const [resource, fragment] = this.splitFragment(normalized);
      const remote = Resolver.remotes.get(resource);
      if (remote) {
         const remoteResolver = remote.getResolver();
         if (!fragment) return remote;
         return remoteResolver.resolve(`#${fragment}`, remote);
      }

      const rootFallback = getJsonPath(this.root, ref);
      if (isSchema(rootFallback)) return rootFallback;

      throw new Error(`ref not found: ${ref}`);
   }

   resolveDynamicRef(
      ref: string,
      from: Schema,
      dynamicScopes: DynamicScopeFrame[] = []
   ): Schema {
      const refSchema = this.resolve(ref, from);
      const anchor = this.dynamicAnchorName(ref);
      if (!anchor || refSchema.$dynamicAnchor !== anchor) {
         return refSchema;
      }

      for (const scope of dynamicScopes) {
         const scoped = scope.resolver.dynamicAnchorInResource(
            scope.resource,
            anchor
         );
         if (scoped) return scoped;
      }
      return refSchema;
   }

   static registerRemote(uri: string, schema: Schema) {
      const resource = uri.split("#")[0] || "";
      if (!schema.$id) {
         schema.$id = resource;
      }
      Resolver.remotes.set(resource, schema);
   }

   static clearRemotes() {
      Resolver.remotes.clear();
   }

   keyFor(schema: Schema): string {
      return this.meta.get(schema)?.key || "#";
   }

   resourceFor(schema: Schema = this.root): string {
      return this.meta.get(schema)?.resource || this.meta.get(this.root)?.resource || "";
   }

   draftFor(schema: Schema = this.root): "2019-09" | "2020-12" {
      return this.meta.get(schema)?.draft || this.meta.get(this.root)?.draft || "2020-12";
   }

   disablesValidationVocabulary(schema: Schema = this.root): boolean {
      const meta = this.meta.get(schema) || this.meta.get(this.root);
      return meta?.validationVocabulary === false;
   }

   owns(schema: Schema): boolean {
      return this.meta.has(schema);
   }

   static ownerOf(schema: Schema): Resolver | undefined {
      return Resolver.owners.get(schema);
   }

   private index(
      schema: Schema,
      path: (string | number)[],
      resource: string,
      base: string,
      draft: "2019-09" | "2020-12",
      validationVocabulary: boolean
   ) {
      const schemaId = schema.$id;
      const hasOwnResource = isString(schemaId) && schemaId.length > 0;
      const nextResource = hasOwnResource
         ? this.resourceId(this.resolveUri(schemaId, base))
         : resource;
      const nextDraft = schema.$schema
         ? this.draftFromSchema(schema.$schema)
         : draft;
      const nextValidationVocabulary = schema.$schema
         ? this.hasValidationVocabulary(schema)
         : validationVocabulary;
      const localPath = hasOwnResource ? [] : path;
      const pointer = this.pointer(localPath);
      const key = `${nextResource}${pointer}`;
      this.meta.set(schema, {
         resource: nextResource,
         pointer,
         key,
         draft: nextDraft,
         validationVocabulary: nextValidationVocabulary,
      });
      Resolver.owners.set(schema, this);
      this.refs.set(key, schema);
      if (hasOwnResource && path.length > 0) {
         this.refs.set(`${resource}${this.pointer(path)}`, schema);
      }

      if (pointer === "#") {
         this.refs.set(nextResource, schema);
         this.refs.set(`${nextResource}#`, schema);
      }
      if (hasOwnResource) {
         this.refs.set(nextResource, schema);
         this.refs.set(`${nextResource}#`, schema);
      }
      if (isString(schema.$anchor)) {
         this.refs.set(`${nextResource}#${schema.$anchor}`, schema);
      }
      if (isString(schema.$dynamicAnchor)) {
         this.refs.set(`${nextResource}#${schema.$dynamicAnchor}`, schema);
      }

      for (const [key, value] of Object.entries(schema)) {
         if (this.shouldSkipKey(key)) continue;
         if (isSchema(value)) {
            this.index(
               value,
               [...localPath, key],
               nextResource,
               nextResource,
               nextDraft,
               nextValidationVocabulary
            );
         } else if (Array.isArray(value)) {
            value.forEach((item, index) => {
               if (isSchema(item)) {
                  this.index(
                     item,
                     [...localPath, key, index],
                     nextResource,
                     nextResource,
                     nextDraft,
                     nextValidationVocabulary
                  );
               }
            });
         } else if (value && typeof value === "object") {
            for (const [childKey, child] of Object.entries(value)) {
               if (isSchema(child)) {
                  this.index(
                     child,
                     [...localPath, key, childKey],
                     nextResource,
                     nextResource,
                     nextDraft,
                     nextValidationVocabulary
                  );
               }
            }
         }
      }
   }

   private normalizeRef(ref: string, base: string): string {
      if (ref === "") return `${base}#`;
      if (ref.startsWith("#")) {
         return `${base}${this.normalizeFragment(ref)}`;
      }
      const resolved = this.resolveUri(ref, base);
      const [resource, fragment = ""] = this.splitFragment(resolved);
      return `${this.resourceId(resource)}${this.normalizeFragment(
         fragment ? `#${fragment}` : "#"
      )}`;
   }

   private normalizeFragment(fragment: string): string {
      if (fragment === "" || fragment === "#") return "#";
      if (fragment.startsWith("#/")) {
         return this.pointer(fromJsonPointer(fragment));
      }
      return fragment;
   }

   private resolveUri(ref: string, base: string): string {
      try {
         return new URL(ref, base || undefined).href;
      } catch (e) {
         if (!base || ref.startsWith("#")) return `${base}${ref}`;
         const [resource] = this.splitFragment(base);
         const slash = resource.lastIndexOf("/");
         const prefix = slash >= 0 ? resource.slice(0, slash + 1) : "";
         return `${prefix}${ref}`;
      }
   }

   private resourceId(uri: string): string {
      const [resource] = this.splitFragment(uri);
      return resource;
   }

   private splitFragment(uri: string): [string, string?] {
      const index = uri.indexOf("#");
      if (index === -1) return [uri];
      return [uri.slice(0, index), uri.slice(index + 1)];
   }

   private dynamicAnchorInResource(
      resource: string,
      anchor: string
   ): Schema | undefined {
      const schema = this.refs.get(`${resource}#${anchor}`);
      return schema?.$dynamicAnchor === anchor ? schema : undefined;
   }

   private dynamicAnchorName(ref: string): string | undefined {
      const index = ref.indexOf("#");
      if (index === -1) return undefined;
      const fragment = ref.slice(index + 1);
      if (!fragment || fragment.startsWith("/")) return undefined;
      return fragment;
   }

   private pointer(path: (string | number)[]) {
      return path.length === 0 ? "#" : `#${toJsonPointer(path)}`;
   }

   private shouldSkipKey(key: string) {
      return (
         key === "~standard" ||
         key === "_resolver" ||
         key === "bool" ||
         key === "type" ||
         key === "$id" ||
         key === "$schema" ||
         key === "$vocabulary" ||
         key === "$ref" ||
         key === "$dynamicRef" ||
         key === "$anchor" ||
         key === "$dynamicAnchor" ||
         key === "title" ||
         key === "description" ||
         key === "$comment" ||
         key === "default" ||
         key === "enum" ||
         key === "const"
      );
   }

   private draftFromSchema(schemaUri?: string): "2019-09" | "2020-12" {
      return schemaUri?.includes("2019-09") ? "2019-09" : "2020-12";
   }

   private hasValidationVocabulary(schema: Schema): boolean {
      if (
         schema.$schema?.includes("metaschema-no-validation") ||
         schema.$vocabulary?.["https://json-schema.org/draft/2020-12/vocab/validation"] ===
            false
      ) {
         return false;
      }
      return true;
   }
}
