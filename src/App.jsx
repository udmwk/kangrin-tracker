import { useState, useEffect, useRef } from "react";
import { db } from "./firebase.js";
import { ref, onValue, push, remove, set } from "firebase/database";

// ── 유틸 ─────────────────────────────────────────────────────────
const BIRTH = new Date("2026-03-07");
const getDays   = () => Math.floor((Date.now() - BIRTH) / 86400000);
const getMonths = () => { const n=new Date(); return (n.getFullYear()-BIRTH.getFullYear())*12+(n.getMonth()-BIRTH.getMonth()); };
const getWeeks  = () => Math.floor(getDays()/7);
const nowISO    = () => new Date().toISOString();
const toInput   = (iso) => { const d=new Date(iso||Date.now()),p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromInput = s => s ? new Date(s).toISOString() : nowISO();
const fmtHHMM   = iso => { if(!iso) return "--:--"; const d=new Date(iso); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const fmtDur    = min => { if(!min||min<=0) return ""; return min>=60?`${Math.floor(min/60)}h ${min%60}m`:`${min}m`; };
const diffMin   = (s,e) => Math.max(0,Math.round((new Date(e)-new Date(s))/60000));
const todayStr  = () => new Date().toISOString().slice(0,10);
const fmtDateKR = iso => { if(!iso) return ""; const d=new Date(iso); return `${d.getMonth()+1}/${d.getDate()}`; };
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2);

// ── 색상 ──────────────────────────────────────────────────────────
const P = {
  bg:"#F7F8FC", white:"#FFFFFF", border:"#E8EAF0",
  text:"#1A1D2E", sub:"#6B7080", accent:"#5B6BF8",
  feeding:"#FF6B6B", sleep:"#7C6FF7", diaper:"#4EA8DE",
  playex:"#F7A928", temp:"#26C486", hospital:"#E05C9B",
};

// ── 카테고리 ──────────────────────────────────────────────────────
const RT = {
  feeding:  { icon:"🍼", label:"수유/식사",   color:P.feeding,  twoTime:true  },
  sleep:    { icon:"😴", label:"수면",        color:P.sleep,    twoTime:true  },
  diaper:   { icon:"🩲", label:"기저귀/배변", color:P.diaper,   twoTime:false },
  playex:   { icon:"🎮", label:"놀이/운동",   color:P.playex,   twoTime:true  },
  temp:     { icon:"🌡️", label:"체온",        color:P.temp,     twoTime:false },
  hospital: { icon:"🏥", label:"병원",        color:P.hospital, twoTime:true  },
};

// ── 발달 기준표 ───────────────────────────────────────────────────
const MILESTONES = [
  { month:0,  label:"신생아", feeding:{amount:"60~90ml",  freq:"8~12회", interval:"2~3시간"}, sleep:{total:"16~18시간",night:"2~4시간"}, whoWeight:{min:2.9,max:4.4},  whoHeight:{min:48,max:54} },
  { month:1,  label:"1개월",  feeding:{amount:"90~120ml", freq:"7~8회",  interval:"3시간"},   sleep:{total:"15~17시간",night:"3~4시간"}, whoWeight:{min:3.4,max:5.7},  whoHeight:{min:50,max:58} },
  { month:2,  label:"2개월",  feeding:{amount:"120~150ml",freq:"6~7회",  interval:"3~3.5시간"}, sleep:{total:"14~16시간",night:"4~6시간"}, whoWeight:{min:4.3,max:7.1},whoHeight:{min:54,max:62} },
  { month:3,  label:"3개월",  feeding:{amount:"150~180ml",freq:"5~6회",  interval:"3.5~4시간"}, sleep:{total:"14~16시간",night:"5~7시간"}, whoWeight:{min:5.0,max:8.0},whoHeight:{min:57,max:65} },
  { month:4,  label:"4개월",  feeding:{amount:"150~200ml",freq:"5회",    interval:"4시간"},   sleep:{total:"12~16시간",night:"6~8시간"}, whoWeight:{min:5.6,max:8.7},  whoHeight:{min:60,max:68} },
  { month:6,  label:"6개월",  feeding:{amount:"분유180ml+이유식",freq:"4~5회+이유식1회",interval:"4시간"}, sleep:{total:"12~15시간",night:"8~10시간"}, whoWeight:{min:6.4,max:9.8},whoHeight:{min:64,max:72} },
  { month:9,  label:"9개월",  feeding:{amount:"분유3회+이유식2~3회",freq:"5~6회",interval:"3~4시간"}, sleep:{total:"12~14시간",night:"10~11시간"}, whoWeight:{min:7.2,max:11.0},whoHeight:{min:68,max:77} },
  { month:12, label:"12개월", feeding:{amount:"우유400ml+유아식3회",freq:"5회",interval:"3~4시간"}, sleep:{total:"11~14시간",night:"10~12시간"}, whoWeight:{min:8.0,max:12.0},whoHeight:{min:72,max:82} },
  { month:18, label:"18개월", feeding:{amount:"우유400ml+유아식+간식",freq:"5회",interval:"3~4시간"}, sleep:{total:"11~14시간",night:"10~12시간"}, whoWeight:{min:9.2,max:13.7},whoHeight:{min:78,max:89} },
  { month:24, label:"24개월", feeding:{amount:"우유300ml+3끼+간식",freq:"5회",interval:"4시간"}, sleep:{total:"11~14시간",night:"10~12시간"}, whoWeight:{min:10.0,max:15.3},whoHeight:{min:82,max:94} },
  { month:36, label:"36개월", feeding:{amount:"우유300ml+3끼+간식",freq:"5회",interval:"4시간"}, sleep:{total:"10~13시간",night:"10~12시간"}, whoWeight:{min:12.0,max:18.3},whoHeight:{min:90,max:104} },
];
const getCur = () => { const m=getMonths(); return [...MILESTONES].sort((a,b)=>b.month-a.month).find(d=>d.month<=m)||MILESTONES[0]; };

// ── 공용 스타일 ───────────────────────────────────────────────────
const S = {
  card:    { background:P.white, borderRadius:16, padding:16, marginBottom:12, border:`1px solid ${P.border}`, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" },
  inp:     { width:"100%", background:P.white, border:`1.5px solid ${P.border}`, borderRadius:10, padding:"10px 14px", fontSize:16, fontFamily:"inherit", color:P.text, outline:"none", boxSizing:"border-box" },
  lbl:     { fontSize:12, color:P.sub, marginBottom:5, display:"block", fontWeight:600, letterSpacing:0.3 },
  secT:    { fontSize:11, fontWeight:700, color:P.sub, marginBottom:12, letterSpacing:1, textTransform:"uppercase" },
  chip:    (a,col=P.accent) => ({ padding:"8px 14px", borderRadius:20, border:`1.5px solid ${a?col:P.border}`, background:a?col+"18":P.white, color:a?col:P.sub, fontWeight:a?700:400, cursor:"pointer", fontSize:13, fontFamily:"inherit", WebkitTapHighlightColor:"transparent" }),
  saveBtn: { width:"100%", padding:"14px", background:P.accent, color:"#fff", border:"none", borderRadius:12, fontWeight:700, fontSize:16, cursor:"pointer", fontFamily:"inherit", marginTop:10, WebkitTapHighlightColor:"transparent" },
  statRow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${P.border}` },
};

// ── 원형 일과표 ───────────────────────────────────────────────────
function DailyCircleChart({ records, date, singleCat }) {
  const size=300, cx=150, cy=150, outerR=130, innerR=76;
  const polar=(r,deg)=>{ const rad=(deg-90)*Math.PI/180; return {x:+(cx+r*Math.cos(rad)).toFixed(2),y:+(cy+r*Math.sin(rad)).toFixed(2)}; };
  const timeToDeg=iso=>{ const d=new Date(iso); return ((d.getHours()*60+d.getMinutes())/1440)*360; };
  const arcPath=(s0,e0,oR,iR)=>{ let s=s0,e=e0; if(e<=s)e+=360; if(e-s>359)e=s+359; const la=(e-s)>180?1:0; const p1=polar(oR,s),p2=polar(oR,e),p3=polar(iR,e),p4=polar(iR,s); return `M${p1.x},${p1.y} A${oR},${oR} 0 ${la} 1 ${p2.x},${p2.y} L${p3.x},${p3.y} A${iR},${iR} 0 ${la} 0 ${p4.x},${p4.y} Z`; };
  const dayRecs=records.filter(r=>(r.start||r.time||"").slice(0,10)===date);
  const arcRecs=dayRecs.filter(r=>r.duration>0);
  const dotRecs=dayRecs.filter(r=>!r.duration||r.duration===0);
  const hourTicks=Array.from({length:12},(_,i)=>i*2);
  const singleColor=singleCat?RT[singleCat]?.color:null;
  const getArcMidLabel=r=>{ const sd=timeToDeg(r.start||r.time),e0=timeToDeg(r.end||r.start||r.time),ed=e0<=sd&&r.duration>5?e0+360:e0; return {midDeg:sd+(ed-sd)/2,label:fmtHHMM(r.start||r.time)}; };
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{maxWidth:size}}>
        <circle cx={cx} cy={cy} r={outerR+4} fill="#F0F2FA"/>
        <circle cx={cx} cy={cy} r={outerR} fill={singleCat?singleColor+"10":"#E8EAF5"}/>
        <circle cx={cx} cy={cy} r={innerR} fill={P.white}/>
        {Array.from({length:24},(_,i)=>{ const deg=i*15,p1=polar(innerR,deg),p2=polar(outerR,deg); return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#D8DCF0" strokeWidth={i%6===0?1.5:0.5}/>; })}
        {arcRecs.map(r=>{ const sd=timeToDeg(r.start||r.time),e0=timeToDeg(r.end||r.start||r.time),ed=e0<=sd&&r.duration>5?e0+360:e0,span=Math.max(singleCat?6:4,ed-sd),col=RT[r.recordType]?.color||P.accent,rOff={feeding:0,sleep:0,diaper:10,playex:5,temp:15,hospital:5},off=singleCat?0:(rOff[r.recordType]||0); return <path key={r.id} d={arcPath(sd,sd+span,outerR-off,innerR+off+2)} fill={col} opacity={0.88}/>; })}
        {dotRecs.map(r=>{ const deg=timeToDeg(r.start||r.time),midR=(outerR+innerR)/2,p=polar(midR,deg),col=RT[r.recordType]?.color||P.accent; return <g key={r.id}><circle cx={p.x} cy={p.y} r={6} fill={col} opacity={0.9}/></g>; })}
        {singleCat&&arcRecs.map(r=>{ const {midDeg,label}=getArcMidLabel(r),p=polar(outerR+18,midDeg); return <text key={"lbl"+r.id} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill={singleColor} fontFamily="inherit" fontWeight="700" opacity={0.9}>{label}</text>; })}
        {singleCat&&dotRecs.map(r=>{ const p=polar(outerR+18,timeToDeg(r.start||r.time)); return <text key={"dlbl"+r.id} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill={singleColor} fontFamily="inherit" fontWeight="700" opacity={0.9}>{fmtHHMM(r.start||r.time)}</text>; })}
        {hourTicks.map(h=>{ const deg=h*15,lp=singleCat?polar(innerR-16,deg):polar(outerR+16,deg); return <text key={h} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={P.sub} fontFamily="inherit" fontWeight="500">{h}</text>; })}
        <text x={cx} y={cy-14} textAnchor="middle" fontSize={10} fill={P.sub} fontFamily="inherit" fontWeight="600" letterSpacing="1">{singleCat?RT[singleCat]?.label:"DAY"}</text>
        <text x={cx} y={cy+6}  textAnchor="middle" fontSize={singleCat?16:22} fill={singleCat?singleColor:P.accent} fontFamily="inherit" fontWeight="800">D+{getDays()}</text>
        {singleCat&&<text x={cx} y={cy+22} textAnchor="middle" fontSize={10} fill={P.sub} fontFamily="inherit">{dayRecs.length}회</text>}
        {!singleCat&&<text x={cx} y={cy+28} textAnchor="middle" fontSize={10} fill={P.sub} fontFamily="inherit">{date}</text>}
      </svg>
      {!singleCat&&<div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center",marginTop:8}}>{Object.entries(RT).filter(([k])=>dayRecs.some(r=>r.recordType===k)).map(([k,v])=>(<div key={k} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:3,background:v.color}}/><span style={{fontSize:11,color:P.sub}}>{v.label}</span></div>))}</div>}
      {singleCat&&dayRecs.length>0&&(
        <div style={{width:"100%",marginTop:12,borderTop:`1px solid ${P.border}`,paddingTop:10}}>
          <div style={{fontSize:11,color:P.sub,fontWeight:600,marginBottom:8,letterSpacing:0.5}}>시간순 기록</div>
          {(()=>{ const sorted=[...dayRecs].sort((a,b)=>new Date(a.start||a.time)-new Date(b.start||b.time)); return sorted.map((r,i)=>{ const prevR=i>0?sorted[i-1]:null,interval=prevR?diffMin(prevR.start||prevR.time,r.start||r.time):null; return (<div key={r.id}>{interval!==null&&interval>0&&<div style={{fontSize:10,color:P.sub,textAlign:"center",padding:"2px 0"}}>↕ {fmtDur(interval)} 간격</div>}<div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${P.border}`}}><div style={{width:7,height:7,borderRadius:"50%",background:singleColor,flexShrink:0}}/><span style={{fontSize:12,fontWeight:700,color:singleColor}}>{fmtHHMM(r.start||r.time)}</span>{r.duration>0&&<span style={{fontSize:11,color:P.sub}}>→ {fmtHHMM(r.end)} ({fmtDur(r.duration)})</span>}{r.amount>0&&<span style={{fontSize:11,color:P.sub}}>{r.amount}ml</span>}{r.subKind&&<span style={{fontSize:11,color:P.sub}}>{r.subKind}{r.foodType?" · "+r.foodType:""}</span>}{r.sleepKind&&<span style={{fontSize:11,color:P.sub}}>{r.sleepKind==="night"?"🌙밤잠":"☀️낮잠"}</span>}{r.diaperKind&&<span style={{fontSize:11,color:P.sub}}>{r.diaperKind}</span>}{r.activity&&<span style={{fontSize:11,color:P.sub}}>{r.activity}</span>}{r.value&&<span style={{fontSize:11,color:P.sub}}>{r.value}°C</span>}</div></div>); }); })()}
        </div>
      )}
    </div>
  );
}

