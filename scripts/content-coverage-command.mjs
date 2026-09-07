import fs from "node:fs";

import { parseIssueDecisionCommand } from "./content-coverage-audit.mjs";

const commandFile = process.argv[2];
if (!commandFile) {
  throw new Error("Command file path is required");
}

const command = parseIssueDecisionCommand(
  fs.readFileSync(commandFile, "utf8"),
);
process.stdout.write(`${JSON.stringify(command)}\n`);
