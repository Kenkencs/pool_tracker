"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { calculateMvp, calculatePlayerStats, type GameRecord } from "../../lib/stats";
import "../dashboard.css";

type Player = { id: string; name: string };
type Session = { id: string; name: string; date: string };

export default function Calendar() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [allGames, setAllGames] = useState<GameRecord[]>([]);
  const [day, setDay] = useState("");
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
      const [playerResult, sessionResult, gameResult] = await Promise.all([
        supabase.from("players").select("id,name").eq("active", true),
        supabase.from("sessions").select("id,name,date").order("date", { ascending: false }),
        supabase.from("games").select("id,session_id,player_a_id,player_b_id,winner_id,loser_id"),
      ]);
      const readError = playerResult.error || sessionResult.error || gameResult.error;
      if (readError) setError(`读取失败：${readError.message}`);
      setPlayers(playerResult.data ?? []);
      setAllSessions(sessionResult.data ?? []);
      setAllGames(gameResult.data ?? []);
      const sessionsWithGames = new Set((gameResult.data ?? []).map((game) => game.session_id));
      const latestPlayedSession = (sessionResult.data ?? []).find((session) => sessionsWithGames.has(session.id));
      setDay(latestPlayedSession?.date ?? sessionResult.data?.[0]?.date ?? "");
      setLoading(false);
    })();
  }, []);

  const dates = [...new Set(allSessions.map((session) => session.date))];
  const sessions = allSessions.filter((session) => session.date === day);
  const games = allGames.filter((game) => sessions.some((session) => session.id === game.session_id));
  const mvp = calculateMvp(players, games);
  const stats = calculatePlayerStats(players, games)
    .filter((item) => item.games > 0)
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games);
  const name = (id: string) => players.find((player) => player.id === id)?.name ?? "已停用玩家";

  return (
    <main>
      <section className="screen">
        <header>
          <div><p className="eyebrow">按活动日期统计</p><h1>团建日历</h1></div>
          <a className="back" href="/">⌂</a>
        </header>
        {loading && <div className="card"><p className="helper">正在读取团建日历…</p></div>}
        {!loading && !signedIn && (
          <div className="card auth-required">
            <b>登录后才能查看团建日历</b>
            <p className="helper">数据受 Supabase 权限保护。</p>
            <a className="primary" href="/">返回首页登录</a>
          </div>
        )}
        {error && <p className="notice">{error}</p>}
        {!loading && signedIn && !error && (
          <>
            <div className="tabs date-tabs">
              {dates.length ? dates.map((date) => (
                <button className={day === date ? "selected" : ""} onClick={() => setDay(date)} key={date}>
                  {date.slice(5).replace("-", "/")}
                </button>
              )) : <span className="helper">尚无活动日期</span>}
            </div>
            {day && (
              <>
                <h2>{day} · {games.length} 局</h2>
                {sessions.map((session) => (
                  <article className="session" key={session.id}>
                    <span>🎱</span>
                    <div><b>{session.name}</b><p>{allGames.filter((game) => game.session_id === session.id).length} 局</p></div>
                  </article>
                ))}
                <div className="hero calendar-mvp">
                  <p>当天 MVP</p>
                  <div className="mvp">
                    <span>🏆</span>
                    <div>
                      <b>{mvp.length ? mvp.map((item) => name(item.playerId)).join("、") : "尚未达到门槛"}</b>
                      <small>至少 6 局；并列玩家共同获得 MVP</small>
                    </div>
                  </div>
                </div>
                <h2>当天玩家表现</h2>
                {stats.map((item) => (
                  <Link className="rank rank-link" href={`/players/${item.playerId}`} key={item.playerId}>
                    <div className="avatar">{name(item.playerId).slice(0, 1)}</div>
                    <b>{name(item.playerId)}<small>{item.games} 局 · {item.wins} 胜 · {item.losses} 负</small></b>
                    <strong>{(item.winRate * 100).toFixed(1)}%</strong>
                  </Link>
                ))}
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
