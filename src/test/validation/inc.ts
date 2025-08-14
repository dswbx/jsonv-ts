import * as s from "../../lib";
import Ajv from "ajv";
import { compileSchema } from "json-schema-library";
import { Validator } from "@cfworker/json-schema";

export const schemas = [
   {
      name: "simple object",
      schema: s.object({
         name: s.string(),
      }),
      data: [
         [{ name: "John" }, true],
         [{ name: 1 }, false],
      ],
   },
   {
      name: "object with optional",
      schema: s.object({
         name: s.string().optional(),
         age: s.number({ minimum: 18 }),
      }),
      data: [
         [{ name: "John", age: 20 }, true],
         [{ name: "John", age: 17 }, false],
         [{ age: 18 }, true],
         [{}, false],
      ],
   },
] as const;

export type TValidator<Schema = any> = {
   name: string;
   prepare: (schema: s.Schema, data: unknown) => Schema;
   validate: (schema: Schema, data: unknown) => boolean;
};

export const validators: TValidator[] = [
   {
      name: "@cfworker/json-schema",
      prepare: (schema) => {
         return schema.toJSON();
      },
      validate: (schema, data) => {
         return new Validator(schema).validate(data).valid;
      },
   },
   {
      name: "ajv (jit)",
      prepare: (schema) => {
         return schema.toJSON();
      },
      validate: (schema, data) => {
         const ajv = new Ajv();
         return ajv.validate(schema, data);
      },
   },
   {
      name: "json-schema-library",
      prepare: (schema) => {
         return schema.toJSON();
      },
      validate: (schema, data) => {
         return compileSchema(schema).validate(data).valid;
      },
   },
   {
      name: "jsonv-ts",
      prepare: (schema) => {
         return schema;
      },
      validate: (schema, data) => {
         return schema.validate(data).valid;
      },
   },
];
