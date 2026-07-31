import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface JsonDb {
  contacts: JsonValue[];
  subscriptions: JsonValue[];
  [key: string]: JsonValue;
}

export async function readDb(): Promise<JsonDb> {
  if (!fs.existsSync(DB_PATH)) {
    return { contacts: [], subscriptions: [] };
  }
  const data = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(data) as JsonDb;
}

export async function writeDb(data: JsonDb) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}
