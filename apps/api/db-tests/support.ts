// Shared fixtures of the database tests: connections of the local stack and the data set of T2,
// loaded once per file (idempotent) by the migration role.
import {
  connectAsLoginRole,
  connectAsMigrationRole,
  loadDataSet,
  type DataSet,
  type LoginRole,
} from "@influx/test-kit/db";
import type postgres from "postgres";
import { afterAll } from "vitest";

const opened: postgres.Sql[] = [];

export function migrationRole(): postgres.Sql {
  const sql = connectAsMigrationRole();
  opened.push(sql);
  return sql;
}

export function loginRole(role: LoginRole, max = 4): postgres.Sql {
  const sql = connectAsLoginRole(role, { max });
  opened.push(sql);
  return sql;
}

let dataSet: Promise<DataSet> | undefined;

export function testDataSet(): Promise<DataSet> {
  dataSet ??= loadDataSet(migrationRole());
  return dataSet;
}

afterAll(async () => {
  await Promise.all(opened.map((sql) => sql.end({ timeout: 1 })));
  opened.length = 0;
});
