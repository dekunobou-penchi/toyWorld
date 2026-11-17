import { Component, useMemo, useState, type ReactNode } from "react";
import { createRngSet, type Direction, type HookName, type RuleFile, type ViewCell } from "@game/shared";
import { energyColor, targetNameOf } from "../model";
import { ctxOf, fakePlayer, initialMap, runtimeOf, simulateRefill } from "../sim";

/** ③ runtime のプレビュー（フックごと） */
export function HookPreview({ hook, rule }: { hook: HookName; rule: RuleFile }) {
    if (runtimeOf(rule) === null) return <div className="mark-error">runtime にエラーがあるのでプレビューできません</div>;
    // ルールの中でエラーが出てもエディタ全体が止まらないようにする。ルールが変わったらもう一度試す
    return (
        <PreviewBoundary resetKey={rule}>
            {hook === "initMap" && <InitMapPreview rule={rule} />}
            {hook === "refill" && <RefillPreview rule={rule} />}
            {hook === "observe" && <ObservePreview rule={rule} />}
            {hook === "respawn" && <RespawnPreview rule={rule} />}
            {hook === "fusion" && <FusionTest rule={rule} />}
            {hook === "energy" && <EnergyTest rule={rule} />}
        </PreviewBoundary>
    );
}

export class PreviewBoundary extends Component<{ children: ReactNode; resetKey: unknown }, { error: string | null }> {
    state = { error: null as string | null };
    static getDerivedStateFromError(err: Error) {
        return { error: err.message };
    }
    componentDidUpdate(prev: { resetKey: unknown }) {
        if (prev.resetKey !== this.props.resetKey && this.state.error !== null) this.setState({ error: null });
    }
    render() {
        if (this.state.error !== null) return <div className="mark-error">プレビューできません：{this.state.error}</div>;
        return this.props.children;
    }
}

/** マップの表示。マスの色はエネルギー、highlight のマスは太枠 */
export function MapView({ map, energy, highlight, agent }: {
    map: number[][]; energy: number[]; highlight?: Set<string>; agent?: { x: number; y: number; dir: Direction };
}) {
    const ny = map.length, nx = map[0]?.length ?? 0;
    const cell = Math.max(6, Math.min(24, Math.floor(320 / Math.max(nx, ny))));
    const maxE = Math.max(1, ...energy.slice(1));
    const arrow: Record<Direction, string> = { N: "▲", E: "▶", S: "▼", W: "◀" };
    return (
        <div className="mapgrid" style={{ gridTemplateColumns: `repeat(${nx}, ${cell}px)` }} role="img" aria-label={`マップ ${nx}×${ny}`}>
            {map.flatMap((row, y) => row.map((v, x) => {
                if (agent && agent.x === x && agent.y === y) {
                    return <div key={`${x},${y}`} style={{ width: cell, height: cell, background: "#1A1A1A", color: "#FFFFFF" }}>{arrow[agent.dir]}</div>;
                }
                const e = energy[v] ?? 0;
                const hl = highlight?.has(`${x},${y}`);
                const dark = e > maxE * 0.55;
                return (
                    <div key={`${x},${y}`} title={`(${x}, ${y}) ID ${v}`} style={{
                        width: cell, height: cell, background: energyColor(e, maxE), color: dark ? "#FFFFFF" : "#1A1A1A",
                        border: hl ? "2px solid #C2410C" : undefined, fontWeight: hl ? 700 : 400,
                        opacity: highlight && !hl ? 0.45 : 1, fontSize: cell >= 18 ? 10 : 0,
                    }}>{v}</div>
                );
            }))}
        </div>
    );
}

