[![npm version](https://img.shields.io/npm/v/jsonv-ts.svg)](https://npmjs.org/package/jsonv-ts)
![gzipped size of jsonv-ts](https://img.badgesize.io/https://unpkg.com/jsonv-ts@latest/dist/lib/index.js?compression=gzip&label=jsonv-ts)
![gzipped size of jsonv-ts/hono](https://img.badgesize.io/https://unpkg.com/jsonv-ts@latest/dist/hono/index.js?compression=gzip&label=jsonv-ts/hono)
![gzipped size of jsonv-ts/mcp](https://img.badgesize.io/https://unpkg.com/jsonv-ts@0.4.0/dist/mcp/index.js?compression=gzip&label=jsonv-ts/mcp)

# jsonv-ts: JSON Schema Builder and Validator, Hono OpenAPI and MCP Server/Client

<!-- TOC depthfrom:2 updateonsave:true -->

-  [Installation](#installation)
-  [Examples](#examples)
   -  [Schema building and validation](#schema-building-and-validation)
   -  [Hono validation and OpenAPI generation](#hono-validation-and-openapi-generation)
   -  [MCP server and client](#mcp-server-and-client)
-  [Motivation](#motivation)
-  [Development](#development)
-  [License](#license)
-  [Acknowledgements](#acknowledgements)

<!-- /TOC -->

A simple, lightweight and dependency-free TypeScript library for defining and validating JSON schemas with static type inference.

-  Static type inference from schemas using the `Static` helper.
-  Type-safe JSON schema definition in TypeScript. [lib docs](./src/lib/README.md)
-  Hono integration for OpenAPI generation and request validation. [hono docs](./src/hono/README.md)
-  MCP server and client implementation. [mcp docs](./src/mcp/README.md)

## Installation

```bash
npm install jsonv-ts
```

## Examples

### Schema building and validation

Read the [lib docs](./src/lib/README.md) for more details.

```ts
import { s, type Static } from "jsonv-ts";

const schema = s.object({
   id: s.number(),
   username: s.string({ minLength: 3 }),
   email: s.string({ format: "email" }).optional(),
});
// {
//    "type": "object",
//    "properties": {
//       "id": { "type": "number" },
//       "username": { "type": "string", "minLength": 3 },
//       "email": { "type": "string", "format": "email" }
//    },
//    "required": ["id", "username"]
// }

// Infer the TypeScript type from the schema
type User = Static<typeof schema>;
// { id: number; username: string; email?: string | undefined }

// Example usage:
const user: User = {
   id: 123,
   username: "john_doe",
   // email is optional
};

// Type checking works as expected:
// const invalidUser: User = { id: "abc", username: "jd" }; // Type error

// Use the integrated validation
const result = schema.validate(user);
// { valid: true, errors: [] }

const result2 = schema.validate({ id: 1 });
// {
//  "valid": false,
//  "errors": [
//    {
//      "keywordLocation": "/required",
//      "instanceLocation": "/",
//      "error": "Expected object with required properties id, username",
//      "data": {
//        "id": 1
//      }
//    }
//  ]
// }
```

### Hono validation and OpenAPI generation

Read the [Hono integration docs](./src/hono/README.md) for more details.

```ts
import { Hono } from "hono";
import { validator } from "jsonv-ts/hono";
import { s } from "jsonv-ts";

const app = new Hono().post(
   "/json",
   validator("json", s.object({ name: s.string() })),
   (c) => {
      const json = c.req.valid("json");
      //    ^? { name: string }
      return c.json(json);
   }
);
```

### MCP server and client

Read the [MCP docs](./src/mcp/README.md) for more details.

```ts
import { McpServer } from "jsonv-ts/mcp";
import { s } from "jsonv-ts";

const server = new McpServer({
   name: "demo-server",
   version: "1.0.0",
});

server.tool(
   "add",
   {
      name: "add",
      description: "Add two numbers",
      inputSchema: s.object({
         a: s.number(),
         b: s.number(),
      }),
   },
   ({ a, b }, c) => c.text(String(a + b))
);

server.resource("greeting", "greeting://{name}", async (c, { name }) => {
   return c.text(`Hello, ${name}!`, {
      title: "Greeting Resource",
      description: "Dynamic greeting resource",
   });
});

// make a request to the server
const request = new Request("http://localhost", {
   method: "POST",
   body: JSON.stringify({
      jsonrpc: "2.0",
      method: "resources/read",
      params: {
         uri: "greeting://John",
      },
   }),
});

const response = await server.handle(request);
const data = await response.json();
console.log(data);
// {
//   jsonrpc: "2.0",
//   result: {
//     contents: [
//       {
//         name: "greeting",
//         title: "Greeting Resource",
//         description: "Dynamic greeting resource",
//         mimeType: "text/plain",
//         uri: "greeting://John",
//         text: "Hello, John!",
//       }
//     ],
//   },
// }
```

## Motivation

If you validate schemas only within the same code base and need comprehensive functionality, you might be better off choosing another library such as zod, TypeBox, etc.

But if you need controllable and predictable schema validation, this library is for you. I was frustrated about the lack of adherence to the JSON schema specification in other libraries, so I decided to create this library. Furthermore, most of the other libraries may reduce your IDE performance due to the sheer number of features they provide.

JSON Schema is simple, elegant and well-defined, so why not use it directly?

## Development

This project uses `bun` for package management and task running.

-  **Install dependencies:** `bun install`
-  **Run tests:** `bun test` (runs both type checks and unit tests)
-  **Run unit tests:** `bun test:unit`
-  **Run JSON Schema test suite:** `bun test:spec`
-  **Run type checks:** `bun test:types`
-  **Build the library:** `bun build` (output goes to the `dist` directory)

## License

MIT

## Acknowledgements

-  [TypeBox](https://github.com/sinclairzx81/typebox) for the inspiration, ideas, and some type inference snippets
-  [@cfworker/json-schema](https://github.com/cfworker/json-schema) for some inspiration
-  [schemasafe](https://github.com/ExodusMovement/schemasafe) for the format keywords
-  [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) for the validation tests
-  [hono-openapi](https://github.com/rhinobase/hono-openapi) for the OpenAPI generation inspiration
-  [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) for the MCP server and client reference
