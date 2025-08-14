import { bench, run, summary } from "mitata";
import { s } from "../../lib";
import { validators, schemas } from "../validation/inc";

// Create more comprehensive test scenarios
const testScenarios = [
   {
      name: "Simple Object",
      schema: s.object({
         name: s.string(),
         age: s.number(),
         active: s.boolean(),
      }),
      data: { name: "John", age: 30, active: true },
   },
   {
      name: "Complex Nested Object",
      schema: s.object({
         user: s.object({
            profile: s.object({
               name: s.string(),
               details: s.object({
                  age: s.number(),
                  preferences: s.array(s.string()),
               }),
            }),
            settings: s.object({
               theme: s.string({ enum: ["light", "dark"] }),
               notifications: s.boolean(),
            }),
         }),
         metadata: s.object({
            created: s.string(),
            tags: s.array(s.string()),
         }),
      }),
      data: {
         user: {
            profile: {
               name: "Alice",
               details: {
                  age: 25,
                  preferences: ["reading", "music", "travel"],
               },
            },
            settings: {
               theme: "dark",
               notifications: true,
            },
         },
         metadata: {
            created: "2024-01-01",
            tags: ["important", "user", "active"],
         },
      },
   },
   {
      name: "Large Array",
      schema: s.array(
         s.object({
            id: s.number(),
            value: s.string(),
            metadata: s.object({
               type: s.string(),
               priority: s.number(),
            }),
         })
      ),
      data: Array.from({ length: 100 }, (_, i) => ({
         id: i,
         value: `item-${i}`,
         metadata: {
            type: `type-${i % 5}`,
            priority: Math.floor(Math.random() * 10),
         },
      })),
   },
   {
      name: "String with Pattern",
      schema: s.string({
         pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
      }),
      data: "user@example.com",
   },
   {
      name: "Union Types",
      schema: s.anyOf([
         s.string(),
         s.number(),
         s.object({ type: s.string({ const: "object" }), data: s.string() }),
      ]),
      data: { type: "object", data: "test" },
   },
   {
      name: "AllOf Schema",
      schema: s.allOf([
         s.object({ name: s.string() }),
         s.object({ age: s.number() }),
         s.object({ active: s.boolean() }),
      ]),
      data: { name: "Bob", age: 35, active: false },
   },
];

// Performance metrics collection
interface PerformanceMetrics {
   name: string;
   avgTime: number;
   minTime: number;
   maxTime: number;
   iterations: number;
   throughput: number; // validations per second
}

class PerformanceCollector {
   private metrics: Map<string, number[]> = new Map();

   record(name: string, time: number) {
      if (!this.metrics.has(name)) {
         this.metrics.set(name, []);
      }
      this.metrics.get(name)!.push(time);
   }

   getMetrics(): PerformanceMetrics[] {
      return Array.from(this.metrics.entries()).map(([name, times]) => {
         if (times.length === 0)
            return {
               name,
               avgTime: 0,
               minTime: 0,
               maxTime: 0,
               iterations: 0,
               throughput: 0,
            };

         const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
         const minTime =
            times.length > 1000
               ? Math.min(...times.slice(0, 1000))
               : Math.min(...times);
         const maxTime =
            times.length > 1000
               ? Math.max(...times.slice(0, 1000))
               : Math.max(...times);
         const iterations = times.length;
         const throughput = 1000 / avgTime; // per second

         return {
            name,
            avgTime,
            minTime,
            maxTime,
            iterations,
            throughput,
         };
      });
   }

   printResults() {
      const metrics = this.getMetrics();
      console.log("\n📊 Performance Metrics:");
      console.log("=" + "=".repeat(80));
      console.log(
         "Test Scenario".padEnd(25) +
            "Avg Time".padEnd(12) +
            "Min Time".padEnd(12) +
            "Max Time".padEnd(12) +
            "Throughput/s".padEnd(15)
      );
      console.log("-".repeat(81));

      metrics.forEach((m) => {
         console.log(
            m.name.padEnd(25) +
               `${m.avgTime.toFixed(3)}ms`.padEnd(12) +
               `${m.minTime.toFixed(3)}ms`.padEnd(12) +
               `${m.maxTime.toFixed(3)}ms`.padEnd(12) +
               `${m.throughput.toFixed(0)}`.padEnd(15)
         );
      });
      console.log("=" + "=".repeat(80));
   }
}

const collector = new PerformanceCollector();

// Detailed benchmarks for jsonv-ts specifically
export function runDetailedBenchmark() {
   console.log("🚀 Starting detailed performance benchmark...");

   summary(() => {
      for (const scenario of testScenarios) {
         bench(`jsonv-ts: ${scenario.name}`, () => {
            const start = performance.now();
            const result = scenario.schema.validate(scenario.data);
            const end = performance.now();

            collector.record(`jsonv-ts: ${scenario.name}`, end - start);

            // Ensure validation actually ran
            if (!result.valid) {
               throw new Error(
                  `Validation failed for ${scenario.name}: ${JSON.stringify(
                     result.errors
                  )}`
               );
            }
         });
      }

      // Stress test - multiple validations in sequence
      bench("jsonv-ts: Stress Test (1000 validations)", () => {
         const schema = testScenarios[0].schema;
         const data = testScenarios[0].data;

         const start = performance.now();
         for (let i = 0; i < 1000; i++) {
            schema.validate(data);
         }
         const end = performance.now();

         collector.record("jsonv-ts: Stress Test", (end - start) / 1000);
      });

      // Memory pressure test - validate large objects
      bench("jsonv-ts: Memory Test (large object)", () => {
         const largeData = {
            items: Array.from({ length: 1000 }, (_, i) => ({
               id: i,
               data: `item-${i}`.repeat(10),
               nested: {
                  values: Array.from({ length: 10 }, (_, j) => `value-${j}`),
               },
            })),
         };

         const schema = s.object({
            items: s.array(
               s.object({
                  id: s.number(),
                  data: s.string(),
                  nested: s.object({
                     values: s.array(s.string()),
                  }),
               })
            ),
         });

         const start = performance.now();
         schema.validate(largeData);
         const end = performance.now();

         collector.record("jsonv-ts: Memory Test", end - start);
      });
   });
}

// Comparison with other validators
export function runComparisonBenchmark() {
   console.log("\n🏁 Running comparison benchmark against other validators...");

   summary(() => {
      for (const { name, validate, prepare } of validators) {
         const testSchema = testScenarios[1]; // Use complex nested object
         const preparedSchema = prepare(testSchema.schema, testSchema.data);

         bench(`${name}: Complex Object`, () => {
            validate(preparedSchema, testSchema.data);
         });
      }
   });
}

// Main benchmark runner
export async function runFullBenchmark() {
   console.log("🔥 JSONV-TS Performance Benchmark Suite");
   console.log("========================================\n");

   // Run detailed jsonv-ts benchmarks
   runDetailedBenchmark();
   await run();

   // Print detailed metrics
   collector.printResults();

   // Run comparison benchmarks
   runComparisonBenchmark();
   await run();

   console.log("\n✅ Benchmark completed!");
}

// Export for use in optimization testing
export { testScenarios, PerformanceCollector };

if (import.meta.env.RUN) {
   await runFullBenchmark();
}
