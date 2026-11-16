import { useContext, useEffect, useState } from "react";
import { AdminContext } from "../context/AdminContext";
import { AdminMapView } from "../components/AdminMapView";

import { DEFAULT_GAME_PARAMS, ruleFileFromValues, valuesFromParams, type BasicRuleValues, type TransitionMode } from "@game/shared";
import styles from './Admin.module.css';

interface LibrarySummary {
  name: string;
  version: number;
  locked: boolean;
  usedBy: string[];
  updatedAt: string;
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; [k: string]: unknown }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

function describeError(r: { [k: string]: unknown }): string {
  const details = Array.isArray(r.details) ? `：${(r.details as string[]).join(' / ')}` : '';
  return `${String(r.message ?? r.error ?? 'エラー')}${details}`;
}

export function Admin() {

  // ルールファイルを作るためのフォームの値（エディタができるまでのつなぎ）
  const [values, setValues] = useState<BasicRuleValues>(valuesFromParams(DEFAULT_GAME_PARAMS));
  const [ruleName, setRuleName] = useState('basic');
  const [library, setLibrary] = useState<LibrarySummary[]>([]);
  const [selected, setSelected] = useState('');
  const [seedOverride, setSeedOverride] = useState('');
  const [experimentName, setExperimentName] = useState('');
  const [message, setMessage] = useState('');
  const ctx = useContext(AdminContext);

  async function refreshLibrary(select?: string) {
    const r = await fetch('/api/rules').then((res) => res.json());
    if (r.ok) {
      setLibrary(r.rules);
      if (select !== undefined) setSelected(select);
    }
  }

  useEffect(() => { refreshLibrary(); }, []);

  if(!ctx) {
    throw new Error('AdminContextが見つかりません');
  }

  function setValue<K extends keyof BasicRuleValues>(key: K, value: BasicRuleValues[K]) {
    setValues({ ...values, [key]: value });
  }

  async function saveRule(rule: unknown) {
    const r = await postJson('/api/rules', { name: ruleName, rule });
    if (!r.ok) {
      setMessage(`保存できませんでした${describeError(r)}`);
      return;
    }
    setMessage(`${r.name} v${r.version} として保存しました`);
    await refreshLibrary(`${r.name}@${r.version}`);
  }

  async function handleInit(){
    if (selected === '') {
      setMessage('ルールを選んでください');
      return;
    }
    const [name, version] = selected.split('@');
    const seed = seedOverride === '' ? undefined : Number(seedOverride);
    const r = await postJson('/api/admin/init', { rule: { name, version: Number(version) }, seed, experimentName });
    setMessage(r.ok ? `${name} v${version}（シード ${r.seed}）で初期化しました` : `初期化できませんでした${describeError(r)}`);
  }

  function numberInput(key: keyof BasicRuleValues, label: string) {
    return (
      <label>{label}: 
        <input
          type="number"
          value={values[key] as number}
          onChange={(e) => setValue(key, e.target.valueAsNumber as never)}
        />
      </label>
    );
  }

  return (
    <div>
      <div>
        <h2>管理者画面</h2>
      </div>
      <div>
        <p>稼働状況: {ctx.running ? 'true' : 'false'}</p>
        <p>プレイヤー数: {ctx.players.length}</p>
        <p>マップの有無: {ctx.map !== null ? 'true' : 'false'}</p>
      </div>
      <div>
        {ctx.map && <AdminMapView nx={ctx.map.nx} ny={ctx.map.ny} data={ctx.map.data} players={ctx.players} /> }
      </div>
      {ctx.distribution && (
        <div>
          <h3>目標分布とのズレ</h3>
          <p>L1：{ctx.distribution.l1.toFixed(3)}</p>
          {ctx.distribution.target.length <= 21 && (
            <table>
              <thead>
                <tr><th>ID</th><th>目標</th><th>今</th></tr>
              </thead>
              <tbody>
                {ctx.distribution.target.slice(1).map((p, i) => (
                  <tr key={i + 1}>
                    <td>{i + 1}</td>
                    <td>{p.toFixed(3)}</td>
                    <td>{ctx.distribution!.current[i + 1].toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <div>
        <table>
          <thead>
            <tr>
              <th>名前</th>
              <th>位置</th>
              <th>方向</th>
              <th>LP</th>
              <th>保持ブロック</th>
              <th>生存時間</th>
              <th>最長生存時間</th>
            </tr>
          </thead>
          <tbody>
            {ctx.players.map((player) => (
              <tr key={player.uid}>
                <td>{player.profile.name}</td>
                <td>({player.pos.x}, {player.pos.y})</td>
                <td>{player.dir}</td>
                <td>{player.lp}</td>
                <td>{player.hold}</td>
                <td>{player.Ltime}</td>
                <td>{player.Ltmax}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3>初期化</h3>
        <label>ルール: 
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">（選んでください）</option>
            {library.map((r) => (
              <option key={`${r.name}@${r.version}`} value={`${r.name}@${r.version}`}>
                {r.name} v{r.version}{r.locked ? '（ロック済み）' : '（下書き）'}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => refreshLibrary()}>一覧を更新</button>
        <div>
          <label>シード（空欄ならルールファイルの値）: 
            <input type="number" value={seedOverride} onChange={(e) => setSeedOverride(e.target.value)} />
          </label>
        </div>
        <div>
          <label>実験名: 
            <input type="text" value={experimentName} onChange={(e) => setExperimentName(e.target.value)} />
          </label>
        </div>
        <button onClick={() => handleInit()}>初期化</button>
        {message && <p>{message}</p>}
      </div>

      <div>
        <h3>ルールファイルを作ってライブラリに保存</h3>
        <label>保存する名前: 
          <input type="text" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
        </label>

        <div className={styles.mapForm}>
          <h4>マップ</h4>
          {numberInput('nx', 'Ｘ方向の長さ')}
          {numberInput('ny', 'Y方向の長さ')}
          {numberInput('N', 'ブロックの種類数 N')}
        </div>

        <div className={styles.playerForm}>
          <h4>プレイヤー</h4>
          {numberInput('lpInitial', 'LP初期値')}
          {numberInput('lpDecreasePerTick', 'LP減少値')}
          {numberInput('viewRange', '視界')}
          {numberInput('seed', 'Seed')}
        </div>

        <div>
          <h4>運用</h4>
          {numberInput('tickIntervalSec', '遷移時間')}
          <label>モード: 
            <select value={values.transition} onChange={(e) => setValue('transition', e.target.value as TransitionMode)}>
              <option value="person">person</option>
              <option value="agent">agent</option>
            </select>
          </label>
        </div>

        <button onClick={() => saveRule(ruleFileFromValues(values))}>この値でルールファイルを作って保存</button>

        <h4>ルールファイル（JSON）を読み込んで保存</h4>
        <input
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                saveRule(JSON.parse(String(reader.result)));
              } catch {
                setMessage('JSON として読めませんでした');
              }
            };
            reader.readAsText(file);
          }}
        />
      </div>
    </div>

  );
}