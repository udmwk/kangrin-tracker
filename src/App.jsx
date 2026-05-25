import { useState, useEffect, useRef } from "react";
import { db } from "./firebase.js";
import { ref, onValue, push, remove, set } from "firebase/database";

const BIRTH = new Date("2026-03-07");
const getDays = () => Math.floor((Date.now() - BIRTH) / 86400000);
const getMonths = () => { const n = new Date(); return (n.getFullYear()-BIRTH.getFullYear())*12+(n.getMonth()-BIRTH.getMonth()); };
const getWeeks = () => Math.floor(getDays()/7);
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2);
const nowISO = () => new Date().toISOString();
// 로컬 날짜 문자열 반환 (YYYY-MM-DD) — UTC 변환 없이 로컬 기준
const localDateStr = (d=new Date()) => {
  const p = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
};
// ISO 문자열에서 로컬 날짜 추출 (UTC 기준이 아닌 로컬 기준)
const isoToLocalDate = iso => { if(!iso) return ""; return localDateStr(new Date(iso)); };
const toInput   = (iso) => { const d=new Date(iso||Date.now()),p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromInput = s => s ? new Date(s).toISOString() : nowISO();
const fmtHHMM   = iso => { if(!iso) return "--:--"; const d=new Date(iso); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const fmtDur    = min => { if(!min||min<=0) return ""; return min>=60?`${Math.floor(min/60)}h ${min%60}m`:`${min}m`; };
const diffMin   = (s,e) => Math.max(0,Math.round((new Date(e)-new Date(s))/60000));
const todayStr  = () => localDateStr(); // 로컬 날짜 기준
const fmtDateKR = iso => { if(!iso) return ""; const d=new Date(iso); return `${d.getMonth()+1}/${d.getDate()}`; };

const P = {
  bg:"#F7F8FC", white:"#FFFFFF", border:"#E8EAF0",
  text:"#1A1D2E", sub:"#6B7080", accent:"#5B6BF8",
  feeding:"#FF6B6B", sleep:"#7C6FF7", diaper:"#4EA8DE",
  playex:"#F7A928", temp:"#26C486", event:"#E05C9B", growth:"#8B5CF6",
};

const RT = {
  feeding:  { icon:"🍼", label:"수유/식사",          color:P.feeding, twoTime:true  },
  sleep:    { icon:"😴", label:"수면",               color:P.sleep,   twoTime:true  },
  diaper:   { icon:"🩲", label:"기저귀/배변",        color:P.diaper,  twoTime:false },
  event:    { icon:"📌", label:"이벤트(활동/건강)",  color:P.event,   twoTime:true  },
  growth:   { icon:"📏", label:"성장 측정",          color:"#8B5CF6", twoTime:false },
};

const MILESTONES = [
  { month:0,  label:"신생아", feeding:{amount:"60~90ml",freq:"8~12회",interval:"2~3시간"}, sleep:{total:"16~18시간",night:"2~4시간"}, whoWeight:{min:2.9,max:4.4},  whoHeight:{min:48,max:54}, whoHead:{min:32,max:36} },
  { month:1,  label:"1개월",  feeding:{amount:"90~120ml",freq:"7~8회",interval:"3시간"},    sleep:{total:"15~17시간",night:"3~4시간"}, whoWeight:{min:3.4,max:5.7},  whoHeight:{min:50,max:58}, whoHead:{min:34,max:38} },
  { month:2,  label:"2개월",  feeding:{amount:"120~150ml",freq:"6~7회",interval:"3~3.5시간"}, sleep:{total:"14~16시간",night:"4~6시간"}, whoWeight:{min:4.3,max:7.1}, whoHeight:{min:54,max:62}, whoHead:{min:36,max:40} },
  { month:3,  label:"3개월",  feeding:{amount:"150~180ml",freq:"5~6회",interval:"3.5~4시간"}, sleep:{total:"14~16시간",night:"5~7시간"}, whoWeight:{min:5.0,max:8.0}, whoHeight:{min:57,max:65}, whoHead:{min:38,max:42} },
  { month:4,  label:"4개월",  feeding:{amount:"150~200ml",freq:"5회",interval:"4시간"},    sleep:{total:"12~16시간",night:"6~8시간"}, whoWeight:{min:5.6,max:8.7},  whoHeight:{min:60,max:68}, whoHead:{min:39,max:43} },
  { month:6,  label:"6개월",  feeding:{amount:"분유180ml+이유식",freq:"4~5회+이유식1회",interval:"4시간"}, sleep:{total:"12~15시간",night:"8~10시간"}, whoWeight:{min:6.4,max:9.8}, whoHeight:{min:64,max:72}, whoHead:{min:41,max:45} },
  { month:9,  label:"9개월",  feeding:{amount:"분유3회+이유식2~3회",freq:"5~6회",interval:"3~4시간"}, sleep:{total:"12~14시간",night:"10~11시간"}, whoWeight:{min:7.2,max:11.0}, whoHeight:{min:68,max:77}, whoHead:{min:43,max:47} },
  { month:12, label:"12개월", feeding:{amount:"우유400ml+유아식3회",freq:"5회",interval:"3~4시간"}, sleep:{total:"11~14시간",night:"10~12시간"}, whoWeight:{min:8.0,max:12.0}, whoHeight:{min:72,max:82}, whoHead:{min:44,max:48} },
  { month:18, label:"18개월", feeding:{amount:"우유400ml+유아식+간식",freq:"5회",interval:"3~4시간"}, sleep:{total:"11~14시간",night:"10~12시간"}, whoWeight:{min:9.2,max:13.7}, whoHeight:{min:78,max:89}, whoHead:{min:46,max:49} },
  { month:24, label:"24개월", feeding:{amount:"우유300ml+3끼+간식",freq:"5회",interval:"4시간"}, sleep:{total:"11~14시간",night:"10~12시간"}, whoWeight:{min:10.0,max:15.3}, whoHeight:{min:82,max:94}, whoHead:{min:47,max:50} },
  { month:36, label:"36개월", feeding:{amount:"우유300ml+3끼+간식",freq:"5회",interval:"4시간"}, sleep:{total:"10~13시간",night:"10~12시간"}, whoWeight:{min:12.0,max:18.3}, whoHeight:{min:90,max:104}, whoHead:{min:48,max:52} },
];
const getCur = () => { const m=getMonths(); return [...MILESTONES].sort((a,b)=>b.month-a.month).find(d=>d.month<=m)||MILESTONES[0]; };

const S = {
  card:  { background:P.white, borderRadius:16, padding:16, marginBottom:12, border:`1px solid ${P.border}`, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" },
  inp:   { width:"100%", background:P.white, border:`1.5px solid ${P.border}`, borderRadius:10, padding:"10px 14px", fontSize:16, fontFamily:"inherit", color:P.text, outline:"none", boxSizing:"border-box" },
  lbl:   { fontSize:12, color:P.sub, marginBottom:5, display:"block", fontWeight:600, letterSpacing:0.3 },
  secT:  { fontSize:11, fontWeight:700, color:P.sub, marginBottom:12, letterSpacing:1, textTransform:"uppercase" },
  chip:  (a,col=P.accent) => ({ padding:"8px 14px", borderRadius:20, border:`1.5px solid ${a?col:P.border}`, background:a?col+"18":P.white, color:a?col:P.sub, fontWeight:a?700:400, cursor:"pointer", fontSize:13, fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }),
  saveBtn: { width:"100%", padding:"14px", background:P.accent, color:"#fff", border:"none", borderRadius:12, fontWeight:700, fontSize:16, cursor:"pointer", fontFamily:"inherit", marginTop:10, WebkitTapHighlightColor:"transparent" },
  statRow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${P.border}` },
};

// ── 24시간 원형 일과표 ─────────────────────────────────────────────
function DailyCircleChart({ records, date, singleCat }) {
  const size = 300;
  const cx = size/2, cy = size/2;
  const outerR = 130, innerR = 76;

  const polar = (r, deg) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: +(cx + r * Math.cos(rad)).toFixed(2), y: +(cy + r * Math.sin(rad)).toFixed(2) };
  };

  const timeToDeg = iso => {
    const d = new Date(iso);
    return ((d.getHours() * 60 + d.getMinutes()) / 1440) * 360;
  };

  const arcPath = (startDeg, endDeg, oR, iR) => {
    let s = startDeg, e = endDeg;
    if (e <= s) e += 360;
    if (e - s > 359) e = s + 359;
    const largeArc = (e - s) > 180 ? 1 : 0;
    const p1 = polar(oR, s), p2 = polar(oR, e);
    const p3 = polar(iR, e), p4 = polar(iR, s);
    return `M${p1.x},${p1.y} A${oR},${oR} 0 ${largeArc} 1 ${p2.x},${p2.y} L${p3.x},${p3.y} A${iR},${iR} 0 ${largeArc} 0 ${p4.x},${p4.y} Z`;
  };

  const dayRecs = records.filter(r => isoToLocalDate(r.start || r.time) === date);

  // 아크: duration > 0인 기록 / 점: duration = 0인 기록 (전체·단일 모두 표시)
  const arcRecs = dayRecs.filter(r => r.duration > 0);
  const dotRecs = dayRecs.filter(r => !r.duration || r.duration === 0);

  const hourTicks = Array.from({length:12},(_,i)=>i*2);
  const singleColor = singleCat ? RT[singleCat]?.color : null;

  // 단일 카테고리일 때: 시간 레이블을 아크 중앙에 표시
  const getArcMidLabel = r => {
    const startDeg = timeToDeg(r.start || r.time);
    const endISO = r.end || r.start || r.time;
    const eDeg0 = timeToDeg(endISO);
    const eDeg = eDeg0 <= startDeg && r.duration > 5 ? eDeg0 + 360 : eDeg0;
    const midDeg = startDeg + (eDeg - startDeg) / 2;
    return { midDeg, label: fmtHHMM(r.start || r.time) };
  };

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{maxWidth:size}}>
        {/* 배경 */}
        <circle cx={cx} cy={cy} r={outerR+4} fill="#F0F2FA"/>
        <circle cx={cx} cy={cy} r={outerR} fill={singleCat ? singleColor+"10" : "#E8EAF5"}/>
        <circle cx={cx} cy={cy} r={innerR} fill={P.white}/>

        {/* 시간 구분선 */}
        {Array.from({length:24},(_,i)=>{
          const deg = i*15;
          const p1 = polar(innerR, deg), p2 = polar(outerR, deg);
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#D8DCF0" strokeWidth={i%6===0?1.5:0.5}/>;
        })}

        {/* 아크 기록 */}
        {arcRecs.map(r => {
          const startDeg = timeToDeg(r.start || r.time);
          const endISO = r.end || r.start || r.time;
          const eDeg0 = timeToDeg(endISO);
          const eDeg = eDeg0 <= startDeg && r.duration > 5 ? eDeg0+360 : eDeg0;
          const minThick = singleCat ? 6 : 4;
          const span = Math.max(minThick, eDeg - startDeg);
          const col = RT[r.recordType]?.color || P.accent;
          const rOff = {feeding:0,sleep:0,diaper:10,playex:5,temp:15,hospital:5};
          const off = singleCat ? 0 : (rOff[r.recordType]||0);
          return (
            <path key={r.id}
              d={arcPath(startDeg, startDeg+span, outerR-off, innerR+off+2)}
              fill={col} opacity={0.88}
            />
          );
        })}

        {/* 단일 카테고리: duration=0 dot 마커 */}
        {dotRecs.map(r => {
          const deg = timeToDeg(r.start || r.time);
          const midR = (outerR + innerR) / 2;
          const p = polar(midR, deg);
          const col = RT[r.recordType]?.color || P.accent;
          return (
            <g key={r.id}>
              <circle cx={p.x} cy={p.y} r={6} fill={col} opacity={0.9}/>
            </g>
          );
        })}

        {/* 단일 카테고리: 시간 레이블 */}
        {singleCat && arcRecs.map(r => {
          const { midDeg, label } = getArcMidLabel(r);
          const labelR = outerR + 18;
          const p = polar(labelR, midDeg);
          return (
            <text key={"lbl"+r.id} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fill={singleColor} fontFamily="inherit" fontWeight="700" opacity={0.9}>
              {label}
            </text>
          );
        })}

        {/* 단일 카테고리: dot에도 시간 레이블 */}
        {singleCat && dotRecs.map(r => {
          const deg = timeToDeg(r.start || r.time);
          const p = polar(outerR+18, deg);
          return (
            <text key={"dlbl"+r.id} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fill={singleColor} fontFamily="inherit" fontWeight="700" opacity={0.9}>
              {fmtHHMM(r.start||r.time)}
            </text>
          );
        })}

        {/* 시간 눈금 레이블 */}
        {hourTicks.map(h => {
          const deg = h * 15;
          const p = polar(outerR+16, deg);
          // 단일 카테고리 모드에서는 시간 레이블과 겹치지 않게 안쪽으로
          const lp = singleCat ? polar(innerR-16, deg) : p;
          return (
            <text key={h} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fill={P.sub} fontFamily="inherit" fontWeight="500">
              {h}
            </text>
          );
        })}

        {/* 중앙 */}
        <text x={cx} y={cy-14} textAnchor="middle" fontSize={10} fill={P.sub} fontFamily="inherit" fontWeight="600" letterSpacing="1">
          {singleCat ? RT[singleCat]?.label : "DAY"}
        </text>
        <text x={cx} y={cy+6} textAnchor="middle" fontSize={singleCat?16:22} fill={singleCat?singleColor:P.accent} fontFamily="inherit" fontWeight="800">
          D+{getDays()}
        </text>
        {singleCat && (
          <text x={cx} y={cy+22} textAnchor="middle" fontSize={10} fill={P.sub} fontFamily="inherit">
            {dayRecs.length}회
          </text>
        )}
        {!singleCat && (
          <text x={cx} y={cy+28} textAnchor="middle" fontSize={10} fill={P.sub} fontFamily="inherit">{date}</text>
        )}
      </svg>

      {/* 범례 */}
      {!singleCat && (
        <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center",marginTop:8}}>
          {Object.entries(RT).filter(([k])=>dayRecs.some(r=>r.recordType===k)).map(([k,v])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:10,height:10,borderRadius:3,background:v.color}}/>
              <span style={{fontSize:11,color:P.sub}}>{v.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* 단일 카테고리: 기록 목록 */}
      {singleCat && dayRecs.length > 0 && (
        <div style={{width:"100%",marginTop:12,borderTop:`1px solid ${P.border}`,paddingTop:10}}>
          <div style={{fontSize:11,color:P.sub,fontWeight:600,marginBottom:8,letterSpacing:0.5}}>시간순 기록</div>
          {(()=>{
            const sorted = [...dayRecs].sort((a,b)=>new Date(a.start||a.time)-new Date(b.start||b.time));
            return sorted.map((r,i)=>{
            const prevR = i>0 ? sorted[i-1] : null;
            const interval = prevR ? diffMin(prevR.start||prevR.time, r.start||r.time) : null;
            return (
              <div key={r.id}>
                {interval !== null && interval > 0 && (
                  <div style={{fontSize:10,color:P.sub,textAlign:"center",padding:"2px 0",letterSpacing:0.3}}>
                    ↕ {fmtDur(interval)} 간격
                  </div>
                )}
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${P.border}`}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:singleColor,flexShrink:0}}/>
                  <span style={{fontSize:12,fontWeight:700,color:singleColor}}>{fmtHHMM(r.start||r.time)}</span>
                  {r.duration>0&&<span style={{fontSize:11,color:P.sub}}>→ {fmtHHMM(r.end)} ({fmtDur(r.duration)})</span>}
                  {r.amount>0&&<span style={{fontSize:11,color:P.sub}}>{r.amount}ml</span>}
                  {r.subKind&&<span style={{fontSize:11,color:P.sub}}>{r.subKind}{r.foodType?" · "+r.foodType:""}</span>}
                  {r.sleepKind&&<span style={{fontSize:11,color:P.sub}}>{r.sleepKind==="night"?"🌙밤잠":"☀️낮잠"}</span>}
                  {r.diaperKind&&<span style={{fontSize:11,color:P.sub}}>{r.diaperKind}</span>}
                  {r.activity&&<span style={{fontSize:11,color:P.sub}}>{r.activity}</span>}
                  {r.value&&<span style={{fontSize:11,color:P.sub}}>{r.value}°C</span>}
                </div>
              </div>
            );
          });
        })()}
        </div>
      )}
    </div>
  );
}


