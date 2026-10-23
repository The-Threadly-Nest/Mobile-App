import type { Response } from "express";

export function collectionWindow(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit + 1 };
}

export function sendCollectionPage<T>(
  res: Response,
  rows: T[],
  page: number,
  limit: number
) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  res.setHeader("X-Page", String(page));
  res.setHeader("X-Has-More", String(hasMore));
  if (hasMore) res.setHeader("X-Next-Page", String(page + 1));
  return res.json(items);
}