// ── 기록 추가 모달 ────────────────────────────────────────────────
// ── 기록 모달 (추가 + 수정 통합) ──────────────────────────────────
function RecordModal({ initType, initTime, editRec, onClose, onSave, onUpdate, onDelete }) {
  const isEdit = !!editRec;

  const [rtype, setRtype] = useState(editRec?.recordType || initType || "feeding");
  const [startT, setStartT] = useState(
    editRec ? toInput(editRec.start||editRec.time) : toInput(initTime||nowISO())
  );
  const [endT, setEndT] = useState(
    editRec
      ? toInput(editRec.end||editRec.start||editRec.time)
      : toInput(initTime ? new Date(new Date(initTime).getTime()+60*60000).toISOString() : nowISO())
  );

  const [fSubKind, setFSubKind] = useState(editRec?.subKind || "분유");
  const [fAmt,     setFAmt]     = useState(editRec?.amount>0 ? String(editRec.amount) : "");
  const [fFood,    setFFood]    = useState(editRec?.foodType || "");
  const [fNote,    setFNote]    = useState(editRec?.note || "");
  const [sKind,    setSKind]    = useState(editRec?.sleepKind || "nap");
  const [dKind,    setDKind]    = useState(editRec?.diaperKind || "");
  const [dNote,    setDNote]    = useState(editRec?.note || "");
  const [pKind,    setPKind]    = useState(editRec?.activity || "");
  const [tVal,     setTVal]     = useState(editRec?.value ? String(editRec.value) : "36.5");
  const [hType,    setHType]    = useState(editRec?.visitType || "외래");
  const [hReason,  setHReason]  = useState(editRec?.reason || "");
  const [hNote,    setHNote]    = useState(editRec?.note || "");

  const [saved,      setSaved]      = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const isTwoTime = RT[rtype]?.twoTime;
  const startISO  = fromInput(startT);
  const endISO    = fromInput(endT);
  const dur = isTwoTime ? diffMin(startISO, endISO) : 0;

  const canSave = () => {
    if (rtype==="feeding")  return !!(fAmt || fFood || fSubKind);
    if (rtype==="diaper")   return !!dKind;
    if (rtype==="playex")   return !!pKind;
    if (rtype==="hospital") return !!(hReason||hNote);
    return true;
  };

  const save = async () => {
    if (!canSave()) return;
    const base = {
      id: editRec?.id || uid(),
      recordType:rtype, start:startISO,
      end:isTwoTime?endISO:startISO,
      duration:isTwoTime?dur:0, time:startISO
    };
    let rec = base;
    if (rtype==="feeding")       rec={...base,subKind:fSubKind,amount:fAmt?Number(fAmt):0,foodType:fFood,note:fNote};
    else if (rtype==="sleep")    rec={...base,sleepKind:sKind};
    else if (rtype==="diaper")   rec={...base,diaperKind:dKind,note:dNote};
    else if (rtype==="playex")   rec={...base,activity:pKind};
    else if (rtype==="temp")     rec={...base,value:isNaN(parseFloat(tVal))?36.5:parseFloat(tVal)};
    else if (rtype==="hospital") rec={...base,visitType:hType,reason:hReason,note:hNote};
    try {
      if (isEdit) await onUpdate(rec);
      else await onSave(rec);
      setSaved(true);
      setTimeout(()=>{ setSaved(false); if(!isEdit){setFAmt("");setFFood("");setFNote("");setDKind("");setDNote("");setPKind("");setHReason("");setHNote("");} }, 900);
    } catch(e) {
      alert("저장 실패. 인터넷 연결을 확인해주세요.");
    }
  };

  const handleDelete = () => {
    if (confirmDel) { onDelete(editRec.id); onClose(); }
    else setConfirmDel(true);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,29,46,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:P.white,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,padding:"20px 20px 0",paddingBottom:"max(48px, env(safe-area-inset-bottom, 48px))",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 -4px 24px rgba(0,0,0,0.12)",WebkitOverflowScrolling:"touch"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontSize:17,fontWeight:800,color:P.text}}>{isEdit?"기록 수정":"기록 추가"}</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {isEdit && (
              <button onClick={handleDelete} style={{border:"none",borderRadius:10,fontWeight:700,fontSize:12,cursor:"pointer",padding:"6px 14px",height:36,WebkitTapHighlightColor:"transparent",background:confirmDel?"#DC2626":"#FEE2E2",color:confirmDel?"#fff":"#DC2626"}}>
                {confirmDel?"확인 삭제":"삭제"}
              </button>
            )}
            <button onClick={onClose} style={{border:"none",background:P.bg,borderRadius:22,color:P.sub,fontSize:16,cursor:"pointer",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>✕</button>
          </div>
        </div>

        {saved ? (
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:"#E8F8F0",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:26}}>✓</div>
            <div style={{fontSize:15,fontWeight:700,color:"#26C486"}}>{isEdit?"수정 완료":"저장 완료"}</div>
          </div>
        ) : <>

          {/* 카테고리 — 수정 모드는 변경 불가 (잠금) */}
          <div style={{marginBottom:18}}>
            <div style={S.lbl}>카테고리</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {Object.entries(RT).map(([k,v])=>(
                <button key={k}
                  onClick={()=>!isEdit&&setRtype(k)}
                  style={{padding:"12px 4px",borderRadius:14,
                    border:`1.5px solid ${rtype===k?v.color:P.border}`,
                    background:rtype===k?v.color+"14":P.bg,
                    cursor:isEdit?"default":"pointer",
                    fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                    opacity:isEdit&&rtype!==k?0.35:1}}>
                  <span style={{fontSize:22}}>{v.icon}</span>
                  <span style={{fontSize:11,fontWeight:rtype===k?700:400,color:rtype===k?v.color:P.sub}}>{v.label}</span>
                </button>
              ))}
            </div>
            {isEdit && <div style={{fontSize:11,color:P.sub,marginTop:6,textAlign:"center"}}>카테고리는 수정할 수 없습니다</div>}
          </div>

          {/* 수면 상세 먼저 */}
          {rtype==="sleep" && (
            <div style={{marginBottom:14}}>
              <div style={S.lbl}>상세 정보</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setSKind("nap")} style={{...S.chip(sKind==="nap",P.sleep),flex:1}}>☀️ 낮잠</button>
                <button onClick={()=>setSKind("night")} style={{...S.chip(sKind==="night",P.sleep),flex:1}}>🌙 밤잠</button>
              </div>
            </div>
          )}

          {/* 시간 입력 */}
          <div style={{marginBottom:18}}>
            {isTwoTime ? (
              <>
                <div style={{marginBottom:10,maxWidth:280}}>
                  <div style={S.lbl}>시작 시간</div>
                  <input type="datetime-local" value={startT} onChange={e=>setStartT(e.target.value)} style={S.inp}/>
                </div>
                <div style={{marginBottom:8,maxWidth:280}}>
                  <div style={S.lbl}>종료 시간</div>
                  <input type="datetime-local" value={endT} onChange={e=>setEndT(e.target.value)} style={S.inp}/>
                </div>
                {dur>0 && (
                  <div style={{display:"inline-flex",alignItems:"center",gap:6,background:RT[rtype]?.color+"14",borderRadius:20,padding:"5px 14px"}}>
                    <span style={{fontSize:12,color:RT[rtype]?.color,fontWeight:700}}>⏱ {fmtDur(dur)}</span>
                  </div>
                )}
              </>
            ) : (
              <div style={{maxWidth:280}}>
                <div style={S.lbl}>시간</div>
                <input type="datetime-local" value={startT} onChange={e=>setStartT(e.target.value)} style={S.inp}/>
              </div>
            )}
          </div>

          {/* 수유/식사 */}
          {rtype==="feeding" && <>
            <div style={{marginBottom:12}}>
              <div style={S.lbl}>종류</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {["분유","모유","이유식","유아식","간식","과일","음료"].map(k=>(
                  <button key={k} onClick={()=>setFSubKind(k)} style={S.chip(fSubKind===k,P.feeding)}>{k}</button>
                ))}
              </div>
              {(fSubKind==="이유식"||fSubKind==="유아식"||fSubKind==="간식"||fSubKind==="과일"||fSubKind==="음료") && <>
                <div style={S.lbl}>음식 상세</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  {(fSubKind==="이유식"?["쌀미음","야채죽","과일퓨레","닭고기죽","소고기죽","두부죽"]
                    :fSubKind==="유아식"?["밥","국","반찬","면류","빵류","계란"]
                    :fSubKind==="간식"?["요거트","치즈","과자","빵","쌀과자","두부"]
                    :fSubKind==="과일"?["사과","배","바나나","딸기","포도","수박"]
                    :["모유","분유","물","주스","보리차"]
                  ).map(f=>(<button key={f} onClick={()=>setFFood(f)} style={S.chip(fFood===f,P.feeding)}>{f}</button>))}
                </div>
                <input style={{...S.inp,marginBottom:10}} placeholder="직접 입력" value={fFood} onChange={e=>setFFood(e.target.value)}/>
              </>}
              {(fSubKind==="분유"||fSubKind==="모유") && <>
                <div style={S.lbl}>수유량 (ml)</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  {[100,120,140,160,180,200].map(ml=>(
                    <button key={ml} onClick={()=>setFAmt(String(ml))} style={S.chip(fAmt===String(ml),P.feeding)}>{ml}</button>
                  ))}
                </div>
                <input style={{...S.inp,marginBottom:10}} type="number" placeholder="직접 입력 (ml)" value={fAmt} onChange={e=>setFAmt(e.target.value)}/>
              </>}
              {(fSubKind==="이유식"||fSubKind==="유아식"||fSubKind==="간식"||fSubKind==="과일") && <>
                <div style={S.lbl}>양 (선택)</div>
                <input style={{...S.inp,marginBottom:10}} placeholder="예: 80ml, 반 개" value={fAmt} onChange={e=>setFAmt(e.target.value)}/>
              </>}
              <div style={S.lbl}>메모</div>
              <input style={S.inp} placeholder="트림, 사레, 잘 먹음 등" value={fNote} onChange={e=>setFNote(e.target.value)}/>
            </div>
          </>}

          {/* 기저귀/배변 */}
          {rtype==="diaper" && <>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              {["소변","대변","혼합"].map(k=>(
                <button key={k} onClick={()=>setDKind(k)} style={{...S.chip(dKind===k,P.diaper),flex:1}}>
                  {k==="소변"?"💧":k==="대변"?"💩":"🔀"} {k}
                </button>
              ))}
            </div>
            <div style={S.lbl}>메모 (색, 상태)</div>
            <input style={S.inp} placeholder="황금색, 묽음 등" value={dNote} onChange={e=>setDNote(e.target.value)}/>
          </>}

          {/* 놀이/운동 */}
          {rtype==="playex" && <>
            <div style={S.lbl}>활동 종류</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
              {["터미타임","까꿍놀이","책읽기","블록쌓기","그림그리기","모래놀이","물놀이","역할놀이","음악놀이","퍼즐","공놀이","야외놀이","산책","수영","체조","감각놀이"].map(k=>(
                <button key={k} onClick={()=>setPKind(k)} style={S.chip(pKind===k,P.playex)}>{k}</button>
              ))}
            </div>
            <input style={S.inp} placeholder="직접 입력" value={pKind} onChange={e=>setPKind(e.target.value)}/>
          </>}

          {/* 체온 */}
          {rtype==="temp" && <>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
              {["35.8","36.0","36.3","36.5","36.8","37.0","37.5","38.0","38.5","39.0"].map(v=>(
                <button key={v} onClick={()=>setTVal(v)} style={S.chip(tVal===v,parseFloat(v)>=37.5?"#E53E3E":P.temp)}>{v}°</button>
              ))}
            </div>
            <input style={S.inp} type="number" step="0.1" placeholder="직접 입력 (°C)" value={tVal} onChange={e=>setTVal(e.target.value)}/>
            {parseFloat(tVal)>=37.5&&<div style={{marginTop:10,padding:"10px 14px",background:"#FFF5F5",border:"1.5px solid #FCA5A5",borderRadius:10,fontSize:13,color:"#DC2626",fontWeight:600}}>⚠️ 발열 의심 — 소아과 상담 권장</div>}
          </>}

          {/* 병원 */}
          {rtype==="hospital" && <>
            <div style={{marginBottom:12}}>
              <div style={S.lbl}>방문 유형</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {["외래","예방접종","응급","건강검진","기타"].map(k=>(
                  <button key={k} onClick={()=>setHType(k)} style={S.chip(hType===k,P.hospital)}>{k}</button>
                ))}
              </div>
              <div style={S.lbl}>병원 / 이유</div>
              <input style={{...S.inp,marginBottom:10}} placeholder="예: 소아과, 감기, 정기검진" value={hReason} onChange={e=>setHReason(e.target.value)}/>
              <div style={S.lbl}>메모</div>
              <input style={S.inp} placeholder="처방, 의사 소견 등" value={hNote} onChange={e=>setHNote(e.target.value)}/>
            </div>
          </>}

          <button
            style={{...S.saveBtn,background:RT[rtype]?.color||P.accent,opacity:canSave()?1:0.4,cursor:canSave()?"pointer":"default"}}
            onClick={save}>
            {isEdit?"수정 저장":"저장"}
          </button>
        </>}
      </div>
    </div>
  );
}


