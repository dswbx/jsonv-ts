import type { Schema } from "../schema";

export const toJsonPointer = (path: (string | number)[] = [], prefix = "") => {
   return (
      "/" +
      [
         prefix,
         ...path.map((p) => {
            return String(p).replace(/~/g, "~0").replace(/\//g, "~1");
         }),
      ]
         .filter(Boolean)
         .join("/")
   );
};

export const fromJsonPointer = (pointer: string) => {
   let value = pointer;
   if (value === "#") return [];
   if (value.startsWith("#")) {
      value = value.slice(1);
      try {
         value = decodeURIComponent(value);
      } catch (e) {
         // Keep the original fragment if it is not valid percent-encoding.
      }
   }
   if (value === "") return [];
   if (!value.startsWith("/")) return [value];
   return value
      .split("/")
      .slice(1)
      .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
};

export function getJsonPath(
   object: object | Schema,
   _path: string | (string | number)[],
   defaultValue = undefined
): any {
   const path = typeof _path === "string" ? fromJsonPointer(_path) : _path;
   return getPath(object, path, defaultValue);
}

export function getPath(
   object: object | Schema,
   _path: string | (string | number)[],
   defaultValue = undefined
): any {
   const path =
      typeof _path === "string"
         ? _path.split(/[.\[\]\"]+/).filter((x) => x)
         : _path;

   if (path.length === 0) {
      return object;
   }

   try {
      const [head, ...tail] = path;
      if (!head || !(head in object)) {
         return defaultValue;
      }

      return getPath(object[head], tail, defaultValue);
   } catch (error) {
      if (typeof defaultValue !== "undefined") {
         return defaultValue;
      }

      throw new Error(`Invalid path: ${path.join(".")}`);
   }
}
