import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectProject, probe, versionSatisfies } from "./doctor";

function project(
  files: Record<string, string>,
  check: (directory: string) => void,
) {
  const directory = mkdtempSync(join(tmpdir(), "doctor-test-"));
  try {
    for (const [file, contents] of Object.entries(files)) {
      mkdirSync(join(directory, file, ".."), { recursive: true });
      writeFileSync(join(directory, file), contents);
    }
    check(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("runtime ranges enforce boundaries and unresolved aliases stay unverified", () => {
  expect(versionSatisfies("v20.11.1", "20")).toBe(true);
  expect(versionSatisfies("22.1.0", "20")).toBe(false);
  expect(versionSatisfies("3.11.9", ">=3.9,<3.12")).toBe(true);
  expect(versionSatisfies("3.12.0", ">=3.9,<3.12")).toBe(false);
  expect(versionSatisfies("20.11.1", "lts/*")).toBeNull();
  expect(versionSatisfies("not-installed", "20")).toBeNull();
});

test("hashed package-manager declarations still enforce the exact installed version", () => {
  project(
    {
      ".nvmrc": "20",
      "package.json": '{"packageManager":"yarn@1.22.22+sha1.ac34549e6aa8e7"}',
    },
    (directory) => {
      const requirement = inspectProject(directory).requirements.find(
        (req) => req.runtime === "yarn",
      )!;
      expect(versionSatisfies("1.22.22", requirement.version)).toBe(true);
      expect(versionSatisfies("1.22.21", requirement.version)).toBe(false);
    },
  );
});

test("broken declarations are not silently ignored and modern Compose filenames require Docker", () => {
  project(
    {
      "package.json": "{broken",
      "pyproject.toml": "[broken",
      "compose.yaml": "services: {}",
    },
    (directory) => {
      const result = inspectProject(directory);
      expect(
        result.issues.some((issue) => issue.includes("package.json")),
      ).toBe(true);
      expect(
        result.issues.some((issue) => issue.includes("pyproject.toml")),
      ).toBe(true);
      expect(result.compose).toBe(true);
    },
  );
});

test("Java output compatibility is not mistaken for a JDK toolchain requirement", () => {
  project(
    { "build.gradle": "sourceCompatibility = JavaVersion.VERSION_1_8" },
    (directory) => {
      expect(
        inspectProject(directory).requirements.some(
          (req) => req.runtime === "java",
        ),
      ).toBe(false);
      expect(
        inspectProject(directory).issues.some((issue) => issue.includes("JDK")),
      ).toBe(true);
      writeFileSync(
        join(directory, "build.gradle"),
        "java { toolchain { languageVersion = JavaLanguageVersion.of(17) } }",
      );
      const requirement = inspectProject(directory).requirements.find(
        (req) => req.runtime === "java",
      )!;
      expect(versionSatisfies("17.0.12", requirement.version)).toBe(true);
      expect(versionSatisfies("21.0.1", requirement.version)).toBe(false);
    },
  );
});

test("missing and hung commands fail without aborting the readiness report", () => {
  // This exercises spawnSync's OS timeout; fake JS timers cannot drive a child-process deadline.
  expect(probe("/definitely-missing-doctor-command", []).ok).toBe(false);
  expect(
    probe(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], 100).ok,
  ).toBe(false);
});
