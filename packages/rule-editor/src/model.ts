import {
    bakeArtifact,
    defaultEnergyTable,
    defaultFusionTable,
    GEN_RULES,
    RULES,
    resolveParams,
    type ArtifactSpec,
    type ArtifactType,
    type ArtifactValue,
    type HookName,
    type RuleFile,
} from "@game/shared";

/** ①目次で選んでいるもの */
export type Selection =
    | { kind: "settings" }
    | { kind: "artifact"; name: string }
    | { kind: "hook"; hook: HookName };

export const HOOKS: HookName[] = ["initMap", "refill", "fusion", "energy", "respawn", "observe"];

/** 生成ルールの表示名 */
export const GEN_LABEL: Record<string, string> = {
    accelCurve: "加速曲線",
    injectNegatives: "負のブロックを混ぜる",
    injectZeros: "0のブロックを混ぜる",
    jumpUp: "ジャンプアップ生成",
    symmetrize: "対称化",
    uniformDistribution: "一様",
    fromEnergy: "エネルギーから減衰",
};

export const TYPE_LABEL: Record<ArtifactType, string> = {
    table1d: "1次元表",
    table2d: "2次元表",
    distribution: "分布",
};

export function clone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
}

/** artifact の型。パイプラインがあれば最後の段の出力、無ければ baked の形から推測する */
export function artifactTypeOf(spec: ArtifactSpec): ArtifactType {
    const last = spec.pipeline[spec.pipeline.length - 1];
    if (last !== undefined && GEN_RULES[last.rule]) return GEN_RULES[last.rule].output;
    const b = spec.baked as unknown[];
    if (Array.isArray(b[0])) return "table2d";
    const nums = b as number[];
    const sum = nums.reduce((a, x) => a + x, 0);
    if (nums[0] === 0 && nums.every((x) => x >= 0) && Math.abs(sum - 1) < 1e-6) return "distribution";
    return "table1d";
}

/** artifact を上から順に作り直す。作れなかったものは前の結果のまま */
export function rebakeAll(rule: RuleFile): RuleFile {
    const out = clone(rule);
    const built: Record<string, ArtifactValue> = {};
    for (const [name, spec] of Object.entries(out.artifacts)) {
        if (spec.pipeline.length > 0) {
            try {
                spec.baked = bakeArtifact(spec, out.constants.N, built);
            } catch {
                // エラーは checkRuleFile が出すので、ここでは何もしない
            }
        }
        built[name] = spec.baked as ArtifactValue;
    }
    return out;
}

/** N を変えたとき、既定の表のまま（パイプライン無し）の energyTable / fusionTable は新しい N の既定の表にする */
export function changeN(rule: RuleFile, N: number): RuleFile {
    const out = clone(rule);
    const oldN = out.constants.N;
    out.constants.N = N;
    const e = out.artifacts.energyTable;
    if (e && e.pipeline.length === 0 && JSON.stringify(e.baked) === JSON.stringify(defaultEnergyTable(oldN))) {
        e.baked = defaultEnergyTable(N);
    }
    const f = out.artifacts.fusionTable;
    if (f && f.pipeline.length === 0 && JSON.stringify(f.baked) === JSON.stringify(defaultFusionTable(oldN))) {
        f.baked = defaultFusionTable(N);
    }
    return rebakeAll(out);
}

/** エラーの文がどの項目のものか */
export function errorsFor(errors: string[], sel: Selection): string[] {
    if (sel.kind === "settings") return errors.filter((e) => e.startsWith("constants") || e.startsWith("operation") || e.startsWith("format") || e.startsWith("version"));
    if (sel.kind === "artifact") return errors.filter((e) => e.includes(`artifacts.${sel.name}`) || e.startsWith(`${sel.name} は`) || e.startsWith(`${sel.name} の`));
    return errors.filter((e) => e.includes(`runtime.${sel.hook}`) || e.startsWith(`runtime: ${sel.hook}`));
}

/** refill か initMap のルールが使っている目標分布の名前 */
export function targetNameOf(rule: RuleFile): string | null {
    for (const hook of ["refill", "initMap"] as HookName[]) {
        const sel = rule.runtime[hook];
        const def = RULES[hook][sel.rule];
        if (def === undefined || !("target" in def.params)) continue;
        try {
            return resolveParams(def, sel.params).target as string;
        } catch {
            return null;
        }
    }
    return null;
}

/** エネルギーで色を付ける（0 は灰、負は橙、正は高いほど濃い青） */
export function energyColor(e: number, maxE: number): string {
    if (e === 0 || Number.isNaN(e)) return "#CFCFCF";
    if (e < 0) return "#C2410C";
    const l = 92 - Math.round((e / Math.max(maxE, 1)) * 57);
    return `hsl(215, 55%, ${l}%)`;
}
