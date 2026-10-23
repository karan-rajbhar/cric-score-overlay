import "server-only";
import { getAdminFirestore } from "~/lib/firebase/admin";
import type { DataSource } from "~/lib/firebase/datasource";
import { AdminDataSource } from "~/lib/firebase/datasource-admin";

/**
 * The raw Admin SDK data source, for server-only collections outside the
 * query builder's schema (`follows`, `push_subscriptions`, `push_log`).
 * Tests mock this module with a MemoryDataSource.
 */
export function adminDataSource(): DataSource {
  return new AdminDataSource(getAdminFirestore());
}
