import { useMemo, useState } from "react";
import { bakeArtifact, GEN_RULES, type ArtifactSpec, type ArtifactValue, type RuleSelection } from "@game/shared";
import { artifactTypeOf, GEN_LABEL, TYPE_LABEL } from "../model";
import { ParamTable } from "./ParamTable";

interface Props {
    name: string;
    spec: ArtifactSpec;
    N: number;
    /** ルールファイルで自分より前にある artifact の結果 */
    before: Record<string, ArtifactValue>;
    disabled: boolean;
    artifactsByType: Record<string, string[]>;
    onChange: (spec: ArtifactSpec) => void;
    /** energyTable・fusionTable 以外は削除できる */
    onDelete?: () => void;
}

/** ② artifact：生成ルールのパイプラインと手修正 */
export function ArtifactEditor({ name, spec, N, before, disabled, artifactsByType, onChange, onDelete }: Props) {
    const type = artifactTypeOf(spec);
    const [addRule, setAddRule] = useState("");
    const [ovKey, setOvKey] = useState("");
    const [ovValue, setOvValue] = useState("");
    const [mirror, setMirror] = useState(true);

    // 次に足せる生成ルール（前の段の出力を受け取れるもの）
    const lastOut = spec.pipeline.length === 0 ? null : type;
    const addable = Object.values(GEN_RULES).filter((d) => d.input === lastOut);

    // 手修正の前の値（パイプラインだけの結果）
    const raw = useMemo(() => {
        if (spec.pipeline.length === 0) return null;
        try {
            return bakeArtifact({ ...spec, overrides: {} }, N, before);
        } catch {
            return null;
        }
    }, [spec, N, before]);

    const setStep = (i: number, step: RuleSelection) => onChange({ ...spec, pipeline: spec.pipeline.map((s, j) => (j === i ? step : s)) });
    const move = (i: number, d: number) => {
        const p = [...spec.pipeline];
        [p[i], p[i + d]] = [p[i + d], p[i]];
        onChange({ ...spec, pipeline: p });
    };
    const remove = (i: number) => onChange({ ...spec, pipeline: spec.pipeline.filter((_, j) => j !== i) });
    const add = () => {
        const rule = addRule || addable[0]?.name;
        if (!rule) return;
        onChange({ ...spec, seed: spec.seed ?? 1, pipeline: [...spec.pipeline, { rule }] });
        setAddRule("");
    };

    const fmt = (v: number | undefined) => (v === undefined ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(4));
    const rawAt = (key: string): string => {
        if (raw === null) return "—";
        if (type === "table2d") {
            const [a, b] = key.split(",").map(Number);
            return fmt((raw as number[][])[a]?.[b]);
        }
        return fmt((raw as number[])[Number(key)]);
    };
    const setOverride = (key: string, v: number | null) => {
        const ov = { ...(spec.overrides ?? {}) };
        const keys = [key];
        if (type === "table2d" && mirror) {
            const [a, b] = key.split(",");
            keys.push(`${b},${a}`);
        }
        for (const k of keys) {
            if (v === null) delete ov[k];
            else ov[k] = v;
        }
        onChange({ ...spec, overrides: ov });
    };

    return (
        <>
            <div className="muted">{TYPE_LABEL[type]}　N = {N}</div>

            {spec.pipeline.length === 0 && (
                <fieldset className="box">
                    <legend>パイプライン</legend>
                    <div className="muted">パイプラインなし（baked をそのまま使います）</div>
                </fieldset>
            )}

            {spec.pipeline.map((step, i) => {
                const def = GEN_RULES[step.rule];
                return (
                    <fieldset className="box" key={i}>
                        <legend>{i + 1}. {GEN_LABEL[step.rule] ?? step.rule}（{step.rule}）</legend>
                        {def ? (
                            <ParamTable
                                idPrefix={`${name}-${i}`}
                                specs={def.params}
                                values={step.params ?? {}}
                                disabled={disabled}
                                artifactsByType={artifactsByType}
                                onChange={(params) => setStep(i, { ...step, params })}
                            />
                        ) : (
                            <div className="mark-error">{step.rule} という生成ルールはありません</div>
                        )}
                        <div className="row">
                            {i > 0 && <button className="btn small" disabled={disabled} onClick={() => move(i, -1)}>上へ移動</button>}
                            {i < spec.pipeline.length - 1 && <button className="btn small" disabled={disabled} onClick={() => move(i, 1)}>下へ移動</button>}
                            <button className="btn small" disabled={disabled} onClick={() => remove(i)}>削除</button>
                        </div>
                    </fieldset>
                );
            })}

            <div className="row" style={{ marginTop: 0 }}>
                <label htmlFor={`${name}-add`}>ステップを追加</label>
                <select id={`${name}-add`} disabled={disabled || addable.length === 0} value={addRule || addable[0]?.name || ""} onChange={(e) => setAddRule(e.target.value)}>
                    {addable.map((d) => <option key={d.name} value={d.name}>{GEN_LABEL[d.name] ?? d.name}（{d.name}）</option>)}
                </select>
                <button className="btn" disabled={disabled || addable.length === 0} onClick={add}>＋ 追加</button>
            </div>

            {spec.pipeline.length > 0 && (
                <fieldset className="box">
                    <legend>乱数</legend>
                    <table className="grid">
                        <tbody>
                            <tr>
                                <td><label htmlFor={`${name}-seed`}>seed</label></td>
                                <td className="input">
                                    <input id={`${name}-seed`} type="number" step={1} disabled={disabled} value={spec.seed ?? 0}
                                        onChange={(e) => onChange({ ...spec, seed: Number(e.target.value) })} />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </fieldset>
            )}

            {spec.pipeline.length > 0 && (
                <fieldset className="box">
                    <legend>手修正（overrides）</legend>
                    <table className="grid full">
                        <thead><tr><th>{type === "table2d" ? "A,B" : "ブロックID"}</th><th className="num">生成値</th><th className="num">上書き値</th><th></th></tr></thead>
                        <tbody>
                            {Object.entries(spec.overrides ?? {}).map(([k, v]) => (
                                <tr key={k}>
                                    <td>{k}</td>
                                    <td className="num muted">{rawAt(k)}</td>
                                    <td className="num" style={{ fontWeight: 700 }}>{v}</td>
                                    <td><button className="btn small" disabled={disabled} onClick={() => setOverride(k, null)}>削除</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="row">
                        <label htmlFor={`${name}-ovk`}>{type === "table2d" ? "A,B" : "ID"}</label>
                        <input id={`${name}-ovk`} type="text" style={{ width: 64 }} disabled={disabled} value={ovKey} onChange={(e) => setOvKey(e.target.value)} />
                        <label htmlFor={`${name}-ovv`}>値</label>
                        <input id={`${name}-ovv`} type="number" step="any" style={{ width: 80 }} disabled={disabled} value={ovValue} onChange={(e) => setOvValue(e.target.value)} />
                        <button className="btn small" disabled={disabled || ovKey === "" || ovValue === ""}
                            onClick={() => { setOverride(ovKey.replace(/\s/g, ""), Number(ovValue)); setOvKey(""); setOvValue(""); }}>＋ 上書きを追加</button>
                    </div>
                    {type === "table2d" && (
                        <label className="row"><input type="checkbox" checked={mirror} disabled={disabled} onChange={(e) => setMirror(e.target.checked)} />B,A にも同じ値を入れる</label>
                    )}
                </fieldset>
            )}

            {onDelete && (
                <div className="row" style={{ marginTop: 0 }}>
                    <button className="btn" disabled={disabled} onClick={onDelete}>この artifact を削除</button>
                </div>
            )}
        </>
    );
}
