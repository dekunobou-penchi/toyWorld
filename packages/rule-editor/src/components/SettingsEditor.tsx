import type { RuleConstants, RuleFile, RuleOperation, TransitionMode } from "@game/shared";

interface Props {
    rule: RuleFile;
    disabled: boolean;
    onConstants: (c: RuleConstants) => void;
    onOperation: (o: RuleOperation) => void;
}

function NumberRow<T extends object>({ id, k, obj, disabled, step, onChange }: {
    id: string; k: keyof T & string; obj: T; disabled: boolean; step?: number | "any"; onChange: (v: T) => void;
}) {
    const v = obj[k] as unknown as number;
    return (
        <tr>
            <td><label htmlFor={id}>{k}</label></td>
            <td className="input">
                <input id={id} type="number" disabled={disabled} step={step ?? 1} value={Number.isFinite(v) ? v : ""}
                    onChange={(e) => onChange({ ...obj, [k]: e.target.value === "" ? NaN : Number(e.target.value) })} />
            </td>
        </tr>
    );
}

/** ② 定数（constants）と運用（operation） */
export function SettingsEditor({ rule, disabled, onConstants, onOperation }: Props) {
    const c = rule.constants;
    const o = rule.operation;
    return (
        <>
            <fieldset className="box">
                <legend>定数（constants）</legend>
                <table className="grid full">
                    <thead><tr><th>項目</th><th style={{ width: 160 }}>値</th></tr></thead>
                    <tbody>
                        {(["nx", "ny", "N", "lpInitial", "lpDecreasePerTick", "seed"] as const).map((k) => (
                            <NumberRow key={k} id={`c-${k}`} k={k} obj={c} disabled={disabled} onChange={onConstants} />
                        ))}
                    </tbody>
                </table>
            </fieldset>
            <fieldset className="box">
                <legend>運用（operation）</legend>
                <table className="grid full">
                    <thead><tr><th>項目</th><th style={{ width: 160 }}>値</th></tr></thead>
                    <tbody>
                        <NumberRow id="o-tick" k="tickIntervalSec" obj={o} disabled={disabled} step="any" onChange={onOperation} />
                        <NumberRow id="o-apt" k="actionsPerTick" obj={o} disabled={disabled} onChange={onOperation} />
                        <NumberRow id="o-rto" k="reconnectTimeoutSec" obj={o} disabled={disabled} onChange={onOperation} />
                        <tr>
                            <td><label htmlFor="o-tr">transition</label></td>
                            <td className="input">
                                <select id="o-tr" disabled={disabled} value={o.transition}
                                    onChange={(e) => onOperation({ ...o, transition: e.target.value as TransitionMode })}>
                                    <option value="agent">agent</option>
                                    <option value="person">person</option>
                                </select>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </fieldset>
        </>
    );
}