function InitMapPreview({ rule }: { rule: RuleFile }) {
    const map = useMemo(() => initialMap(rule), [rule]);
    const N = rule.constants.N;
    const energy = (rule.artifacts.energyTable?.baked as number[]) ?? [];
    const counts = new Array(N + 1).fill(0);
    for (const row of map) for (const v of row) if (v >= 0 && v <= N) counts[v]++;
    const tName = targetNameOf(rule);
    const target = tName ? (rule.artifacts[tName]?.baked as number[] | undefined) : undefined;
    return (
        <>
            <fieldset className="box">
                <legend>初期マップ（シード {rule.constants.seed}）</legend>
                <MapView map={map} energy={energy} />
            </fieldset>
            <fieldset className="box">
                <legend>個数</legend>
                <div className="scroll">
                    <table className="grid">
                        <thead><tr><th className="num">ID</th>{target && <th className="num">目標</th>}<th className="num">実際</th></tr></thead>
                        <tbody>
                            {counts.map((c, id) => (id === 0 && c === 0) ? null : (
                                <tr key={id}><td className="num">{id === 0 ? "0（空）" : id}</td>{target && <td className="num">{((target[id] ?? 0) * rule.constants.nx * rule.constants.ny).toFixed(1)}</td>}<td className="num">{c}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </fieldset>
        </>
    );
}

function RefillPreview({ rule }: { rule: RuleFile }) {
    const [taker, setTaker] = useState<"greedy" | "random">("greedy");
    const [ticks, setTicks] = useState(1000);
    const [rate, setRate] = useState(0.1);
    const N = rule.constants.N;
    const energy = (rule.artifacts.energyTable?.baked as number[]) ?? [];
    // 一番エネルギーが低い ID と高い ID の推移を見る
    const ids = Array.from({ length: N }, (_, i) => i + 1);
    const low = ids.reduce((a, b) => ((energy[b] ?? 0) < (energy[a] ?? 0) ? b : a), 1);
    const high = ids.reduce((a, b) => ((energy[b] ?? 0) > (energy[a] ?? 0) ? b : a), 1);
    const result = useMemo(() => simulateRefill(rule, { taker, ticks: Math.max(1, ticks | 0), rate: Math.min(Math.max(rate, 0), 1), watch: [low, high] }), [rule, taker, ticks, rate, low, high]);

    const W = 640, H = 260, left = 44, right = 620, top = 20, bottom = 220;
    const all = [...result.series.flat(), ...(result.target ? [result.target[low], result.target[high]] : [])];
    const maxY = Math.max(0.05, ...all) * 1.1;
    const X = (t: number) => left + (t / Math.max(1, result.series[0].length - 1)) * (right - left);
    const Y = (v: number) => bottom - (v / maxY) * (bottom - top);
    // 点が多すぎると重いので、最大 300 点くらいに間引く（最後の点は必ず入れる）
    const line = (s: number[]) => {
        const step = Math.max(1, Math.floor(s.length / 300));
        const idx: number[] = [];
        for (let i = 0; i < s.length; i += step) idx.push(i);
        if (idx[idx.length - 1] !== s.length - 1) idx.push(s.length - 1);
        return idx.map((i) => `${X(i).toFixed(1)},${Y(s[i]).toFixed(1)}`).join(" ");
    };
    const colors = ["#1A1A1A", "#C2410C"];
    return (
        <>
            <fieldset className="box">
                <legend>補充シミュレーション</legend>
                <div className="row" style={{ marginTop: 0, marginBottom: 10, gap: 16 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>取り方
                        <span role="group" aria-label="取り方" style={{ display: "flex" }}>
                            <button className={`btn small ${taker === "greedy" ? "active" : ""}`} aria-pressed={taker === "greedy"} onClick={() => setTaker("greedy")}>貪欲</button>
                            <button className={`btn small ${taker === "random" ? "active" : ""}`} aria-pressed={taker === "random"} onClick={() => setTaker("random")}>ランダム</button>
                        </span>
                    </span>
                    <label>長さ（tick） <input type="number" min={1} style={{ width: 72 }} value={ticks} onChange={(e) => setTicks(Number(e.target.value))} /></label>
                    <label>頻度（回/tick） <input type="number" min={0} max={1} step={0.05} style={{ width: 64 }} value={rate} onChange={(e) => setRate(Number(e.target.value))} /></label>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="ブロック種類ごとのマップ上の割合の推移">
                    <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="#4A4A4A" />
                    <line x1={left} y1={top} x2={left} y2={bottom} stroke="#4A4A4A" />
                    <text x={left - 6} y={top + 4} textAnchor="end" fontSize="11" fill="#4A4A4A">{Math.round(maxY * 100)}%</text>
                    <text x={left - 6} y={bottom + 4} textAnchor="end" fontSize="11" fill="#4A4A4A">0</text>
                    <text x={left} y={bottom + 18} textAnchor="middle" fontSize="11" fill="#4A4A4A">0</text>
                    <text x={right} y={bottom + 18} textAnchor="middle" fontSize="11" fill="#4A4A4A">{ticks}</text>
                    <text x={(left + right) / 2} y={bottom + 34} textAnchor="middle" fontSize="11" fill="#4A4A4A">tick</text>
                    {result.target && [low, high].map((id, i) => (
                        <line key={`t${id}`} x1={left} x2={right} y1={Y(result.target![id])} y2={Y(result.target![id])} stroke={colors[i]} strokeDasharray="5 4" />
                    ))}
                    {result.series.map((s, i) => <polyline key={i} points={line(s)} fill="none" stroke={colors[i]} strokeWidth={2} />)}
                </svg>
                <div className="legend">黒：ID {low}（エネルギー {energy[low]}）　橙：ID {high}（エネルギー {energy[high]}）{result.target ? "　点線：目標" : ""}</div>
            </fieldset>
            <fieldset className="box">
                <legend>集計</legend>
                <table className="grid">
                    <tbody>
                        <tr><th scope="row">目標とのズレ（L1）</th><td className="num">{result.l1 === null ? "—（目標分布なし）" : result.l1.toFixed(3)}</td></tr>
                        <tr><th scope="row">取ったIDと同じIDが補充された割合</th><td className="num">{Math.round(result.sameRate * 100)}%</td></tr>
                        <tr><th scope="row">補充回数</th><td className="num">{result.refills}</td></tr>
                    </tbody>
                </table>
            </fieldset>
        </>
    );
}

function ObservePreview({ rule }: { rule: RuleFile }) {
    const [dir, setDir] = useState<Direction>("E");
    const map = useMemo(() => initialMap(rule), [rule]);
    const rt = runtimeOf(rule)!;
    const nx = rule.constants.nx, ny = rule.constants.ny;
    const me = fakePlayer(Math.floor(nx / 2) - 1, Math.floor(ny / 2), dir);
    let cells: ViewCell[] = [];
    let error = "";
    try {
        cells = rt.observe(ctxOf(rule, map, createRngSet(rule.constants.seed).observe, [me]), me);
    } catch (err) {
        error = (err as Error).message;
    }
    const energy = (rule.artifacts.energyTable?.baked as number[]) ?? [];
    return (
        <>
            <fieldset className="box">
                <legend>見える範囲</legend>
                <div className="row" style={{ marginTop: 0, marginBottom: 8 }}>
                    <span>向き</span>
                    {(["N", "E", "S", "W"] as Direction[]).map((d) => (
                        <button key={d} className={`btn small ${dir === d ? "active" : ""}`} aria-pressed={dir === d} onClick={() => setDir(d)}>{d}</button>
                    ))}
                </div>
                {error ? <div className="mark-error">{error}</div> : <MapView map={map} energy={energy} highlight={new Set(cells.map((c) => `${c.x},${c.y}`))} agent={{ x: me.pos.x, y: me.pos.y, dir }} />}
                <div className="legend" style={{ marginTop: 6 }}>黒：エージェント　太枠：見えるマス（{cells.length} マス）</div>
            </fieldset>
            <fieldset className="box">
                <legend>返す ViewCell</legend>
                <div className="scroll">
                    <table className="grid">
                        <thead><tr><th className="num">view[i]</th><th className="num">x</th><th className="num">y</th><th className="num">block</th></tr></thead>
                        <tbody>
                            {cells.map((c, i) => <tr key={i}><td className="num">{i}</td><td className="num">{c.x}</td><td className="num">{c.y}</td><td className="num">{c.block}</td></tr>)}
                        </tbody>
                    </table>
                </div>
            </fieldset>
        </>
    );
}

function RespawnPreview({ rule }: { rule: RuleFile }) {
    const rt = runtimeOf(rule)!;
    const map = initialMap(rule);
    const rng = createRngSet(rule.constants.seed).respawn;
    const me = fakePlayer(0, 0, "N", 5);
    const rows = Array.from({ length: 5 }, () => rt.respawn(ctxOf(rule, map, rng, [me]), me));
    return (
        <fieldset className="box">
            <legend>サンプル（5回、死亡前：向き N・hold 5）</legend>
            <table className="grid">
                <thead><tr><th className="num">回</th><th>位置</th><th>向き</th><th className="num">hold</th><th className="num">LP</th></tr></thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i}><td className="num">{i + 1}</td><td>{r.pos ? `(${r.pos.x}, ${r.pos.y})` : "そのまま"}</td><td>{r.dir}</td><td className="num">{r.hold}</td><td className="num">{r.lp}</td></tr>
                    ))}
                </tbody>
            </table>
        </fieldset>
    );
}

function FusionTest({ rule }: { rule: RuleFile }) {
    const [a, setA] = useState(1);
    const [b, setB] = useState(1);
    const [target, setTarget] = useState<"map" | "player">("map");
    const rt = runtimeOf(rule)!;
    let result: string;
    try {
        result = String(rt.fusion(ctxOf(rule, initialMap(rule), createRngSet(rule.constants.seed).fusion), a, b, target));
    } catch (err) {
        result = `エラー：${(err as Error).message}`;
    }
    return (
        <fieldset className="box">
            <legend>参照テスト</legend>
            <div className="row" style={{ marginTop: 0 }}>
                <label>A <input type="number" min={1} max={rule.constants.N} style={{ width: 64 }} value={a} onChange={(e) => setA(Number(e.target.value))} /></label>
                <label>B <input type="number" min={1} max={rule.constants.N} style={{ width: 64 }} value={b} onChange={(e) => setB(Number(e.target.value))} /></label>
                <label>target <select value={target} onChange={(e) => setTarget(e.target.value as "map" | "player")}><option value="map">map</option><option value="player">player</option></select></label>
                <span>→</span><span style={{ fontWeight: 700, fontSize: 16 }}>{result}</span>
            </div>
        </fieldset>
    );
}

function EnergyTest({ rule }: { rule: RuleFile }) {
    const [id, setId] = useState(1);
    const rt = runtimeOf(rule)!;
    let result: string;
    try {
        result = String(rt.energy(ctxOf(rule, initialMap(rule), createRngSet(rule.constants.seed).energy), id));
    } catch (err) {
        result = `エラー：${(err as Error).message}`;
    }
    return (
        <fieldset className="box">
            <legend>参照テスト</legend>
            <div className="row" style={{ marginTop: 0 }}>
                <label>ブロックID <input type="number" min={1} max={rule.constants.N} style={{ width: 64 }} value={id} onChange={(e) => setId(Number(e.target.value))} /></label>
                <span>→</span><span style={{ fontWeight: 700, fontSize: 16 }}>{result}</span>
            </div>
        </fieldset>
    );
}
