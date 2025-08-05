export class InvalidTypeError extends Error {
   constructor(expected: string) {
      super(`Expected ${expected}`);
   }
}

export class InvalidRawSchemaError extends Error {
   constructor(message: string, public schema: any) {
      super(`${message ?? "Invalid raw schema"}: ${JSON.stringify(schema)}`);
   }
}

export class InvariantError extends Error {
   constructor(message: string, public value: unknown) {
      super(
         `${message}, got: 'type "${typeof value}": ${JSON.stringify(value)}'`
      );
   }
}
