import fs from "node:fs";
import { randomBytes } from "node:crypto";
const filename = new URL("../.env.local", import.meta.url);
let content = fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
let added = 0;
for (const name of ["BOOKING_ACCESS_SECRET", "TRAINING_JOB_SECRET"]) {
  if (!new RegExp("^" + name + "=.+$", "m").test(content)) {
    content += "\n" + name + "=" + randomBytes(32).toString("hex") + "\n"; added++;
  }
}
if (!/^BOOKINGS_ENABLED=/m.test(content)) content += "\nBOOKINGS_ENABLED=false\n";
fs.writeFileSync(filename, content);
console.log("Training secrets initialized locally (" + added + " new). No secret values printed. Booking activation requires approved cohort data, privacy version and Moyasar credentials.");

