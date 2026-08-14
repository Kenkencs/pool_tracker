import test from "node:test";import assert from "node:assert/strict";import {parseLegacyCsv} from "../lib/csv-import.ts";
test("旧比分拆成独立对局并跳过非中八",()=>{const p=parseLegacyCsv("日期,胜方,败方,比分,种类\n2026-08-13,甲,乙,3-1,中八\n2026-08-14,甲,乙,2-0,斯诺克");assert.equal(p.rows.length,1);assert.equal(p.games,4);assert.equal(p.skipped.length,1);assert.deepEqual(p.players,["甲","乙"])});
test("可疑日期不会静默导入",()=>{const p=parseLegacyCsv("日期,胜方,败方,比分,种类\n1-Jan,甲,乙,1-0,中八");assert.equal(p.rows.length,0);assert.match(p.errors[0],/日期异常/)});
