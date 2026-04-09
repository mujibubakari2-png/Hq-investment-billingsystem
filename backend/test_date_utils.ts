import { parseOptionalDate, parseSafeDate, toISOSafe, toTimestampSafe, getStartOfTodayTZ, getStartOfMonthTZ, getEndOfMonthTZ } from "./src/lib/dateUtils";

console.log("--- TEST parseSafeDate ---");
console.log("Passing 'undefined':", parseSafeDate("undefined"));
console.log("Passing 'null':", parseSafeDate("null"));
console.log("Passing empty string:", parseSafeDate(""));
console.log("Passing valid date string:", parseSafeDate("2026-04-06T12:00:00Z"));

console.log("\n--- TEST parseOptionalDate ---");
console.log("Passing primitive undefined:", parseOptionalDate(undefined));
console.log("Passing string 'undefined':", parseOptionalDate("undefined"));
console.log("Passing string 'null':", parseOptionalDate("null"));
console.log("Passing valid date string:", parseOptionalDate("2026-04-06T12:00:00Z"));

console.log("\n--- TEST toISOSafe ---");
console.log("Passing Date object:", toISOSafe(new Date("2026-04-07T10:00:00Z")));
console.log("Passing ISO string:", toISOSafe("2026-04-07T10:00:00Z"));
console.log("Passing invalid string:", toISOSafe("not-a-date"));
console.log("Passing null:", toISOSafe(null));

console.log("\n--- TEST toTimestampSafe ---");
const testDate = new Date("2026-04-07T10:00:00Z");
console.log("Passing Date object:", toTimestampSafe(testDate));
console.log("Passing ISO string:", toTimestampSafe("2026-04-07T10:00:00Z"));
console.log("Matches getTime():", toTimestampSafe(testDate) === testDate.getTime());

console.log("\n--- TEST TZ Helpers (Africa/Dar_es_Salaam) ---");
console.log("Start of Today TZ:", new Date(getStartOfTodayTZ()).toISOString());
console.log("Start of Month TZ:", new Date(getStartOfMonthTZ()).toISOString());
console.log("End of Month TZ:", new Date(getEndOfMonthTZ()).toISOString());
