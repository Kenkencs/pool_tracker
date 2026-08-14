export type FinishType = "normal" | "early_black" | "wrong_pocket" | "scratch_on_black" | "other_black_foul" | "legacy_unknown";

export type GameInput = {
  playerAId: string; playerBId: string; playerABalls: number | null; playerBBalls: number | null;
  finishType: FinishType; foulPlayerId?: string | null;
};

export function determineGameResult(game: GameInput) {
  if (game.playerAId === game.playerBId) throw new Error("两位玩家不能相同");
  const a = game.playerABalls ?? 0, b = game.playerBBalls ?? 0;
  if (a < 0 || b < 0 || a > 8 || b > 8) throw new Error("进球数必须在 0 至 8 之间");
  const hasFoul = game.finishType !== "normal" && game.finishType !== "legacy_unknown";
  if (hasFoul) {
    if (!game.foulPlayerId || ![game.playerAId, game.playerBId].includes(game.foulPlayerId)) throw new Error("请选择发生黑八犯规的玩家");
    const loserId = game.foulPlayerId;
    return { winnerId: loserId === game.playerAId ? game.playerBId : game.playerAId, loserId, tableBallsRemaining: 14 - a - b };
  }
  if (game.finishType === "legacy_unknown") throw new Error("历史未知对局需要导入时指定胜者");
  if ((a === 8) === (b === 8)) throw new Error("正常抢8结束时必须且只能有一人进 8 球");
  return a === 8
    ? { winnerId: game.playerAId, loserId: game.playerBId, tableBallsRemaining: 15 - a - b }
    : { winnerId: game.playerBId, loserId: game.playerAId, tableBallsRemaining: 15 - a - b };
}

export type Balance = { playerId: string; cents: number };
export function calculateSettlement(balances: Balance[]) {
  const debtors = balances.filter(x => x.cents < 0).map(x => ({ ...x, cents: -x.cents }));
  const creditors = balances.filter(x => x.cents > 0).map(x => ({ ...x }));
  const transfers: { from: string; to: string; cents: number }[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const cents = Math.min(debtors[i].cents, creditors[j].cents);
    transfers.push({ from: debtors[i].playerId, to: creditors[j].playerId, cents });
    debtors[i].cents -= cents; creditors[j].cents -= cents;
    if (!debtors[i].cents) i++; if (!creditors[j].cents) j++;
  }
  return transfers;
}
