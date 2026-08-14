import test from "node:test";
import assert from "node:assert/strict";
import { determineGameResult, calculateSettlement } from "../lib/game-rules.ts";
test("正常抢8由进8者获胜",()=>assert.equal(determineGameResult({playerAId:"A",playerBId:"B",playerABalls:8,playerBBalls:4,finishType:"normal"}).winnerId,"A"));
test("黑八犯规优先",()=>assert.equal(determineGameResult({playerAId:"A",playerBId:"B",playerABalls:6,playerBBalls:5,finishType:"early_black",foulPlayerId:"A"}).winnerId,"B"));
test("违规黑八离台",()=>assert.equal(determineGameResult({playerAId:"A",playerBId:"B",playerABalls:2,playerBBalls:0,finishType:"early_black",foulPlayerId:"B"}).tableBallsRemaining,12));
test("结算合并",()=>assert.equal(calculateSettlement([{playerId:"A",cents:200},{playerId:"B",cents:-100},{playerId:"C",cents:-100}]).length,2));
