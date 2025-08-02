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
