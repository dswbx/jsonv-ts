#!/usr/bin/env bun
import { runFullBenchmark } from "../src/test/performance/detailed-benchmark";

console.log("🏃‍♂️ Running baseline performance benchmark...");
console.log("This will help us measure the impact of optimizations.\n");

await runFullBenchmark();

