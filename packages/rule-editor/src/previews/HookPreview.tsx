import { Component, useMemo, useState, type ReactNode } from "react";
import { createRngSet, type Direction, type HookName, type RuleFile, type ViewCell } from "@game/shared";
import { energyColor, targetNameOf } from "../model";
import { binomialPmf, binomialSd, ctxOf, fakePlayer, initialMap, runtimeOf, simulateRefill, type RefillSimResult } from "../sim";

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
    const [burnIn, setBurnIn] = useState(200);
    const result = useMemo(
        () => simulateRefill(rule, { taker, ticks: Math.max(1, ticks | 0), rate: Math.min(Math.max(rate, 0), 1), burnIn: Math.max(0, burnIn | 0) }),
        [rule, taker, ticks, rate, burnIn],
    );
    const N = rule.constants.N;
    // 見る ID：最初は割合（目標、なければ最後の割合）が違う ID を、大・中・小から 1 つずつ
    const [pickedRaw, setPicked] = useState<number[] | null>(null);
    const defaultPicks = useMemo(() => {
        const base = result.target ?? result.final;
        const byValue = new Map<number, number>();
        // 期待個数が 1 個未満の ID は 0 に山が立つだけなので、できるだけ避ける
        const minP = [...base.slice(1)].some((v) => v * result.cells >= 1) ? 1 / result.cells : Number.MIN_VALUE;
        for (let k = 1; k <= N; k++) if (base[k] >= minP && !byValue.has(base[k])) byValue.set(base[k], k);
        const ids = [...byValue.entries()].sort((a, b) => b[0] - a[0]).map(([, k]) => k);
        if (ids.length <= 3) return ids.sort((a, b) => a - b);
        return [ids[0], ids[Math.floor((ids.length - 1) / 2)], ids[ids.length - 1]].sort((a, b) => a - b);
    }, [result.target, result.final, result.cells, N]);
    const picked = (pickedRaw ?? defaultPicks).filter((k) => k >= 1 && k <= N);
    const toggle = (k: number) => {
        if (picked.includes(k)) setPicked(picked.filter((x) => x !== k));
        else if (picked.length < MAX_PICKS) setPicked([...picked, k].sort((a, b) => a - b));
    };

    return (
        <>
            <fieldset className="box">
                <legend>補充シミュレーション</legend>
                <div className="row" style={{ marginTop: 0, gap: 16 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>取り方
                        <span role="group" aria-label="取り方" style={{ display: "flex" }}>
                            <button className={`btn small ${taker === "greedy" ? "active" : ""}`} aria-pressed={taker === "greedy"} onClick={() => setTaker("greedy")}>貪欲</button>
                            <button className={`btn small ${taker === "random" ? "active" : ""}`} aria-pressed={taker === "random"} onClick={() => setTaker("random")}>ランダム</button>
                        </span>
                    </span>
                    <label>長さ（tick） <input type="number" min={1} style={{ width: 72 }} value={ticks} onChange={(e) => setTicks(Number(e.target.value))} /></label>
                    <label>頻度（回/tick） <input type="number" min={0} max={1} step={0.05} style={{ width: 64 }} value={rate} onChange={(e) => setRate(Number(e.target.value))} /></label>
                    <label>集計しない最初の tick <input type="number" min={0} style={{ width: 72 }} value={burnIn} onChange={(e) => setBurnIn(Number(e.target.value))} /></label>
                </div>
            </fieldset>
            <fieldset className="box">
                <legend>個数の分布（2項分布との比較）</legend>
                <CountDistribution result={result} picked={picked} onToggle={toggle} N={N} />
            </fieldset>
            <fieldset className="box">
                <legend>最後の分布と目標</legend>
                <DistributionCompare final={result.final} target={result.target} cells={result.cells} picked={picked} onToggle={toggle} />
            </fieldset>
            {result.target && (
                <fieldset className="box">
                    <legend>目標とのズレ（L1）の推移</legend>
                    <L1Chart series={result.l1Series} chance={result.l1Chance!} ticks={ticks} />
                </fieldset>
            )}
            <fieldset className="box">
                <legend>集計</legend>
                <table className="grid">
                    <tbody>
                        <tr><th scope="row">目標とのズレ（L1）</th><td className="num">{result.l1 === null ? "—（目標分布なし）" : result.l1.toFixed(3)}</td></tr>
                        <tr><th scope="row">偶然でも出る L1 の目安</th><td className="num">{result.l1Chance === null ? "—" : result.l1Chance.toFixed(3)}</td></tr>
                        <tr><th scope="row">偶然の範囲を外れた ID</th><td className="num">{result.target === null ? "—" : `${result.outside.length} / ${result.final.length - 1}`}</td></tr>
                        <tr><th scope="row">取ったIDと同じIDが補充された割合</th><td className="num">{Math.round(result.sameRate * 100)}%</td></tr>
                        <tr><th scope="row">補充回数</th><td className="num">{result.refills}</td></tr>
                    </tbody>
                </table>
            </fieldset>
        </>
    );
}

const MAX_PICKS = 5;
const PICK_COLORS = ["#1F4E9A", "#C2410C", "#2E7D32", "#7B3FA0", "#9A6B00"];

/** 選んだ ID ごとに、理論の 2項分布 B(M, p)（線）と、シミュレーション中の個数のヒストグラム（棒）を重ねる */
function CountDistribution({ result, picked, onToggle, N }: { result: RefillSimResult; picked: number[]; onToggle: (k: number) => void; N: number }) {
    const [addId, setAddId] = useState("");
    const M = result.cells;
    const series = picked.map((k) => ({
        k,
        theory: result.target ? binomialPmf(M, result.target[k]) : null,
        emp: result.samples > 0 ? result.hist[k].map((n) => n / result.samples) : null,
    }));
    // 横軸：どれかの線か棒が見える範囲だけ
    let lo = M, hi = 0, maxY = 0.01;
    for (const s of series) {
        for (let c = 0; c <= M; c++) {
            const t = s.theory?.[c] ?? 0, e = s.emp?.[c] ?? 0;
            if (t > 1e-3 || e > 0) { lo = Math.min(lo, c); hi = Math.max(hi, c); }
            maxY = Math.max(maxY, t, e);
        }
    }
    if (lo > hi) { lo = 0; hi = Math.min(M, 10); }
    lo = Math.max(0, lo - 1); hi = Math.min(M, hi + 1);
    maxY *= 1.1;
    const W = 640, H = 260, left = 44, right = 630, top = 14, bottom = 216;
    const span = hi - lo + 1;
    const cw = (right - left) / span;
    const X = (c: number) => left + (c - lo + 0.5) * cw;
    const Y = (v: number) => bottom - (v / maxY) * (bottom - top);
    const tickEvery = Math.ceil(span / 15);
    const nb = Math.max(series.length, 1);
    const canAdd = picked.length < MAX_PICKS;
    const addNum = Number(addId);
    const addValid = Number.isInteger(addNum) && addNum >= 1 && addNum <= N && !picked.includes(addNum);
    return (
        <>
            <div className="row" style={{ marginTop: 0, flexWrap: "wrap" }}>
                <span>見る ID</span>
                {picked.map((k, i) => (
                    <button key={k} className="btn small" onClick={() => onToggle(k)} title="クリックで外す" style={{ borderColor: PICK_COLORS[i], color: PICK_COLORS[i], fontWeight: 700 }}>ID {k} ✕</button>
                ))}
                <input type="number" min={1} max={N} aria-label="追加する ID" style={{ width: 64 }} value={addId} disabled={!canAdd} onChange={(e) => setAddId(e.target.value)} />
                <button className="btn small" disabled={!canAdd || !addValid} onClick={() => { onToggle(addNum); setAddId(""); }}>＋ 追加</button>
                <span className="muted">（{MAX_PICKS} 個まで）</span>
            </div>
            {picked.length === 0 ? <div className="muted">ID を選んでください</div> : (
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="ID ごとの個数の分布と 2項分布">
                    <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="#4A4A4A" />
                    <line x1={left} y1={top} x2={left} y2={bottom} stroke="#4A4A4A" />
                    <text x={left - 6} y={top + 4} textAnchor="end" fontSize="11" fill="#4A4A4A">{maxY.toFixed(2)}</text>
                    <text x={left - 6} y={bottom + 4} textAnchor="end" fontSize="11" fill="#4A4A4A">0</text>
                    {Array.from({ length: span }, (_, i) => lo + i).filter((c) => (c - lo) % tickEvery === 0 || c === hi).map((c) => (
                        <text key={`x${c}`} x={X(c)} y={bottom + 16} textAnchor="middle" fontSize="10" fill="#1A1A1A">{c}</text>
                    ))}
                    <text x={(left + right) / 2} y={bottom + 34} textAnchor="middle" fontSize="11" fill="#4A4A4A">マップ上の個数（{M} マス中）</text>
                    {series.map((s, i) => s.emp && s.emp.slice(lo, hi + 1).map((v, j) => v > 0 && (
                        <rect key={`b${s.k}-${j}`} x={left + j * cw + (cw * 0.8 * i) / nb + cw * 0.1} y={Y(v)} width={Math.max((cw * 0.8) / nb, 1)} height={bottom - Y(v)} fill={PICK_COLORS[i]} fillOpacity={0.35} />
                    )))}
                    {series.map((s, i) => s.theory && (
                        <polyline key={`l${s.k}`} fill="none" stroke={PICK_COLORS[i]} strokeWidth={2}
                            points={s.theory.slice(lo, hi + 1).map((v, j) => `${X(lo + j).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")} />
                    ))}
                </svg>
            )}
            <div className="legend">
                {result.target ? "線：目標どおりにばらまいたときの 2項分布 B(M, p)　薄い棒：シミュレーション中にその個数だった tick の割合" : "薄い棒：シミュレーション中にその個数だった tick の割合（目標分布がないので 2項分布は出しません）"}
                {`　集計した tick：${result.samples}`}
            </div>
        </>
    );
}

/** ID ごとの最後の割合（棒）と目標（線）、2項分布の ±2σ（帯） */
function DistributionCompare({ final, target, cells, picked, onToggle }: { final: number[]; target: number[] | null; cells: number; picked: number[]; onToggle: (k: number) => void }) {
    const [hover, setHover] = useState("");
    const N = final.length - 1;
    const band = (k: number) => {
        if (target === null) return null;
        const sd = binomialSd(target[k], cells);
        return { lo: Math.max(0, target[k] - 2 * sd), hi: target[k] + 2 * sd };
    };
    const W = 640, H = 240, left = 44, right = 630, top = 14, bottom = 200;
    let maxY = 0.01;
    for (let k = 1; k <= N; k++) maxY = Math.max(maxY, final[k], band(k)?.hi ?? 0);
    maxY *= 1.1;
    const Y = (v: number) => bottom - (v / maxY) * (bottom - top);
    const bw = (right - left) / Math.max(N, 1);
    const tickEvery = Math.ceil(N / 20);
    const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
    return (
        <>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="ID ごとの最後の割合と目標" onMouseLeave={() => setHover("")}>
                <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="#4A4A4A" />
                <line x1={left} y1={top} x2={left} y2={bottom} stroke="#4A4A4A" />
                <text x={left - 6} y={top + 4} textAnchor="end" fontSize="11" fill="#4A4A4A">{pct(maxY)}</text>
                <text x={left - 6} y={bottom + 4} textAnchor="end" fontSize="11" fill="#4A4A4A">0</text>
                {Array.from({ length: N }, (_, i) => {
                    const k = i + 1;
                    const x0 = left + i * bw;
                    const bnd = band(k);
                    const out = bnd !== null && (final[k] < bnd.lo || final[k] > bnd.hi);
                    const label = `ID ${k}：最後 ${pct(final[k])}` + (target && bnd ? `／目標 ${pct(target[k])}（偶然の範囲 ${pct(bnd.lo)}〜${pct(bnd.hi)}）${out ? " 範囲外" : ""}` : "");
                    return (
                        <g key={k} onMouseEnter={() => setHover(label)} onClick={() => onToggle(k)} style={{ cursor: "pointer" }}>
                            <rect x={x0} y={top} width={bw} height={bottom - top} fill={picked.includes(k) ? PICK_COLORS[picked.indexOf(k)] : "transparent"} fillOpacity={0.12} />
                            {bnd && <rect x={x0 + bw * 0.05} y={Y(bnd.hi)} width={bw * 0.9} height={Math.max(Y(bnd.lo) - Y(bnd.hi), 1)} fill="#D6E4F5" />}
                            <rect x={x0 + bw * 0.25} y={Y(final[k])} width={Math.max(bw * 0.5, 1)} height={Math.max(bottom - Y(final[k]), final[k] > 0 ? 1 : 0)} fill={out ? "#C2410C" : "#3B6EB5"} />
                            {target && <line x1={x0 + bw * 0.05} x2={x0 + bw * 0.95} y1={Y(target[k])} y2={Y(target[k])} stroke="#1A1A1A" strokeWidth={2} />}
                            {(i % tickEvery === 0 || k === N) && <text x={x0 + bw / 2} y={bottom + 16} textAnchor="middle" fontSize="10" fill="#1A1A1A">{k}</text>}
                        </g>
                    );
                })}
                <text x={(left + right) / 2} y={bottom + 34} textAnchor="middle" fontSize="11" fill="#4A4A4A">ブロック ID</text>
            </svg>
            <div className="legend">
                {target
                    ? "棒：最後の割合（橙＝偶然の範囲外）　黒線：目標　水色の帯：偶然の範囲（2項分布の ±2σ）　クリックで上のグラフに追加・削除"
                    : "棒：最後の割合（目標分布がないので比較はしません）　クリックで上のグラフに追加・削除"}
            </div>
            <div className="muted" aria-live="polite" style={{ minHeight: "1.5em" }}>{hover}</div>
        </>
    );
}

/** tick ごとの L1 と、偶然でも出る L1 の目安（点線） */
function L1Chart({ series, chance, ticks }: { series: number[]; chance: number; ticks: number }) {
    const W = 640, H = 220, left = 44, right = 620, top = 14, bottom = 180;
    const maxY = Math.max(chance, ...series, 0.01) * 1.1;
    const X = (t: number) => left + (t / Math.max(1, series.length - 1)) * (right - left);
    const Y = (v: number) => bottom - (v / maxY) * (bottom - top);
    // 点が多すぎると重いので、最大 300 点くらいに間引く（最後の点は必ず入れる）
    const step = Math.max(1, Math.floor(series.length / 300));
    const idx: number[] = [];
    for (let i = 0; i < series.length; i += step) idx.push(i);
    if (idx[idx.length - 1] !== series.length - 1) idx.push(series.length - 1);
    const points = idx.map((i) => `${X(i).toFixed(1)},${Y(series[i]).toFixed(1)}`).join(" ");
    return (
        <>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="目標とのズレ（L1）の推移">
                <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="#4A4A4A" />
                <line x1={left} y1={top} x2={left} y2={bottom} stroke="#4A4A4A" />
                <text x={left - 6} y={top + 4} textAnchor="end" fontSize="11" fill="#4A4A4A">{maxY.toFixed(2)}</text>
                <text x={left - 6} y={bottom + 4} textAnchor="end" fontSize="11" fill="#4A4A4A">0</text>
                <text x={left} y={bottom + 16} textAnchor="middle" fontSize="11" fill="#4A4A4A">0</text>
                <text x={right} y={bottom + 16} textAnchor="middle" fontSize="11" fill="#4A4A4A">{ticks}</text>
                <text x={(left + right) / 2} y={bottom + 32} textAnchor="middle" fontSize="11" fill="#4A4A4A">tick</text>
                <line x1={left} x2={right} y1={Y(chance)} y2={Y(chance)} stroke="#3B6EB5" strokeDasharray="5 4" />
                <polyline points={points} fill="none" stroke="#1A1A1A" strokeWidth={2} />
            </svg>
            <div className="legend">黒：L1　青の点線：偶然でも出る L1 の目安（目標どおりの確率でばらまいたときの期待値）</div>
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
