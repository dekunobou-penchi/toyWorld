import { useMemo, useState } from "react";
import { targetCounts, type ArtifactSpec, type RuleFile } from "@game/shared";
import { artifactTypeOf, TYPE_LABEL } from "../model";

/** 分布の棒の色：エネルギー 0 は灰、負は橙、それ以外は青 */
function barColor(e: number | undefined): string {
    if (e === undefined) return "#3B6EB5";
    if (e === 0) return "#9A9A9A";
    return e < 0 ? "#C2410C" : "#3B6EB5";
}

/** ③ artifact のプレビュー（型ごと） */
export function ArtifactPreview({ name, spec, rule }: { name: string; spec: ArtifactSpec; rule: RuleFile }) {
    const type = artifactTypeOf(spec);
    const N = rule.constants.N;
    const energy = rule.artifacts.energyTable?.baked as number[] | undefined;
    return (
        <fieldset className="box">
            <legend>{TYPE_LABEL[type]}：{name}</legend>
            {type === "table1d" && <BarChart values={spec.baked as number[]} N={N} />}
            {type === "table2d" && <Heatmap key={N} table={spec.baked as number[][]} N={N} />}
            {type === "distribution" && <DistributionTable dist={spec.baked as number[]} energy={name === "energyTable" ? undefined : energy} cells={rule.constants.nx * rule.constants.ny} />}
        </fieldset>
    );
}

/** 1次元表：ID ごとの棒グラフ（点線＝0、橙＝負） */
export function BarChart({ values, N }: { values: number[]; N: number }) {
    const W = 380, H = 160, left = 34, top = 14, bottom = 124;
    const vals = values.slice(1, N + 1);
    const maxPos = Math.max(0, ...vals);
    const maxNeg = Math.max(0, ...vals.map((v) => -v));
    const span = Math.max(maxPos + maxNeg, 1);
    // 正と負の大きさに合わせて 0 の線の高さを決める
    const base = top + (maxPos / span) * (bottom - top);
    const scale = (bottom - top) / span;
    const bw = (W - left - 8) / Math.max(vals.length, 1);
    const tickEvery = Math.ceil(vals.length / 10);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="ブロックIDごとの値" style={{ maxWidth: 560 }}>
            <line x1={left} y1={base} x2={W - 4} y2={base} stroke="#4A4A4A" />
            {maxPos > 0 && <text x={left - 4} y={top + 4} textAnchor="end" fontSize="10" fill="#4A4A4A">{maxPos}</text>}
            <text x={left - 4} y={base + 3} textAnchor="end" fontSize="10" fill="#4A4A4A">0</text>
            {maxNeg > 0 && <text x={left - 4} y={bottom} textAnchor="end" fontSize="10" fill="#4A4A4A">{-maxNeg}</text>}
            {vals.map((v, i) => {
                const x = left + i * bw + bw * 0.15;
                const w = Math.max(bw * 0.7, 1);
                if (v === 0) return <rect key={i} x={x} y={base - 3} width={w} height={3} fill="none" stroke="#7A7A7A" strokeDasharray="2 2" />;
                const h = Math.abs(v) * scale;
                return <rect key={i} x={x} y={v > 0 ? base - h : base} width={w} height={Math.max(h, 1)} fill={v > 0 ? "#3B6EB5" : "#C2410C"} />;
            })}
            {vals.map((_, i) => (i % tickEvery === 0 || i === vals.length - 1) && (
                <text key={`t${i}`} x={left + i * bw + bw / 2} y={bottom + 18} textAnchor="middle" fontSize="10" fill="#1A1A1A">{i + 1}</text>
            ))}
        </svg>
    );
}

/** ID 1 だけから融合を繰り返して作れるブロック */
function reachable(f: number[][]): Set<number> {
    const seen = new Set<number>([1]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const a of [...seen]) for (const b of [...seen]) {
            const r = f[a]?.[b];
            if (r !== undefined && !seen.has(r)) { seen.add(r); grew = true; }
        }
    }
    return seen;
}

