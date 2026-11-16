import { Router, type Response } from "express";
import { checkRuleFile } from "@game/shared";
import { deleteRule, getRule, LibraryError, listRules, saveRule } from "../rules/library.js";

function sendError(res: Response, err: unknown): void {
    if (err instanceof LibraryError) {
        const status = err.code === "not_found" ? 404 : err.code === "locked" ? 409 : 400;
        res.status(status).json({ ok: false, error: err.code, message: err.message, details: err.details });
        return;
    }
    res.status(500).json({ ok: false, error: "server_error", message: String(err) });
}

/** /api/rules：ルールライブラリ */
export function createRulesRouter(): Router {
    const router = Router();

    // 一覧（中身は含めない）
    router.get("/", (_req, res) => {
        try {
            res.json({ ok: true, rules: listRules() });
        } catch (err) {
            sendError(res, err);
        }
    });

    // 1 つ取得
    router.get("/:name/:version", (req, res) => {
        try {
            res.json({ ok: true, entry: getRule({ name: req.params.name, version: Number(req.params.version) }) });
        } catch (err) {
            sendError(res, err);
        }
    });

    // 保存せずに検証だけ
    router.post("/check", (req, res) => {
        res.json({ ok: true, ...checkRuleFile(req.body.rule) });
    });

    // 保存。version を省略すると新しい版
    router.post("/", (req, res) => {
        try {
            const { name, version, rule } = req.body as { name: string; version?: number; rule: unknown };
            const entry = saveRule(String(name ?? ""), rule, version);
            res.json({ ok: true, name: entry.name, version: entry.version, warnings: checkRuleFile(rule).warnings });
        } catch (err) {
            sendError(res, err);
        }
    });

    // 削除（下書きだけ）
    router.delete("/:name/:version", (req, res) => {
        try {
            deleteRule({ name: req.params.name, version: Number(req.params.version) });
            res.json({ ok: true });
        } catch (err) {
            sendError(res, err);
        }
    });

    return router;
}
