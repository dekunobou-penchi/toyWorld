import { listRules, RULES, type HookName, type RuleSelection } from "@game/shared";
import { ParamTable } from "./ParamTable";

interface Props {
    hook: HookName;
    selection: RuleSelection;
    disabled: boolean;
    artifactsByType: Record<string, string[]>;
    onChange: (sel: RuleSelection) => void;
}

/** ② runtime：フックに差すルールとそのパラメータ */
export function HookEditor({ hook, selection, disabled, artifactsByType, onChange }: Props) {
    const rules = listRules(hook);
    const def = RULES[hook][selection.rule];
    return (
        <>
            <fieldset className="box">
                <legend>ルール</legend>
                <label htmlFor={`${hook}-rule`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>使うルール</label>
                <select id={`${hook}-rule`} style={{ width: "100%" }} disabled={disabled} value={selection.rule}
                    onChange={(e) => onChange({ rule: e.target.value })}>
                    {!def && <option value={selection.rule}>{selection.rule}</option>}
                    {rules.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
            </fieldset>
            <fieldset className="box">
                <legend>パラメータ</legend>
                {def ? (
                    <ParamTable
                        idPrefix={hook}
                        specs={def.params}
                        values={selection.params ?? {}}
                        disabled={disabled}
                        artifactsByType={artifactsByType}
                        onChange={(params) => onChange({ ...selection, params })}
                    />
                ) : (
                    <div className="mark-error">{selection.rule} というルールはありません</div>
                )}
            </fieldset>
        </>
    );
}
