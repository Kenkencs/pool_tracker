"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  calculateHeadToHead,
  calculatePlayerStats,
  type GameRecord,
} from "../../../lib/stats";
import "../../dashboard.css";

type Player = {
  id: string;
  name: string;
  avatar_url: string | null;
  active: boolean;
};
type Session = { id: string; name: string; date: string };
type DetailedGame = GameRecord & {
  player_a_balls: number | null;
  player_b_balls: number | null;
  finish_type: string;
  black_ball_foul_player_id: string | null;
  created_at: string;
};

const finishLabels: Record<string, string> = {
  normal: "正常抢8",
  early_black: "提前打进黑八判负",
  wrong_pocket: "黑八进错袋判负",
  scratch_on_black: "击打黑八时白球落袋",
  other_black_foul: "其他黑八犯规",
  legacy_unknown: "历史比分",
};

export default function PlayerHistoryPage() {
  const params = useParams<{ id: string }>();
  const playerId = params.id;
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [games, setGames] = useState<DetailedGame[]>([]);
  const [resultFilter, setResultFilter] = useState<"all" | "win" | "loss">("all");
  const [opponentFilter, setOpponentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!supabase || !playerId) {
        setError("无法读取玩家资料。");
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
        supabase.from("players").select("id,name,avatar_url,active").order("name"),
        supabase.from("sessions").select("id,name,date"),
        supabase.from("games").select("id,session_id,player_a_id,player_b_id,player_a_balls,player_b_balls,finish_type,black_ball_foul_player_id,winner_id,loser_id,created_at"),
      ]);
      const readError = playerResult.error || sessionResult.error || gameResult.error;
      if (readError) setError(`读取失败：${readError.message}`);
      setPlayers(playerResult.data ?? []);
      setSessions(sessionResult.data ?? []);
      setGames((gameResult.data ?? []).filter((game) =>
        game.player_a_id === playerId || game.player_b_id === playerId,
      ));
      setLoading(false);
    })();
  }, [playerId]);

  const player = players.find((item) => item.id === playerId);
  const name = (id: string) => players.find((item) => item.id === id)?.name ?? "已停用玩家";
  const session = (id: string) => sessions.find((item) => item.id === id);
  const stats = player ? calculatePlayerStats([player], games)[0] : null;
  const opponents = players
    .filter((item) => item.id !== playerId)
    .map((opponent) => ({
      opponent,
      record: calculateHeadToHead(playerId, opponent.id, games),
    }))
    .filter((item) => item.record.games > 0)
    .sort((a, b) => b.record.games - a.record.games || a.opponent.name.localeCompare(b.opponent.name, "zh-CN"));

  const filteredGames = useMemo(() => games
    .filter((game) => resultFilter === "all" || (resultFilter === "win" ? game.winner_id === playerId : game.loser_id === playerId))
    .filter((game) => !opponentFilter || game.player_a_id === opponentFilter || game.player_b_id === opponentFilter)
    .sort((a, b) => {
      const aSession = sessions.find((item) => item.id === a.session_id);
      const bSession = sessions.find((item) => item.id === b.session_id);
      return (bSession?.date ?? "").localeCompare(aSession?.date ?? "") || b.created_at.localeCompare(a.created_at);
    }), [games, opponentFilter, playerId, resultFilter, sessions]);

  return (
    <main>
      <section className="screen">
        <header>
          <div><p className="eyebrow">个人历史战绩</p><h1>{player?.name ?? "玩家资料"}</h1></div>
          <Link className="back" href="/players">‹</Link>
        </header>

        {loading && <div className="card"><p className="helper">正在读取历史战绩…</p></div>}
        {!loading && !signedIn && (
          <div className="card auth-required">
            <b>登录后才能查看玩家战绩</b>
            <p className="helper">请先回到首页登录。</p>
            <Link className="primary" href="/">返回首页登录</Link>
          </div>
        )}
        {error && <p className="notice">{error}</p>}
        {!loading && signedIn && !error && !player && (
          <div className="card"><b>找不到这位玩家</b><p className="helper">玩家可能已被移除。</p></div>
        )}

        {!loading && signedIn && !error && player && stats && (
          <>
            <div className="hero player-hero">
              <div
                className={`avatar profile-avatar ${player.avatar_url ? "has-photo" : ""}`}
                style={player.avatar_url ? { backgroundImage: `url(${player.avatar_url})` } : undefined}
                aria-label={`${player.name}头像`}
              >
                {player.avatar_url ? "" : player.name.slice(0, 1)}
              </div>
              <div className="player-heading">
                <b>{player.name}</b>
                <small>{player.active ? "活跃玩家" : "已停用 · 历史数据保留"}</small>
              </div>
              <div className="metrics player-metrics">
                <div><strong>{stats.games}</strong><span>总局数</span></div>
                <div><strong>{stats.wins}</strong><span>胜场</span></div>
                <div><strong>{(stats.winRate * 100).toFixed(1)}%</strong><span>胜率</span></div>
              </div>
            </div>

            <h2>对手战绩</h2>
            {opponents.length ? opponents.map(({ opponent, record }) => (
              <article className="matchup" key={opponent.id}>
                <div className="matchup-title">
                  <b>{player.name} vs {opponent.name}</b>
                  <small>共 {record.games} 局</small>
                </div>
                <div className="matchup-score">
                  <span><b>{record.aWins}</b><small>{player.name}胜</small></span>
                  <em>:</em>
                  <span><b>{record.bWins}</b><small>{opponent.name}胜</small></span>
                </div>
                <button type="button" onClick={() => {
                  setOpponentFilter(opponent.id);
                  document.getElementById("game-history")?.scrollIntoView({ behavior: "smooth" });
                }}>查看逐局 ›</button>
              </article>
            )) : <div className="card"><p className="helper">还没有对手战绩。</p></div>}

            <div className="section-heading" id="game-history">
              <h2>逐局记录</h2>
              <span>{filteredGames.length} 局</span>
            </div>
            <div className="tabs">
              <button className={resultFilter === "all" ? "selected" : ""} onClick={() => setResultFilter("all")}>全部</button>
              <button className={resultFilter === "win" ? "selected" : ""} onClick={() => setResultFilter("win")}>胜</button>
              <button className={resultFilter === "loss" ? "selected" : ""} onClick={() => setResultFilter("loss")}>负</button>
            </div>
            <div className="form-card history-filter">
              <label>
                对手
                <select value={opponentFilter} onChange={(event) => setOpponentFilter(event.target.value)}>
                  <option value="">全部对手</option>
                  {opponents.map(({ opponent }) => <option key={opponent.id} value={opponent.id}>{opponent.name}</option>)}
                </select>
              </label>
            </div>

            {filteredGames.slice(0, 30).map((game) => {
              const gameSession = session(game.session_id);
              const isA = game.player_a_id === playerId;
              const opponentId = isA ? game.player_b_id : game.player_a_id;
              const playerBalls = isA ? game.player_a_balls : game.player_b_balls;
              const opponentBalls = isA ? game.player_b_balls : game.player_a_balls;
              const won = game.winner_id === playerId;
              return (
                <article className="game-history" key={game.id}>
                  <div className="game-date">
                    <b>{gameSession?.date ?? "未知日期"}</b>
                    <small>{gameSession?.name ?? "未知活动"}</small>
                  </div>
                  <div className="game-result">
                    <span className={won ? "won" : "lost"}>{won ? "胜" : "负"}</span>
                    <b>{player.name} vs {name(opponentId)}</b>
                    <strong>{playerBalls == null || opponentBalls == null ? "— : —" : `${playerBalls} : ${opponentBalls}`}</strong>
                  </div>
                  <p>
                    {finishLabels[game.finish_type] ?? game.finish_type}
                    {game.black_ball_foul_player_id ? ` · ${name(game.black_ball_foul_player_id)}犯规` : ""}
                  </p>
                </article>
              );
            })}
            {filteredGames.length > 30 && <p className="helper history-limit">当前显示最近 30 局，可用上方条件筛选。</p>}
          </>
        )}
      </section>
    </main>
  );
}
