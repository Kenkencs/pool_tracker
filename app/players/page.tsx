"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { calculatePlayerStats, type GameRecord } from "../../lib/stats";
import "../dashboard.css";

type Player = { id: string; name: string; avatar_url: string | null; active: boolean };

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
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
        supabase.from("players").select("id,name,avatar_url,active").order("active", { ascending: false }).order("name"),
        supabase.from("games").select("id,session_id,player_a_id,player_b_id,winner_id,loser_id"),
      ]);
      const readError = playerResult.error || gameResult.error;
      if (readError) setError(`读取失败：${readError.message}`);
      setPlayers(playerResult.data ?? []);
      setGames(gameResult.data ?? []);
      setLoading(false);
    })();
  }, []);

  const stats = calculatePlayerStats(players, games);

  return (
    <main>
      <section className="screen">
        <header>
          <div><p className="eyebrow">生涯数据</p><h1>玩家战绩</h1></div>
          <Link className="back" href="/">⌂</Link>
        </header>
        {loading && <div className="card"><p className="helper">正在读取玩家战绩…</p></div>}
        {!loading && !signedIn && (
          <div className="card auth-required">
            <b>登录后才能查看玩家战绩</b>
            <p className="helper">请先回到首页登录。</p>
            <Link className="primary" href="/">返回首页登录</Link>
          </div>
        )}
        {error && <p className="notice">{error}</p>}
        {!loading && signedIn && !error && (
          <>
            <p className="helper">点击玩家，查看对每位对手的历史比分和逐局记录。</p>
            <div className="player-list">
              {players.map((player) => {
                const stat = stats.find((item) => item.playerId === player.id)!;
                return (
                  <Link className="player-card" href={`/players/${player.id}`} key={player.id}>
                    <div
                      className={`avatar ${player.avatar_url ? "has-photo" : ""}`}
                      style={player.avatar_url ? { backgroundImage: `url(${player.avatar_url})` } : undefined}
                    >{player.avatar_url ? "" : player.name.slice(0, 1)}</div>
                    <div>
                      <b>{player.name}</b>
                      <small>{stat.games} 局 · {stat.wins} 胜 · {stat.losses} 负{player.active ? "" : " · 已停用"}</small>
                    </div>
                    <strong>{stat.games ? `${(stat.winRate * 100).toFixed(1)}%` : "—"}</strong>
                    <span>›</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
