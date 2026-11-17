import type { RuleFile } from "@game/shared";

/** ルールライブラリ（ゲームサーバーの /api/rules） */

export interface LibrarySummary {
    name: string;
    version: number;
    locked: boolean;
    usedBy: string[];
    createdAt: string;
    updatedAt: string;
}

export interface LibraryEntry extends LibrarySummary {
    rule: RuleFile;
}

interface ApiError {
    ok: false;
    error: string;
    message?: string;
    details?: string[];
}

export class RuleApiError extends Error {
    constructor(public code: string, message: string, public details?: string[]) {
        super(message);
    }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    const body = (await res.json()) as T | ApiError;
    if ((body as ApiError).ok === false) {
        const e = body as ApiError;
        throw new RuleApiError(e.error, e.message ?? e.error, e.details);
    }
    return body as T;
}

export async function listRules(): Promise<LibrarySummary[]> {
    return (await call<{ rules: LibrarySummary[] }>("/api/rules")).rules;
}

export async function getRule(name: string, version: number): Promise<LibraryEntry> {
    return (await call<{ entry: LibraryEntry }>(`/api/rules/${encodeURIComponent(name)}/${version}`)).entry;
}

/** version を省略すると新しい版として保存する */
export async function saveRule(name: string, rule: RuleFile, version?: number): Promise<{ name: string; version: number }> {
    return call("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rule, version }),
    });
}

export async function deleteRule(name: string, version: number): Promise<void> {
    await call(`/api/rules/${encodeURIComponent(name)}/${version}`, { method: "DELETE" });
}
