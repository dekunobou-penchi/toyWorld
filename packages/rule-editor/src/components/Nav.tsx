import { useState } from "react";
import { GEN_RULES, type RuleFile } from "@game/shared";
import { artifactTypeOf, errorsFor, GEN_LABEL, HOOKS, TYPE_LABEL, type Selection } from "../model";

interface Props {
    rule: RuleFile;
    sel: Selection;
    errors: string[];
    warnings: string[];
    disabled: boolean;
    onSelect: (sel: Selection) => void;
    onAddArtifact: (name: string, generator: string) => void;
}

const same = (a: Selection, b: Selection) => JSON.stringify(a) === JSON.stringify(b);

/** ① 目次 */
export function Nav({ rule, sel, errors, warnings, disabled, onSelect, onAddArtifact }: Props) {
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const generators = Object.values(GEN_RULES).filter((d) => d.input === null);
    const [gen, setGen] = useState(generators[0]?.name ?? "");

    const mark = (s: Selection) => {
        if (errorsFor(errors, s).length > 0) return <span className="mark-error" aria-label="エラー">✕</span>;
        if (errorsFor(warnings, s).length > 0) return <span className="mark-warn" aria-label="警告">⚠</span>;
        return null;
    };
    const item = (s: Selection, label: string, sub?: string) => (
        <button key={JSON.stringify(s)} className={`nav-item ${same(s, sel) ? "current" : ""}`} aria-current={same(s, sel) ? "page" : undefined} onClick={() => onSelect(s)}>
            <span>{label} {mark(s)}</span>
            {sub && <span className="sub">{sub}</span>}
        </button>
    );
    const validName = /^[A-Za-z][A-Za-z0-9_]*$/.test(newName) && !(newName in rule.artifacts);

    return (
        <nav className="panel nav" aria-label="目次">
            <div className="panel-head">① 目次</div>
            <div style={{ padding: "8px 0", display: "flex", flexDirection: "column" }}>
                <div className="nav-section">定数・運用</div>
                {item({ kind: "settings" }, "定数・運用", `N=${rule.constants.N}`)}

                <div className="nav-section">生成ルール（artifacts）</div>
                {Object.entries(rule.artifacts).map(([name, spec]) => item({ kind: "artifact", name }, name, TYPE_LABEL[artifactTypeOf(spec)]))}
                {!adding && (
                    <button className="btn small" style={{ margin: "4px 10px 0 22px", textAlign: "left" }} disabled={disabled} onClick={() => setAdding(true)}>＋ 追加</button>
                )}
                {adding && (
                    <div style={{ margin: "6px 10px 0 22px", display: "flex", flexDirection: "column", gap: 4 }}>
                        <label>名前 <input type="text" style={{ width: 130 }} value={newName} onChange={(e) => setNewName(e.target.value)} /></label>
                        <label>最初のルール{" "}
                            <select value={gen} onChange={(e) => setGen(e.target.value)}>
                                {generators.map((d) => <option key={d.name} value={d.name}>{GEN_LABEL[d.name] ?? d.name}</option>)}
                            </select>
                        </label>
                        <div className="row" style={{ marginTop: 0 }}>
                            <button className="btn small" disabled={!validName} onClick={() => { onAddArtifact(newName, gen); setAdding(false); setNewName(""); }}>作成</button>
                            <button className="btn small" onClick={() => { setAdding(false); setNewName(""); }}>やめる</button>
                        </div>
                    </div>
                )}

                <div className="nav-section">実行ルール（runtime）</div>
                {HOOKS.map((h) => item({ kind: "hook", hook: h }, h, rule.runtime[h].rule))}
            </div>
        </nav>
    );
}
