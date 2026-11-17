import { useEffect, useMemo, useRef, useState } from "react";
import {
    checkRuleFile,
    DEFAULT_GAME_PARAMS,
    makeArtifact,
    ruleFileFromValues,
    valuesFromParams,
    type ArtifactSpec,
    type ArtifactValue,
    type RuleFile,
} from "@game/shared";
import * as api from "./api";
import { ArtifactEditor } from "./components/ArtifactEditor";
import { HookEditor } from "./components/HookEditor";
import { Library } from "./components/Library";
import { Nav } from "./components/Nav";
import { SettingsEditor } from "./components/SettingsEditor";
import { artifactTypeOf, changeN, clone, errorsFor, rebakeAll, type Selection } from "./model";
import { ArtifactPreview } from "./previews/ArtifactPreview";
import { HookPreview, PreviewBoundary } from "./previews/HookPreview";

const REQUIRED_ARTIFACTS = ["energyTable", "fusionTable"];
const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

function newRule(): RuleFile {
    return ruleFileFromValues(valuesFromParams(DEFAULT_GAME_PARAMS));
}

/** 書き出したファイルに付けた「エラーあり」の記録を外す */
function stripMarks(x: unknown): RuleFile {
    const r = clone(x) as RuleFile & { _errors?: unknown };
    delete r._errors;
    return r;
}