// ── 기록 모달 (추가 + 수정 통합) ──────────────────────────────────

// ── 기록 모달 ─────────────────────────────────────────────────────
function RecordModal({ initType, initTime, editRec, onClose, onSave, onUpdate, onDelete, records, lastNipple }) {
  const isEdit = !!editRec;
  const lastFeeding = [...(records||[])].filter(r=>r.recordType==="feeding")
    .sort((a,b)=>new Date(b.start||b.time)-new Date(a.start||a.time))[0];

  const [rtype,   setRtype]   = useState(editRec?.recordType || initType || "feeding");
  const [startT,  setStartT]  = useState(
    editRec ? toInput(editRec.start||editRec.time) : toInput(initTime||nowISO())
  );
  const [endT, setEndT] = useState(
    editRec ? toInput(editRec.end||editRec.start||editRec.time) : toInput(initTime||nowISO())
  );

  // ── 수유/식사 ────────────────────────────────────────────────────
  const [fSubKind,    setFSubKind]    = useState(editRec?.subKind || "분유");
  const [fAmt,        setFAmt]        = useState(editRec?.amount>0 ? String(editRec.amount) : (lastFeeding?.amount>0 ? String(lastFeeding.amount) : ""));
  const [fFood,       setFFood]       = useState(editRec?.foodType || "");
  const [preMeal,     setPreMeal]     = useState(editRec?.preMeal || []);
  const [duringMeal,  setDuringMeal]  = useState(editRec?.duringMeal || []);
  const [leftover,    setLeftover]    = useState(editRec?.leftover!=null ? String(editRec.leftover) : "");
  const [postMeal,    setPostMeal]    = useState(editRec?.postMeal || []);
  const [burstFail,   setBurstFail]   = useState(editRec?.burstFail || false);
  const [nippleStep,  setNippleStep]  = useState(editRec?.nippleStep  || lastNipple?.step  || "");
  const [nippleShape, setNippleShape] = useState(editRec?.nippleShape || lastNipple?.shape || "");
  const [fNote,       setFNote]       = useState(editRec?.note || "");

  // ── 수면 ─────────────────────────────────────────────────────────
  const [sKind,        setSKind]        = useState(editRec?.sleepKind || "nap");
  const [preSleep,     setPreSleep]     = useState(editRec?.preSleep || []);
  const [sleepMethod,  setSleepMethod]  = useState(editRec?.sleepMethod || []);
  const [careStartAdj, setCareStartAdj] = useState(0);
  const [wakeReason,   setWakeReason]   = useState(editRec?.wakeReason || []);
  const [sleepPlace,   setSleepPlace]   = useState(editRec?.sleepPlace || []);
  const [roomEnv,      setRoomEnv]      = useState(editRec?.roomEnv || []);
  const [sleepQuality, setSleepQuality] = useState(editRec?.sleepQuality || []);
  const [sleepMemo,    setSleepMemo]    = useState(editRec?.memo || "");

  // ── 기저귀/배변 ──────────────────────────────────────────────────
  const [diaperState, setDiaperState] = useState(editRec?.diaperState || (editRec?.diaperKind ? [editRec.diaperKind] : []));
  const [urineColor,  setUrineColor]  = useState(editRec?.urineColor || []);
  const [stoolState,  setStoolState]  = useState(editRec?.stoolState || []);
  const [dNote,       setDNote]       = useState(editRec?.note || "");

  // ── 체온 ─────────────────────────────────────────────────────────
  const [tVal, setTVal] = useState(editRec?.value ? String(editRec.value) : "36.5");

  // ── 이벤트 ───────────────────────────────────────────────────────
  const [eventTypes,   setEventTypes]   = useState(editRec?.eventTypes || (editRec?.visitType ? [editRec.visitType] : []));
  const [eventDetails, setEventDetails] = useState(editRec?.eventDetails || (editRec?.reason ? [editRec.reason] : []));
  const [eventMemo,    setEventMemo]    = useState(editRec?.note || "");

  // ── 공통 ─────────────────────────────────────────────────────────
  const [saved,      setSaved]      = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const isTwoTime = RT[rtype]?.twoTime;
  const startISO  = fromInput(startT);
  const endISO    = fromInput(endT);
  const dur = isTwoTime ? diffMin(startISO, endISO) : 0;

  const handleRtypeChange = (k) => { setRtype(k); setEndT(startT); setCareStartAdj(0); };
  const handleStartChange  = (val) => { setStartT(val); if(isTwoTime) setEndT(val); };
  const toggle = (arr, setArr, v) => setArr(s => s.includes(v) ? s.filter(x=>x!==v) : [...s, v]);

  // 멀티 칩 컴포넌트
  const MChips = ({opts, sel, onTog, col}) => (
    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
      {opts.map(o=>(
        <button key={o} onClick={()=>onTog(o)}
          style={{padding:"6px 12px",borderRadius:20,
            border:`1.5px solid ${sel.includes(o)?col:P.border}`,
            background:sel.includes(o)?col+"18":P.white,
            color:sel.includes(o)?col:P.sub,
            fontWeight:sel.includes(o)?700:400,
            cursor:"pointer",fontSize:13,fontFamily:"inherit",
            WebkitTapHighlightColor:"transparent"}}>
          {o}
        </button>
      ))}
    </div>
  );

  const EVENT_SUB = {
    "활동": ["목욕","산책","드라이브","책읽기","터미타임","병원","손님방문","놀이"],
    "놀이": ["음악듣기","딸랑이","모빌보기","그림책","조명놀이","촉감놀이","거울놀이"],
    "운동": ["터미타임","스트레칭","뒤집기연습","발차기놀이","앉기연습","자전거다리","손잡기"],
    "체온": [],
    "건강": ["예방접종","열","약","병원"],
    "외출": ["차이동","마트","쇼핑몰","카페","식당","가족모임","야외활동","외박","여행"],
    "자극": ["오래깨어있음","시끄러움","심한울음"],
    "루틴": ["늦은취침","낮잠누락","루틴깨짐"],
    "특이": ["유독예민","유독배고픔","이유모름"],
  };

  const canSave = () => {
    if(rtype==="diaper") return diaperState.length > 0;
    if(rtype==="event")  return eventTypes.length > 0;
    return true;
  };

  const save = async () => {
    if(!canSave()) return;
    const base = {
      id: editRec?.id || uid(),
      recordType:rtype, start:startISO,
      end:isTwoTime?endISO:startISO,
      duration:isTwoTime?dur:0, time:startISO
    };
    let rec = base;
    if(rtype==="feeding") rec={...base,
      subKind:fSubKind, amount:fAmt?Number(fAmt):0, foodType:fFood,
      preMeal, duringMeal,
      leftover:leftover?Number(leftover):null, completed:!leftover,
      postMeal, burstFail, nippleStep, nippleShape, note:fNote
    };
    else if(rtype==="sleep") rec={...base,
      sleepKind:sKind, preSleep, sleepMethod,
      wakeReason, sleepPlace, roomEnv, sleepQuality, memo:sleepMemo,
      careStartTime: careStartAdj>0 ? new Date(new Date(startISO).getTime()-careStartAdj*60000).toISOString() : null,
      careStartAdj: careStartAdj>0 ? careStartAdj : null,
    };
    else if(rtype==="diaper") rec={...base,
      diaperState, diaperKind:diaperState[0]||"소변",
      urineColor, stoolState, note:dNote
    };
    else if(rtype==="temp") rec={...base, value:isNaN(parseFloat(tVal))?36.5:parseFloat(tVal)};
    else if(rtype==="event") rec={...base,
      eventTypes, eventDetails, note:eventMemo,
      visitType:eventTypes[0]||"", reason:eventDetails.join(",")
    };
    try {
      const startDate = isoToLocalDate(startISO);
      const endDate   = isoToLocalDate(endISO);
      if(isTwoTime && startDate !== endDate) {
        const midnight = new Date(endDate+"T00:00:00").toISOString();
        const rec1={...rec,id:editRec?.id||uid(),end:midnight,duration:diffMin(startISO,midnight)};
        const rec2={...rec,id:uid(),start:midnight,time:midnight,end:endISO,duration:diffMin(midnight,endISO)};
        if(isEdit){await onUpdate(rec1);await onSave(rec2);}
        else{await onSave(rec1);await onSave(rec2);}
      } else {
        if(isEdit) await onUpdate(rec); else await onSave(rec);
      }
      setSaved(true);
      setTimeout(()=>{
        setSaved(false);
        if(!isEdit){
          setPreMeal([]);setDuringMeal([]);setLeftover("");setPostMeal([]);setBurstFail(false);setFNote("");
          setPreSleep([]);setSleepMethod([]);setWakeReason([]);setSleepPlace([]);setRoomEnv([]);setSleepQuality([]);setSleepMemo("");setCareStartAdj(0);
          setDiaperState([]);setUrineColor([]);setStoolState([]);setDNote("");
          setEventTypes([]);setEventDetails([]);setEventMemo("");
        }
      },900);
    } catch(e){alert("저장 실패. 다시 시도해주세요.");}
  };

  const handleDelete = () => {
    if(confirmDel){onDelete(editRec.id);onClose();}
    else setConfirmDel(true);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,29,46,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:P.white,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,padding:"20px 20px 0",paddingBottom:"max(48px,env(safe-area-inset-bottom,48px))",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 -4px 32px rgba(26,29,46,0.18)",WebkitOverflowScrolling:"touch"}}>

        {/* 헤더 */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontSize:17,fontWeight:800,color:P.text}}>{isEdit?"기록 수정":"기록 추가"}</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {isEdit&&(
              <button onClick={handleDelete}
                style={{border:"none",borderRadius:10,fontWeight:700,fontSize:12,cursor:"pointer",
                  padding:"6px 14px",height:36,WebkitTapHighlightColor:"transparent",
                  background:confirmDel?"#DC2626":"#FEE2E2",color:confirmDel?"#fff":"#DC2626"}}>
                {confirmDel?"확인 삭제":"삭제"}
              </button>
            )}
            <button onClick={onClose} style={{border:"none",background:P.bg,borderRadius:22,color:P.sub,fontSize:16,cursor:"pointer",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>✕</button>
          </div>
        </div>

        {saved ? (
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:"#DCFCE7",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:26}}>✓</div>
            <div style={{fontSize:15,fontWeight:700,color:"#16A34A"}}>{isEdit?"수정 완료":"저장 완료"}</div>
          </div>
        ) : <>

          {/* 카테고리 */}
          <div style={{marginBottom:16}}>
            <div style={S.lbl}>카테고리</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
              {Object.entries(RT).filter(([k])=>k!=="growth").map(([k,v])=>(
                <button key={k}
                  onClick={()=>!isEdit&&handleRtypeChange(k)}
                  style={{padding:"10px 4px",borderRadius:14,
                    border:`1.5px solid ${rtype===k?v.color:P.border}`,
                    background:rtype===k?v.color+"18":P.white,
                    cursor:isEdit?"default":"pointer",fontFamily:"inherit",
                    display:"flex",flexDirection:"column",alignItems:"center",gap:3,
                    opacity:isEdit&&rtype!==k?0.3:1,WebkitTapHighlightColor:"transparent"}}>
                  <span style={{fontSize:20}}>{v.icon}</span>
                  <span style={{fontSize:10,fontWeight:rtype===k?700:400,color:rtype===k?v.color:P.sub}}>{v.label}</span>
                </button>
              ))}
            </div>
            {isEdit&&<div style={{fontSize:11,color:P.sub,marginTop:5,textAlign:"center"}}>카테고리는 수정할 수 없습니다</div>}
          </div>

          {/* 수면 종류 */}
          {rtype==="sleep"&&(
            <div style={{marginBottom:12}}>
              <div style={S.lbl}>수면 종류</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setSKind("nap")} style={{...S.chip(sKind==="nap",P.sleep),flex:1}}>☀️ 낮잠</button>
                <button onClick={()=>setSKind("night")} style={{...S.chip(sKind==="night",P.sleep),flex:1}}>🌙 밤잠</button>
              </div>
            </div>
          )}

          {/* 시간 입력 */}
          <div style={{marginBottom:14}}>
            {isTwoTime ? (<>
              <div style={{marginBottom:8,maxWidth:280}}>
                <div style={S.lbl}>시작 시간</div>
                <input type="datetime-local" value={startT} onChange={e=>handleStartChange(e.target.value)} style={S.inp}/>
              </div>
              {/* 수면: 재우기 차감 (시작시간 수정 없이 별도 표시) */}
              {rtype==="sleep"&&(
                <div style={{marginBottom:8}}>
                  <div style={S.lbl}>재우기 시작 시간 차감</div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <div style={{display:"flex",gap:6}}>
                      {[1,5,10].map(m=>(
                        <button key={m} onClick={()=>setCareStartAdj(p=>p+m)}
                          style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${P.sleep}`,background:P.sleep+"18",color:P.sleep,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>
                          -{m}분
                        </button>
                      ))}
                      {careStartAdj>0&&<button onClick={()=>setCareStartAdj(0)} style={{padding:"5px 10px",borderRadius:20,border:`1px solid ${P.border}`,background:"none",color:P.sub,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>초기화</button>}
                    </div>
                    {careStartAdj>0&&(
                      <div style={{fontSize:12,color:P.sleep,fontWeight:700,background:P.sleep+"18",borderRadius:10,padding:"4px 10px"}}>
                        재우기 시작: {fmtHHMM(new Date(new Date(startT).getTime()-careStartAdj*60000).toISOString())}
                        <span style={{color:P.sub,fontWeight:400,fontSize:11}}> ({careStartAdj}분 전)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div style={{marginBottom:6,maxWidth:280}}>
                <div style={S.lbl}>종료 시간</div>
                <input type="datetime-local" value={endT} onChange={e=>setEndT(e.target.value)} style={S.inp}/>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                {(rtype==="feeding"
                  ? [{l:"+1분",m:1},{l:"+5분",m:5},{l:"+10분",m:10}]
                  : [{l:"+1분",m:1},{l:"+5분",m:5},{l:"+10분",m:10},{l:"+1시간",m:60}]
                ).map(({l,m})=>(
                  <button key={l} onClick={()=>{
                    const d=new Date(endT); d.setMinutes(d.getMinutes()+m);
                    setEndT(toInput(d.toISOString()));
                  }} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${RT[rtype]?.color}`,background:RT[rtype]?.color+"18",color:RT[rtype]?.color,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>
                    {l}
                  </button>
                ))}
              </div>
              {dur>0&&<div style={{display:"inline-flex",alignItems:"center",gap:6,background:RT[rtype]?.color+"18",borderRadius:20,padding:"5px 14px"}}><span style={{fontSize:12,color:RT[rtype]?.color,fontWeight:700}}>⏱ {fmtDur(dur)}</span></div>}
            </>) : (
              <div style={{maxWidth:280}}>
                <div style={S.lbl}>시간</div>
                <input type="datetime-local" value={startT} onChange={e=>setStartT(e.target.value)} style={S.inp}/>
              </div>
            )}
          </div>

          {/* ══ 수유/식사 ══ */}
          {rtype==="feeding"&&<div style={{marginBottom:8}}>
            <div style={S.lbl}>종류</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
              {["분유","모유","이유식","유아식","간식","과일","음료"].map(k=>(
                <button key={k} onClick={()=>setFSubKind(k)} style={S.chip(fSubKind===k,P.feeding)}>{k}</button>
              ))}
            </div>

            {(fSubKind==="분유"||fSubKind==="모유")&&<>
              <div style={S.lbl}>수유량 (ml)</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                {[100,120,140,160,180,200,220,240,260,280,300].map(ml=>(
                  <button key={ml} onClick={()=>setFAmt(String(ml))} style={S.chip(fAmt===String(ml),P.feeding)}>{ml}</button>
                ))}
              </div>
              <input style={{...S.inp,marginBottom:10}} type="number" placeholder="직접 입력 (ml)" value={fAmt} onChange={e=>setFAmt(e.target.value)}/>

              <div style={S.lbl}>식사 전 모습</div>
              <MChips opts={["손빨기","입쩝쩝","칭얼","울음","하품","멍함","없음"]} sel={preMeal} onTog={v=>toggle(preMeal,setPreMeal,v)} col={P.feeding}/>

              <div style={S.lbl}>식사 중 모습</div>
              <MChips opts={["짜증","거부"]} sel={duringMeal} onTog={v=>toggle(duringMeal,setDuringMeal,v)} col={P.feeding}/>

              <div style={S.lbl}>남긴 양 (ml) <span style={{color:P.sub,fontSize:10}}>없으면 수유 완료</span></div>
              <input style={{...S.inp,marginBottom:6}} type="number" placeholder="남기지 않으면 수유 완료" value={leftover} onChange={e=>setLeftover(e.target.value)}/>
              {leftover&&<div style={{fontSize:11,color:"#F7A928",marginBottom:8,fontWeight:600}}>⚠ 수유 미완료 — 남긴 양: {leftover}ml</div>}

              <div style={S.lbl}>식사 후</div>
              <MChips opts={["게워냄","끙끙","복부팽만"]} sel={postMeal} onTog={v=>toggle(postMeal,setPostMeal,v)} col={P.feeding}/>

              <div style={{marginBottom:10}}>
                <div style={S.lbl}>트림</div>
                <button onClick={()=>setBurstFail(b=>!b)}
                  style={{padding:"7px 18px",borderRadius:20,
                    border:`1.5px solid ${burstFail?"#DC2626":P.border}`,
                    background:burstFail?"#FEE2E2":P.white,
                    color:burstFail?"#DC2626":P.sub,cursor:"pointer",fontSize:13,fontFamily:"inherit",
                    fontWeight:burstFail?700:400,WebkitTapHighlightColor:"transparent"}}>
                  트림 실패
                </button>
                <span style={{marginLeft:8,fontSize:11,color:burstFail?"#DC2626":P.sub}}>
                  {burstFail?"● 실패로 저장":"누르지 않으면 성공으로 저장"}
                </span>
              </div>

              <div style={S.lbl}>젖꼭지 단계/모양</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                {["SS","S","M","L","LL","/","O","Y","X"].map(s=>
                  s==="/" ? <span key="sep" style={{color:P.border,fontSize:18,lineHeight:"36px",padding:"0 2px"}}>|</span> :
                  ["SS","S","M","L","LL"].includes(s) ? (
                    <button key={s} onClick={()=>setNippleStep(nippleStep===s?"":s)} style={S.chip(nippleStep===s,P.feeding)}>{s}</button>
                  ) : (
                    <button key={s} onClick={()=>setNippleShape(nippleShape===s?"":s)} style={S.chip(nippleShape===s,P.feeding)}>{s}</button>
                  )
                )}
              </div>
            </>}

            {(fSubKind==="이유식"||fSubKind==="유아식"||fSubKind==="간식"||fSubKind==="과일"||fSubKind==="음료")&&<>
              <div style={S.lbl}>음식 상세</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                {(fSubKind==="이유식"?["쌀미음","야채죽","과일퓨레","닭고기죽","소고기죽","두부죽"]
                  :fSubKind==="유아식"?["밥","국","반찬","면류","빵류","계란"]
                  :fSubKind==="간식"?["요거트","치즈","과자","빵","쌀과자","두부"]
                  :fSubKind==="과일"?["사과","배","바나나","딸기","포도","수박"]
                  :["모유","분유","물","주스","보리차"]
                ).map(f=>(<button key={f} onClick={()=>setFFood(f)} style={S.chip(fFood===f,P.feeding)}>{f}</button>))}
              </div>
              <input style={{...S.inp,marginBottom:8}} placeholder="직접 입력" value={fFood} onChange={e=>setFFood(e.target.value)}/>
            </>}

            <div style={S.lbl}>메모</div>
            <input style={S.inp} placeholder="트림, 사레 등" value={fNote} onChange={e=>setFNote(e.target.value)}/>
          </div>}

          {/* ══ 수면 ══ */}
          {rtype==="sleep"&&<div style={{marginBottom:8}}>
            <div style={S.lbl}>잠들기 전 상태</div>
            <MChips opts={["칭얼","허우적","손빨기","눈비빔","하품","잘잠듦"]} sel={preSleep} onTog={v=>toggle(preSleep,setPreSleep,v)} col={P.sleep}/>

            <div style={S.lbl}>잠든 방식</div>
            <MChips opts={["안아서","스스로","쪽쪽이","수유잠"]} sel={sleepMethod} onTog={v=>toggle(sleepMethod,setSleepMethod,v)} col={P.sleep}/>

            <div style={S.lbl}>깬 이유</div>
            <MChips opts={["배고픔","소리","기저귀","모름"]} sel={wakeReason} onTog={v=>toggle(wakeReason,setWakeReason,v)} col={P.sleep}/>

            <div style={S.lbl}>수면 장소</div>
            <MChips opts={["침대","안방","안음","유모차","바운서","카시트"]} sel={sleepPlace} onTog={v=>toggle(sleepPlace,setSleepPlace,v)} col={P.sleep}/>

            <div style={S.lbl}>방 환경</div>
            <MChips opts={["암실","백색소음","더움","추움","습함","건조함"]} sel={roomEnv} onTog={v=>toggle(roomEnv,setRoomEnv,v)} col={P.sleep}/>

            <div style={S.lbl}>수면질</div>
            <MChips opts={["깊은잠","뒤척임","자주깸"]} sel={sleepQuality} onTog={v=>toggle(sleepQuality,setSleepQuality,v)} col={P.sleep}/>

            <div style={S.lbl}>메모</div>
            <input style={S.inp} placeholder="특이사항 메모" value={sleepMemo} onChange={e=>setSleepMemo(e.target.value)}/>
          </div>}

          {/* ══ 기저귀/배변 ══ */}
          {rtype==="diaper"&&<div style={{marginBottom:8}}>
            <div style={S.lbl}>기저귀 상태</div>
            <MChips opts={["소변","대변","혈변","점액","폭발변"]} sel={diaperState} onTog={v=>toggle(diaperState,setDiaperState,v)} col={P.diaper}/>

            {diaperState.some(d=>["소변","혈변"].includes(d))&&<>
              <div style={S.lbl}>소변 색</div>
              <MChips opts={["맑은노랑","노랑","갈색","분홍기운"]} sel={urineColor} onTog={v=>toggle(urineColor,setUrineColor,v)} col={P.diaper}/>
            </>}

            {diaperState.some(d=>["대변","폭발변","점액"].includes(d))&&<>
              <div style={S.lbl}>대변 상태</div>
              <MChips opts={["묽음","보통","딱딱","노랑","초록","갈색","검정","회백","빨강"]} sel={stoolState} onTog={v=>toggle(stoolState,setStoolState,v)} col={P.diaper}/>
            </>}

            <div style={S.lbl}>메모</div>
            <input style={S.inp} placeholder="메모" value={dNote} onChange={e=>setDNote(e.target.value)}/>
          </div>}

          {/* ══ 체온 ══ */}
          {rtype==="temp"&&<div style={{marginBottom:8}}>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
              {["35.8","36.0","36.3","36.5","36.8","37.0","37.5","38.0","38.5","39.0"].map(v=>(
                <button key={v} onClick={()=>setTVal(v)} style={S.chip(tVal===v,parseFloat(v)>=37.5?"#DC2626":"#26C486")}>{v}°</button>
              ))}
            </div>
            <input style={S.inp} type="number" step="0.1" placeholder="직접 입력 (°C)" value={tVal} onChange={e=>setTVal(e.target.value)}/>
            {parseFloat(tVal)>=37.5&&<div style={{marginTop:8,padding:"10px 14px",background:"#FEF2F2",border:"1.5px solid #FCA5A5",borderRadius:10,fontSize:13,color:"#DC2626",fontWeight:600}}>⚠️ 발열 의심 — 소아과 상담 권장</div>}
          </div>}

          {/* ══ 이벤트 ══ */}
          {rtype==="event"&&<div style={{marginBottom:8}}>
            <div style={S.lbl}>이벤트 유형</div>
            <MChips opts={["활동","놀이","운동","체온","건강","외출","자극","루틴","특이"]} sel={eventTypes} onTog={v=>toggle(eventTypes,setEventTypes,v)} col={P.event}/>

            {eventTypes.length>0&&<>
              <div style={S.lbl}>상세</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
                {eventTypes.flatMap(t=>EVENT_SUB[t]||[]).filter((v,i,a)=>a.indexOf(v)===i).map(o=>(
                  <button key={o} onClick={()=>toggle(eventDetails,setEventDetails,o)}
                    style={{padding:"6px 12px",borderRadius:20,
                      border:`1.5px solid ${eventDetails.includes(o)?P.event:P.border}`,
                      background:eventDetails.includes(o)?P.event+"18":P.white,
                      color:eventDetails.includes(o)?P.event:P.sub,
                      fontWeight:eventDetails.includes(o)?700:400,
                      cursor:"pointer",fontSize:13,fontFamily:"inherit",
                      WebkitTapHighlightColor:"transparent"}}>
                    {o}
                  </button>
                ))}
              </div>
            </>}

            {/* 체온 선택시 온도 입력 */}
            {eventTypes.includes("체온")&&(
              <div style={{marginBottom:8}}>
                <div style={S.lbl}>체온 (°C)</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                  {["35.8","36.0","36.3","36.5","36.8","37.0","37.5","38.0","38.5","39.0"].map(v=>(
                    <button key={v} onClick={()=>setEventMemo(prev=>{
                      const cleaned=prev.replace(/체온:[0-9.]+°C ?/,"").trim();
                      return ("체온:"+v+"°C"+(cleaned?" "+cleaned:"")).trim();
                    })}
                      style={{padding:"5px 10px",borderRadius:20,
                        border:`1.5px solid ${eventMemo.includes("체온:"+v)?"#DC2626":P.border}`,
                        background:eventMemo.includes("체온:"+v)?"#FEE2E2":P.white,
                        color:eventMemo.includes("체온:"+v)?"#DC2626":P.sub,
                        fontWeight:eventMemo.includes("체온:"+v)?700:400,
                        cursor:"pointer",fontSize:12,fontFamily:"inherit",
                        WebkitTapHighlightColor:"transparent"}}>
                      {v}°
                    </button>
                  ))}
                </div>
                {parseFloat(eventMemo.match(/체온:([0-9.]+)/)?.[1])>=37.5&&(
                  <div style={{fontSize:11,color:"#DC2626",fontWeight:600,marginBottom:6}}>⚠️ 발열 의심</div>
                )}
              </div>
            )}
            <div style={S.lbl}>메모</div>
            <input style={S.inp} placeholder="특이사항 메모" value={eventMemo} onChange={e=>setEventMemo(e.target.value)}/>
          </div>}

          <button
            style={{...S.saveBtn, background:RT[rtype]?.color||P.accent, opacity:canSave()?1:0.4}}
            onClick={save}>
            {isEdit?"수정 저장":"저장"}
          </button>
        </>}
      </div>
    </div>
  );
}

