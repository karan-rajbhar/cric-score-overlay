/**
 * The raw Admin SDK DataSource (no session, no write hooks), for server
 * code that works on collections directly: the streaming features
 * (`~/lib/overlay/*`) and token-authenticated routes. Server actions still
 * get the caller from `createServerClient().auth.getUser()`.
 */

import "server-only";
import { getAdminFirestore } from "./admin";
import type { DataSource } from "./datasource";
import { AdminDataSource } from "./datasource-admin";

export function serverDataSource(): DataSource {
  return new AdminDataSource(getAdminFirestore());
}
