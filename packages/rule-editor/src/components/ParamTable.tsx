import type { ParamSpec, ParamValues } from "@game/shared";

interface Props {
    /** 入力欄の id の先頭（同じ画面に複数の表を置くため） */
    idPrefix: string;
    specs: Record<string, ParamSpec>;
    values: ParamValues;
    onChange: (values: ParamValues) => void;
    disabled: boolean;
    /** artifact を選ぶパラメータの候補（型ごとの名前の一覧） */
    artifactsByType: Record<string, string[]>;
}

/** ルールが宣言したパラメータの型から、入力欄を作る */
export function ParamTable({ idPrefix, specs, values, onChange, disabled, artifactsByType }: Props) {
    const keys = Object.keys(specs);
    if (keys.length === 0) return <div className="muted">パラメータなし</div>;

    const set = (key: string, v: unknown) => onChange({ ...values, [key]: v });

    return (
        <table className="grid full">
            <thead>
                <tr><th>パラメータ</th><th style={{ width: 160 }}>値</th></tr>
            </thead>
            <tbody>
                {keys.map((key) => {
                    const spec = specs[key];
                    const id = `${idPrefix}-${key}`;
                    const value = key in values ? values[key] : spec.default;
                    let input;
                    switch (spec.type) {
                        case "number":
                        case "integer":
                            input = (
                                <input
                                    id={id}
                                    type="number"
                                    disabled={disabled}
                                    step={spec.type === "integer" ? 1 : (spec.step ?? "any")}
                                    min={spec.min}
                                    max={spec.max}
                                    value={Number.isFinite(value as number) ? (value as number) : ""}
                                    onChange={(e) => set(key, e.target.value === "" ? NaN : Number(e.target.value))}
                                />
                            );
                            break;
                        case "boolean":
                            input = (
                                <select id={id} disabled={disabled} value={String(value)} onChange={(e) => set(key, e.target.value === "true")}>
                                    <option value="true">true</option>
                                    <option value="false">false</option>
                                </select>
                            );
                            break;
                        case "enum":
                            input = (
                                <select id={id} disabled={disabled} value={String(value)} onChange={(e) => set(key, e.target.value)}>
                                    {spec.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                            );
                            break;
                        case "artifact": {
                            const names = artifactsByType[spec.artifactType] ?? [];
                            const options = names.includes(String(value)) ? names : [String(value), ...names];
                            input = (
                                <select id={id} disabled={disabled} value={String(value)} onChange={(e) => set(key, e.target.value)}>
                                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                            );
                            break;
                        }
                    }
                    return (
                        <tr key={key}>
                            <td><label htmlFor={id}>{key}</label></td>
                            <td className="input">{input}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
