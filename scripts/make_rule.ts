/*
 * 生成ルールを使ってルールファイルを作る（エディタができるまでのつなぎ）
 *
 * 使い方（リポジトリのルートで）:
 *   pnpm --filter @game/server exec tsx ../../scripts/make_rule.ts [オプション] > rule.json
 *
 * オプション（--名前 値）。省略したものは旧 PHP 版の値:
 *   --N 100                    ブロックの種類数
 *   --nx 10 --ny 10            マップの大きさ
 *   --seed 43                  実験のシード（constants.seed）
 *   --artifactSeed 1           表を作るときの乱数のシード
 *   --Estart 1 --Eend 100      エネルギーの加速曲線（ID 1 と ID N のエネルギー）
 *   --EmN 3 --EmNst 10         負のブロックの個数と、どの ID より大きいところから選ぶか
 *   --EzN 10 --EzNst 10        エネルギー 0 のブロックの個数と、どの ID より大きいところから選ぶか
 *   --Mnup 1 --Mnpath 1        融合のジャンプアップ（いくつ上がるか、1 行に何個か）
 *   --viewRange 5 --lpInitial 100 --lpDecreasePerTick 1 --tickIntervalSec 5 --transition agent
 *
 * 表の性質（0・負の個数、対称性、ジャンプアップの数など）は標準エラーに出す。
 */
import {
    checkRuleFile,
    makeArtifact,
    ruleFileFromValues,
    type RuleFile,
    type TransitionMode,
} from "../packages/shared/src/index.ts";

const defaults = {
    N: 100, nx: 10, ny: 10, seed: 43, artifactSeed: 1,
    Estart: 1, Eend: 100, EmN: 3, EmNst: 10, EzN: 10, EzNst: 10,
    Mnup: 1, Mnpath: 1,
    viewRange: 5, lpInitial: 100, lpDecreasePerTick: 1, tickIntervalSec: 5, transition: "agent",
};
type Options = typeof defaults;

function parseArgs(argv: string[]): Options {
    const o: Record<string, number | string> = { ...defaults };
    for (let i = 0; i < argv.length; i += 2) {
        const key = argv[i].replace(/^--/, "");
        if (!(key in defaults)) throw new Error(`--${key} というオプションはありません`);
        const raw = argv[i + 1];
        o[key] = key === "transition" ? raw : Number(raw);
    }
    return o as Options;
}

export function makeRule(o: Options): RuleFile {
    const rule = ruleFileFromValues({
        nx: o.nx, ny: o.ny, N: o.N, lpInitial: o.lpInitial, lpDecreasePerTick: o.lpDecreasePerTick,
        viewRange: o.viewRange, seed: o.seed, tickIntervalSec: o.tickIntervalSec, actionsPerTick: 1,
        reconnectTimeoutSec: 60, transition: o.transition as TransitionMode,
    });
    rule.artifacts.energyTable = makeArtifact([
        { rule: "accelCurve", params: { Estart: o.Estart, Eend: o.Eend } },
        { rule: "injectNegatives", params: { count: o.EmN, start: o.EmNst } },
        { rule: "injectZeros", params: { count: o.EzN, start: o.EzNst } },
    ], o.artifactSeed, o.N);
    rule.artifacts.fusionTable = makeArtifact([
        { rule: "jumpUp", params: { Mnup: o.Mnup, Mnpath: o.Mnpath } },
        { rule: "symmetrize" },
    ], o.artifactSeed, o.N);
    return rule;
}

/** ID 1 だけから融合を繰り返して作れるブロック */
function reachable(f: number[][]): Set<number> {
    const seen = new Set<number>([1]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const a of [...seen]) for (const b of [...seen]) {
            const r = f[a][b];
            if (!seen.has(r)) { seen.add(r); grew = true; }
        }
    }
    return seen;
}

export function describe(rule: RuleFile): string[] {
    const N = rule.constants.N;
    const e = rule.artifacts.energyTable.baked as number[];
    const f = rule.artifacts.fusionTable.baked as number[][];
    const ids = Array.from({ length: N }, (_, i) => i + 1);
    let symmetric = true;
    for (const i of ids) for (const j of ids) if (f[i][j] !== f[j][i]) symmetric = false;
    const jumps = ids.map((i) => ids.filter((j) => j <= i && f[i][j] > i).length);
    const reach = reachable(f);
    return [
        `N = ${N}`,
        `エネルギー：ID 1 = ${e[1]}、ID ${N} = ${e[N]}`,
        `エネルギー 0 の ID（${ids.filter((i) => e[i] === 0).length} 個）：${ids.filter((i) => e[i] === 0).join(", ")}`,
        `負の ID（${ids.filter((i) => e[i] < 0).length} 個）：${ids.filter((i) => e[i] < 0).join(", ")}`,
        `融合表：対称 = ${symmetric}、結果の範囲 = ${Math.min(...ids.flatMap((i) => ids.map((j) => f[i][j])))}〜${Math.max(...ids.flatMap((i) => ids.map((j) => f[i][j])))}`,
        `ジャンプアップの数（行ごと）：${[...new Set(jumps)].sort((a, b) => a - b).join(" / ")}（0 の行：${ids.filter((i) => jumps[i - 1] === 0).join(", ") || "なし"}）`,
        `ID 1 だけから融合で作れるブロック：${reach.size} 種類（最高 ID ${Math.max(...reach)}）`,
    ];
}

const isMain = process.argv[1]?.endsWith("make_rule.ts");
if (isMain) {
    let rule: RuleFile;
    try {
        rule = makeRule(parseArgs(process.argv.slice(2)));
    } catch (err) {
        console.error(`エラー：${(err as Error).message}`);
        process.exit(1);
    }
    const { errors, warnings } = checkRuleFile(rule);
    for (const line of describe(rule)) console.error(line);
    for (const w of warnings) console.error(`警告：${w}`);
    for (const e of errors) console.error(`エラー：${e}`);
    process.stdout.write(JSON.stringify(rule, null, 2) + "\n");
    if (errors.length > 0) process.exit(1);
}
