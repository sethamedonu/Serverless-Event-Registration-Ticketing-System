import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { db, AUDIT_TABLE } from "../shared/db.mjs";
import { ok, forbidden, serverError, cors } from "../shared/response.mjs";
import { callerFromEvent, isAdmin } from "../shared/auth.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return cors();

  const caller = callerFromEvent(event);
  if (!isAdmin(caller.groups)) return forbidden();

  try {
    const result = await db.send(new ScanCommand({ TableName: AUDIT_TABLE, Limit: 300 }));
    const items = (result.Items ?? []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return ok(items);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
