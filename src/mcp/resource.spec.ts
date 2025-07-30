import { describe, expect, it } from "bun:test";
import {
   extractParamValues,
   matchPath,
   Resource,
   type TResourceUri,
} from "./resource";
import { expectTypeOf } from "expect-type";

describe("resource", () => {
   it("should extract params from uri", () => {
      const uri = "users://{userId}/profile";
      const params = extractParamValues(uri, "users://123/profile");
      expect(params).toEqual({ userId: "123" });
   });

   it("should match path", () => {
      const uri = "users://{userId}/profile";
      expect(matchPath(uri, "users://123/profile")).toBe(true);
   });

   it("should not match path", () => {
      const uri = "users://{userId}/profile";
      expect(matchPath(uri, "users://123/profile/posts")).toBe(false);
   });

   it("should be dynamic", () => {
      const uri = "users://{userId}/profile";
      const resource = new Resource("users", uri, async (params, context) => {
         expectTypeOf<typeof params>().toEqualTypeOf<{ userId: string }>();
         return {
            text: `hello ${params.userId}`,
         };
      });
      expect(resource.isDynamic()).toBe(true);
   });

   it("should not be dynamic", () => {
      const uri = "users://123/profile";
      const resource = new Resource("users", uri, async (params, context) => {
         expectTypeOf<typeof params>().toEqualTypeOf<{}>();

         return {
            text: "hello user",
         };
      });
      expect(resource.isDynamic()).toBe(false);
   });

   it("should toJSON", async () => {
      {
         // dynamic
         const uri = "users://{userId}/profile";
         const resource = new Resource("users", uri, async ({ userId }) => {
            return {
               text: `hello ${userId}`,
            };
         });
         const json = resource.toJSON();
         expect(json).toEqual({
            uriTemplate: uri,
            name: "users",
            mimeType: "text/plain",
            description: undefined,
         });
      }

      {
         // static
         const uri = "users://123/profile";
         const resource = new Resource("users", uri, async () => {
            return {
               text: "hello",
            };
         });
         const json = resource.toJSON();
         expect(json).toEqual({
            uri: uri,
            name: "users",
            mimeType: "text/plain",
            description: undefined,
         });
      }
   });
});