/** 2次元表：A × B → 結果 のヒートマップ（太枠＝A, B より上の ID になる組） */
export function Heatmap({ table, N }: { table: number[][]; N: number }) {
    const [from, setFrom] = useState(1);
    const [to, setTo] = useState(Math.min(N, 100));
    const [hover, setHover] = useState<string>("");
    const lo = Math.max(1, Math.min(from, N));
    const hi = Math.max(lo, Math.min(to, N));
    const size = hi - lo + 1;
    const cell = Math.max(4, Math.min(34, Math.floor(440 / (size + 1))));
    const showNumbers = size <= 20;

    const stats = useMemo(() => {
        let jumps = 0, down = 0, total = 0, symmetric = true;
        for (let a = 1; a <= N; a++) for (let b = 1; b <= N; b++) {
            const v = table[a]?.[b];
            if (v !== table[b]?.[a]) symmetric = false;
            if (b < a) continue;
            total++;
            if (v > Math.max(a, b)) jumps++;
            if (v < Math.max(a, b)) down++;
        }
        const r = reachable(table);
        return { jumps, downRate: total ? down / total : 0, reach: Math.max(...r), reachCount: r.size, symmetric };
    }, [table, N]);

    const ids = Array.from({ length: size }, (_, i) => lo + i);
    const rowH = showNumbers ? Math.max(cell, 22) : cell;
    const head = { width: cell, height: rowH, background: "#E6E6E6", fontWeight: 700, fontSize: showNumbers ? 11 : 0 };
    return (
        <>
            <div className="row" style={{ marginTop: 0 }}>
                <label htmlFor="hm-from">表示する ID</label>
                <input id="hm-from" type="number" min={1} max={N} style={{ width: 60 }} value={from} onChange={(e) => setFrom(Number(e.target.value))} />
                <span>〜</span>
                <input id="hm-to" aria-label="表示する ID の終わり" type="number" min={1} max={N} style={{ width: 60 }} value={to} onChange={(e) => setTo(Number(e.target.value))} />
                <span className="muted" aria-live="polite">{hover}</span>
            </div>
            <div className="mapgrid" style={{ gridTemplateColumns: `repeat(${size + 1}, ${cell}px)` }} role="img" aria-label="融合表のヒートマップ" onMouseLeave={() => setHover("")}>
                <div style={head}>{showNumbers ? "A\\B" : ""}</div>
                {ids.map((b) => <div key={`h${b}`} style={head}>{showNumbers ? b : ""}</div>)}
                {ids.map((a) => [
                    <div key={`r${a}`} style={head}>{showNumbers ? a : ""}</div>,
                    ...ids.map((b) => {
                        const v = table[a]?.[b] ?? 0;
                        const l = 95 - Math.round((v / N) * 50);
                        const jump = v > Math.max(a, b);
                        return (
                            <div key={`${a},${b}`} onMouseEnter={() => setHover(`${a} × ${b} → ${v}`)} style={{
                                width: cell, height: rowH,
                                background: `hsl(215, 55%, ${l}%)`, color: l < 62 ? "#FFFFFF" : "#1A1A1A",
                                border: jump ? `${showNumbers ? 2 : 1}px solid #C2410C` : undefined, fontWeight: jump ? 700 : 400,
                            }}>{showNumbers ? v : ""}</div>
                        );
                    }),
                ])}
            </div>
            <table className="grid">
                <tbody>
                    <tr><th scope="row">ジャンプアップの組数</th><td className="num">{stats.jumps}</td></tr>
                    <tr><th scope="row">格下になる組の割合</th><td className="num">{Math.round(stats.downRate * 100)}%</td></tr>
                    <tr><th scope="row">ID 1 から到達できる最高 ID</th><td className="num">{stats.reach}（{stats.reachCount} 種類）</td></tr>
                    <tr><th scope="row">対称性</th><td className="num">{stats.symmetric ? "OK" : <span className="mark-error">対称でない</span>}</td></tr>
                </tbody>
            </table>
        </>
    );
}

/** 分布：ID・エネルギー・割合・マップ全体での目標個数 */
export function DistributionTable({ dist, energy, cells }: { dist: number[]; energy?: number[]; cells: number }) {
    const N = dist.length - 1;
    const sum = dist.slice(1).reduce((a, b) => a + b, 0);
    const ok = Math.abs(sum - 1) <= 1e-6;
    const counts = ok ? targetCounts(dist, cells) : null;
    const maxP = Math.max(...dist.slice(1), 1e-9);
    return (
        <div className="scroll">
            <table className="grid full">
                <thead>
                    <tr><th className="num">ID</th>{energy && <th className="num">エネルギー</th>}<th>割合</th><th className="num">目標個数</th></tr>
                </thead>
                <tbody>
                    {dist.slice(1).map((p, i) => (
                        <tr key={i}>
                            <td className="num">{i + 1}</td>
                            {energy && <td className="num">{energy[i + 1]}</td>}
                            <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ flex: 1, height: 12, background: "#EFEFEF" }}>
                                        <div style={{ height: 12, width: `${Math.round((p / maxP) * 100)}%`, background: barColor(energy?.[i + 1]) }} />
                                    </div>
                                    <span style={{ width: 48, textAlign: "right" }}>{p.toFixed(3)}</span>
                                </div>
                            </td>
                            <td className="num">{counts ? counts[i + 1] : "—"}</td>
                        </tr>
                    ))}
                    <tr>
                        <th scope="row" colSpan={energy ? 2 : 1} className="num">合計</th>
                        <td className={ok ? "num" : "num mark-error"}>{ok ? "" : "✕ "}{sum.toFixed(3)}</td>
                        <td className="num">{counts ? counts.reduce((a, b) => a + b, 0) : "—"}</td>
                    </tr>
                </tbody>
            </table>
            {N > 0 && !ok && <div className="mark-error">割合の合計が 1 ではありません</div>}
        </div>
    );
}