export function App() {
    const [view, setView] = useState<"editor" | "library">("editor");
    const [rule, setRule] = useState<RuleFile>(newRule);
    const [name, setName] = useState("new-rule");
    const [version, setVersion] = useState<number | null>(null);
    const [locked, setLocked] = useState(false);
    const [usedBy, setUsedBy] = useState<string[]>([]);
    const [dirty, setDirty] = useState(false);
    const [sel, setSel] = useState<Selection>({ kind: "artifact", name: "energyTable" });
    const [library, setLibrary] = useState<api.LibrarySummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const fileInput = useRef<HTMLInputElement>(null);

    const { errors, warnings } = useMemo(() => checkRuleFile(rule), [rule]);
    const disabled = locked;

    async function refreshLibrary() {
        setLoading(true);
        try {
            setLibrary(await api.listRules());
        } catch (err) {
            setMessage(`ライブラリを読めませんでした：${(err as Error).message}`);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { refreshLibrary(); }, []);

    // 選んでいた artifact が消えたら定数・運用に戻す
    useEffect(() => {
        if (sel.kind === "artifact" && !(sel.name in rule.artifacts)) setSel({ kind: "settings" });
    }, [rule, sel]);

    function update(next: RuleFile) {
        setRule(rebakeAll(next));
        setDirty(true);
    }

    function confirmDiscard(): boolean {
        return !dirty || window.confirm("保存していない変更があります。破棄しますか？");
    }

    function load(r: RuleFile, opts: { name: string; version: number | null; locked: boolean; usedBy: string[] }) {
        setRule(r);
        setName(opts.name);
        setVersion(opts.version);
        setLocked(opts.locked);
        setUsedBy(opts.usedBy);
        setDirty(false);
        setSel({ kind: "artifact", name: Object.keys(r.artifacts)[0] ?? "energyTable" });
        setView("editor");
    }

    async function open(n: string, v: number) {
        if (!confirmDiscard()) return;
        try {
            const e = await api.getRule(n, v);
            load(stripMarks(e.rule), { name: e.name, version: e.version, locked: e.locked, usedBy: e.usedBy });
            setMessage("");
        } catch (err) {
            setMessage(`開けませんでした：${(err as Error).message}`);
        }
    }

    async function duplicate(n: string, v: number) {
        if (!confirmDiscard()) return;
        const e = await api.getRule(n, v);
        load(stripMarks(e.rule), { name: `${n}-copy`, version: null, locked: false, usedBy: [] });
        setDirty(true);
    }

    async function remove(n: string, v: number) {
        if (!window.confirm(`${n} v${v} を削除しますか？`)) return;
        try {
            await api.deleteRule(n, v);
            await refreshLibrary();
        } catch (err) {
            setMessage(`削除できませんでした：${(err as Error).message}`);
        }
    }

    function editAsNewVersion() {
        setLocked(false);
        setVersion(null);
        setUsedBy([]);
        setDirty(true);
        setMessage("新しいバージョンの下書きです。保存すると次の版になります");
    }

    async function save() {
        if (!NAME_RE.test(name)) {
            setMessage("名前は英数字・_・- の 64 文字までです");
            return;
        }
        try {
            const r = await api.saveRule(name, rule, version ?? undefined);
            setVersion(r.version);
            setDirty(false);
            setMessage(`${r.name} v${r.version} として保存しました`);
        } catch (err) {
            if (err instanceof api.RuleApiError && err.code === "locked") {
                if (window.confirm("このルールは実験に使われてロックされました。新しいバージョンとして保存しますか？")) {
                    const r = await api.saveRule(name, rule);
                    setVersion(r.version);
                    setDirty(false);
                    setMessage(`${r.name} v${r.version} として保存しました`);
                }
            } else {
                const details = err instanceof api.RuleApiError && err.details ? `：${err.details.join(" / ")}` : "";
                setMessage(`保存できませんでした：${(err as Error).message}${details}`);
            }
        }
        await refreshLibrary();
    }

    function exportFile() {
        // エラーがあっても途中保存として書き出せる。その場合は「エラーあり」を記録しておく
        const out = errors.length > 0 ? { ...rule, _errors: errors } : rule;
        const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${name}${version !== null ? `-v${version}` : ""}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function importFile(file: File) {
        if (!confirmDiscard()) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result));
                const base = file.name.replace(/\.json$/i, "").replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64) || "imported";
                load(stripMarks(parsed), { name: base, version: null, locked: false, usedBy: [] });
                setDirty(true);
                setMessage(`${file.name} を読み込みました`);
            } catch {
                setMessage("JSON として読めませんでした");
            }
        };
        reader.readAsText(file);
    }

    function addArtifact(n: string, generator: string) {
        try {
            const before = Object.fromEntries(Object.entries(rule.artifacts).map(([k, a]) => [k, a.baked])) as Record<string, ArtifactValue>;
            const spec = makeArtifact([{ rule: generator }], 1, rule.constants.N, undefined, before);
            update({ ...rule, artifacts: { ...rule.artifacts, [n]: spec } });
            setSel({ kind: "artifact", name: n });
        } catch (err) {
            setMessage(`作れませんでした：${(err as Error).message}`);
        }
    }

    // artifact の型ごとの名前（ルールのパラメータで artifact を選ぶ候補）
    const artifactsByType = useMemo(() => {
        const out: Record<string, string[]> = { table1d: [], table2d: [], distribution: [] };
        for (const [n, spec] of Object.entries(rule.artifacts)) out[artifactTypeOf(spec)].push(n);
        return out;
    }, [rule]);

    if (view === "library") {
        return (
            <div className="app">
                <div className="titlebar">toyWorld ルールエディタ</div>
                <Library library={library} loading={loading} onBack={() => setView("editor")} onRefresh={refreshLibrary}
                    onNew={() => { if (confirmDiscard()) load(newRule(), { name: "new-rule", version: null, locked: false, usedBy: [] }); }}
                    onOpen={open} onDuplicate={duplicate} onDelete={remove} />
            </div>
        );
    }

    const versions = library.filter((r) => r.name === name).sort((a, b) => b.version - a.version);
    const selErrors = errorsFor(errors, sel);
    const selWarnings = errorsFor(warnings, sel);
    const otherErrors = errors.filter((e) => !selErrors.includes(e));

    let editor;
    let preview = null;
    let title = "";
    if (sel.kind === "settings") {
        title = "定数・運用";
        editor = (
            <SettingsEditor rule={rule} disabled={disabled}
                onConstants={(c) => update(c.N !== rule.constants.N && Number.isInteger(c.N) && c.N >= 1 ? { ...changeN(rule, c.N), constants: c } : { ...rule, constants: c })}
                onOperation={(o) => update({ ...rule, operation: o })} />
        );
    } else if (sel.kind === "artifact" && rule.artifacts[sel.name]) {
        const n = sel.name;
        const spec = rule.artifacts[n];
        const keys = Object.keys(rule.artifacts);
        const before = Object.fromEntries(keys.slice(0, keys.indexOf(n)).map((k) => [k, rule.artifacts[k].baked])) as Record<string, ArtifactValue>;
        title = n;
        editor = (
            <ArtifactEditor name={n} spec={spec} N={rule.constants.N} before={before} disabled={disabled} artifactsByType={artifactsByType}
                onChange={(s: ArtifactSpec) => update({ ...rule, artifacts: { ...rule.artifacts, [n]: s } })}
                onDelete={REQUIRED_ARTIFACTS.includes(n) ? undefined : () => {
                    if (!window.confirm(`${n} を削除しますか？`)) return;
                    const a = { ...rule.artifacts };
                    delete a[n];
                    update({ ...rule, artifacts: a });
                }} />
        );
        preview = <PreviewBoundary resetKey={rule}><ArtifactPreview name={n} spec={spec} rule={rule} /></PreviewBoundary>;
    } else if (sel.kind === "hook") {
        const h = sel.hook;
        title = h;
        editor = (
            <HookEditor hook={h} selection={rule.runtime[h]} disabled={disabled} artifactsByType={artifactsByType}
                onChange={(s) => update({ ...rule, runtime: { ...rule.runtime, [h]: s } })} />
        );
        preview = <HookPreview hook={h} rule={rule} />;
    }

    return (
        <div className="app">
            <div className="titlebar">toyWorld ルールエディタ</div>
            <div className="toolbar" role="toolbar" aria-label="ツールバー">
                <fieldset>
                    <legend>ルールファイル</legend>
                    <label htmlFor="rf-name" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>名前</label>
                    <input id="rf-name" type="text" style={{ width: 150, fontWeight: 700 }} value={name} disabled={version !== null}
                        onChange={(e) => { setName(e.target.value); setDirty(true); }} />
                    <label htmlFor="rf-ver" style={{ fontSize: 12 }}>版</label>
                    <select id="rf-ver" value={version ?? ""} onChange={(e) => { if (e.target.value) open(name, Number(e.target.value)); }}>
                        {version === null && <option value="">新しい版（未保存）</option>}
                        {versions.map((r) => <option key={r.version} value={r.version}>v{r.version}（{r.locked ? "ロック済み" : "下書き"}）</option>)}
                    </select>
                </fieldset>
                <fieldset>
                    <legend>乱数</legend>
                    <label htmlFor="rf-seed" style={{ fontSize: 12 }}>シード</label>
                    <input id="rf-seed" type="number" style={{ width: 72 }} disabled={disabled} value={rule.constants.seed}
                        onChange={(e) => update({ ...rule, constants: { ...rule.constants, seed: Number(e.target.value) } })} />
                </fieldset>
                <fieldset>
                    <legend>ファイル操作</legend>
                    <button className="btn" onClick={() => { refreshLibrary(); setView("library"); }}>ライブラリ</button>
                    <button className="btn" onClick={() => fileInput.current?.click()}>読み込み</button>
                    <input ref={fileInput} type="file" accept=".json" style={{ display: "none" }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
                    <button className="btn" onClick={exportFile}>書き出し</button>
                    {locked
                        ? <button className="btn primary" onClick={editAsNewVersion}>新しいバージョンとして編集</button>
                        : <button className="btn primary" disabled={errors.length > 0} title={errors.length > 0 ? "エラーがあると保存できません" : undefined} onClick={save}>ライブラリに保存</button>}
                </fieldset>
            </div>

            {locked && (
                <div className="banner" role="note">
                    <b>ロック済み（読み取り専用）</b>
                    <span>使用した実験：{usedBy.length > 0 ? usedBy.join("、") : "なし"}</span>
                </div>
            )}

            <div className="body">
                <Nav rule={rule} sel={sel} errors={errors} warnings={warnings} disabled={disabled} onSelect={setSel} onAddArtifact={addArtifact} />
                <main className={`panel edit ${preview === null ? "wide" : ""}`}>
                    <div className="panel-head">② 編集：{title}</div>
                    <div className="panel-body">
                        {selErrors.length > 0 && <ul className="error-list">{selErrors.map((e) => <li key={e}>{e}</li>)}</ul>}
                        {selWarnings.length > 0 && <ul className="warn-list">{selWarnings.map((e) => <li key={e}>{e}</li>)}</ul>}
                        {editor}
                    </div>
                </main>
                {preview !== null && (
                    <aside className="panel preview" aria-label="プレビュー">
                        <div className="panel-head">③ プレビュー</div>
                        <div className="panel-body">{preview}</div>
                    </aside>
                )}
            </div>

            <div className="statusbar" role="status">
                <span>{locked ? "ロック済み" : version === null ? "未保存" : "下書き"}{dirty ? "（変更あり）" : ""}</span>
                <span>N = {rule.constants.N}</span>
                {errors.length > 0 && <span className="error">✕ エラー {errors.length} 件{otherErrors.length > 0 ? `：${otherErrors[0]}` : ""}</span>}
                {warnings.length > 0 && <span className="warn">⚠ 警告 {warnings.length} 件</span>}
                {message && <span>{message}</span>}
            </div>
        </div>
    );
}
