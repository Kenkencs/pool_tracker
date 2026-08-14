"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { calculatePlayerStats, type GameRecord } from "../../lib/stats";
import "../dashboard.css";

type Player = { id: string; name: string };

export default function Ranking() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [mode, setMode] = useState<"rate" | "games">("rate");
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setError("尚未配置 Supabase");
        setLoading(false);
        return;
      }
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        setSignedIn(false);
        setLoading(false);
        return;
      }
      const [playerResult, gameResult] = await Promise.all([
        supabase.from("players").select("id,name").eq("active", true),
        supabase.from("games").select("id,session_id,player_a_id,player_b_id,winner_id,loser_id"),
      ]);
      const readError = playerResult.error || gameResult.error;
      if (readError) setError(`读取失败：${readError.message}`);
      setPlayers(playerResult.data ?? []);
      setGames(gameResult.data ?? []);
      setLoading(false);
    })();
  }, []);

  const stats = calculatePlayerStats(players, games)
    .filter((item) => mode === "games" || item.games >= 6)
    .sort((a, b) => mode === "games" ? b.games - a.games : b.winRate - a.winRate || b.games - a.games);
  const name = (id: string) => players.find((player) => player.id === id)?.name ?? "已停用玩家";

  return (
    <main>
      <section className="screen">
        <header>
          <div><p className="eyebrow">实时汇总</p><h1>排行榜</h1></div>
          <a className="back" href="/">⌂</a>
        </header>
        {loading && <div className="card"><p className="helper">正在读取排行榜…</p></div>}
        {!loading && !signedIn && (
          <div className="card auth-required">
            <b>登录后才能查看排行榜</b>
            <p className="helper">数据受 Supabase 权限保护。</p>
            <a className="primary" href="/">返回首页登录</a>
          </div>
        )}
        {error && <p className="notice">{error}</p>}
        {!loading && signedIn && !error && (
          <>
            <div className="tabs">
              <button className={mode === "rate" ? "selected" : ""} onClick={() => setMode("rate")}>总胜率（至少 6 局）</button>
              <button className={mode === "games" ? "selected" : ""} onClick={() => setMode("games")}>总局数</button>
            </div>
            {stats.length ? stats.map((item, index) => (
              <Link className="rank rank-link" href={`/players/${item.playerId}`} key={item.playerId}>
                <span>#{index + 1}</span>
                <div className="avatar">{name(item.playerId).slice(0, 1)}</div>
                <b>{name(item.playerId)}<small>{item.games} 局 · {item.wins} 胜 · {item.losses} 负</small></b>
                <strong>{mode === "rate" ? `${(item.winRate * 100).toFixed(1)}%` : `${item.games} 局`}</strong>
              </Link>
            )) : (
              <div className="card"><b>尚无符合条件的数据</b><p className="helper">录入至少 6 局后进入正式胜率榜。</p></div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
