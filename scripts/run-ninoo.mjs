import { fileURLToPath } from "node:url";

const [command, ...args] = process.argv.slice(2);
if (!["dev", "build", "start"].includes(command)) {
  throw new Error("Expected dev, build or start.");
}

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  throw new Error("Mandate's portable runtime requires Node.js 22.13 or newer for node:sqlite.");
}

process.env.MANDATE_RUNTIME = "node";
const cli = new URL("../node_modules/vinext/dist/cli.js", import.meta.url);
const serverArgs = command === "build" ? [] : [
  "--hostname", "0.0.0.0", "--port", process.env.PORT ?? "3000",
];

// Keep the listening process attached to Ninoo so stop/restart signals reach it.
process.argv = [process.execPath, fileURLToPath(cli), command, ...serverArgs, ...args];
await import(cli.href);
