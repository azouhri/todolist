import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Builds follow-ups.mcpb — the Claude Desktop extension bundle.
 *
 *   npm run pack:extension
 *
 * The bundle is a zip with manifest.json at its root. The launcher runs the
 * TypeScript server out of this project rather than carrying a copy of
 * node_modules, so the project path is baked in here.
 */

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(projectDir, "mcp", "extension");
const outFile = path.join(projectDir, "mcp", "follow-ups.mcpb");

const staging = mkdtempSync(path.join(tmpdir(), "follow-ups-mcpb-"));

try {
  cpSync(sourceDir, staging, { recursive: true });

  // Bake the absolute project path into the launcher.
  const launcher = path.join(staging, "server.mjs");
  writeFileSync(
    launcher,
    readFileSync(launcher, "utf8").replace(
      "__PROJECT_DIR__",
      projectDir.replace(/\\/g, "\\\\"),
    ),
    "utf8",
  );

  rmSync(outFile, { force: true });

  if (process.platform === "win32") {
    // Compress-Archive refuses any extension but .zip, so build a .zip and rename.
    const tempZip = path.join(staging, "..", "follow-ups.zip");
    rmSync(tempZip, { force: true });
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${staging}\\*' -DestinationPath '${tempZip}' -Force`,
      ],
      { stdio: "inherit" },
    );
    renameSync(tempZip, outFile);
  } else {
    execFileSync("zip", ["-r", outFile, "."], { cwd: staging, stdio: "inherit" });
  }

  console.log(`Built ${outFile}`);
  console.log(`Project path baked in: ${projectDir}`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
