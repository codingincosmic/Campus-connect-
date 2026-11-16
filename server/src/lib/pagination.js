/**
 * Shared list pagination.
 *
 * Every list endpoint returns the same envelope so the frontend can use one
 * component for all of them:
 *
 *   { items: [...], page, pageSize, total, totalPages }
 */
import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/**
 * Query-string schema for paginated lists. Query values arrive as strings, so
 * `coerce` turns them into numbers before validation.
 */
export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

/** Turn validated page/pageSize into Prisma's skip/take. */
export function toSkipTake({ page, pageSize }) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/** Build the response envelope. */
export function paginated(items, total, { page, pageSize }) {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
