# lib: JSON Schema Builder and Validator for TypeScript

The schemas composed can be used with any JSON schema validator, it strips all metadata when being JSON stringified. It has an integrated validator that can be used to validate instances against the latest JSON schema draft (2020-12).

`jsonv-ts` allows you to define JSON schemas using a TypeScript API. It provides functions for all standard JSON schema types (`object`, `string`, `number`, `array`, `boolean`) as well as common patterns like `optional` fields, union types (`anyOf`, `oneOf`, and `allOf`), and constants/enums. The `Static` type helper infers the corresponding TypeScript type directly from your schema definition.

<!-- TOC depthfrom:2 updateonsave:true -->

-  [Schema Types](#schema-types)
   -  [Strings](#strings)
   -  [Numbers](#numbers)
   -  [Integers](#integers)
   -  [Booleans](#booleans)
   -  [Literals](#literals)
   -  [Arrays](#arrays)
   -  [Objects](#objects)
      -  [Strict Object](#strict-object)
      -  [Partial Object](#partial-object)
      -  [Record](#record)
   -  [Unions](#unions)
   -  [Any](#any)
   -  [From Schema](#from-schema)
   -  [Custom Schemas](#custom-schemas)
-  [Validation](#validation)
   -  [Integrated Validator](#integrated-validator)
      -  [Using Standard Schema](#using-standard-schema)
   -  [Using ajv](#using-ajv)
   -  [Using @cfworker/json-schema](#using-cfworkerjson-schema)
   -  [Using json-schema-library](#using-json-schema-library)

<!-- /TOC -->

## Schema Types

Below are the primary functions for building schemas:

### Strings

Defines a string type. Optional `schema` can include standard JSON schema string constraints like `minLength`, `maxLength`, `pattern`, `format`, etc.

```ts
const schema = s.string({ format: "email" });
// { type: "string", format: "email" }

type Email = Static<typeof schema>; // string
```

To define an Enum, you can add the `enum` property to the schema. It'll be inferred correctly.

```ts
const schema = s.string({ enum: ["red", "green", "blue"] });
// { type: "string", enum: [ "red", "green", "blue" ] }

type Color = Static<typeof schema>; // "red" | "green" | "blue"
```

The same applies to Constants:

```ts
const schema = s.string({ const: "active" });
// { type: "string", const: "active" }

type Status = Static<typeof schema>; // "active"
```

### Numbers

Defines a number type. Optional `schema` can include `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`.

```ts
const schema = s.number({ minimum: 0 });
// { type: "number", minimum: 0 }

type PositiveNumber = Static<typeof schema>; // number
```

Just like with Strings, you can use Enums and Constants with Numbers:

```ts
const enumSchema = s.number({ enum: [18, 21, 25] });
// { type: "number", enum: [ 18, 21, 25 ] }

type Age = Static<typeof enumSchema>; // 18 | 21 | 25

const constSchema = s.number({ const: 200 });
// { type: "number", const: 200 }

type Status = Static<typeof constSchema>; // 200
```

### Integers

Defines an integer type. This is a shorthand for `s.number({ type: "integer", ...props })`.

### Booleans

Defines a boolean type.

```ts
const schema = s.boolean();
// { type: "boolean" }

type Active = Static<typeof schema>; // boolean
```

### Literals

The `literal` schema type defines a schema that only accepts a specific value. It's useful for defining constants or enums with a single value.

```ts
const schema = s.literal(1);
// { const: 1 }

type One = Static<typeof schema>; // 1
```

It can be used with all primitive types, arrays and objects:

```ts
// String literal
const strSchema = s.literal("hello");
type Hello = Static<typeof strSchema>; // "hello"

// Number literal
const numSchema = s.literal(42);
type FortyTwo = Static<typeof numSchema>; // 42

// Boolean literal
const boolSchema = s.literal(true);
type True = Static<typeof boolSchema>; // true

// Null literal
const nullSchema = s.literal(null);
type Null = Static<typeof nullSchema>; // null

// Undefined literal
const undefSchema = s.literal(undefined);
type Undefined = Static<typeof undefSchema>; // undefined

// Object literal
const objSchema = s.literal({ name: "hello" });
type Obj = Static<typeof objSchema>; // { name: "hello" }

// Array literal
const arrSchema = s.literal([1, "2", true]);
type Arr = Static<typeof arrSchema>; // [1, "2", true]
```

You can also add additional schema properties:

```ts
const schema = s.literal(1, { title: "number" });
// { const: 1, title: "number" }
```

### Arrays

Defines an array type where all items must match the `items` schema.

```ts
const schema = s.array(s.string({ minLength: 1 }), { minItems: 1 });
// { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 }

type Tags = Static<typeof schema>; // string[]
```

### Objects

Defines an object type with named `properties`. By default, all properties defined are required. Use `optional()` to mark properties as optional.

```ts
const schema = s.object({
   productId: s.integer(),
   name: s.string(),
   price: s.number({ minimum: 0 }),
   description: s.string().optional(), // Optional property
});
// {
//   type: "object",
//   properties: {
//     productId: { type: "integer" },
//     name: { type: "string" },
//     price: { type: "number", minimum: 0 },
//     description: { type: "string" }
//   },
//   required: [ "productId", "name", "price" ]
// }

type Product = Static<typeof schema>;
// {
//   productId: number;
//   name: string;
//   price: number;
//   description?: string | undefined;
//   [key: string]: unknown;
// }
```

#### Strict Object

You may also use the `s.strictObject()` function to create a strict object schema which sets `additionalProperties` to `false`.

```ts
const schema = s.strictObject({
   id: s.integer(),
   username: s.string().optional(),
});
// {
//   type: "object",
//   properties: {
//     id: { type: "integer" },
//     username: { type: "string" }
//   },
//   required: ["id"],
//   additionalProperties: false,
// }

type StrictProduct = Static<typeof schema>;
// {
//   productId: number;
//   name: string;
//   price: number;
//   description?: string | undefined;
// }
//
// note that `[key: string]: unknown` is not added to the type now

// it's equivalent to:
const schema = s.object(
   {
      id: s.integer(),
      username: s.string().optional(),
   },
   {
      additionalProperties: false,
   }
);
```

#### Partial Object

The `partialObject` function creates an object schema where all properties are optional. This is useful when you want to make all properties of an object optional without having to call `.optional()` on each property individually.

```ts
const schema = s.partialObject({
   name: s.string(),
   age: s.number(),
});
// {
//   type: "object",
//   properties: {
//     name: { type: "string" },
//     age: { type: "number" }
//   }
// }

type User = Static<typeof schema>;
// { name?: string; age?: number; [key: string]: unknown }
```

You can also combine it with `additionalProperties: false` to create a strict partial object:

```ts
const schema = s.partialObject(
   {
      name: s.string(),
      age: s.number(),
   },
   { additionalProperties: false }
);
// {
//   type: "object",
//   properties: {
//     name: { type: "string" },
//     age: { type: "number" }
//   },
//   additionalProperties: false
// }

type User = Static<typeof schema>;
// { name?: string; age?: number }
```

#### Record

Or for records, use `s.record()`.

```ts
const schema = s.record(s.string());
// {
//   type: "object",
//   additionalProperties: {
//     type: "string"
//   }
// }

type User = Static<typeof schema>;
// { [key: string]: string; [key: string]: unknown }
```

### Unions

Combine multiple schemas using union keywords:

-  `anyOf(schemas: TSchema[])`: Must match at least one of the provided schemas.
-  `oneOf(schemas: TSchema[])`: Must match exactly one of the provided schemas.
-  `allOf(schemas: TSchema[])`: Must match all of the provided schemas.

```ts
import { s, type Static } from "jsonv-ts";

const schema = s.anyOf([s.string(), s.number()]);
// { anyOf: [ { type: "string" }, { type: "number" } ] }

type StringOrNumber = Static<typeof schema>; // string | number
```

### Any

The `any` schema type allows any value to pass validation. It's useful when you need to accept any type of value in your schema.

```ts
const schema = s.any(); // {}
type AnyValue = Static<typeof schema>; // any
```

It can be used in objects to allow any type for a property:

```ts
const schema = s.object({
   name: s.any().optional(),
});
// {
//   type: "object",
//   properties: {
//     name: {}
//   }
// }

type User = Static<typeof schema>;
// { name?: any }
```

### From Schema

In case you need schema functionality such as validation of coercion, but only have raw JSON schema definitions, you may use `s.fromSchema()`:

```ts
import { fromSchema } from "jsonv-ts";

const schema = fromSchema({
   type: "string",
   maxLength: 10,
});
```

There is no type inference, but it tries to read the schema added and maps it to the corresponding schema function. In this case, `s.string()` will be used. The benefit of using this function over `s.schema()` (described below) is that coercion logic is applied.

This function is mainly added to perform the tests against the JSON Schema Test Suite.

### Custom Schemas

In case you need to define a custom schema, e.g. without `type` to be added, you may simply use `s.schema()`:

```ts
import { schema } from "jsonv-ts";

const schema = schema({
   // any valid JSON schema object
   maxLength: 10,
});
```

It can also be used to define boolean schemas:

```ts
const alwaysTrue = schema(true);
const alwaysFalse = schema(false);
```

## Validation

The schemas created with `jsonv-ts` are standard JSON Schema objects and can be used with any compliant validator. The library ensures that when the schema object is converted to JSON (e.g., using `JSON.stringify`), only standard JSON Schema properties are included, stripping any internal metadata. For the examples, this is going to be the base schema object.

```ts
import { s } from "jsonv-ts";

const schema = s.object({
   id: s.integer({ minimum: 1 }),
   username: s.string({ minLength: 3 }),
   email: s.string({ format: "email" }).optional(),
});
// { id: number, username: string, email?: string }
```

### Integrated Validator

The library includes an integrated validator that can be used to validate instances against the schema.

```ts
const result = schema.validate({ id: 1, username: "valid_user" });
// { valid: true, errors: [] }
```

**Validation Status**

-  Total tests: 1906
-  Passed: 1412 (74.08%)
-  Skipped: 440 (23.08%)
-  Failed: 0 (0.00%)
-  Optional failed: 54 (2.83%)

Todo:

-  [ ] `$ref` and `$defs`
-  [ ] `unevaluatedItems` and `unevaluatedProperties`
-  [ ] `contentMediaType`, `contentSchema` and `contentEncoding`
-  [ ] meta schemas and `vocabulary`
-  [ ] Additional optional formats: `idn-email`, `idn-hostname`, `iri`, `iri-reference`
-  [ ] Custom formats

#### Using Standard Schema

The integrated validator of `jsonv-ts` supports [Standard Schema](https://github.com/standard-schema/standard-schema). To use it, refer to the list of [tools and frameworks](https://github.com/standard-schema/standard-schema?tab=readme-ov-file#what-tools--frameworks-accept-spec-compliant-schemas) that accept spec-compliant schemas.

### Using `ajv`

```ts
import Ajv from "ajv";
import addFormats from "ajv-formats";

// ... example code from above

const ajv = new Ajv();
addFormats(ajv); // Recommended for formats like "email"

const validate = ajv.compile(schema.toJSON());

const validUser = { id: 1, username: "valid_user", email: "test@example.com" };
const invalidUser = { id: 0, username: "no" }; // Fails minimum and minLength

console.log(validate(validUser)); // true
console.log(validate(invalidUser)); // false
```

### Using `@cfworker/json-schema`

This validator is designed for environments like Cloudflare Workers and is also standards-compliant.

```ts
import { Validator } from "@cfworker/json-schema";
import { s } from "jsonv-ts";

const validator = new Validator();

// Assume UserSchema is defined as in the common example above

// Validate data directly against the schema
const validUser = { id: 1, username: "valid_user", email: "test@example.com" };
const invalidUser = { id: 0, username: "no" };

const resultValid = validator.validate(validUser, UserSchema.toJSON());
console.log(resultValid.valid); // true
// For errors: console.log(resultValid.errors);

const resultInvalid = validator.validate(invalidUser, schema.toJSON());
console.log(resultInvalid.valid); // false
// For errors: console.log(resultInvalid.errors);
```

### Using `json-schema-library`

```ts
import { compileSchema } from "json-schema-library";

const schema = compileSchema(schema.toJSON());

const validUser = { id: 1, username: "valid_user", email: "test@example.com" };
const invalidUser = { id: 0, username: "no" };

console.log(schema.validate(validUser).valid); // true
console.log(schema.validate(invalidUser).valid); // false
```
