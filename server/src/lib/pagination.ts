import { EndpointResult } from "../core/http/endpoint-result";

export function collectionWindow(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit + 1 };
}

export function collectionPage<T>(
  rows: T[],
  page: number,
  limit: number
) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return new EndpointResult(items, 200, {
    "X-Page": String(page),
    "X-Has-More": String(hasMore),
    ...(hasMore ? { "X-Next-Page": String(page + 1) } : {}),
  });
}
