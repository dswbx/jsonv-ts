# Hono Integration

<!-- TOC depthfrom:2 updateonsave:true -->

-  [Validator Middleware](#validator-middleware)
-  [OpenAPI generation](#openapi-generation)

<!-- /TOC -->

## Validator Middleware

If you're using [Hono](https://hono.dev/) and want to validate the request targets (query, body, etc.), you can use the `validator` middleware.

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

It also automatically coerces e.g. query parameters to the corresponding type.

```ts
import { Hono } from "hono";
import { validator } from "jsonv-ts/hono";
import { s } from "jsonv-ts";

const app = new Hono().get(
   "/query",
   validator("query", s.object({ count: s.number() })),
   (c) => {
      const query = c.req.valid("query");
      //    ^? { count: number }
      return c.json(query);
   }
);
```

## OpenAPI generation

Every route that uses the `validator` middleware will be automatically added to the OpenAPI specification. Additionally, you can use the `describeRoute` function to add additional information to the route, or add routes that don't use any validations:

```ts
import { Hono } from "hono";
import { describeRoute } from "jsonv-ts/hono";

const app = new Hono().get(
   "/",
   describeRoute({ summary: "Hello, world!" }),
   (c) => c.json({ foo: "bar" })
);
```

To then generate the OpenAPI specification, you can use the `openAPISpecs` function at a desired path:

```ts
import { openAPISpecs } from "jsonv-ts/hono";

const app = /* ... your hono app */;
app.get("/openapi.json", openAPISpecs(app, { info: { title: "My API" } }));
```

You may then use Swagger UI to view the API documentation:

```ts
import { swaggerUI } from "@hono/swagger-ui";

const app = /* ... your hono app */;
app.get("/swagger", swaggerUI({ url: "/openapi.json" }));
```
