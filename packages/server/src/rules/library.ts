import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkRuleFile, type RuleFile, type RuleRef } from "@game/shared";

/*
 * ルールライブラリ：data/rules/<名前>/v<版>.json
 * 実験を開始した版はロックされ、上書き・削除できなくなる。
 */

export interface LibraryEntry {
    name: string;
    version: number;
    locked: boolean;
    /** この版を使って開始した実験（ログのフォルダ名） */
    usedBy: string[];
    createdAt: string;
    updatedAt: string;
    rule: RuleFile;
}

export type LibrarySummary = Omit<LibraryEntry, "rule">;

export class LibraryError extends Error {
    constructor(public code: "invalid_name" | "not_found" | "locked" | "invalid_rule", message: string, public details?: string[]) {
        super(message);
    }
}

const ROOT = join(process.cwd(), "..", "..", "data", "rules");
const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

function checkName(name: string): void {
    if (!NAME_RE.test(name)) {
        throw new LibraryError("invalid_name", "名前は英数字・_・- の 64 文字までです");
    }
}

function fileOf(name: string, version: number): string {
    return join(ROOT, name, `v${version}.json`);
}

function versionsOf(name: string): number[] {
    const dir = join(ROOT, name);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .map((f) => /^v(\d+)\.json$/.exec(f))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => Number(m[1]))
        .sort((a, b) => a - b);
}

function read(name: string, version: number): LibraryEntry {
    checkName(name);
    const file = fileOf(name, version);
    if (!existsSync(file)) {
        throw new LibraryError("not_found", `${name} v${version} はありません`);
    }
    return JSON.parse(readFileSync(file, "utf-8")) as LibraryEntry;
}

function write(entry: LibraryEntry): void {
    mkdirSync(join(ROOT, entry.name), { recursive: true });
    writeFileSync(fileOf(entry.name, entry.version), JSON.stringify(entry, null, 2));
}

export function listRules(): LibrarySummary[] {
    if (!existsSync(ROOT)) return [];
    const out: LibrarySummary[] = [];
    for (const name of readdirSync(ROOT)) {
        if (!NAME_RE.test(name)) continue;
        for (const version of versionsOf(name)) {
            const { rule: _rule, ...summary } = read(name, version);
            out.push(summary);
        }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name) || b.version - a.version);
}

export function getRule(ref: RuleRef): LibraryEntry {
    return read(ref.name, ref.version);
}

/**
 * 保存する。version を省略すると新しい版として保存する。
 * 既存の版を指定した場合、ロック済みなら失敗する（新しい版として保存し直す）。
 */
export function saveRule(name: string, rule: unknown, version?: number): LibraryEntry {
    checkName(name);
    const { errors } = checkRuleFile(rule);
    if (errors.length > 0) {
        throw new LibraryError("invalid_rule", "ルールファイルにエラーがあります", errors);
    }
    const now = new Date().toISOString();
    let entry: LibraryEntry;
    if (version === undefined) {
        const versions = versionsOf(name);
        const next = versions.length === 0 ? 1 : versions[versions.length - 1] + 1;
        entry = { name, version: next, locked: false, usedBy: [], createdAt: now, updatedAt: now, rule: rule as RuleFile };
    } else if (existsSync(fileOf(name, version))) {
        const old = read(name, version);
        if (old.locked) {
            throw new LibraryError("locked", `${name} v${version} は実験に使われてロックされています。新しい版として保存してください`);
        }
        entry = { ...old, updatedAt: now, rule: rule as RuleFile };
    } else {
        entry = { name, version, locked: false, usedBy: [], createdAt: now, updatedAt: now, rule: rule as RuleFile };
    }
    write(entry);
    return entry;
}

export function deleteRule(ref: RuleRef): void {
    const entry = read(ref.name, ref.version);
    if (entry.locked) {
        throw new LibraryError("locked", `${ref.name} v${ref.version} はロックされているので削除できません`);
    }
    rmSync(fileOf(ref.name, ref.version));
}

/** 実験を開始したときに呼ぶ。その版をロックして、使った実験を記録する */
export function lockRule(ref: RuleRef, experiment: string): void {
    const entry = read(ref.name, ref.version);
    entry.locked = true;
    if (!entry.usedBy.includes(experiment)) entry.usedBy.push(experiment);
    entry.updatedAt = new Date().toISOString();
    write(entry);
}
