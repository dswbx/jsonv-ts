import {
   Node,
   Schema,
   type ISchemaOptions,
   type StrictOptions,
   type WalkOptions,
} from "../schema";
import type { Simplify, Static, StaticCoerced } from "../static";
import { isObject } from "../utils";

type RecordStatic<AP extends Schema> = Simplify<Record<string, Static<AP>>>;
type RecordCoerced<AP extends Schema> = Simplify<
   Record<string, StaticCoerced<AP>>
>;

export interface IRecordOptions extends ISchemaOptions {
   additionalProperties?: never;
   maxProperties?: number;
   minProperties?: number;
   propertyNames?: Schema;
}

export class RecordSchema<
   AP extends Schema,
   O extends IRecordOptions = IRecordOptions
> extends Schema<O, RecordStatic<AP>, RecordCoerced<AP>> {
   override readonly type = "object";
   additionalProperties: AP;

   constructor(ap: AP, o?: O) {
      super(
         {
            ...o,
            additionalProperties: ap,
         } as any,
         {
            template: (value, opts) => {
               if (!opts?.withExtendedOptional) return value;
               if (value === undefined || !isObject(value)) return {};
               return value;
            },
         }
      );
      this.additionalProperties = ap;
   }

   override children(opts?: WalkOptions): Node[] {
      const nodes: Node[] = [];
      const node = new Node(this.additionalProperties, opts);
      node.appendKeywordPath(["additionalProperties"]);
      nodes.push(node);
      return nodes;
   }
}

export const record = <const AP extends Schema, const O extends IRecordOptions>(
   ap: AP,
   options?: StrictOptions<IRecordOptions, O>
): RecordSchema<AP, O> => new RecordSchema(ap, options) as any;
