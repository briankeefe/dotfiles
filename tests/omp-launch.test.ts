import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("OMP launches after failed or stalled updates and debounces attempts for 24 hours", () => {
  const root = mkdtempSync(join(tmpdir(), "omp-launch-"));
  try {
    const bin = join(root, "bin");
    const state = join(root, "state");
    const calls = join(root, "calls");
    mkdirSync(bin);
    const template = readFileSync(new URL("../dot_zshrc.tmpl", import.meta.url), "utf8");
    const wrapper = template.match(/^omp\(\) \{[\s\S]*?^\}/m)![0];
    const shell = join(root, "launch.zsh");
    writeFileSync(shell, `${wrapper}\nomp "$@"\n`);
    writeFileSync(join(bin, "omp"), `#!/bin/sh
printf '%s\\n' "\${1:-launch}" >> "$CALLS"
if [ "$1" = update ]; then
  [ "$UPDATE_MODE" != stall ] || exec sleep 30
  exit 1
fi
printf '<%s>\\n' "$@"
exit 7
`, { mode: 0o755 });
    const launch = (args: string[] = [], mode = "fail") => Bun.spawnSync(["zsh", "-f", shell, ...args], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, XDG_STATE_HOME: state, CALLS: calls, UPDATE_MODE: mode },
      timeout: 15000,
    });
    const history = () => readFileSync(calls, "utf8").trim().split("\n");
    const stamp = join(state, "omp-last-update");

    const failed = launch(["hello world"]);
    expect(failed.exitCode).toBe(7);
    expect(failed.stdout.toString()).toBe("<hello world>\n");
    expect(failed.stderr.toString()).toContain("launching installed version");
    expect(history()).toEqual(["update", "hello world"]);

    expect(launch().exitCode).toBe(7);
    expect(history()).toEqual(["update", "hello world", "launch"]);

    writeFileSync(stamp, String(Math.floor(Date.now() / 1000) - 86401));
    const start = Date.now();
    const stalled = launch([], "stall");
    expect(stalled.exitCode).toBe(7);
    expect(stalled.stderr.toString()).toContain("timed out");
    expect(Date.now() - start).toBeLessThan(13000);
    expect(history().slice(-2)).toEqual(["update", "launch"]);
    expect(launch().exitCode).toBe(7);
    expect(history().slice(-2)).toEqual(["launch", "launch"]);

    const previous = readFileSync(stamp, "utf8");
    expect(launch(["update"]).exitCode).toBe(1);
    expect(history().slice(-2)).toEqual(["launch", "update"]);
    expect(readFileSync(stamp, "utf8")).toBe(previous);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 20000);
