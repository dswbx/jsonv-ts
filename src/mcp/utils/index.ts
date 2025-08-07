import type { Tool } from "../tool";

export type MaybePromise<T> = T | Promise<T>;

export type ResourceCompletionResult = {
   values: string[];
   total: number;
   hasMore: boolean;
};
export type ResourceCompletionResultLike = string[] | ResourceCompletionResult;

export function isPlainObject(value: any): value is object {
   return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function callTool(
   tool: Tool,
   params: any,
   opts?: { context?: any; request?: Request }
) {
   const res = await tool.call(
      params,
      opts?.context,
      opts?.request ?? new Request("http://localhost")
   );
   return JSON.parse((res as any).text);
}