// ── 타임라인 ──────────────────────────────────────────────────────
function Timeline({ records, onAdd, onEdit, onDelete, selDate }) {
  const scrollRef=useRef(null);
  const hours=Array.from({length:24},(_,i)=>i);
  const isToday=selDate===todayStr();
  const curH=new Date().getHours();
  useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=Math.max(0,(isToday?curH-3:6)*56); },[selDate]);
  const byHour={};
  records.forEach(r=>{ const h=new Date(r.start||r.time).getHours(); if(!byHour[h]) byHour[h]=[]; byHour[h].push(r); });
  const getLabel=r=>{
    if(r.recordType==="feeding")  return `${RT.feeding.icon} ${r.subKind}${r.amount>0?" "+r.amount+"ml":""}${r.foodType?" ("+r.foodType+")":""}${r.duration>0?" · "+fmtDur(r.duration):""}`;
    if(r.recordType==="sleep")    return `${r.sleepKind==="night"?"🌙":"☀️"} ${r.sleepKind==="night"?"밤잠":"낮잠"}${r.duration>0?" · "+fmtDur(r.duration):""}`;
    if(r.recordType==="diaper")   return `${RT.diaper.icon} ${r.diaperKind}`;
    if(r.recordType==="playex")   return `${RT.playex.icon} ${r.activity}${r.duration>0?" · "+fmtDur(r.duration):""}`;
    if(r.recordType==="temp")     return `${RT.temp.icon} ${r.value}°C`;
    if(r.recordType==="hospital") return `${RT.hospital.icon} ${r.visitType} ${r.reason||""}`;
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
          const isCur=isToday&&h===curH,isPast=isToday&&h<curH;
          return (
            <div key={h} style={{display:"flex",minHeight:52,borderBottom:`1px solid ${P.border}`,background:isCur?"#F0F2FF":"transparent"}}>
              <div style={{width:52,flexShrink:0,paddingTop:10,fontSize:11,color:isCur?P.accent:isPast?"#CBD0E0":"#B0B8CC",fontWeight:isCur?700:400,textAlign:"right",paddingRight:10,borderRight:`2px solid ${isCur?P.accent:P.border}`,position:"relative"}}>
                {String(h).padStart(2,"0")}:00
                {isCur&&<div style={{width:6,height:6,background:P.accent,borderRadius:"50%",position:"absolute",right:-4,top:14}}/>}
              </div>
              <div style={{flex:1,padding:"6px 10px",display:"flex",flexDirection:"column",gap:4}}>
                {recs.map(r=>(
                  <div key={r.id} onClick={()=>onEdit(r)} style={{display:"inline-flex",alignItems:"center",gap:5,background:RT[r.recordType]?.color+"14",border:`1.5px solid ${RT[r.recordType]?.color}33`,borderRadius:20,padding:"6px 4px 6px 12px",cursor:"pointer",alignSelf:"flex-start",WebkitTapHighlightColor:"transparent"}}>
                    <span style={{fontSize:11,color:P.sub,fontWeight:500}}>{fmtHHMM(r.start||r.time)}</span>
                    {r.duration>0&&<span style={{fontSize:11,color:P.sub}}>→{fmtHHMM(r.end)}</span>}
                    <span style={{fontSize:13,fontWeight:600,color:RT[r.recordType]?.color}}>{getLabel(r)}</span>
                    <span style={{fontSize:13,color:"#BCC0CC",padding:"0 6px",minWidth:32,display:"flex",alignItems:"center",justifyContent:"center",minHeight:32}}>✏️</span>
                  </div>
                ))}
                {recs.length===0&&<button onClick={()=>onAdd(h)} style={{width:"100%",height:32,border:`1px dashed ${P.border}`,borderRadius:8,background:"none",cursor:"pointer",color:P.border,fontSize:11,fontFamily:"inherit"}}>+ 여기에 기록</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AI 프롬프트 ───────────────────────────────────────────────────
function genPrompt(records, status, from, to) {
  const cur=getCur();
  const days=[]; const d=new Date(from); let safety=0;
  while(d.toISOString().slice(0,10)<=to&&safety++<366){days.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
  const lines=days.map(date=>{
    const dr=records.filter(r=>(r.start||r.time||"").slice(0,10)===date);
    const feeds=dr.filter(r=>r.recordType==="feeding"),sleepR=dr.filter(r=>r.recordType==="sleep"),diapers=dr.filter(r=>r.recordType==="diaper"),plays=dr.filter(r=>r.recordType==="playex"),temps=dr.filter(r=>r.recordType==="temp"),hosps=dr.filter(r=>r.recordType==="hospital");
    const totalFeed=feeds.reduce((a,f)=>a+(f.amount||0),0),nightS=sleepR.filter(s=>s.sleepKind==="night").reduce((a,s)=>a+(s.duration||0),0),napS=sleepR.filter(s=>s.sleepKind==="nap").reduce((a,s)=>a+(s.duration||0),0);
    return `[${date}]\n수유/식사: ${feeds.length}회 총${totalFeed}ml 평균${feeds.length?Math.round(totalFeed/feeds.length):0}ml\n  ${feeds.map(f=>`${fmtHHMM(f.start)}~${fmtHHMM(f.end)} ${f.subKind}${f.amount>0?" "+f.amount+"ml":""}${f.foodType?" ("+f.foodType+")":""}${f.duration>0?" "+fmtDur(f.duration):""}`).join(" / ")||"없음"}\n수면: 밤잠 ${nightS>0?fmtDur(nightS):"없음"} / 낮잠 ${napS>0?fmtDur(napS):"없음"} / 총 ${fmtDur(nightS+napS)||"없음"}\n  ${sleepR.map(s=>`${fmtHHMM(s.start)}~${fmtHHMM(s.end)} ${s.sleepKind==="night"?"밤잠":"낮잠"}${s.duration>0?" "+fmtDur(s.duration):""}`).join(" / ")||"없음"}\n기저귀: 소변${diapers.filter(d=>d.diaperKind==="소변"||d.diaperKind==="혼합").length}회 대변${diapers.filter(d=>d.diaperKind==="대변"||d.diaperKind==="혼합").length}회\n${plays.length?`놀이/운동: ${plays.map(p=>`${p.activity}${p.duration>0?" "+fmtDur(p.duration):""}`).join(", ")}`:""}\n${temps.length?`체온: ${temps.map(t=>t.value+"°C").join("→")}`:""}\n${hosps.length?`병원: ${hosps.map(h=>`${h.visitType} ${h.reason||""}`).join(", ")}`:""}`
  }).join("\n\n");
  return `[Ronan 성장 데이터 리포트]\n아기: Ronan(김강린) / 2026-03-07\n생후: ${getDays()}일 (${getMonths()}개월 / ${getWeeks()}주)\n기간: ${from} ~ ${to} (${days.length}일)\n체중: ${status.weight||"미입력"}g / 신장: ${status.height||"미입력"}cm\n\n[기준: ${cur.label}]\n수유 ${cur.feeding.amount} / ${cur.feeding.freq} / 간격${cur.feeding.interval}\n수면 총${cur.sleep.total} / 밤잠${cur.sleep.night}\nWHO 체중 ${cur.whoWeight.min}~${cur.whoWeight.max}kg\n\n[일별 기록]\n${lines}\n\n[특이사항] ${status.notes||"없음"}\n[요청 목적] (분석 목적을 추가하세요)`;
}

// ── 탭 정의 ──────────────────────────────────────────────────────
const TABS=[{key:"타임라인",icon:"📅",label:"타임라인"},{key:"발달",icon:"🌱",label:"발달"},{key:"성장",icon:"📊",label:"성장"},{key:"리포트",icon:"📋",label:"리포트"}];

// ── 메인 앱 ──────────────────────────────────────────────────────
export default function App() {
  // ── Firebase 상태 ─────────────────────────────────────────────
  const [records,     setRecords]     = useState([]);
  const [status,      setStatus]      = useState({weight:"",height:"",notes:""});
  const [statusInput, setStatusInput] = useState({weight:"",height:"",notes:""});
  const [fbLoading,   setFbLoading]   = useState(true);

  // ── 로컬 UI 상태 ──────────────────────────────────────────────
  const [tab,         setTab]         = useState("타임라인");
  const [showModal,    setShowModal]    = useState(false);
  const [editRec,      setEditRec]      = useState(null); // 수정 대상 기록
  const [modalInitType,setModalInitType]=useState(null);
  const [modalInitTime,setModalInitTime]=useState(null);
  const [selDate,     setSelDate]     = useState(todayStr());
  const [devView,     setDevView]     = useState("current");
  const [selMonth,    setSelMonth]    = useState(null);
  const [reportFrom,  setReportFrom]  = useState(()=>{const d=new Date();d.setDate(d.getDate()-6);return d.toISOString().slice(0,10);});
  const [reportTo,    setReportTo]    = useState(todayStr());
  const [copied,      setCopied]      = useState(false);
  const [showPrompt,  setShowPrompt]  = useState(false);
  const promptRef=useRef(null);
  const [reportCat,   setReportCat]   = useState(null);
  const [chartDate,   setChartDate]   = useState(todayStr());
  const [chartCat,    setChartCat]    = useState(null);

  // ── Firebase 실시간 구독 (records) ────────────────────────────
  // push()로 저장하므로 각 기록이 독립된 키 → 동시 입력 충돌 없음
  useEffect(()=>{
    const recRef=ref(db,"records");
    const unsub=onValue(recRef,(snap)=>{
      const val=snap.val();
      if(val){
        const arr=Object.entries(val).map(([fbKey,rec])=>({...rec,id:fbKey}));
        setRecords(arr);
      } else {
        setRecords([]);
      }
      setFbLoading(false);
    });
    return ()=>unsub();
  },[]);

  // ── Firebase 실시간 구독 (status) ─────────────────────────────
  useEffect(()=>{
    const stRef=ref(db,"status");
    const unsub=onValue(stRef,(snap)=>{
      const val=snap.val();
      if(val){
        setStatus(val);
        setStatusInput(val);
      }
    });
    return ()=>unsub();
  },[]);

  // ── 기록 추가: push()로 고유 키 자동 생성 → 충돌 없음 ────────
  const addRecord = async (rec) => {
    try {
      const recRef=ref(db,"records");
      const { id, ...recWithoutId } = rec; // id는 fbKey가 대신함
      await push(recRef, recWithoutId);
    } catch(e) {
      alert("저장 실패: 인터넷 연결을 확인해주세요.");
    }
  };

  // ── 기록 삭제: 해당 키만 삭제 ────────────────────────────────
  const delRecord = async (id) => {
    if(!window.confirm("이 기록을 삭제할까요?")) return;
    try {
      await remove(ref(db,`records/${id}`));
    } catch(e) {
      alert("삭제 실패: 인터넷 연결을 확인해주세요.");
    }
  };

  // ── 기록 수정: set()으로 해당 키 덮어쓰기 ────────────────────
  const updateRecord = async (rec) => {
    try {
      await set(ref(db,`records/${rec.id}`), rec);
    } catch(e) {
      alert("수정 실패: 인터넷 연결을 확인해주세요.");
    }
  };

  // 수정 모달 열기
  const openEdit = rec => {
    setEditRec(rec);
    setModalInitType(null);
    setModalInitTime(null);
    setShowModal(true);
  };

  // ── 성장 데이터 저장: set()으로 덮어쓰기 ────────────────────
  const saveStatus = async () => {
    try {
      await set(ref(db,"status"), statusInput);
      setStatus(statusInput);
    } catch(e) {
      alert("저장 실패: 인터넷 연결을 확인해주세요.");
    }
  };

  // ── 모달 열기 ─────────────────────────────────────────────────
  const openModal = (hour, type=null) => {
    if (hour !== null && hour !== undefined) {
      const pad = n => String(n).padStart(2,"0");
      setModalInitTime(new Date(selDate+"T"+pad(hour)+":00").toISOString());
    } else {
      setModalInitTime(
        isToday ? null : new Date(selDate+"T12:00:00").toISOString()
      );
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
    if(next <= todayStr()) setSelDate(next);
  };
  const isToday = selDate===todayStr();

  const dayRecs=records.filter(r=>(r.start||r.time||"").slice(0,10)===selDate).sort((a,b)=>new Date(a.start||a.time)-new Date(b.start||b.time));
  const todayR=records.filter(r=>(r.start||r.time||"").slice(0,10)===todayStr());
  const todayF=todayR.filter(r=>r.recordType==="feeding");
  const todayS=todayR.filter(r=>r.recordType==="sleep");
  const todayFml=todayF.reduce((a,f)=>a+(f.amount||0),0);
  const todaySmin=todayS.reduce((a,s)=>a+(s.duration||0),0);
  const lastTemp=[...todayR.filter(r=>r.recordType==="temp")].sort((a,b)=>new Date(b.time)-new Date(a.time))[0];
  const lastFeed=[...todayR.filter(r=>r.recordType==="feeding")].sort((a,b)=>new Date(b.start||b.time)-new Date(a.start||a.time))[0];
  const lastFeedMinsAgo=lastFeed?Math.max(0,Math.round((Date.now()-new Date(lastFeed.start||lastFeed.time))/60000)):null;

  const cur=getCur(); const mo=getMonths();
  const selM=selMonth!==null?(MILESTONES.find(m=>m.month===selMonth)||cur):cur;

  const copyPrompt=()=>{
    const text=genPrompt(records,status,reportFrom,reportTo);
    setShowPrompt(true);
    if(navigator.clipboard&&window.isSecureContext){
      navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),3000);}).catch(()=>setCopied(false));
    }
    setTimeout(()=>{ if(promptRef.current){promptRef.current.select();promptRef.current.setSelectionRange(0,99999);} },100);
  };

  const reportRecs=records.filter(r=>(r.start||r.time||"").slice(0,10)>=reportFrom&&(r.start||r.time||"").slice(0,10)<=reportTo);
  const catFilter={feeding:r=>r.recordType==="feeding",sleep:r=>r.recordType==="sleep",diaper:r=>r.recordType==="diaper",playex:r=>r.recordType==="playex",temp:r=>r.recordType==="temp",hospital:r=>r.recordType==="hospital"};
  const filteredRecs=reportCat?reportRecs.filter(catFilter[reportCat]||(_=>true)):reportRecs;

  const getReportLabel=r=>{
    if(r.recordType==="feeding")  return `${RT.feeding.icon} ${r.subKind}${r.amount>0?" "+r.amount+"ml":""}${r.foodType?" ("+r.foodType+")":""}${r.duration>0?" · "+fmtDur(r.duration):""}`;
    if(r.recordType==="sleep")    return `${r.sleepKind==="night"?"🌙":"☀️"} ${r.sleepKind==="night"?"밤잠":"낮잠"}${r.duration>0?" · "+fmtDur(r.duration):""}`;
    if(r.recordType==="diaper")   return `${RT.diaper.icon} ${r.diaperKind}${r.note?" ("+r.note+")":""}`;
    if(r.recordType==="playex")   return `${RT.playex.icon} ${r.activity}${r.duration>0?" · "+fmtDur(r.duration):""}`;
    if(r.recordType==="temp")     return `${RT.temp.icon} ${r.value}°C`;
    if(r.recordType==="hospital") return `${RT.hospital.icon} ${r.visitType} ${r.reason||""}${r.note?" — "+r.note:""}`;
    return "";
  };

  // ── 로딩 화면 ─────────────────────────────────────────────────
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
        onSave={addRecord} onUpdate={updateRecord} onDelete={delRecord}
      />}

      {/* 헤더 */}
      <div style={{background:P.white,padding:"18px 20px 14px",borderBottom:`1px solid ${P.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:11,color:P.accent,letterSpacing:2,fontWeight:700,marginBottom:3}}>RONAN PROJECT</div>
            <div style={{fontSize:20,fontWeight:800,letterSpacing:-0.5,color:P.text}}>Ronan 성장 트래커</div>
            <div style={{fontSize:11,color:P.sub,marginTop:3}}>D+{getDays()} · {getWeeks()}W · {mo}M</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:P.sub,marginBottom:3}}>TODAY</div>
            <div style={{fontSize:12,color:P.feeding,fontWeight:600}}>🍼 {todayF.length}회 {todayFml}ml</div>
            <div style={{fontSize:12,color:P.sleep,fontWeight:600}}>😴 {fmtDur(todaySmin)||"0m"}</div>
            {lastTemp&&<div style={{fontSize:12,fontWeight:600,color:lastTemp.value>=37.5?"#DC2626":P.temp}}>🌡️ {lastTemp.value}°C</div>}
          </div>
        </div>
      </div>

      {/* 탭 */}
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
                {isToday&&lastFeed&&<div style={{fontSize:11,color:P.feeding,fontWeight:600,marginTop:2}}>마지막 수유/식사: {fmtHHMM(lastFeed.start||lastFeed.time)}{lastFeedMinsAgo!==null&&` (${lastFeedMinsAgo<60?lastFeedMinsAgo+"분 전":Math.floor(lastFeedMinsAgo/60)+"시간 "+lastFeedMinsAgo%60+"분 전"})`}</div>}
                {isToday&&!lastFeed&&<div style={{fontSize:11,color:P.sub,marginTop:2}}>마지막 수유/식사: 없음</div>}
                <div style={{fontSize:11,color:P.sub,marginTop:1}}>🍼{dayRecs.filter(r=>r.recordType==="feeding").length} &nbsp;😴{fmtDur(dayRecs.filter(r=>r.recordType==="sleep").reduce((a,s)=>a+(s.duration||0),0))||"0m"} &nbsp;{RT.diaper.icon}{dayRecs.filter(r=>r.recordType==="diaper").length}</div>
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
          {devView==="timeline"&&<div style={{position:"relative",paddingLeft:20}}>
            <div style={{position:"absolute",left:8,top:0,bottom:0,width:2,background:P.border}}/>
            {MILESTONES.map(m=>(
              <div key={m.month} style={{marginBottom:8,paddingLeft:22,position:"relative"}}>
                <div style={{position:"absolute",left:-5,top:14,width:10,height:10,borderRadius:"50%",background:m.month<=mo?P.accent:P.white,border:`2px solid ${m.month<=mo?P.accent:P.border}`}}/>
                <button onClick={()=>{setSelMonth(m.month);setDevView("detail");}} style={{width:"100%",textAlign:"left",background:m.month===mo?P.accent+"10":P.white,border:`1px solid ${m.month<=mo?P.accent+"40":P.border}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><div style={{fontSize:13,fontWeight:700,color:m.month<=mo?P.text:P.sub}}>{m.label}</div><div style={{fontSize:11,color:P.sub,marginTop:2}}>{m.feeding.amount} · 수면 {m.sleep.total}</div></div>
                    <span style={{fontSize:12,color:m.month<=mo?P.accent:P.border}}>{m.month<=mo?"✓":"›"}</span>
                  </div>
                </button>
              </div>
            ))}
          </div>}
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

        {/* ── 성장 ── */}
        {tab==="성장"&&<>
          <div style={S.card}>
            <div style={S.secT}>측정값 입력</div>
            <div style={{marginBottom:10}}><div style={S.lbl}>체중 (g)</div><input style={S.inp} type="number" placeholder="예: 4800" value={statusInput.weight||""} onChange={e=>setStatusInput(s=>({...s,weight:e.target.value}))}/></div>
            <div style={{marginBottom:10}}><div style={S.lbl}>신장 (cm)</div><input style={S.inp} type="number" placeholder="예: 56.5" value={statusInput.height||""} onChange={e=>setStatusInput(s=>({...s,height:e.target.value}))}/></div>
            <div style={{marginBottom:10}}><div style={S.lbl}>특이사항</div><textarea value={statusInput.notes||""} onChange={e=>setStatusInput(s=>({...s,notes:e.target.value}))} placeholder="예방접종, 외출, 발달 특이사항 등" style={{...S.inp,minHeight:72,resize:"vertical"}}/></div>
            <button style={S.saveBtn} onClick={saveStatus}>저장</button>
          </div>
          <div style={S.card}>
            <div style={S.secT}>WHO 비교 — {mo}개월</div>
            <div style={S.statRow}><span style={{color:P.sub}}>WHO 체중 기준</span><span style={{fontWeight:700}}>{cur.whoWeight.min}~{cur.whoWeight.max} kg</span></div>
            <div style={S.statRow}><span style={{color:P.sub}}>Ronan 체중</span><span style={{fontWeight:700,color:P.accent}}>{status.weight?`${(Number(status.weight)/1000).toFixed(2)} kg`:"미입력"}</span></div>
            <div style={S.statRow}><span style={{color:P.sub}}>WHO 신장 기준</span><span style={{fontWeight:700}}>{cur.whoHeight.min}~{cur.whoHeight.max} cm</span></div>
            <div style={{...S.statRow,borderBottom:"none"}}><span style={{color:P.sub}}>Ronan 신장</span><span style={{fontWeight:700,color:P.accent}}>{status.height?`${status.height} cm`:"미입력"}</span></div>
            {status.weight&&(()=>{const kg=Number(status.weight)/1000,ok=kg>=cur.whoWeight.min&&kg<=cur.whoWeight.max;return <div style={{marginTop:12,padding:"10px 14px",background:ok?"#F0FFF4":"#FFF5F5",border:`1.5px solid ${ok?"#86EFAC":"#FCA5A5"}`,borderRadius:10,fontSize:13,fontWeight:600,color:ok?"#16A34A":"#DC2626"}}>{ok?"✓ 체중 정상 범위":"⚠ 범위 확인 필요 — 소아과 상담 권장"}</div>})()}
          </div>
        </>}

        {/* ── 리포트 ── */}
        {tab==="리포트"&&<>
          {/* 일과표 */}
          <div style={S.card}>
            <div style={{...S.secT,marginBottom:10}}>일과표</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {[{key:null,icon:"◉",label:"전체",col:P.accent},{key:"feeding",icon:RT.feeding.icon,label:"수유/식사",col:P.feeding},{key:"sleep",icon:RT.sleep.icon,label:"수면",col:P.sleep},{key:"diaper",icon:RT.diaper.icon,label:"기저귀/배변",col:P.diaper},{key:"playex",icon:RT.playex.icon,label:"놀이/운동",col:P.playex},{key:"temp",icon:RT.temp.icon,label:"체온",col:P.temp},{key:"hospital",icon:RT.hospital.icon,label:"병원",col:P.hospital}].map(c=>(
                <button key={String(c.key)} onClick={()=>setChartCat(c.key)} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:20,border:`1.5px solid ${chartCat===c.key?c.col:P.border}`,background:chartCat===c.key?c.col+"18":P.white,color:chartCat===c.key?c.col:P.sub,fontWeight:chartCat===c.key?700:400,cursor:"pointer",fontSize:12,fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>
                  <span style={{fontSize:14}}>{c.icon}</span><span>{c.label}</span>
                </button>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <button onClick={()=>{const d=new Date(chartDate+"T12:00:00");d.setDate(d.getDate()-1);setChartDate(d.toISOString().slice(0,10));}} style={{border:"none",background:P.bg,borderRadius:22,color:P.accent,fontSize:18,cursor:"pointer",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>‹</button>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:P.text}}>{chartDate===todayStr()?"오늘":chartDate}</div>
                <div style={{fontSize:11,color:P.sub,marginTop:1}}>{(()=>{ const base=records.filter(r=>(r.start||r.time||"").slice(0,10)===chartDate),shown=chartCat?base.filter(r=>r.recordType===chartCat):base; return `${shown.length}개 기록${chartCat?" ("+RT[chartCat]?.label+")":""}`; })()}</div>
              </div>
              <button onClick={()=>{const d=new Date(chartDate+"T12:00:00");d.setDate(d.getDate()+1);const next=d.toISOString().slice(0,10);if(next<=todayStr())setChartDate(next);}} style={{border:"none",background:P.bg,borderRadius:22,color:chartDate===todayStr()?"#E0E4EF":P.accent,fontSize:18,cursor:"pointer",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}} disabled={chartDate===todayStr()}>›</button>
            </div>
            <DailyCircleChart records={chartCat?records.filter(r=>r.recordType===chartCat):records} date={chartDate} singleCat={chartCat}/>
          </div>

          {/* AI 분석 데이터 */}
          <div style={S.card}>
            <div style={S.secT}>AI 분석 데이터</div>
            <div style={{marginBottom:12}}>
              <div style={{marginBottom:10,maxWidth:200}}><div style={S.lbl}>시작일</div><input type="date" value={reportFrom} onChange={e=>{setReportFrom(e.target.value);setShowPrompt(false);setCopied(false);}} style={S.inp}/></div>
              <div style={{maxWidth:200}}><div style={S.lbl}>종료일</div><input type="date" value={reportTo} onChange={e=>{setReportTo(e.target.value);setShowPrompt(false);setCopied(false);}} style={S.inp}/></div>
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
                <textarea ref={promptRef} readOnly value={genPrompt(records,status,reportFrom,reportTo)} style={{width:"100%",height:240,border:`1.5px solid ${P.border}`,borderRadius:10,padding:"10px 12px",fontSize:11,fontFamily:"monospace",color:P.text,background:"#FAFAFA",lineHeight:1.6,resize:"none",boxSizing:"border-box",WebkitUserSelect:"all",userSelect:"all"}} onClick={e=>{e.target.select();e.target.setSelectionRange(0,99999);}}/>
                <div style={{fontSize:11,color:P.sub,marginTop:6,textAlign:"center"}}>텍스트를 탭하면 전체 선택됩니다</div>
              </div>
            )}
          </div>

          {/* 카테고리별 기록 */}
          <div style={S.card}>
            <div style={S.secT}>카테고리별 기록 보기</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
              {[{key:null,icon:"📋",label:"전체"},{key:"feeding",icon:RT.feeding.icon,label:"수유/식사"},{key:"sleep",icon:RT.sleep.icon,label:"수면"},{key:"diaper",icon:RT.diaper.icon,label:"기저귀/배변"},{key:"playex",icon:RT.playex.icon,label:"놀이/운동"},{key:"temp",icon:RT.temp.icon,label:"체온"},{key:"hospital",icon:RT.hospital.icon,label:"병원"}].map(c=>(
                <button key={String(c.key)} onClick={()=>setReportCat(c.key)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"10px 14px",borderRadius:14,border:`1.5px solid ${reportCat===c.key?(c.key?RT[c.key]?.color:P.accent):P.border}`,background:reportCat===c.key?(c.key?RT[c.key]?.color+"14":P.accent+"14"):P.white,cursor:"pointer",fontFamily:"inherit",minWidth:56,WebkitTapHighlightColor:"transparent"}}>
                  <span style={{fontSize:22}}>{c.icon}</span>
                  <span style={{fontSize:10,fontWeight:reportCat===c.key?700:400,color:reportCat===c.key?(c.key?RT[c.key]?.color:P.accent):P.sub}}>{c.label}</span>
                </button>
              ))}
            </div>
            {filteredRecs.length===0
              ? <div style={{textAlign:"center",color:P.sub,fontSize:13,padding:"20px 0"}}>해당 기간의 기록이 없습니다</div>
              : [...filteredRecs].sort((a,b)=>new Date(b.start||b.time)-new Date(a.start||a.time)).map(r=>(
                  <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${P.border}`}}>
                    <div style={{width:38,height:38,borderRadius:10,background:RT[r.recordType]?.color+"14",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{RT[r.recordType]?.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:RT[r.recordType]?.color}}>{getReportLabel(r)}</div>
                      <div style={{fontSize:11,color:P.sub,marginTop:1}}>{fmtDateKR(r.start||r.time)} {fmtHHMM(r.start||r.time)}{r.duration>0?` ~ ${fmtHHMM(r.end)}`:""}</div>
                    </div>
                  </div>
                ))
            }
          </div>
        </>}
      </div>
    </div>
  );
}