function Timeline({ records, onAdd, onEdit, onDelete, selDate }) {
  const scrollRef = useRef(null);
  const hours = Array.from({length:24},(_,i)=>i);
  const isToday = selDate===todayStr();
  const curH = new Date().getHours();

  useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=Math.max(0,(isToday?curH-3:6)*56); },[selDate]);

  const byHour = {};
  records.forEach(r=>{
    const startH = new Date(r.start||r.time).getHours();
    if(!byHour[startH]) byHour[startH]=[];
    if(!byHour[startH].find(x=>x.id===r.id)) byHour[startH].push(r);
    if(r.end && r.duration > 0) {
      const startDate = isoToLocalDate(r.start||r.time);
      const endDate   = isoToLocalDate(r.end);
      if(endDate !== startDate) {
        if(endDate === selDate) {
          const endH = new Date(r.end).getHours();
          for(let hh=0; hh<=endH; hh++){
            if(!byHour[hh]) byHour[hh]=[];
            if(!byHour[hh].find(x=>x.id===r.id)) byHour[hh].push(r);
          }
        }
      }
    }
  });

  const getLabel = r => {
    if(r.recordType==="feeding")  return `${RT.feeding.icon} ${r.subKind}${r.amount>0?" "+r.amount+"ml":""}${r.foodType?" ("+r.foodType+")":""}${r.duration>0?" · "+fmtDur(r.duration):""}`;
    if(r.recordType==="sleep")    return `${r.sleepKind==="night"?"🌙":"☀️"} ${r.sleepKind==="night"?"밤잠":"낮잠"}${r.duration>0?" · "+fmtDur(r.duration):""}`;
    if(r.recordType==="diaper")   return `${RT.diaper.icon} ${r.diaperKind}`;
    if(r.recordType==="playex")   return `🎮 ${r.activity}${r.duration>0?" · "+fmtDur(r.duration):""}`;  // 구버전 호환
    if(r.recordType==="temp")     return `🌡️ ${r.value}°C`;  // 구버전 호환
    if(r.recordType==="event") return `${RT.event.icon} ${r.eventTypes?.join("·")||r.visitType||""} ${r.eventDetails?.slice(0,2).join(",")||r.reason||""}`;
    return "";
  };

  return (
    <div>
      <button onClick={()=>onAdd(null)} style={{width:"100%",padding:"15px",background:P.accent,color:"#fff",border:"none",borderRadius:14,fontWeight:700,fontSize:16,cursor:"pointer",fontFamily:"inherit",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 16px rgba(91,107,248,0.28)",WebkitTapHighlightColor:"transparent",minHeight:52}}>
        <span style={{fontSize:22,lineHeight:1}}>＋</span> 기록 추가 {isToday?"(지금)":""}
      </button>
      <div ref={scrollRef} style={{height:480,overflowY:"auto",borderRadius:12,background:P.white,border:`1px solid ${P.border}`,WebkitOverflowScrolling:"touch"}}>
        {hours.map(h=>{
          const recs=(byHour[h]||[]).sort((a,b)=>new Date(a.start||a.time)-new Date(b.start||b.time));
          const isCur=isToday&&h===curH, isPast=isToday&&h<curH;
          return (
            <div key={h} style={{display:"flex",minHeight:52,borderBottom:`1px solid ${P.border}`,background:isCur?"#F0F2FF":"transparent"}}>
              <div style={{width:52,flexShrink:0,paddingTop:10,fontSize:11,color:isCur?P.accent:isPast?"#CBD0E0":"#B0B8CC",fontWeight:isCur?700:400,textAlign:"right",paddingRight:10,borderRight:`2px solid ${isCur?P.accent:P.border}`,position:"relative"}}>
                {String(h).padStart(2,"0")}:00
                {isCur&&<div style={{width:6,height:6,background:P.accent,borderRadius:"50%",position:"absolute",right:-4,top:14}}/>}
              </div>
              <div style={{flex:1,padding:"6px 10px",display:"flex",flexDirection:"column",gap:4}}>
                {recs.map(r=>(
                  <div key={r.id}
                    onClick={()=>onEdit(r)}
                    style={{display:"inline-flex",alignItems:"center",gap:5,background:RT[r.recordType]?.color+"14",border:`1.5px solid ${RT[r.recordType]?.color}33`,borderRadius:20,padding:"6px 4px 6px 12px",cursor:"pointer",alignSelf:"flex-start",WebkitTapHighlightColor:"transparent"}}>
                    <span style={{fontSize:11,color:P.sub,fontWeight:500}}>{fmtHHMM(r.start||r.time)}</span>
                    {r.duration>0&&<span style={{fontSize:11,color:P.sub}}>→{fmtHHMM(r.end)}</span>}
                    <span style={{fontSize:13,fontWeight:600,color:RT[r.recordType]?.color}}>{getLabel(r)}</span>
                    <span style={{fontSize:13,color:"#BCC0CC",padding:"0 6px",minWidth:32,display:"flex",alignItems:"center",justifyContent:"center",minHeight:32}}>✏️</span>
                  </div>
                ))}
                {recs.length===0 ? (
                  <button onClick={()=>onAdd(h)} style={{width:"100%",height:32,border:`1px dashed ${P.border}`,borderRadius:8,background:"none",cursor:"pointer",color:P.border,fontSize:11,fontFamily:"inherit"}}>+ 여기에 기록</button>
                ) : (
                  <button onClick={()=>onAdd(h)} style={{width:"100%",height:28,border:`1px dashed ${P.border}88`,borderRadius:8,background:"none",cursor:"pointer",color:"#D0D4E0",fontSize:10,fontFamily:"inherit",marginTop:2}}>+ 여기에 기록</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AI 프롬프트 ────────────────────────────────────────────────────
function genPrompt(records, status, from, to) {
  const cur=getCur();
  const days=[]; const d=new Date(from); let safety=0;
  while(d.toISOString().slice(0,10)<=to && safety++<366){days.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
  const lines=days.map(date=>{
    const dr=records.filter(r=>isoToLocalDate(r.start||r.time)===date);
    const feeds=dr.filter(r=>r.recordType==="feeding");
    const sleepR=dr.filter(r=>r.recordType==="sleep");
    const diapers=dr.filter(r=>r.recordType==="diaper");
    const plays=dr.filter(r=>r.recordType==="playex");
    const temps=dr.filter(r=>r.recordType==="temp");
    const hosps=dr.filter(r=>r.recordType==="event");
    const growths=dr.filter(r=>r.recordType==="growth");
    const totalFeed=feeds.reduce((a,f)=>a+(f.amount||0),0);
    const nightS=sleepR.filter(s=>s.sleepKind==="night").reduce((a,s)=>a+(s.duration||0),0);
    const napS=sleepR.filter(s=>s.sleepKind==="nap").reduce((a,s)=>a+(s.duration||0),0);

    // 막수: 해당 날 22시~24시 사이 마지막 수유
    const maksu = [...feeds]
      .filter(f=>new Date(f.start||f.time).getHours()>=22)
      .sort((a,b)=>new Date(b.start||b.time)-new Date(a.start||a.time))[0];
    const maksuTime = maksu ? new Date(maksu.start||maksu.time) : null;
    // 1. 첫 밤잠 블록: 막수 이후 첫 밤잠
    const firstNightSleep = maksuTime
      ? [...sleepR].filter(s=>s.sleepKind==="night"&&new Date(s.start||s.time)>maksuTime)
          .sort((a,b)=>new Date(a.start||a.time)-new Date(b.start||b.time))[0]
      : [...sleepR].filter(s=>s.sleepKind==="night")
          .sort((a,b)=>new Date(a.start||a.time)-new Date(b.start||b.time))[0];
    // 2. 깨어있는 시간: 24h - 총수면
    const awakeMin = Math.max(0, 24*60 - (nightS+napS));
    // 3. 밤중 수유: 0시~6시 수유
    const nightFeeds = feeds.filter(f=>{const h=new Date(f.start||f.time).getHours();return h>=0&&h<6;});
    // 4. 첫 깨어남 제거됨

    return `[${date}]
수유/식사: ${feeds.length}회 총${totalFeed}ml 평균${feeds.length?Math.round(totalFeed/feeds.length):0}ml
  ${feeds.map(f=>{
    const base=`${fmtHHMM(f.start)}~${fmtHHMM(f.end)} ${f.subKind}${f.amount>0?" "+f.amount+"ml":""}${f.foodType?" ("+f.foodType+")":""}${f.duration>0?" "+fmtDur(f.duration):""}`;
    const detail=[
      f.completed===false?"미완료(남긴양:"+(f.leftover||"?")+"ml)":"완료",
      f.preMeal?.length?"식전:"+f.preMeal.join("·"):"",
      f.duringMeal?.length?"식중:"+f.duringMeal.join("·"):"",
      f.postMeal?.length?"식후:"+f.postMeal.join("·"):"",
      f.burstFail===true?"트림실패":"트림성공",
      (f.nippleStep||f.nippleShape)?"젖꼭지:"+(f.nippleStep||"")+(f.nippleShape?"/"+f.nippleShape:""):"",
    ].filter(Boolean).join(" ");
    return base+" ["+detail+"]";
  }).join(" / ")||"없음"}
수면: 밤잠 ${nightS>0?fmtDur(nightS):"없음"} / 낮잠 ${napS>0?fmtDur(napS):"없음"} / 총 ${fmtDur(nightS+napS)||"없음"}
  ${sleepR.map(s=>{
    const base=`${fmtHHMM(s.start)}~${fmtHHMM(s.end)} ${s.sleepKind==="night"?"밤잠":"낮잠"}${s.duration>0?" "+fmtDur(s.duration):""}`;
    const detail=[
      s.careStartTime?"재우기시작:"+fmtHHMM(s.careStartTime)+"("+s.careStartAdj+"분전)":"",
      s.preSleep?.length?"잠전:"+s.preSleep.join("·"):"",
      s.sleepMethod?.length?"방식:"+s.sleepMethod.join("·"):"",
      s.sleepQuality?.length?"수면질:"+s.sleepQuality.join("·"):"",
      s.sleepPlace?.length?"장소:"+s.sleepPlace.join("·"):"",
      s.roomEnv?.length?"환경:"+s.roomEnv.join("·"):"",
      s.wakeReason?.length?"기상이유:"+s.wakeReason.join("·"):"",
      s.memo?"메모:"+s.memo:"",
    ].filter(Boolean).join(" ");
    return base+(detail?" ["+detail+"]":"");
  }).join(" / ")||"없음"}
첫 밤잠 블록: ${firstNightSleep?fmtHHMM(firstNightSleep.start||firstNightSleep.time)+(firstNightSleep.duration>0?" ("+fmtDur(firstNightSleep.duration)+")":""):"없음"}${maksu?" (막수: "+fmtHHMM(maksu.start||maksu.time)+")":""}
깨어있는 시간: ${fmtDur(awakeMin)||"0m"} (24h - 수면 ${fmtDur(nightS+napS)||"0m"})
밤중 수유: ${nightFeeds.length}회${nightFeeds.length>0?" ("+nightFeeds.map(f=>fmtHHMM(f.start||f.time)).join(", ")+")":""}
기저귀: ${diapers.length}회${diapers.length>0?" — "+diapers.map(d=>{const s=(d.diaperState?.join("·")||d.diaperKind||"");const uc=d.urineColor?.length?"소변색:"+d.urineColor.join("·"):"";const ss=d.stoolState?.length?"대변상태:"+d.stoolState.join("·"):"";return s+[uc,ss].filter(Boolean).map(x=>" ["+x+"]").join("");}).join(" / "):""}
${plays.length?`놀이/운동(구): ${plays.map(p=>`${p.activity}${p.duration>0?" "+fmtDur(p.duration):""}`).join(", ")}`:""} 
${temps.length?`체온(구): ${temps.map(t=>t.value+"°C").join("→")}`:""} 
${hosps.length?`이벤트: ${hosps.map(h=>`${h.eventTypes?.join("·")||h.visitType||""}${h.eventDetails?.length?" ("+h.eventDetails.join(",")+")":h.reason?" ("+h.reason+")":""}${h.note?" 메모:"+h.note:""}`).join(" / ")}`:""} 
${growths.length?`성장 측정: ${growths.map(g=>[g.weight?g.weight+"g":"",g.height?g.height+"cm":"",g.head?g.head+"cm(머리)":""].filter(Boolean).join(" / ")).join(", ")}`:""}` 
  }).join("\n\n");
  return `[Ronan 성장 데이터 리포트]
아기: Ronan(김강린) / 2026-03-07
생후: ${getDays()}일 (${getMonths()}개월 / ${getWeeks()}주)
기간: ${from} ~ ${to} (${days.length}일)
체중: ${status.weight||"미입력"}g / 신장: ${status.height||"미입력"}cm

[기준: ${cur.label}]
수유 ${cur.feeding.amount} / ${cur.feeding.freq} / 간격${cur.feeding.interval}
수면 총${cur.sleep.total} / 밤잠${cur.sleep.night}
WHO 체중 ${cur.whoWeight.min}~${cur.whoWeight.max}kg

[일별 기록]
${lines}

[특이사항] ${status.notes||"없음"}
[요청 목적] (분석 목적을 추가하세요)`;
}

// ── 일별 총합 요약 함수 ───────────────────────────────────────────
function summarizeDay(dayRecs, cat) {
  const show = cat ? dayRecs.filter(r=>r.recordType===cat) : dayRecs;
  if(!show||show.length===0) return null;
  const f  = show.filter(r=>r.recordType==="feeding");
  const sl = show.filter(r=>r.recordType==="sleep");
  const di = show.filter(r=>r.recordType==="diaper");
  const pl = show.filter(r=>r.recordType==="playex"); // 구버전 호환
  const te = show.filter(r=>r.recordType==="temp"); // 구버전 호환
  const ho = show.filter(r=>r.recordType==="event");
  const gr = show.filter(r=>r.recordType==="growth");
  const items = [];
  if(f.length>0){
    const milkMl  = f.filter(x=>x.subKind==="분유"||x.subKind==="모유").reduce((a,x)=>a+(x.amount||0),0);
    const milkCnt = f.filter(x=>x.subKind==="분유"||x.subKind==="모유").length;
    const foodCnt = f.filter(x=>x.subKind!=="분유"&&x.subKind!=="모유").length;
    const parts=[]; if(milkCnt>0) parts.push("분유·모유 "+milkMl+"ml ("+milkCnt+"회)"); if(foodCnt>0) parts.push("식사·간식 "+foodCnt+"회");
    if(parts.length>0) items.push({icon:RT.feeding.icon,color:P.feeding,text:parts.join("  ·  ")});
  }
  if(sl.length>0){
    const night=sl.filter(s=>s.sleepKind==="night").reduce((a,s)=>a+(s.duration||0),0);
    const nap  =sl.filter(s=>s.sleepKind==="nap").reduce((a,s)=>a+(s.duration||0),0);
    const parts=[]; if(night>0) parts.push("밤잠 "+fmtDur(night)); if(nap>0) parts.push("낮잠 "+fmtDur(nap)); if(night>0&&nap>0) parts.push("합계 "+fmtDur(night+nap));
    items.push({icon:RT.sleep.icon,color:P.sleep,text:parts.join("  ·  ")||fmtDur(night+nap)||"0m"});
  }
  if(di.length>0){
    const pee=di.filter(d=>d.diaperKind==="소변"||d.diaperKind==="혼합").length;
    const poo=di.filter(d=>d.diaperKind==="대변"||d.diaperKind==="혼합").length;
    items.push({icon:RT.diaper.icon,color:P.diaper,text:"소변 "+pee+"회  ·  대변 "+poo+"회"});
  }
  if(pl.length>0){
    const total=pl.reduce((a,p)=>a+(p.duration||0),0);
    const acts=[...new Set(pl.map(p=>p.activity))].slice(0,3).join(", ");
    items.push({icon:"🎮",color:"#F7A928",text:acts+(total>0?" · 합계 "+fmtDur(total):"")});
  }
  if(te.length>0){
    const vals=te.map(t=>t.value).filter(v=>v!=null&&!isNaN(v));
    if(vals.length>0){ const max=Math.max(...vals),avg=(vals.reduce((a,v)=>a+v,0)/vals.length).toFixed(1); items.push({icon:"🌡️",color:max>=37.5?"#DC2626":"#26C486",text:"평균 "+avg+"°C  ·  최고 "+max+"°C  ·  "+te.length+"회"}); }
  }
  if(ho.length>0) items.push({icon:RT.event.icon,color:P.event,text:ho.map(h=>(h.eventTypes?.join("·")||h.visitType||"")+(h.eventDetails?.length?" — "+h.eventDetails.join(","):h.reason?" — "+h.reason:"")).join(" / ")});
  if(gr.length>0){ const last=gr[gr.length-1]; const parts=[]; if(last.weight) parts.push(last.weight+"g"); if(last.height) parts.push(last.height+"cm"); if(last.head) parts.push("머리 "+last.head+"cm"); items.push({icon:RT.growth.icon,color:"#8B5CF6",text:parts.join("  ·  ")||"측정값 없음"}); }
  return items.length>0 ? items : null;
}

// ── 메인 앱 ───────────────────────────────────────────────────────
const TABS = [
  {key:"타임라인",icon:"📅",label:"타임라인"},
  {key:"발달",    icon:"🌱",label:"발달"},
  {key:"성장",    icon:"📊",label:"성장"},
  {key:"리포트",  icon:"📋",label:"리포트"},
];

export default function App() {
  const [tab,      setTab]      = useState("타임라인");
  const [records,  setRecords]  = useState([]);
  const [lastNipple, setLastNipple] = useState({step:"", shape:""});
  const [status,      setStatus]      = useState({weight:"",height:"",notes:""});
  const [statusInput, setStatusInput] = useState({weight:"",height:"",notes:""});
  const [fbLoading,   setFbLoading]   = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [modalInitType,setModalInitType]= useState(null);
  const [modalInitTime,setModalInitTime]= useState(null);
  const [editRec,      setEditRec]      = useState(null); // 수정 대상 기록
  const [selDate,     setSelDate]     = useState(todayStr());
  const [devView,     setDevView]     = useState("current");
  const [selMonth,    setSelMonth]    = useState(null);
  const [reportFrom,  setReportFrom]  = useState(()=>{const d=new Date();d.setDate(d.getDate()-6);return localDateStr(d);});
  const [reportTo,    setReportTo]    = useState(todayStr());
  const [copied,      setCopied]      = useState(false);
  const [showPrompt,  setShowPrompt]  = useState(false);
  const promptRef = useRef(null);
  const [reportCat,   setReportCat]   = useState(null);
  const [chartDate,   setChartDate]   = useState(todayStr());
  const [chartCat,    setChartCat]    = useState(null); // null = 전체

  // ── Firebase 실시간 구독 (records) ────────────────────────────────
  // ── Firebase 실시간 구독 ──────────────────────────────────────────
  useEffect(()=>{
    const recRef = ref(db,"records");
    const unsub = onValue(recRef,(snap)=>{
      const val = snap.val();
      if(val){ setRecords(Object.entries(val).map(([k,r])=>({...r,id:k}))); }
      else { setRecords([]); }
      setFbLoading(false);
    },(error)=>{
      console.error("Firebase load failed", error);
      setFbLoading(false);
    });
    return ()=>unsub();
  },[]);
  useEffect(()=>{
    const stRef = ref(db,"status");
    const unsub = onValue(stRef,(snap)=>{
      const val = snap.val();
      if(val){ setStatus(val); setStatusInput(val); }
    });
    return ()=>unsub();
  },[]);

  const dayRecs = records.filter(r=>isoToLocalDate(r.start||r.time)===selDate).sort((a,b)=>new Date(a.start||a.time)-new Date(b.start||b.time));
  // ── Firebase 기록 추가 ──────────────────────────────────────────────
  const addRecord = async (rec) => {
    try {
      const {id, ...r} = rec;
      await push(ref(db,"records"), r);
      if(rec.recordType==="feeding" && (rec.nippleStep||rec.nippleShape))
        setLastNipple({step:rec.nippleStep||"", shape:rec.nippleShape||""});
    } catch(e) { alert("저장 실패: 인터넷 연결을 확인해주세요."); }
  };
  // ── Firebase 기록 수정 ──────────────────────────────────────────────
  const updateRecord = async (rec) => {
    try {
      await set(ref(db,`records/${rec.id}`), rec);
      if(rec.recordType==="feeding" && (rec.nippleStep||rec.nippleShape))
        setLastNipple({step:rec.nippleStep||"", shape:rec.nippleShape||""});
    } catch(e) { alert("수정 실패: 인터넷 연결을 확인해주세요."); }
  };
  // ── Firebase 기록 삭제 ──────────────────────────────────────────────
  const delRecord = async (id) => {
    if(!window.confirm("이 기록을 삭제할까요?")) return;
    try { await remove(ref(db,`records/${id}`)); }
    catch(e){ alert("삭제 실패: 인터넷 연결을 확인해주세요."); }
  };

  // 성장 측정 저장: status 업데이트 + 기록으로도 저장
  const saveStatusWithRecord = async () => {
    const withTime = {...statusInput, savedAt: nowISO()};
    const hasValue = statusInput.weight||statusInput.height||statusInput.head;
    try {
      await set(ref(db,"status"), withTime);
      setStatus(withTime);
      if (hasValue) {
        const {id,...r}={id:uid(),recordType:"growth",start:nowISO(),end:nowISO(),time:nowISO(),duration:0,
          weight:statusInput.weight?Number(statusInput.weight):null,
          height:statusInput.height?Number(statusInput.height):null,
          head:statusInput.head?Number(statusInput.head):null,
          notes:statusInput.notes||""};
        await push(ref(db,"records"),r);
      }
    } catch(e){ alert("저장 실패. 다시 시도해주세요."); }
  };

  // 수정 모달 열기
  const openEdit = rec => {
    setEditRec(rec);
    setModalInitType(null);
    setModalInitTime(null);
    setShowModal(true);
  };

  const openModal = (hour, type=null) => {
    if (hour !== null && hour !== undefined) {
      // 특정 시간칸 클릭 → selDate의 해당 시간 (로컬 기준, UTC 왜곡 없이)
      const pad = n => String(n).padStart(2,"0");
      // "YYYY-MM-DDTHH:00" 로컬 문자열을 Date로 파싱 → ISO
      const localStr = `${selDate}T${pad(hour)}:00`;
      setModalInitTime(new Date(localStr).toISOString());
    } else {
      // + 기록 추가 버튼: 오늘이면 현재시각, 과거면 해당날 정오
      setModalInitTime(isToday ? null : new Date(`${selDate}T12:00:00`).toISOString());
    }
    setModalInitType(type);
    setShowModal(true);
  };

  const prevDay = () => {
    const d = new Date(selDate+"T12:00:00");
    d.setDate(d.getDate()-1);
    setSelDate(d.toISOString().slice(0,10));
  };
  const nextDay = () => {
    const d = new Date(selDate+"T12:00:00");
    d.setDate(d.getDate()+1);
    const next = d.toISOString().slice(0,10);
    // 문자열 비교로 오늘 날짜를 넘지 않게 체크
    if(next <= todayStr()) setSelDate(next);
  };
  const isToday = selDate===todayStr();

  // 선택된 날짜 기준 통계 (오늘이 아닌 날도 반영)
  const selDateR = records.filter(r=>isoToLocalDate(r.start||r.time)===selDate);
  const todayR   = selDateR; // 하위 호환성 유지
  const todayF   = selDateR.filter(r=>r.recordType==="feeding");
  const todayS   = selDateR.filter(r=>r.recordType==="sleep");
  const lastTemp = [...selDateR.filter(r=>r.recordType==="temp")].sort((a,b)=>new Date(b.time)-new Date(a.time))[0];
  const lastFeed = [...selDateR.filter(r=>r.recordType==="feeding")].sort((a,b)=>new Date(b.start||b.time)-new Date(a.start||a.time))[0];
  const lastFeedMinsAgo = lastFeed ? Math.max(0, Math.round((Date.now()-new Date(lastFeed.start||lastFeed.time))/60000)) : null;

  // 수유/식사 종류별 집계
  const todayMilkMl  = todayF.filter(f=>f.subKind==="분유"||f.subKind==="모유").reduce((a,f)=>a+(f.amount||0),0);
  const todayMilkCnt = todayF.filter(f=>f.subKind==="분유"||f.subKind==="모유").length;
  const todayFoodCnt = todayF.filter(f=>f.subKind!=="분유"&&f.subKind!=="모유").length;
  // 수면 종류별 집계
  const todayNightMin = todayS.filter(s=>s.sleepKind==="night").reduce((a,s)=>a+(s.duration||0),0);
  const todayNapMin   = todayS.filter(s=>s.sleepKind==="nap").reduce((a,s)=>a+(s.duration||0),0);
  const todayTotalMin = todayNightMin + todayNapMin;

  const cur = getCur(); const mo = getMonths();
  const selM = selMonth!==null?(MILESTONES.find(m=>m.month===selMonth)||cur):cur;

  // 리포트: 최근 10일 일별 총합 계산 (JSX 밖에서 미리 계산)
  const last10Days = Array.from({length:10},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-i); return localDateStr(d); });
  const reportRows = last10Days.map(date=>{
    const all = records.filter(r=>isoToLocalDate(r.start||r.time)===date);
    const items = summarizeDay(all, reportCat);
    return items ? {date, items} : null;
  }).filter(Boolean);

  const copyPrompt = () => {
    const text = genPrompt(records,status,reportFrom,reportTo);
    setShowPrompt(true);
    // 자동 복사 시도
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),3000); })
        .catch(()=>{ setCopied(false); });
    }
    // textarea 열린 후 전체 선택 (폴백)
    setTimeout(()=>{
      if(promptRef.current){
        promptRef.current.select();
        promptRef.current.setSelectionRange(0, 99999); // 모바일 호환
      }
    }, 100);
  };

  const reportRecs = records.filter(r=>isoToLocalDate(r.start||r.time)>=reportFrom&&isoToLocalDate(r.start||r.time)<=reportTo);
  const catFilter = {feeding:r=>r.recordType==="feeding",sleep:r=>r.recordType==="sleep",diaper:r=>r.recordType==="diaper",playex:r=>r.recordType==="playex",temp:r=>r.recordType==="temp",hospital:r=>r.recordType==="hospital"};
  const filteredRecs = reportCat?reportRecs.filter(catFilter[reportCat]||(_=>true)):reportRecs;

  const getReportLabel = r => {
    if(r.recordType==="feeding")  return `${RT.feeding.icon} ${r.subKind}${r.amount>0?" "+r.amount+"ml":""}${r.foodType?" ("+r.foodType+")":""}${r.duration>0?" · "+fmtDur(r.duration):""}`;
    if(r.recordType==="sleep")    return `${r.sleepKind==="night"?"🌙":"☀️"} ${r.sleepKind==="night"?"밤잠":"낮잠"}${r.duration>0?" · "+fmtDur(r.duration):""}`;
    if(r.recordType==="diaper")   return `${RT.diaper.icon} ${r.diaperKind}${r.note?" ("+r.note+")":""}`;
    if(r.recordType==="playex")   return `🎮 ${r.activity}${r.duration>0?" · "+fmtDur(r.duration):""}`;  // 구버전 호환
    if(r.recordType==="temp")     return `🌡️ ${r.value}°C`;  // 구버전 호환
    if(r.recordType==="event") return `${RT.event.icon} ${r.eventTypes?.join("·")||r.visitType||""}${r.eventDetails?.length?" — "+r.eventDetails.join(","):""}${r.note?" ("+r.note+")":""}`;
    if(r.recordType==="growth")   return `${RT.growth.icon} ${[r.weight?r.weight+"g":"", r.height?r.height+"cm":"", r.head?r.head+"cm(머리둘레)":""].filter(Boolean).join(" · ")}`;
    return "";
  };

  if(fbLoading) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:P.bg,fontFamily:"-apple-system,sans-serif"}}>
      <div style={{fontSize:40,marginBottom:16}}>🌱</div>
      <div style={{fontSize:18,fontWeight:800,color:P.accent,marginBottom:6}}>Ronan 성장 트래커</div>
      <div style={{fontSize:13,color:P.sub}}>데이터를 불러오는 중...</div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:P.bg,fontFamily:"-apple-system,'SF Pro Display','Apple SD Gothic Neo','Noto Sans KR',sans-serif",maxWidth:480,margin:"0 auto",color:P.text,WebkitTextSizeAdjust:"100%"}}>

      {showModal&&<RecordModal
        initType={modalInitType} initTime={modalInitTime} editRec={editRec}
        onClose={()=>{setShowModal(false);setEditRec(null);}}
        onSave={addRecord} onUpdate={updateRecord} onDelete={delRecord} records={records} lastNipple={lastNipple}
      />}

      {/* Header */}
      <div style={{background:P.white,padding:"18px 20px 14px",borderBottom:`1px solid ${P.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:11,color:P.accent,letterSpacing:2,fontWeight:700,marginBottom:3}}>RONAN PROJECT</div>
            <div style={{fontSize:20,fontWeight:800,letterSpacing:-0.5,color:P.text}}>Ronan 성장 트래커</div>
            <div style={{fontSize:11,color:P.sub,marginTop:3}}>D+{getDays()} · {getWeeks()}W · {mo}M</div>
          </div>
          <div style={{textAlign:"right",minWidth:140}}>
            <div style={{fontSize:10,color:P.sub,marginBottom:4,letterSpacing:1,fontWeight:700}}>
              {isToday?"TODAY":selDate}
            </div>

            {/* 수유/식사 */}
            {(todayMilkCnt>0||todayFoodCnt>0) ? <>
              {todayMilkCnt>0 && (
                <div style={{fontSize:11,color:P.feeding,fontWeight:600,lineHeight:1.6}}>
                  🍼 분유·모유 {todayMilkMl}ml ({todayMilkCnt}회)
                </div>
              )}
              {todayFoodCnt>0 && (
                <div style={{fontSize:11,color:P.feeding,fontWeight:600,lineHeight:1.6}}>
                  🥄 식사·간식 {todayFoodCnt}회
                </div>
              )}
            </> : (
              <div style={{fontSize:11,color:"#CBD0E0",lineHeight:1.6}}>🍼 수유 기록 없음</div>
            )}

            {/* 수면 */}
            {todayTotalMin>0 ? <>
              {todayNightMin>0 && (
                <div style={{fontSize:11,color:P.sleep,fontWeight:600,lineHeight:1.6}}>
                  🌙 밤잠 {fmtDur(todayNightMin)}
                </div>
              )}
              {todayNapMin>0 && (
                <div style={{fontSize:11,color:P.sleep,fontWeight:600,lineHeight:1.6}}>
                  ☀️ 낮잠 {fmtDur(todayNapMin)}
                </div>
              )}
              {todayNightMin>0 && todayNapMin>0 && (
                <div style={{fontSize:11,color:P.sleep,fontWeight:700,lineHeight:1.6}}>
                  😴 계 {fmtDur(todayTotalMin)}
                </div>
              )}
              {(todayNightMin===0||todayNapMin===0) && (
                <div style={{fontSize:11,color:P.sleep,fontWeight:600,lineHeight:1.6}}>
                  😴 {fmtDur(todayTotalMin)}
                </div>
              )}
            </> : (
              <div style={{fontSize:11,color:"#CBD0E0",lineHeight:1.6}}>😴 수면 기록 없음</div>
            )}

            {/* 체온 */}
            {lastTemp && (
              <div style={{fontSize:11,fontWeight:600,color:lastTemp.value>=37.5?"#DC2626":"#26C486",lineHeight:1.6}}>
                🌡️ {lastTemp.value}°C
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",background:P.white,borderBottom:`1px solid ${P.border}`,position:"sticky",top:0,zIndex:10}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,padding:"10px 2px 8px",border:"none",background:"none",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:2,borderBottom:`2.5px solid ${tab===t.key?P.accent:"transparent"}`,WebkitTapHighlightColor:"transparent",minHeight:48}}>
            <span style={{fontSize:18}}>{t.icon}</span>
            <span style={{fontSize:10,fontWeight:tab===t.key?700:400,color:tab===t.key?P.accent:P.sub}}>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={{padding:"14px 16px 0",paddingBottom:"max(100px, calc(80px + env(safe-area-inset-bottom, 0px)))"}}>

        {/* ── 타임라인 ── */}
        {tab==="타임라인"&&<>
          <div style={{...S.card,padding:"10px 16px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <button onClick={prevDay} style={{border:"none",background:P.bg,borderRadius:22,color:P.accent,fontSize:20,cursor:"pointer",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>‹</button>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:15,fontWeight:700,color:P.text}}>{isToday?"오늘":selDate}</div>
                {isToday&&lastFeed&&(
                  <div style={{fontSize:11,color:P.feeding,fontWeight:600,marginTop:2}}>
                    마지막 수유/식사: {fmtHHMM(lastFeed.start||lastFeed.time)}
                    {lastFeedMinsAgo!==null&&` (${lastFeedMinsAgo<60?lastFeedMinsAgo+"분 전":Math.floor(lastFeedMinsAgo/60)+"시간 "+lastFeedMinsAgo%60+"분 전"})`}
                  </div>
                )}
                {isToday&&!lastFeed&&<div style={{fontSize:11,color:P.sub,marginTop:2}}>마지막 수유/식사: 없음</div>}
                <div style={{fontSize:11,color:P.sub,marginTop:1}}>
                  🍼{dayRecs.filter(r=>r.recordType==="feeding").length} &nbsp;
                  😴{fmtDur(dayRecs.filter(r=>r.recordType==="sleep").reduce((a,s)=>a+(s.duration||0),0))||"0m"} &nbsp;
                  {RT.diaper.icon}{dayRecs.filter(r=>r.recordType==="diaper").length}
                </div>
              </div>
              <button onClick={nextDay} style={{border:"none",background:P.bg,borderRadius:22,color:isToday?"#E0E4EF":P.accent,fontSize:20,cursor:"pointer",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}} disabled={isToday}>›</button>
            </div>
          </div>
          <div style={S.card}>
            <Timeline records={dayRecs} onAdd={openModal} onEdit={openEdit} onDelete={delRecord} selDate={selDate}/>
          </div>
        </>}

        {/* ── 발달 ── */}
        {tab==="발달"&&<>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button onClick={()=>setDevView("current")} style={S.chip(devView==="current")}>현재 {mo}개월</button>
            <button onClick={()=>setDevView("timeline")} style={S.chip(devView==="timeline")}>전체 타임라인</button>
          </div>
          {devView==="current"&&<>
            <div style={{background:`linear-gradient(135deg,${P.accent}18,${P.sleep}18)`,border:`1px solid ${P.accent}30`,borderRadius:16,padding:20,marginBottom:14,textAlign:"center"}}>
              <div style={{fontSize:11,color:P.sub,letterSpacing:2,marginBottom:6}}>CURRENT STAGE</div>
              <div style={{fontSize:20,fontWeight:800,marginBottom:4,color:P.text}}>{cur.label}</div>
              <div style={{fontSize:12,color:P.sub}}>WHO {cur.whoWeight.min}~{cur.whoWeight.max}kg · {cur.whoHeight.min}~{cur.whoHeight.max}cm</div>
            </div>
            {[{t:"수유 기준",c:`${cur.feeding.amount}\n${cur.feeding.freq} / 간격 ${cur.feeding.interval}`},{t:"수면 기준",c:`총 ${cur.sleep.total}\n밤잠 ${cur.sleep.night}`}].map(item=>(
              <div key={item.t} style={S.card}><div style={S.secT}>{item.t}</div><div style={{fontSize:14,color:P.text,lineHeight:1.9,whiteSpace:"pre-line"}}>{item.c}</div></div>
            ))}
          </>}
          {devView==="timeline"&&(
            <div style={{position:"relative",paddingLeft:20}}>
              <div style={{position:"absolute",left:8,top:0,bottom:0,width:2,background:P.border}}/>
              {MILESTONES.map(m=>(
                <div key={m.month} style={{marginBottom:8,paddingLeft:22,position:"relative"}}>
                  <div style={{position:"absolute",left:-5,top:14,width:10,height:10,borderRadius:"50%",background:m.month<=mo?P.accent:P.white,border:`2px solid ${m.month<=mo?P.accent:P.border}`}}/>
                  <button onClick={()=>{setSelMonth(m.month);setDevView("detail");}} style={{width:"100%",textAlign:"left",background:m.month===mo?P.accent+"10":P.white,border:`1px solid ${m.month<=mo?P.accent+"40":P.border}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",fontFamily:"inherit"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:m.month<=mo?P.text:P.sub}}>{m.label}</div>
                        <div style={{fontSize:11,color:P.sub,marginTop:2}}>{m.feeding.amount} · 수면 {m.sleep.total}</div>
                      </div>
                      <span style={{fontSize:12,color:m.month<=mo?P.accent:P.border}}>{m.month<=mo?"✓":"›"}</span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
          {devView==="detail"&&<>
            <button onClick={()=>setDevView("timeline")} style={{border:"none",background:"none",color:P.accent,fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:12,padding:0,fontFamily:"inherit"}}>← 타임라인</button>
            <div style={{background:`linear-gradient(135deg,${P.accent}14,${P.sleep}14)`,border:`1px solid ${P.accent}30`,borderRadius:16,padding:18,marginBottom:14,textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:800,color:P.text}}>{selM.label}</div>
              <div style={{fontSize:11,color:P.sub,marginTop:4}}>WHO {selM.whoWeight.min}~{selM.whoWeight.max}kg / {selM.whoHeight.min}~{selM.whoHeight.max}cm</div>
            </div>
            {[{t:"수유",c:`${selM.feeding.amount}\n${selM.feeding.freq} · 간격 ${selM.feeding.interval}`},{t:"수면",c:`총 ${selM.sleep.total}\n밤잠 ${selM.sleep.night}`}].map(item=>(
              <div key={item.t} style={S.card}><div style={S.secT}>{item.t}</div><div style={{fontSize:14,color:P.text,lineHeight:1.9,whiteSpace:"pre-line"}}>{item.c}</div></div>
            ))}
          </>}
        </>}

        {tab==="성장"&&<>
          <div style={S.card}>
            <div style={S.secT}>측정값 입력</div>
            <div style={{marginBottom:10}}><div style={S.lbl}>체중 (g)</div><input style={S.inp} type="number" placeholder="예: 4800" value={statusInput.weight||""} onChange={e=>setStatusInput(s=>({...s,weight:e.target.value}))}/></div>
            <div style={{marginBottom:10}}><div style={S.lbl}>신장 (cm)</div><input style={S.inp} type="number" placeholder="예: 56.5" value={statusInput.height||""} onChange={e=>setStatusInput(s=>({...s,height:e.target.value}))}/></div>
            <div style={{marginBottom:10}}><div style={S.lbl}>머리둘레 (cm)</div><input style={S.inp} type="number" placeholder="예: 37.5" value={statusInput.head||""} onChange={e=>setStatusInput(s=>({...s,head:e.target.value}))}/></div>
            <div style={{marginBottom:10}}><div style={S.lbl}>특이사항</div><textarea value={statusInput.notes||""} onChange={e=>setStatusInput(s=>({...s,notes:e.target.value}))} placeholder="예방접종, 외출, 발달 특이사항 등" style={{...S.inp,minHeight:72,resize:"vertical"}}/></div>
            <button style={S.saveBtn} onClick={saveStatusWithRecord}>저장 (기록에 자동 추가)</button>
            {status.savedAt && (
              <div style={{marginTop:10,textAlign:"center",fontSize:12,color:P.sub}}>
                마지막 저장: <b style={{color:P.accent}}>{fmtHHMM(status.savedAt)} {isoToLocalDate(status.savedAt)}</b>
              </div>
            )}
          </div>
          <div style={S.card}>
            <div style={S.secT}>WHO 비교 — {mo}개월</div>
            <div style={S.statRow}><span style={{color:P.sub}}>WHO 체중 기준</span><span style={{fontWeight:700}}>{cur.whoWeight.min}~{cur.whoWeight.max} kg</span></div>
            <div style={S.statRow}><span style={{color:P.sub}}>Ronan 체중</span><span style={{fontWeight:700,color:P.accent}}>{status.weight?`${(Number(status.weight)/1000).toFixed(2)} kg`:"미입력"}</span></div>
            <div style={S.statRow}><span style={{color:P.sub}}>WHO 신장 기준</span><span style={{fontWeight:700}}>{cur.whoHeight.min}~{cur.whoHeight.max} cm</span></div>
            <div style={S.statRow}><span style={{color:P.sub}}>Ronan 신장</span><span style={{fontWeight:700,color:P.accent}}>{status.height?`${status.height} cm`:"미입력"}</span></div>
            <div style={S.statRow}><span style={{color:P.sub}}>WHO 머리둘레 기준</span><span style={{fontWeight:700}}>{cur.whoHead.min}~{cur.whoHead.max} cm</span></div>
            <div style={{...S.statRow,borderBottom:"none"}}><span style={{color:P.sub}}>Ronan 머리둘레</span><span style={{fontWeight:700,color:P.accent}}>{status.head?`${status.head} cm`:"미입력"}</span></div>
            {status.weight&&(()=>{const kg=Number(status.weight)/1000,ok=kg>=cur.whoWeight.min&&kg<=cur.whoWeight.max;return <div style={{marginTop:8,padding:"10px 14px",background:ok?"#F0FFF4":"#FFF5F5",border:`1.5px solid ${ok?"#86EFAC":"#FCA5A5"}`,borderRadius:10,fontSize:13,fontWeight:600,color:ok?"#16A34A":"#DC2626"}}>{ok?"✓ 체중 정상 범위":"⚠ 체중 범위 확인 — 소아과 상담 권장"}</div>})()}
            {status.height&&(()=>{const h=Number(status.height),ok=h>=cur.whoHeight.min&&h<=cur.whoHeight.max;return <div style={{marginTop:8,padding:"10px 14px",background:ok?"#F0FFF4":"#FFF5F5",border:`1.5px solid ${ok?"#86EFAC":"#FCA5A5"}`,borderRadius:10,fontSize:13,fontWeight:600,color:ok?"#16A34A":"#DC2626"}}>{ok?"✓ 신장 정상 범위":"⚠ 신장 범위 확인 — 소아과 상담 권장"}</div>})()}
            {status.head&&(()=>{const h=Number(status.head),ok=h>=cur.whoHead.min&&h<=cur.whoHead.max;return <div style={{marginTop:8,padding:"10px 14px",background:ok?"#F0FFF4":"#FFF5F5",border:`1.5px solid ${ok?"#86EFAC":"#FCA5A5"}`,borderRadius:10,fontSize:13,fontWeight:600,color:ok?"#16A34A":"#DC2626"}}>{ok?"✓ 머리둘레 정상 범위":"⚠ 머리둘레 범위 확인 — 소아과 상담 권장"}</div>})()}
          </div>
        </>}

        {/* ── 리포트 ── */}
        {tab==="리포트"&&<>

          {/* 일과표 */}
          <div style={S.card}>
            <div style={{...S.secT,marginBottom:10}}>일과표</div>

            {/* 카테고리 필터 칩 */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {[
                {key:null,       icon:"◉",  label:"전체",       col:P.accent},
                {key:"feeding",  icon:RT.feeding.icon,  label:"수유/식사",  col:P.feeding},
                {key:"sleep",    icon:RT.sleep.icon,    label:"수면",      col:P.sleep},
                {key:"diaper",   icon:RT.diaper.icon,   label:"기저귀/배변",col:P.diaper},
                {key:"event",    icon:RT.event.icon,    label:"이벤트",   col:P.event},
              ].map(c=>(
                <button key={String(c.key)} onClick={()=>setChartCat(c.key)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:20,
                    border:`1.5px solid ${chartCat===c.key?c.col:P.border}`,
                    background:chartCat===c.key?c.col+"18":P.white,
                    color:chartCat===c.key?c.col:P.sub,
                    fontWeight:chartCat===c.key?700:400,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>
                  <span style={{fontSize:14}}>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>

            {/* 날짜 선택 */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <button onClick={()=>{const d=new Date(chartDate+"T12:00:00");d.setDate(d.getDate()-1);setChartDate(d.toISOString().slice(0,10));}} style={{border:"none",background:P.bg,borderRadius:22,color:P.accent,fontSize:18,cursor:"pointer",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>‹</button>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:P.text}}>{chartDate===todayStr()?"오늘":chartDate}</div>
                <div style={{fontSize:11,color:P.sub,marginTop:1}}>
                  {(()=>{
                    const base = records.filter(r=>isoToLocalDate(r.start||r.time)===chartDate);
                    const shown = chartCat ? base.filter(r=>r.recordType===chartCat) : base;
                    return `${shown.length}개 기록${chartCat?" ("+RT[chartCat]?.label+")":""}`;
                  })()}
                </div>
              </div>
              <button onClick={()=>{const d=new Date(chartDate+"T12:00:00");d.setDate(d.getDate()+1);const next=d.toISOString().slice(0,10);if(next<=todayStr())setChartDate(next);}} style={{border:"none",background:P.bg,borderRadius:22,color:chartDate===todayStr()?"#E0E4EF":P.accent,fontSize:18,cursor:"pointer",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}} disabled={chartDate===todayStr()}>›</button>
            </div>

            <DailyCircleChart
              records={chartCat ? records.filter(r=>r.recordType===chartCat) : records}
              date={chartDate}
              singleCat={chartCat}
            />
          </div>

          {/* 카테고리별 기록 보기 — 10일 일별 총합 */}
          <div style={S.card}>
            <div style={S.secT}>카테고리별 일별 요약 (최근 10일)</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
              {[
                {key:null,       icon:"📋", label:"전체"},
                {key:"feeding",  icon:RT.feeding.icon,  label:"수유/식사"},
                {key:"sleep",    icon:RT.sleep.icon,    label:"수면"},
                {key:"diaper",   icon:RT.diaper.icon,   label:"기저귀/배변"},
                {key:"event",    icon:RT.event.icon,    label:"이벤트(활동/건강)"},
                {key:"growth",   icon:RT.growth.icon,   label:"성장 측정"},
              ].map(c=>(
                <button key={String(c.key)} onClick={()=>setReportCat(c.key)}
                  style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"10px 12px",borderRadius:14,
                    border:`1.5px solid ${reportCat===c.key?(c.key?RT[c.key]?.color:P.accent):P.border}`,
                    background:reportCat===c.key?(c.key?RT[c.key]?.color+"14":P.accent+"14"):P.white,
                    cursor:"pointer",fontFamily:"inherit",minWidth:52,WebkitTapHighlightColor:"transparent"}}>
                  <span style={{fontSize:20}}>{c.icon}</span>
                  <span style={{fontSize:9,fontWeight:reportCat===c.key?700:400,color:reportCat===c.key?(c.key?RT[c.key]?.color:P.accent):P.sub}}>{c.label}</span>
                </button>
              ))}
            </div>

            {reportRows.length===0 ? (
              <div style={{textAlign:"center",color:P.sub,fontSize:13,padding:"20px 0"}}>최근 10일간 기록이 없습니다</div>
            ) : reportRows.map(({date, items})=>{
              const isDateToday = date===todayStr();
              return (
                <div key={date} style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${P.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:13,fontWeight:700,color:isDateToday?P.accent:P.text}}>
                      {isDateToday?"📅 오늘":date}
                    </span>
                  </div>
                  {items.map((item,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                      <span style={{fontSize:16,width:24,textAlign:"center",flexShrink:0}}>{item.icon}</span>
                      <span style={{fontSize:12,color:item.color,fontWeight:600,lineHeight:1.5}}>{item.text}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* AI 분석 데이터 — 카테고리별 기록 아래로 이동 */}
          <div style={S.card}>
            <div style={S.secT}>AI 분석 데이터</div>
            <div style={{marginBottom:12}}>
              <div style={{marginBottom:10,maxWidth:200}}>
                <div style={S.lbl}>시작일</div>
                <input type="date" value={reportFrom} onChange={e=>{setReportFrom(e.target.value);setShowPrompt(false);setCopied(false);}} style={S.inp}/>
              </div>
              <div style={{maxWidth:200}}>
                <div style={S.lbl}>종료일</div>
                <input type="date" value={reportTo} onChange={e=>{setReportTo(e.target.value);setShowPrompt(false);setCopied(false);}} style={S.inp}/>
              </div>
            </div>
            <div style={{fontSize:12,color:P.sub,marginBottom:12}}>선택: <b style={{color:P.text}}>{reportFrom} ~ {reportTo}</b> ({Math.max(1,Math.round((new Date(reportTo)-new Date(reportFrom))/86400000)+1)}일)</div>
            <button onClick={copyPrompt} style={{...S.saveBtn,background:copied?"#16A34A":P.accent}}>
              {copied?"✓ 자동 복사 완료 — Claude에 붙여넣기하세요":"📋 AI 프롬프트 보기 / 복사"}
            </button>
            {showPrompt&&(
              <div style={{marginTop:14}}>
                <div style={{padding:"10px 14px",marginBottom:10,borderRadius:10,fontSize:13,fontWeight:600,background:copied?"#F0FFF4":"#FFF8E1",border:`1.5px solid ${copied?"#86EFAC":"#FFD54F"}`,color:copied?"#16A34A":"#B45309"}}>
                  {copied?"✓ 클립보드에 복사됨 — Claude/ChatGPT에 붙여넣기 하세요":"⚠ 자동 복사 안 됨 — 아래 텍스트를 길게 눌러 전체선택 후 복사하세요"}
                </div>
                <div style={{fontSize:11,color:P.sub,marginBottom:6,fontWeight:600}}>👇 전체선택(Ctrl+A / 길게 누르기) → 복사</div>
                <textarea ref={promptRef} readOnly value={genPrompt(records,status,reportFrom,reportTo)}
                  style={{width:"100%",height:240,border:`1.5px solid ${P.border}`,borderRadius:10,padding:"10px 12px",fontSize:11,fontFamily:"monospace",color:P.text,background:"#FAFAFA",lineHeight:1.6,resize:"none",boxSizing:"border-box",WebkitUserSelect:"all",userSelect:"all"}}
                  onClick={e=>{e.target.select();e.target.setSelectionRange(0,99999);}}/>
                <div style={{fontSize:11,color:P.sub,marginTop:6,textAlign:"center"}}>텍스트를 탭하면 전체 선택됩니다</div>
              </div>
            )}
          </div>
        </>}
      </div>
    </div>
  );
}
