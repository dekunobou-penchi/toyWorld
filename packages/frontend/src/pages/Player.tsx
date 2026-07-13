import { act, use, useContext, useEffect, useState } from "react";
import { GameContext } from "../context/GameContext";
import { Action, ACTIONS } from "@game/shared";
import styles from './Player.module.css';
import { MapView } from "../components/MapView";

export function Player() {
  const ctx = useContext(GameContext);
  
  if(!ctx) {
    throw new Error('GameContextが見つかりません');
  }

  const me = ctx.me;
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if(!ctx.running) {
      return;
    }
    const timerId = setInterval(() => {
      // ここで残り時間を減らす処理
      setRemaining((prev) => prev - 0.1);
    }, 100);

    return () => {
      clearInterval(timerId);
    };
  }, [ctx.running]);

  useEffect(() => {
    // remaining を tickIntervalSec にリセット
    
      setRemaining(ctx.params?.tickIntervalSec ?? 0);

  }, [me]);   // me が変わるたびに実行

  // C: resetCount が変わったら（init）0 にリセット
  useEffect(() => {
    setRemaining(0);
  }, [ctx.resetCount]);

  function handleaction(action: Action) {
    const client = ctx?.client;
    if (!client) {
      return;
    }
    client.send({ type: 'action', action});
  }

  if (!me) {
    return (
      <div>
        <h2 className={styles.title}>プレイヤ画面</h2>
        <p>まだ参加していません</p>
      </div>
    );
  }
  return (
    <div>
      <div>
        <h2 className={styles.title}>プレイヤ画面</h2>
      </div>    
      <div className={styles.pageLayout}>
        <div className={styles.leftPanel}>
          <div className={styles.infoBox}>
            <p>ターン残り時間: {remaining.toFixed(1)}秒</p>
            <p>名前: {me.profile.name}</p>
            <p>位置: ({me.pos.x}, {me.pos.y})</p>
            <p>向き: {me.dir}</p>
            <span className={styles.lpValue}>LP: {me.lp}</span>
            <p>保持ブロック: {me.hold}</p>
          </div>
          <h3>アクション</h3>
          <div className={styles.controlsWrapper}>
            <div className={styles.dpad}>
              <div className={styles.dpadRow} >
                <button className={styles.dirButton} onClick={() => handleaction('N')}>▲</button>
              </div>
              <div className={styles.dpadRow}>
                <button className={styles.dirButton} onClick={() => handleaction('W')}>◀︎</button>
                <button className={styles.dirButton} onClick={() => handleaction('E')}>▶︎</button>
              </div>
              <div className={styles.dpadRow}>
                <button className={styles.dirButton} onClick={() => handleaction('S')}>▼</button>
              </div>
            </div>
            <div className={styles.actionRow}>
              {['forward', 'get', 'eat', 'put', 'fusion'].map((action) => (
              <button key={action} className={styles.actionButton} onClick={() => handleaction(action as Action)}>{action}</button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.rightPanel}>
          {ctx.params && <MapView nx={ctx.params?.map.nx} ny={ctx.params?.map.ny} myPos={me.pos} dir={me.dir} view={ctx.view}/>}
        </div>




      </div>

    </div>


  );

}