import { useState } from "react";
import type { LibrarySummary } from "../api";

interface Props {
    library: LibrarySummary[];
    loading: boolean;
    onBack: () => void;
    onNew: () => void;
    onRefresh: () => void;
    onOpen: (name: string, version: number) => void;
    onDuplicate: (name: string, version: number) => void;
    onDelete: (name: string, version: number) => void;
}

/** ライブラリ：一覧と、選んだ版の詳細 */
export function Library({ library, loading, onBack, onNew, onRefresh, onOpen, onDuplicate, onDelete }: Props) {
    const [query, setQuery] = useState("");
    const [showLocked, setShowLocked] = useState(true);
    const [selected, setSelected] = useState<string | null>(null);
    const rows = library.filter((r) => r.name.includes(query) && (showLocked || !r.locked));
    const cur = library.find((r) => `${r.name}@${r.version}` === selected) ?? null;

    return (
        <>
            <div className="toolbar" role="toolbar" aria-label="ツールバー" style={{ alignItems: "center" }}>
                <button className="btn" onClick={onBack}>← エディタに戻る</button>
                <button className="btn" onClick={onNew}>新規作成</button>
                <button className="btn" onClick={onRefresh}>一覧を更新</button>
                <label style={{ marginLeft: 8 }}>検索 <input type="text" style={{ width: 200 }} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} />ロック済みも表示</label>
            </div>
            <div className="body">
                <main className="panel" style={{ flex: "999 1 640px" }}>
                    <div className="panel-head">ライブラリ</div>
                    <div className="panel-body" style={{ overflowX: "auto" }}>
                        {loading && <div className="muted">読み込み中…</div>}
                        {!loading && rows.length === 0 && <div className="muted">ルールファイルがありません</div>}
                        {rows.length > 0 && (
                            <table className="grid full">
                                <thead><tr><th>名前</th><th>版</th><th>状態</th><th>更新日</th><th className="num">使用した実験</th></tr></thead>
                                <tbody>
                                    {rows.map((r) => {
                                        const key = `${r.name}@${r.version}`;
                                        return (
                                            <tr key={key} style={{ background: key === selected ? "#CDE0F7" : undefined, cursor: "pointer" }} onClick={() => setSelected(key)}>
                                                <td><button className="nav-item" style={{ padding: 0, fontWeight: 700 }} onClick={() => setSelected(key)} onDoubleClick={() => onOpen(r.name, r.version)}>{r.name}</button></td>
                                                <td>v{r.version}</td>
                                                <td>{r.locked ? <b>ロック済み</b> : "下書き"}</td>
                                                <td>{r.updatedAt.slice(0, 10)}</td>
                                                <td className="num">{r.usedBy.length}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </main>
                <aside className="panel" style={{ flex: "1 1 380px" }} aria-label="詳細">
                    <div className="panel-head">{cur ? `${cur.name} v${cur.version}` : "詳細"}</div>
                    <div className="panel-body">
                        {cur === null ? <div className="muted">一覧から選んでください</div> : (
                            <>
                                <table className="grid">
                                    <tbody>
                                        <tr><th scope="row">状態</th><td>{cur.locked ? "ロック済み" : "下書き"}</td></tr>
                                        <tr><th scope="row">作成</th><td>{cur.createdAt.replace("T", " ").slice(0, 16)}</td></tr>
                                        <tr><th scope="row">更新</th><td>{cur.updatedAt.replace("T", " ").slice(0, 16)}</td></tr>
                                    </tbody>
                                </table>
                                <fieldset className="box">
                                    <legend>使用した実験</legend>
                                    {cur.usedBy.length === 0 ? <div className="muted">なし</div> : <ul style={{ margin: 0, paddingLeft: 18 }}>{cur.usedBy.map((e) => <li key={e}>{e}</li>)}</ul>}
                                </fieldset>
                                <div className="row" style={{ marginTop: 0 }}>
                                    <button className="btn primary" onClick={() => onOpen(cur.name, cur.version)}>開く</button>
                                    <button className="btn" onClick={() => onDuplicate(cur.name, cur.version)}>複製</button>
                                    <button className="btn" disabled={cur.locked} onClick={() => onDelete(cur.name, cur.version)}>削除</button>
                                </div>
                            </>
                        )}
                    </div>
                </aside>
            </div>
        </>
    );
}
