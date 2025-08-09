import { getTestFiles, loadTest, recurisvelyHasKeys } from "./utils";
import { fromSchema } from "../../lib/schema/from-schema";
import path from "node:path";
import c from "picocolors";
import type { JSONSchema } from "../../lib/types";

const files = await getTestFiles("draft2020-12", { includeOptional: true });

const tests: (Awaited<ReturnType<typeof loadTest>> & { path: string })[] = [];
for (const file of files) {
   tests.push({
      ...(await loadTest(file)),
      path: path.relative(process.cwd(), file),
   });
}

const stats = {
   total: tests.reduce(
      (acc, test) =>
         acc + test.content.reduce((acc, item) => acc + item.tests.length, 0),
      0
   ),
   skipped: 0,
   passed: 0,
   failed: 0,
   optionalFailed: 0,
};

type SkipFn = (ctx: {
   schema: JSONSchema;
   file: string;
   test?: Awaited<
      ReturnType<typeof loadTest>
   >["content"][number]["tests"][number];
}) => boolean;

const skips: SkipFn[] = [
   ({ schema, file }) =>
      [
         // definitions
         "$ref",
         "$defs",
         // evaluation
         "dependencies",
         "unevaluatedItems",
         "unevaluatedProperties",
         // meta
         "vocabulary",
         // misc
         "float-overflow",
      ].some((k) => file.includes(k) || recurisvelyHasKeys(schema, [k])),

   // skip specific tests
   ({ test }) =>
      (test &&
         ["is only an annotation by default"].some((s) =>
            test.description.includes(s)
         )) ||
      false,
];

const abort_early = true;
const abort_early_optional = false;
const explain = false;

for (const testSuite of tests) {
   console.log(c.cyan(`\n[TEST] ${testSuite.path}`));
   for (const item of testSuite.content) {
      try {
         if (
            skips.some((skip) =>
               skip({ schema: item.schema, file: testSuite.path })
            )
         ) {
            stats.skipped += item.tests.length;
            console.log(c.dim(" ->"), item.description);
            for (const test of item.tests) {
               console.log(
                  c.dim(`  -> ${c.yellow("[SKIPPED]")} ${test.description}`)
               );
            }
            continue;
         }

         const schema = fromSchema(item.schema);
         console.log(c.dim(" ->"), item.description);
         for (const test of item.tests) {
            if (
               skips.some((skip) =>
                  skip({ schema: item.schema, file: testSuite.path, test })
               )
            ) {
               stats.skipped++;
               console.log(
                  c.dim(`  -> ${c.yellow("[SKIPPED]")} ${test.description}`)
               );
               continue;
            }
            try {
               const result = schema.validate(test.data);
               if (result.valid !== test.valid) {
                  throw result;
               }
               console.info(
                  c.dim("  ->"),
                  c.green("[OK]"),
                  c.dim(test.description)
               );
               stats.passed++;
            } catch (e) {
               const isOptional = testSuite.path.includes("/optional/");
               const result = e instanceof Error ? undefined : e;
               const isError = e instanceof Error;
               const color = isError ? c.red : isOptional ? c.yellow : c.red;
               console.log(
                  color(
                     `  -> ${isError ? "[ERR]" : "[FAIL]"} ${test.description}`
                  )
               );
               explain && isError && console.error("Error:", String(e));
               explain &&
                  console.log({
                     result,
                     test,
                     schema: item.schema,
                     fromSchema: schema,
                  });
               if (isOptional) {
                  stats.optionalFailed++;
               } else {
                  stats.failed++;
               }

               const abort = isOptional ? abort_early_optional : abort_early;
               if (abort) {
                  printStats();
                  if (e instanceof Error) {
                     throw e;
                  }
                  process.exit(1);
               }
            }
         }
      } catch (e) {
         console.error(" ->", item.description);
         explain && console.log("schema", JSON.stringify(item.schema, null, 2));

         if (abort_early) {
            printStats();
            throw e;
         }
      }
      console.log("");
   }
}
printStats();

function printStats() {
   console.log("\n\n");
   console.log("Total tests:", stats.total);
   console.log(
      "Passed:",
      stats.passed,
      `(${((stats.passed / stats.total) * 100).toFixed(2)}%)`
   );
   console.log(
      "Skipped:",
      stats.skipped,
      `(${((stats.skipped / stats.total) * 100).toFixed(2)}%)`
   );
   console.log(
      "Failed:",
      stats.failed,
      `(${((stats.failed / stats.total) * 100).toFixed(2)}%)`
   );
   console.log(
      "Optional failed:",
      stats.optionalFailed,
      `(${((stats.optionalFailed / stats.total) * 100).toFixed(2)}%)`
   );
}

const amount = 1414;
const passed = stats.passed >= amount;
if (!passed) {
   process.exit(1);
}
process.exit(0);
