"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import "../dashboard.css";

type Player = { id: string; name: string };
type Session = { id: string; name: string; date: string };
type PaymentRow = { key: number; payerId: string; amount: string };

const toCents = (value: string) => Math.round(Number(value || 0) * 100);
const money = (cents: number) => `HK$${(cents / 100).toFixed(2)}`;

export default function Expenses() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [gameCounts, setGameCounts] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [nextPaymentKey, setNextPaymentKey] = useState(2);
  const [payments, setPayments] = useState<PaymentRow[]>([
    { key: 1, payerId: "", amount: "" },
  ]);
  const [form, setForm] = useState({
    session: "",
    category: "pool",
    amount: "",
    description: "",
    people: [] as string[],
  });

  const load = async () => {
    if (!supabase) return;
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setMessage("请先返回首页登录，再记录费用。");
      return;
    }
    const [playerResult, sessionResult, gameResult] = await Promise.all([
      supabase.from("players").select("id,name").eq("active", true).order("name"),
      supabase.from("sessions").select("id,name,date").order("date", { ascending: false }),
      supabase.from("games").select("session_id"),
    ]);
    const readError = playerResult.error || sessionResult.error || gameResult.error;
    if (readError) {
      setMessage(`无法读取记账数据：${readError.message}`);
      return;
    }
    const loadedPlayers = playerResult.data ?? [];
    const loadedSessions = sessionResult.data ?? [];
    const counts: Record<string, number> = {};
    for (const game of gameResult.data ?? []) {
      counts[game.session_id] = (counts[game.session_id] ?? 0) + 1;
    }
    setPlayers(loadedPlayers);
    setSessions(loadedSessions);
    setGameCounts(counts);
    setForm((current) => ({
      ...current,
      session: current.session || loadedSessions[0]?.id || "",
      people: current.people.length ? current.people : loadedPlayers.map((player) => player.id),
    }));
    setPayments((current) => current.map((row, index) => ({
      ...row,
      payerId: row.payerId || loadedPlayers[index]?.id || loadedPlayers[0]?.id || "",
    })));
  };

  useEffect(() => {
    load();
  }, []);

  const amountCents = toCents(form.amount);
  const paymentCents = useMemo(
    () => payments.reduce((sum, payment) => sum + toCents(payment.amount), 0),
    [payments],
  );
  const selectedGameCount = gameCounts[form.session] ?? 0;

  const addPayment = () => {
    const used = new Set(payments.map((payment) => payment.payerId));
    const available = players.find((player) => !used.has(player.id)) ?? players[0];
    setPayments((current) => [
      ...current,
      { key: nextPaymentKey, payerId: available?.id ?? "", amount: "" },
    ]);
    setNextPaymentKey((key) => key + 1);
  };

  const updatePayment = (key: number, patch: Partial<PaymentRow>) => {
    setPayments((current) => current.map((payment) =>
      payment.key === key ? { ...payment, ...patch } : payment,
    ));
  };

  const removePayment = (key: number) => {
    setPayments((current) => current.filter((payment) => payment.key !== key));
  };

  const togglePerson = (id: string) => {
    setForm((current) => ({
      ...current,
      people: current.people.includes(id)
        ? current.people.filter((personId) => personId !== id)
        : [...current.people, id],
    }));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || busy) return;
    setMessage("");

    const paymentRows = payments
      .map((payment) => ({ payer_id: payment.payerId, amount_cents: toCents(payment.amount) }))
      .filter((payment) => payment.amount_cents > 0);
    const payerIds = paymentRows.map((payment) => payment.payer_id);

    if (!form.session || amountCents <= 0 || !paymentRows.length) {
      setMessage("请完整填写活动、费用金额和至少一位付款人。");
      return;
    }
    if (new Set(payerIds).size !== payerIds.length) {
      setMessage("同一位付款人不要重复添加，请合并成一个金额。");
      return;
    }
    if (paymentCents !== amountCents) {
      setMessage(`付款合计 ${money(paymentCents)}，必须等于费用金额 ${money(amountCents)}。`);
      return;
    }
    if (form.category === "pool" && selectedGameCount === 0) {
      setMessage("这个活动还没有对局，暂时无法按出场次数分摊台球费。");
      return;
    }
    if (form.category !== "pool" && !form.people.length) {
      setMessage("普通费用至少要选择一位承担人。");
      return;
    }

    setBusy(true);
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        session_id: form.session,
        category: form.category,
        description: form.description || null,
        amount_cents: amountCents,
        currency: "HKD",
      })
      .select("id")
      .single();

    if (expenseError || !expense) {
      setMessage(`无法保存费用：${expenseError?.message ?? "未知错误"}`);
      setBusy(false);
      return;
    }

    const participantRows = form.category === "pool"
      ? []
      : form.people.map((player_id) => ({ expense_id: expense.id, player_id }));
    const databasePayments = paymentRows.map((payment) => ({
      expense_id: expense.id,
      ...payment,
    }));
    const [participantResult, paymentResult] = await Promise.all([
      participantRows.length
        ? supabase.from("expense_participants").insert(participantRows)
        : Promise.resolve({ error: null }),
      supabase.from("expense_payments").insert(databasePayments),
    ]);

    const detailError = participantResult.error || paymentResult.error;
    if (detailError) {
      await supabase.from("expenses").delete().eq("id", expense.id);
      setMessage(`费用未保存：${detailError.message}`);
      setBusy(false);
      return;
    }

    setMessage(`✓ 费用已保存：${paymentRows.length} 位付款人合计 ${money(paymentCents)}`);
    setForm((current) => ({ ...current, amount: "", description: "" }));
    setPayments((current) => current.map((payment) => ({ ...payment, amount: "" })));
    setBusy(false);
  };

  return (
    <main>
      <section className="screen">
        <header>
          <div><p className="eyebrow">真实数据</p><h1>记一笔账</h1></div>
          <a className="back" href="/">⌂</a>
        </header>
        {message && <p className="notice">{message}</p>}
        <form className="form-card" onSubmit={save}>
          <label>
            团建活动
            <select value={form.session} onChange={(event) => setForm({ ...form, session: event.target.value })}>
              <option value="">请选择</option>
              {sessions.map((session) => (
                <option value={session.id} key={session.id}>
                  {session.date} · {session.name} · {gameCounts[session.id] ?? 0} 局
                </option>
              ))}
            </select>
          </label>
          <label>
            费用类型
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="pool">台球费（按对局参与次数）</option>
              <option value="meal">吃饭</option>
              <option value="delivery">外卖</option>
              <option value="transport">交通</option>
              <option value="drinks">饮料</option>
              <option value="other">其他</option>
            </select>
          </label>
          <label>
            费用总额（HK$）
            <input type="number" step="0.01" min="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </label>

          <div className="payment-heading">
            <div>
              <p className="eyebrow">实际付款</p>
              <small>可以由多人共同垫付</small>
            </div>
            <button type="button" className="add-payment" onClick={addPayment}>＋ 添加付款人</button>
          </div>
          <div className="payment-list">
            {payments.map((payment) => (
              <div className="payment-row" key={payment.key}>
                <select aria-label="付款人" value={payment.payerId} onChange={(event) => updatePayment(payment.key, { payerId: event.target.value })}>
                  {players.map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}
                </select>
                <input aria-label="付款金额" type="number" step="0.01" min="0" placeholder="0.00" value={payment.amount} onChange={(event) => updatePayment(payment.key, { amount: event.target.value })} />
                <button type="button" aria-label="删除付款人" disabled={payments.length === 1} onClick={() => removePayment(payment.key)}>−</button>
              </div>
            ))}
          </div>
          <p className={`payment-total ${amountCents > 0 && paymentCents === amountCents ? "balanced" : ""}`}>
            付款合计 {money(paymentCents)} / 费用总额 {money(amountCents)}
          </p>

          <label>
            备注（可选）
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>

          {form.category === "pool" ? (
            <div className="card allocation-note">
              <b>自动按出场次数分摊</b>
              <p className="helper">所选活动共 {selectedGameCount} 局；每一分钱都会完整分配，不会产生尾差。</p>
            </div>
          ) : (
            <>
              <p className="eyebrow">承担人（平均分摊）</p>
              {players.map((player) => (
                <label className="check" key={player.id}>
                  <input type="checkbox" checked={form.people.includes(player.id)} onChange={() => togglePerson(player.id)} />
                  {player.name}
                </label>
              ))}
            </>
          )}
          <button className="primary" disabled={busy}>{busy ? "正在保存…" : "保存费用"}</button>
        </form>
      </section>
    </main>
  );
}
