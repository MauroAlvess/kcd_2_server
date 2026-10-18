/**
 * Small durable JSON files for the data a player must not lose (their belongings, what they have learned).
 *
 * The older stores in this gamemode (`characters.ts`, `status.ts`, ...) write the file in place; a crash in the middle
 * of that write leaves half a file. These do better: the new content goes to `<file>.tmp`, the previous file becomes
 * `<file>.bak`, and only then does the new one take its name. `read` falls back to the `.bak` when the main file is
 * missing or does not parse, so a server killed at the worst moment still comes back with the last good copy.
 *
 * Like the other stores this uses the embedded Node's `fs` through a hand-typed bridge: the resource's declarations
 * leave Node's globals out on purpose.
 */

declare function require(id: string): unknown;

export interface NodeFs {
    readFileSync(path: string, encoding: "utf8"): string;
    writeFileSync(path: string, data: string): void;
    mkdirSync(path: string, options: { recursive: true }): void;
    renameSync(from: string, to: string): void;
    existsSync(path: string): boolean;
}

let fs: NodeFs | null = null;

function node(): NodeFs {
    if (fs === null) {
        fs = require("node:fs") as NodeFs;
    }
    return fs;
}

/** A directory (and its parents) that exists afterwards. */
export function ensureDir(path: string): void {
    node().mkdirSync(path, { recursive: true });
}

export type ReadResult<T> =
    | { readonly status: "missing" }
    | { readonly status: "ok"; readonly value: T; readonly fromBackup: boolean }
    | { readonly status: "corrupt"; readonly reason: string };

function parseFile(path: string): { ok: true; value: unknown } | { ok: false; reason: string } | null {
    const files = node();
    if (!files.existsSync(path)) {
        return null;
    }
    try {
        return { ok: true, value: JSON.parse(files.readFileSync(path, "utf8")) };
    } catch (error: unknown) {
        return { ok: false, reason: `${path}: ${error instanceof Error ? error.message : String(error)}` };
    }
}

/**
 * Reads `path`, or its backup when the file itself is missing or damaged. `missing` means neither exists: a
 * player seen for the first time. `corrupt` means something exists and none of it can be read, which a caller
 * must treat as "do not overwrite", never as "start over".
 */
export function read<T>(path: string): ReadResult<T> {
    const main = parseFile(path);
    if (main !== null && main.ok) {
        return { status: "ok", value: main.value as T, fromBackup: false };
    }
    const backup = parseFile(`${path}.bak`);
    if (backup !== null && backup.ok) {
        return { status: "ok", value: backup.value as T, fromBackup: true };
    }
    if (main === null && backup === null) {
        return { status: "missing" };
    }
    const reasons = [main, backup].flatMap((entry) => (entry !== null && !entry.ok ? [entry.reason] : []));
    return { status: "corrupt", reason: reasons.join("; ") };
}

/**
 * Writes `value` to `path` so that a failure at any point leaves the previous content readable. A main file that
 * no longer parses is set aside under another name instead of replacing the good backup.
 */
export function write(path: string, value: unknown): void {
    const files = node();
    const temp = `${path}.tmp`;
    files.writeFileSync(temp, JSON.stringify(value));
    if (files.existsSync(path)) {
        const current = parseFile(path);
        files.renameSync(path, current !== null && current.ok ? `${path}.bak` : `${path}.corrupt-${Date.now()}`);
    }
    files.renameSync(temp, path);
}
