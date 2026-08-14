export type LegacyRow={line:number;date:string;playerA:string;playerB:string;aWins:number;bWins:number;type:string};
export type CsvPreview={rows:LegacyRow[];skipped:LegacyRow[];players:string[];dates:string[];games:number;errors:string[]};

const clean=(value:string)=>value.replace(/\s+/g," ").trim();

export function parseLegacyCsv(text:string):CsvPreview{
 const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);
 const header=lines[0]?.split(",").map(clean)??[];
 const errors:string[]=[];
 if(!header.includes("日期")||!header.includes("比分"))errors.push("无法识别表头，需要包含日期与比分列");
 const parsed:LegacyRow[]=[];
 lines.slice(1).forEach((line,index)=>{const parts=line.split(",").map(clean);const [date,playerA,playerB,score,type]=parts;const match=score?.match(/^(\d+)-(\d+)$/);const lineNo=index+2;if(!/^\d{4}-\d{2}-\d{2}$/.test(date??"")){errors.push(`第 ${lineNo} 行日期异常：${date??"空"}`);return}if(!playerA||!playerB||playerA===playerB){errors.push(`第 ${lineNo} 行玩家异常`);return}if(!match){errors.push(`第 ${lineNo} 行比分异常：${score??"空"}`);return}parsed.push({line:lineNo,date,playerA,playerB,aWins:Number(match[1]),bWins:Number(match[2]),type:type||""})});
 const rows=parsed.filter(row=>row.type==="中八"),skipped=parsed.filter(row=>row.type!=="中八");
 return{rows,skipped,players:[...new Set(rows.flatMap(row=>[row.playerA,row.playerB]))],dates:[...new Set(rows.map(row=>row.date))].sort(),games:rows.reduce((sum,row)=>sum+row.aWins+row.bWins,0),errors};
}
