"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import "./dashboard.css";
import {
  calculateMvp,
  calculatePlayerStats,
  type GameRecord,
} from "../lib/stats";

type Player = { id: string; name: string };
type Session = { id: string; name: string; date: string };
type AuthState = "checking" | "signed_out" | "signed_in";

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const load = async () => {
    if (!supabase) {
      setError("尚未配置 Supabase");
      setAuthState("signed_out");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setAuthState("signed_out");
      setPlayers([]);
      setSessions([]);
      setGames([]);
      setLoading(false);
      return;
    }

    setAuthState("signed_in");
    const [playerResult, sessionResult, gameResult] = await Promise.all([
      supabase.from("players").select("id,name").eq("active", true).order("name"),
      supabase.from("sessions").select("id,name,date").order("date", { ascending: false }),
      supabase.from("games").select("id,session_id,player_a_id,player_b_id,winner_id,loser_id"),
    ]);

    const readError = playerResult.error || sessionResult.error || gameResult.error;
    if (readError) setError(`读取失败：${readError.message}`);
    setPlayers(playerResult.data ?? []);
    setSessions(sessionResult.data ?? []);
    setGames(gameResult.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    await supabase.auth.signOut({ scope: "local" });
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (loginError) {
      setError(`登录失败：${loginError.message}`);
      setBusy(false);
      return;
    }
    setPassword("");
    await load();
    setBusy(false);
  };

  if (authState !== "signed_in") {
    return (
      <main>
        <section className="screen" id="login">
          <header>
            <div>
              <p className="eyebrow">真实数据看板</p>
              <h1>🎱 中八团建助手</h1>
            </div>
          </header>
          {authState === "checking" || loading ? (
            <div className="card"><p className="helper">正在检查登录状态…</p></div>
          ) : (
            <form className="form-card login-card" onSubmit={login}>
              <h2>登录后查看榜单和日历</h2>
              <p className="helper">比赛数据受保护，请使用管理员账号登录。</p>
              <label>
                邮箱
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                密码
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "正在登录…" : "登录并查看全部数据"}
              </button>
              {error && <p className="notice">{error}</p>}
            </form>
          )}
        </section>
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter((session) => session.date === today);
  const todayGames = games.filter((game) =>
    todaySessions.some((session) => session.id === game.session_id),
  );
  const mvp = calculateMvp(players, todayGames);
  const stats = calculatePlayerStats(players, games).sort(
    (a, b) => b.winRate - a.winRate || b.games - a.games,
  );
  const name = (id: string) =>
    players.find((player) => player.id === id)?.name ?? "已停用玩家";

  return (
    <main>
      <section className="screen">
        <header>
          <div>
            <p className="eyebrow">真实数据看板</p>
            <h1>🎱 中八团建助手</h1>
          </div>
          <a className="avatar" href="/setup" aria-label="进入数据管理">＋</a>
        </header>

        {error && <p className="notice">{error}</p>}
        {loading ? (
          <p className="helper">正在读取数据…</p>
        ) : (
          <>
            <div className="hero">
              <p>今日 MVP</p>
              {mvp.length ? (
                <div className="mvp">
                  <span>🏆</span>
                  <div>
                    <b>{mvp.map((item) => name(item.playerId)).join("、")}</b>
                    <small>
                      {mvp[0].wins} 胜 / {mvp[0].games} 局 · 胜率{" "}
                      {(mvp[0].winRate * 100).toFixed(1)}%
                    </small>
                  </div>
                </div>
              ) : (
                <div className="mvp">
                  <span>🎱</span>
                  <div>
                    <b>尚无今日 MVP</b>
                    <small>至少完成 6 局后自动评选</small>
                  </div>
                </div>
              )}
            </div>

            <div className="metrics">
              <div><strong>{todayGames.length}</strong><span>今日对局</span></div>
              <div><strong>{players.length}</strong><span>活跃玩家</span></div>
              <div><strong>{sessions.length}</strong><span>团建活动</span></div>
            </div>

            <div className="quick quick-pages">
              <a href="/calendar">▦<span>团建日历</span></a>
              <a href="/ranking">🏆<span>完整榜单</span></a>
              <a href="/setup">＋<span>记一局</span></a>
              <a href="/expenses">￥<span>记一笔账</span></a>
            </div>

            <div className="section-heading">
              <h2>最近团建</h2>
              <a href="/calendar">查看日历 ›</a>
            </div>
            {sessions.length ? (
              sessions.slice(0, 3).map((session) => (
                <article className="session" key={session.id}>
                  <span>🎱</span>
                  <div>
                    <b>{session.name}</b>
                    <p>{session.date} · {games.filter((game) => game.session_id === session.id).length} 局</p>
                  </div>
                  <a href="/calendar">查看 ›</a>
                </article>
              ))
            ) : (
              <div className="card">
                <b>还没有团建活动</b>
                <p className="helper">先新建一场活动，再记录第一局。</p>
                <a className="primary" href="/setup">新建活动</a>
              </div>
            )}

            <div className="section-heading">
              <h2>总胜率榜</h2>
              <a href="/ranking">完整榜单 ›</a>
            </div>
            {stats.filter((item) => item.games >= 6).slice(0, 3).map((item, index) => (
              <Link className="rank rank-link" href={`/players/${item.playerId}`} key={item.playerId}>
                <span>#{index + 1}</span>
                <div className="avatar">{name(item.playerId).slice(0, 1)}</div>
                <b>{name(item.playerId)}<small>{item.games} 局 · {item.wins} 胜</small></b>
                <strong>{(item.winRate * 100).toFixed(1)}%</strong>
              </Link>
            ))}
          </>
        )}
      </section>
      <nav>
        <a className="active" href="/">⌂<small>首页</small></a>
        <a href="/calendar">▦<small>日历</small></a>
        <a href="/ranking">🏆<small>榜单</small></a>
        <a href="/expenses">￥<small>记账</small></a>
        <a href="/settlement">♜<small>结算</small></a>
      </nav>
    </main>
  );
}
