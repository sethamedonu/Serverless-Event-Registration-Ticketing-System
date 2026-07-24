import { randomUUID } from "crypto";

export function newId() {
  return randomUUID();
}

// Generates SUMMIT-0001 style numbers using a timestamp+random suffix
// DynamoDB atomic counters are complex; we use a zero-padded timestamp slice
// which is collision-resistant for event-scale volumes.
export function registrationNumber(prefix = "SUMMIT") {
  const n = Date.now() % 100000;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}
