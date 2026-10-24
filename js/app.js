/* ระบบปฏิทินการศึกษาและแผนปฏิบัติงาน · พัฒนาโดย ครูซอสสอนสังคม 2569 */
import { firebaseConfig, EMAIL_DOMAIN } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot, query, orderBy as fbOrderBy, limit as fbLimit, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ===== Firebase ===== */
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const fs = getFirestore(fbApp);
let secAuth = null; /* second Auth instance: lets the main admin create accounts without being signed out */
const secondaryAuth = () => secAuth || (secAuth = getAuth(initializeApp(firebaseConfig, "secondary")));
const toEmail = u => { u = String(u || "").trim().toLowerCase(); return u.includes("@") ? u : `${u}@${EMAIL_DOMAIN}`; };
const okUsername = u => /^[a-z0-9._-]{3,30}$/.test(u);

/* Firestore adapter: same small API the app was written against (doc / collection / onSnapshot) */
const wrapDoc = s => ({ id: s.id, exists: s.exists(), data: () => s.data() });
function dref(p) { const r = doc(fs, p); return { id: r.id, path: p,
  get: () => getDoc(r).then(wrapDoc), set: d => setDoc(r, d), update: d => updateDoc(r, d), delete: () => deleteDoc(r),
  onSnapshot: (n, e) => onSnapshot(r, s => n(wrapDoc(s)), e) }; }
function cref(p, cons = []) { const c = collection(fs, p); const q = () => cons.length ? query(c, ...cons) : c; return { path: p,
  doc: id => dref(`${p}/${id || doc(c).id}`), add: d => addDoc(c, d),
  orderBy: (f, d) => cref(p, [...cons, fbOrderBy(f, d || "asc")]), limit: n => cref(p, [...cons, fbLimit(n)]),
  get: () => getDocs(q()).then(s => ({ docs: s.docs.map(wrapDoc), size: s.size, empty: s.empty })),
  onSnapshot: (n, e) => onSnapshot(q(), s => n({ docs: s.docs.map(wrapDoc), size: s.size, empty: s.empty }), e) }; }
const DB = { doc: dref, collection: p => cref(p) };

/* browser download (replaces the artifact download capability) */
async function saveBlob({ filename, data }) {
  const type = filename.endsWith(".pdf") ? "application/pdf" : filename.endsWith(".png") ? "image/png" : filename.endsWith(".zip") ? "application/zip" : "application/octet-stream";
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000); return { status: "saved" };
}

(function(){
"use strict";
/* ================= constants ================= */
const MONTHS=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const MSH=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const DOW=["อา","จ","อ","พ","พฤ","ศ","ส"];
const DOWF=["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
const HTYPES={holiday:"วันหยุดราชการ",special:"วันหยุดพิเศษ",makeup:"วันเรียนชดเชย"};
const DIVS={academic:"บริหารงานวิชาการ",general:"บริหารงานทั่วไป",personnel:"บริหารงานบุคคล",budget:"บริหารงบประมาณ"};
const ROLE_LABEL={main:"แอดมินหลัก",school:"แอดมินโรงเรียน",teacher:"ครู/บุคลากร"};
const RANK={teacher:0,school:1,main:2};
const DEF_SYS="ระบบปฏิทินการศึกษาและแผนปฏิบัติงาน";
const I={
 home:'<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
 grid:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9 4.5v15M15 4.5v15"/>',
 cal:'<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
 ops:'<circle cx="12" cy="5.5" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="12" cy="18" r="2.2"/><circle cx="19" cy="18" r="2.2"/><path d="M12 7.7V12M5 15.8V12h14v3.8M12 12v3.8"/>',
 list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
 hol:'<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v4M10 15h4"/>',
 users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.8-3.2 3.2-5 6-5s5.2 1.8 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.2c2.2.2 3.8 1.8 4.5 4.3"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z"/>',
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
 restore:'<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
 print:'<path d="M7 9V3h10v6"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
 close:'<path d="M6 6l12 12M18 6L6 18"/>',
 chevl:'<path d="M15 6l-6 6 6 6"/>', chevr:'<path d="M9 6l6 6-6 6"/>',
 trashbin:'<path d="M4 7h16M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
 eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
};
const ic=(n,cls="i")=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]||""}</svg>`;
const ROUTES=[
 {id:"home",label:"ภาพรวม",icon:"home",group:"ปฏิทินการศึกษา",sub:"สถานะวันเรียนและกำหนดการที่กำลังจะถึง"},
 {id:"days",label:"ตารางวันเรียน Day 1–200",short:"200 วัน",icon:"grid",group:"ปฏิทินการศึกษา",sub:"ลำดับวันทำการเรียนสะสมตลอดปีการศึกษา"},
 {id:"term1",label:"ปฏิทินภาคเรียนที่ 1",short:"ภาค 1",icon:"cal",group:"ปฏิทินการศึกษา",sub:"ปฏิทินการจัดการเวลาเรียนรายเดือน"},
 {id:"term2",label:"ปฏิทินภาคเรียนที่ 2",short:"ภาค 2",icon:"cal",group:"ปฏิทินการศึกษา",sub:"ปฏิทินการจัดการเวลาเรียนรายเดือน"},
 {id:"ops",label:"แผนปฏิบัติงาน 4 ฝ่าย",short:"4 ฝ่าย",icon:"ops",group:"ปฏิทินการศึกษา",sub:"วิชาการ · ทั่วไป · บุคคล · งบประมาณ"},
 {id:"holidays",label:"วันหยุด / วันเรียนชดเชย",icon:"hol",group:"จัดการข้อมูล",sub:"ค้นหา เพิ่ม แก้ไขวันหยุดและวันชดเชย"},
 {id:"plans",label:"รายการแผนงาน 4 ฝ่าย",icon:"list",group:"จัดการข้อมูล",sub:"ค้นหา เพิ่ม แก้ไขงานของแต่ละฝ่าย"},
 {id:"trash",label:"ถังขยะ",icon:"trashbin",group:"จัดการข้อมูล",sub:"รายการที่ถูกลบ กู้คืนได้"},
 {id:"people",label:"ผู้ใช้งานและประวัติ",icon:"users",group:"ผู้ดูแลระบบ",sub:"จัดการผู้ใช้ บทบาท และประวัติการแก้ไข",min:"school"},
 {id:"setup",label:"ตั้งค่า / ปีการศึกษา",icon:"gear",group:"ผู้ดูแลระบบ",sub:"ข้อมูลโรงเรียน ภาคเรียน และปีการศึกษา",min:"school"}
];

/* ================= state ================= */
const S={users:[],bootstrapped:false,bootChecked:false,authChecked:false,settingUp:false,loginErr:"",connErr:false,gateMode:"",sysDoc:{},schoolDoc:{},yearsDocs:{},holidays:[],plans:[],audit:[],loaded:{sys:false,school:false,years:false,h:false,p:false},
  db:null,user:null,downloads:null,dbChecked:false,realRole:"teacher",viewAs:null,uid:null,me:null,route:"home",
  viewYear:null,yearPinned:false,opsTerm:null,hSearch:"",pSearch:"",names:{},cfg:null,setupDirty:false};
let prefs={opsDivs:Object.keys(DIVS),pDivs:Object.keys(DIVS),hTypes:Object.keys(HTYPES),uRoles:["main","school","teacher"]};
try{const p=JSON.parse(localStorage.getItem("acal2")||"null");if(p)prefs={...prefs,...p};}catch(e){}
try{const y=+localStorage.getItem("acal-year");if(y>2500){S.viewYear=y;S.yearPinned=true;}}catch(e){}
function savePrefs(){try{localStorage.setItem("acal2",JSON.stringify(prefs));}catch(e){}}
const role=()=>S.viewAs||S.realRole;
const canWrite=()=>RANK[role()]>=1&&!!S.db;
const isMain=()=>role()==="main"&&!!S.db;
try{const h=(location.hash||"").slice(1);if(ROUTES.some(r=>r.id===h))S.route=h;}catch(e){}

/* ================= dates ================= */
const toD=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(Date.UTC(y,m-1,d));};
const iso=d=>d.toISOString().slice(0,10);
const add=(s,n)=>{const d=toD(s);d.setUTCDate(d.getUTCDate()+n);return iso(d);};
const diff=(a,b)=>Math.round((toD(b)-toD(a))/864e5);
const TODAY=(()=>{const n=new Date();return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0");})();
const be=y=>y+543;
const ymOf=s=>s.slice(0,7);
const dnum=s=>toD(s).getUTCDate();
const fLong=s=>{const d=toD(s);return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${be(d.getUTCFullYear())}`;};
const fShort=s=>{const d=toD(s);return `${d.getUTCDate()} ${MSH[d.getUTCMonth()]}`;};
const fShortY=s=>{const d=toD(s);return `${d.getUTCDate()} ${MSH[d.getUTCMonth()]} ${String(be(d.getUTCFullYear())).slice(2)}`;};
const ymLabel=ym=>{const[y,m]=ym.split("-").map(Number);return `${MONTHS[m-1]} ${be(y)}`;};
const ymShort=ym=>{const[y,m]=ym.split("-").map(Number);return `${MSH[m-1]} ${String(be(y)).slice(2)}`;};
function fRange(a,b,short){ if(!b||a===b) return short?fShort(a):fLong(a);
  const A=toD(a),B=toD(b); if(A.getUTCMonth()===B.getUTCMonth()&&A.getUTCFullYear()===B.getUTCFullYear()) return short?`${A.getUTCDate()}–${B.getUTCDate()} ${MSH[B.getUTCMonth()]}`:`${A.getUTCDate()}–${B.getUTCDate()} ${MONTHS[B.getUTCMonth()]} ${be(B.getUTCFullYear())}`;
  return short?`${fShort(a)} – ${fShort(b)}`:`${fLong(a)} – ${fLong(b)}`; }
function monthsBetween(a,b){const out=[];let y=+a.slice(0,4),m=+a.slice(5,7);const ey=+b.slice(0,4),em=+b.slice(5,7);while(y<ey||(y===ey&&m<=em)){out.push(`${y}-${String(m).padStart(2,"0")}`);m++;if(m>12){m=1;y++;}}return out;}
const daysIn=ym=>{const[y,m]=ym.split("-").map(Number);return new Date(Date.UTC(y,m,0)).getUTCDate();};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const onOrAfter=(s,dow)=>{let d=s;for(let i=0;i<7;i++){if(toD(d).getUTCDay()===dow)return d;d=add(d,1);}return s;};
const onOrBefore=(s,dow)=>{let d=s;for(let i=0;i<7;i++){if(toD(d).getUTCDay()===dow)return d;d=add(d,-1);}return s;};
/* academic year of a date: 1 Apr – 31 Mar */
const yearOf=d=>{const g=+d.slice(0,4);return d.slice(5)>="04-01"?g+543:g+542;};

/* ================= config ================= */
function defaultsFor(Y){const g=Y-543;return{t1Start:onOrAfter(`${g}-05-16`,1),t1End:onOrBefore(`${g}-10-10`,5),t2Start:onOrAfter(`${g}-11-01`,1),t2End:`${g+1}-03-31`};}
function baseYear(){return +(S.sysDoc.currentYear||S.schoolDoc.year||yearOf(TODAY));}
/* the year moves on by itself once the set year has ended and the next year has been opened */
function currentYear(){let y=baseYear();for(let i=0;i<3;i++){if(S.yearsDocs[y+1]&&TODAY>yearCfg(y).t2End)y++;else break;}return y;}
function termStatus(){const Y=currentYear();const c=yearCfg(Y);
  if(TODAY<c.t1Start)return{t:0,label:"ก่อนเปิดภาคเรียนที่ 1",short:"ก่อนเปิดภาค",next:c.t1Start,nextLabel:"เปิดภาคเรียนที่ 1",Y,c};
  if(TODAY<=c.t1End)return{t:1,label:"ภาคเรียนที่ 1",short:"ภาคเรียนที่ 1",Y,c};
  if(TODAY<c.t2Start)return{t:0,label:"ปิดภาคเรียนระหว่างภาค",short:"ปิดภาคเรียน",next:c.t2Start,nextLabel:"เปิดภาคเรียนที่ 2",Y,c};
  if(TODAY<=c.t2End)return{t:2,label:"ภาคเรียนที่ 2",short:"ภาคเรียนที่ 2",Y,c};
  return{t:0,label:"ปิดภาคเรียนปลายปี",short:"ปิดภาคเรียน",Y,c};}
function logoHTML(){const l=S.schoolDoc&&S.schoolDoc.logoData;return `<span class="seal has-img"><img src="${l?esc(l):"assets/logo.png"}" alt="โลโก้"></span>`;}
function yearCfg(Y){const d=S.yearsDocs[Y];if(d&&d.t1Start)return{...defaultsFor(Y),...d};
  if(+S.schoolDoc.year===Y&&S.schoolDoc.t1Start){const s=S.schoolDoc;return{t1Start:s.t1Start,t1End:s.t1End,t2Start:s.t2Start,t2End:s.t2End};}
  return defaultsFor(Y);}
function yearList(){const set=new Set([currentYear(),S.viewYear,...Object.keys(S.yearsDocs).map(Number)]);if(S.schoolDoc.year)set.add(+S.schoolDoc.year);return[...set].filter(Boolean).sort((a,b)=>b-a);}
function buildCfg(){ if(!S.viewYear)S.viewYear=currentYear();
  S.cfg={systemName:S.sysDoc.systemName||S.schoolDoc.systemName||DEF_SYS,name:S.schoolDoc.name||"โรงเรียนของเรา",affiliation:S.schoolDoc.affiliation||"",year:S.viewYear,...yearCfg(S.viewYear)}; }
const isPast=()=>S.viewYear!==currentYear();

/* ================= engine ================= */
let E=null;
function termOf(d){const c=S.cfg;if(d>=c.t1Start&&d<=c.t1End)return 1;if(d>=c.t2Start&&d<=c.t2End)return 2;return 0;}
function weekOf(d){const t=termOf(d);if(!t)return 0;const st=t===1?S.cfg.t1Start:S.cfg.t2Start;const mon=add(st,-((toD(st).getUTCDay()+6)%7));return Math.floor(diff(mon,d)/7)+1;}
function curTerm(){ if(isPast())return 1; const c=S.cfg; return TODAY>c.t1End?2:1; }
function activeH(){return S.holidays.filter(h=>!h.deleted&&h.start&&yearOf(h.start)===S.viewYear);}
function activeP(){return S.plans.filter(p=>!p.deleted&&p.start&&yearOf(p.start)===S.viewYear);}
function compute(){
  buildCfg(); const c=S.cfg; const hmap=new Map();
  for(const h of activeH()){let d=h.start;const e=h.end&&h.end>=h.start?h.end:h.start;let g=0;while(d<=e&&g<120){if(!hmap.has(d)||h.type==="makeup")hmap.set(d,h);d=add(d,1);g++;}}
  const months=monthsBetween(c.t1Start,c.t2End);
  const map=new Map(),ms={};let n=0,t1=0,t2=0,d200=null;
  for(const ym of months){let cnt=0;const dim=daysIn(ym);
    for(let i=1;i<=dim;i++){const d=`${ym}-${String(i).padStart(2,"0")}`;const t=termOf(d);const h=hmap.get(d);const w=toD(d).getUTCDay();let st;
      if(!t)st="off";else if(h&&h.type==="makeup")st="makeup";else if(h)st=h.type==="special"?"special":"holiday";else if(w===0||w===6)st="weekend";else st="school";
      let k=0;if(st==="school"||st==="makeup"){n++;cnt++;k=n;if(t===1)t1++;else t2++;if(n===200)d200=d;}
      map.set(d,{st,n:k,t,h,w});}
    ms[ym]={days:cnt,c1:t1,c2:t2,cum:n};}
  E={map,ms,months,hmap,total:n,t1,t2,d200};
}
const info=d=>E&&E.map.get(d);
function doneSoFar(){let k=0;for(const[d,v]of E.map){if(d>TODAY)break;if(v.n)k=v.n;}return k;}

/* ================= shell ================= */
function navRoute(id){return id==="term"?"term"+curTerm():id;}
function renderNav(){
  const ct="term"+curTerm();let html="",g="";
  for(const r of ROUTES){if(r.min&&RANK[role()]<RANK[r.min])continue;
    if(r.group!==g){html+=`<div class="navgroup">${r.group}</div>`;g=r.group;}
    html+=`<button class="nav" data-act="nav" data-v="${r.id}" ${S.route===r.id?'aria-current="page"':""}>${ic(r.icon)}<span>${r.label}</span>${r.id===ct&&!isPast()?'<span class="nb">ปัจจุบัน</span>':""}</button>`;}
  document.getElementById("railNav").innerHTML=html;
  const bottom=["home","days","term","ops","more"];const shown=["home","days","term1","term2","ops"];
  document.getElementById("bottomNav").innerHTML=bottom.map(id=>{
    if(id==="more")return `<button data-act="more" ${!shown.includes(S.route)?'aria-current="page"':""}>${ic("menu")}<span>เมนู</span></button>`;
    if(id==="term")return `<button data-act="nav" data-v="${ct}" ${S.route.startsWith("term")?'aria-current="page"':""}>${ic("cal")}<span>ภาค ${curTerm()}</span></button>`;
    const r=ROUTES.find(x=>x.id===id);return `<button data-act="nav" data-v="${id}" ${S.route===id?'aria-current="page"':""}>${ic(r.icon)}<span>${r.short||r.label}</span></button>`;}).join("");
  const c=S.cfg;
  document.getElementById("brandName").textContent=c.systemName;
  document.getElementById("brandSchool").textContent=`${c.name}${c.affiliation?" · "+c.affiliation:""}`;
  document.getElementById("footSchool").textContent=c.name;
  const ts=termStatus();
  document.getElementById("footYear").textContent=`ปีการศึกษา ${ts.Y} · ${ts.short}`;
  document.getElementById("todayChip").innerHTML=`${ic("cal")} ${fLong(TODAY)} · ${ts.short}`;
  document.getElementById("brandLogo").innerHTML=logoHTML();
  const ys=document.getElementById("yearSel");
  ys.innerHTML=yearList().map(y=>`<option value="${y}" ${y===S.viewYear?"selected":""}>ปีการศึกษา ${y}${y===currentYear()?" (ปัจจุบัน)":""}</option>`).join("");
  const r=ROUTES.find(x=>x.id===S.route)||ROUTES[0];
  document.getElementById("pageTitle").textContent=r.label;
  document.getElementById("pageSub").textContent=isPast()?`${c.name} · ปีการศึกษา ${c.year} (ย้อนหลัง/ล่วงหน้า) · ${r.sub}`:`${c.name} · ปีการศึกษา ${c.year} · ${ts.label} · ${r.sub}`;
  const nm=(S.me&&S.me.name)||"ผู้ใช้งาน";
  document.getElementById("meName").textContent=nm;
  document.getElementById("meAv").textContent=nm.trim().charAt(0)||"?";
  document.getElementById("meRole").textContent=ROLE_LABEL[role()]+(S.viewAs?" · ทดลองมุมมอง":"");
}
function render(){
  if(!E)compute();
  renderNav();
  const v=document.getElementById("view");
  const ready=Object.values(S.loaded).every(Boolean);
  if(!ready){v.innerHTML=`<div class="loading">กำลังโหลดปฏิทิน…</div>`;return;}
  const r=ROUTES.find(x=>x.id===S.route);if(r&&r.min&&RANK[role()]<RANK[r.min])S.route="home";
  if(S.route==="setup"&&S.setupDirty&&document.getElementById("setupWrap"))return;
  const fn={home:vHome,days:vDays,term1:()=>vTerm(1),term2:()=>vTerm(2),ops:vOps,holidays:vHolidays,plans:vPlans,trash:vTrash,people:vPeople,setup:vSetup}[S.route]||vHome;
  const bar=isPast()?`<div class="pastbar"><span>กำลังดู<b> ปีการศึกษา ${S.viewYear} </b>(ข้อมูลย้อนหลัง/ล่วงหน้า) ข้อมูลทุกปีเก็บไว้ครบ</span><button class="btn sm" data-act="year-now">กลับไปปีการศึกษาปัจจุบัน ${currentYear()}</button></div>`:"";
  v.innerHTML=bar+fn(false);
  if(S.route==="people")loadNames();
}
function rerender(){compute();render();renderGate();}

/* ================= fragments ================= */
function legend(){return `<div class="legend"><span><i class="s-school"></i>วันทำการเรียนปกติ</span><span><i class="s-holiday"></i>วันหยุดราชการ</span><span><i class="s-special"></i>วันหยุดพิเศษ</span><span><i class="s-makeup"></i>วันเรียนชดเชย (นับวันเรียน)</span><span><i style="border:1px solid var(--line)"></i>เสาร์–อาทิตย์</span><span><i class="s-off"></i>นอกช่วงเปิดภาคเรียน</span></div>`;}
function printBtn(view){return S.downloads?`<button class="btn" data-act="print" data-v="${view}">${ic("print")}พิมพ์เอกสาร</button>`:"";}
function hBadge(t){return `<span class="badge b-${t}">${HTYPES[t]||""}</span>`;}
function ticks(group,opts,selected,{type="checkbox",cls=k=>"",name}={}){
  return `<div class="ticks" role="group">${Object.entries(opts).map(([k,v])=>`<label class="tick ${cls(k)}"><input type="${type}" ${name?`name="${name}"`:""} data-tick="${group}" value="${k}" ${selected.includes(k)?"checked":""}><span>${v}</span></label>`).join("")}</div>`;}
function miniCal(ym,{week=false,P=false}={}){
  const off=toD(`${ym}-01`).getUTCDay();const dim=daysIn(ym);
  let h=`<div class="mg${week?" wk":""}">`+DOW.map((d,i)=>`<div class="h${i===0?" red":""}">${d}</div>`).join("")+(week?`<div class="h">สัปดาห์</div>`:"");
  const cells=[];for(let i=0;i<off;i++)cells.push(null);for(let i=1;i<=dim;i++)cells.push(`${ym}-${String(i).padStart(2,"0")}`);while(cells.length%7)cells.push(null);
  for(let r=0;r<cells.length/7;r++){
    for(let c=0;c<7;c++){const d=cells[r*7+c];if(!d){h+=`<div class="d blank"></div>`;continue;}
      const x=info(d);const st=x?x.st:"off";const tip=`${fLong(d)}${x&&x.h?" · "+x.h.title:""}${x&&x.n?" · วันเรียนที่ "+x.n:""}`;
      const cls=`d s-${st}${d===TODAY&&!P?" today":""}`;
      h+=P?`<div class="${cls}">${dnum(d)}</div>`:`<button class="${cls}" data-act="day" data-v="${d}" title="${esc(tip)}">${dnum(d)}</button>`;}
    if(week){const row=cells.slice(r*7,r*7+7);const mon=row.find(x=>x&&toD(x).getUTCDay()===1)||row.find(Boolean);const w=mon?weekOf(mon):0;h+=`<div class="w">${w||""}</div>`;}
  }
  return h+`</div>`;
}

/* ================= views ================= */
function vHome(){
  const c=S.cfg;const x=info(TODAY);const done=doneSoFar();const t=termOf(TODAY);let L;
  if(x&&x.n){L=`<div class="k">วันนี้คือ</div><div class="big">${x.n}<small>/ ${E.total} วันเรียน</small></div><p>ภาคเรียนที่ ${t}/${c.year} · สัปดาห์ที่ ${weekOf(TODAY)} · ${DOWF[toD(TODAY).getUTCDay()]}</p>`;}
  else{let msg,sub;
    if(TODAY<c.t1Start){msg=`ก่อนเปิดภาคเรียน ปีการศึกษา ${c.year}`;sub=`เปิดภาคเรียนที่ 1 ในอีก ${diff(TODAY,c.t1Start)} วัน (${fLong(c.t1Start)})`;}
    else if(TODAY>c.t1End&&TODAY<c.t2Start){msg="ปิดภาคเรียนระหว่างภาค";sub=`เปิดภาคเรียนที่ 2 ในอีก ${diff(TODAY,c.t2Start)} วัน (${fLong(c.t2Start)})`;}
    else if(TODAY>c.t2End){msg=`สิ้นปีการศึกษา ${c.year}`;sub=`จัดการเรียนการสอนรวม ${E.total} วัน`;}
    else{msg=x&&x.h?x.h.title:"วันหยุดสุดสัปดาห์";sub=`ภาคเรียนที่ ${t} · สัปดาห์ที่ ${weekOf(TODAY)}`;}
    L=`<div class="k">สถานะวันนี้</div><div class="stat">${esc(msg)}</div><p>${esc(sub)}</p><p style="margin-top:14px">เรียนไปแล้ว <b class="num" style="font-size:22px;color:#f3d28a">${done}</b> จาก ${E.total} วัน</p>`;}
  const nowYm=ymOf(TODAY);const maxD=Math.max(...E.months.map(m=>E.ms[m].days),1);
  const ribbon=E.months.map(ym=>{const m=E.ms[ym];const past=ym<nowYm;const isNow=ym===nowYm;let fp=0;
    if(past)fp=m.days/maxD*100;else if(isNow){let k=0;for(let i=1;i<=daysIn(ym);i++){const d=`${ym}-${String(i).padStart(2,"0")}`;if(d>TODAY)break;const v=info(d);if(v&&v.n)k++;}fp=k/maxD*100;}
    return `<div class="rb${isNow?" now":""}" title="${ymLabel(ym)} · ${m.days} วันเรียน"><div class="bar${m.days?"":" off"}"><div class="fill" style="height:${m.days/maxD*100}%;opacity:.22"></div><div class="fill" style="height:${fp}%"></div><span class="cnt num">${m.days||"–"}</span></div><div class="m">${MSH[+ym.slice(5)-1]}</div></div>`;}).join("");
  const gap=E.total-200;
  const kpis=`<div class="kpis">
    <div class="kpi"><div class="l">ภาคเรียนที่ 1</div><div class="v">${E.t1}</div><div class="s">${fRange(c.t1Start,c.t1End,true)}</div></div>
    <div class="kpi"><div class="l">ภาคเรียนที่ 2</div><div class="v">${E.t2}</div><div class="s">${fRange(c.t2Start,c.t2End,true)}</div></div>
    <div class="kpi"><div class="l">รวมทั้งปี (เกณฑ์ 200)</div><div class="v ${gap>=0?"ok":"warn"}">${E.total}</div><div class="s">${gap>=0?`เกินเกณฑ์ ${gap} วัน`:`ขาดอีก ${-gap} วัน`}</div></div>
    <div class="kpi"><div class="l">ครบ 200 วันเรียน</div><div class="v" style="font-size:19px;padding-top:5px">${E.d200?fShortY(E.d200):"—"}</div><div class="s">${E.d200?DOWF[toD(E.d200).getUTCDay()]:"ยังไม่ครบในปีนี้"}</div></div></div>`;
  const from=isPast()?c.t1Start:TODAY;const until=add(from,30);
  const items=[...activeH().map(h=>({k:"h",s:h.start,e:h.end||h.start,t:h.title,o:h})),...activeP().map(p=>({k:"p",s:p.start,e:p.end||p.start,t:p.title,o:p}))]
    .filter(i=>i.e>=from&&i.s<=until).sort((a,b)=>a.s.localeCompare(b.s)).slice(0,14);
  const ag=items.length?items.map(i=>{const d=toD(i.s<from?from:i.s);const left=diff(TODAY,i.s);
    const when=isPast()?fLong(i.s):i.s<=TODAY?"วันนี้":left===1?"พรุ่งนี้":`อีก ${left} วัน`;
    const tag=i.k==="h"?hBadge(i.o.type):`<span class="dchip div-${i.o.division}">${DIVS[i.o.division]||""}</span>`;
    return `<div class="ag"><div class="dt"><b>${d.getUTCDate()}</b><small>${MSH[d.getUTCMonth()]}</small></div><div class="t">${esc(i.t)}<small>${when}${i.o.time?" · "+esc(i.o.time)+" น.":""}${i.e!==i.s?" · ถึง "+fShort(i.e):""}</small></div>${tag}</div>`;}).join(""):`<div class="empty">ไม่มีกำหนดการใน 30 วันข้างหน้า</div>`;
  const nextH=activeH().filter(h=>h.type!=="makeup"&&h.start>=TODAY).sort((a,b)=>a.start.localeCompare(b.start))[0];
  const divCount=Object.keys(DIVS).map(k=>({k,n:activeP().filter(p=>p.division===k&&(isPast()||(p.end||p.start)>=TODAY)).length}));
  return `<section class="hero"><div class="hero-l">${L}</div><div class="hero-r"><div class="sectitle"><h2>วันเรียนรายเดือนตลอดปี</h2><span class="muted" style="font-size:13px">แถบสีทองคือส่วนที่ผ่านมาแล้ว</span></div><div class="ribbon" style="--n:${E.months.length}">${ribbon}</div>${kpis}</div></section>
  <section class="dash2">
    <div class="card"><div class="cardhead"><h3>${isPast()?"กำหนดการต้นปีการศึกษา":"กำหนดการ 30 วันข้างหน้า"}</h3><button class="btn sm" data-act="nav" data-v="ops">ดูแผน 4 ฝ่าย ${ic("chevr")}</button></div><div class="agenda">${ag}</div></div>
    <div style="display:flex;flex-direction:column;gap:20px;min-width:0">
      <div class="card"><div class="cardhead"><h3>วันหยุดถัดไป</h3></div><div style="padding:14px 16px">${nextH?`<div style="font-family:var(--f-display);font-size:17px">${esc(nextH.title)}</div><div class="muted num" style="margin-top:4px">${fRange(nextH.start,nextH.end)} · อีก ${diff(TODAY,nextH.start)} วัน</div>`:`<div class="muted">ยังไม่มีวันหยุดที่จะถึง</div>`}</div></div>
      <div class="card"><div class="cardhead"><h3>${isPast()?"แผนงานทั้งปี":"งานที่ยังไม่ถึงกำหนด"}</h3></div><div style="padding:12px 16px;display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:center">${divCount.map(d=>`<span class="dchip div-${d.k}" style="justify-self:start">${DIVS[d.k]}</span><b class="num" style="font-size:18px">${d.n}</b>`).join("")}</div></div>
      ${canWrite()?`<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="add-plan">${ic("plus")}เพิ่มกิจกรรม/แผนงาน</button><button class="btn" data-act="add-hol">${ic("plus")}เพิ่มวันหยุด/ชดเชย</button></div>`:""}
    </div>
  </section>`;
}

function vDays(P){
  let rows="";
  for(const ym of E.months){const dim=daysIn(ym);let tds="";
    for(let i=1;i<=31;i++){if(i>dim){tds+=`<td class="c blank"></td>`;continue;}
      const d=`${ym}-${String(i).padStart(2,"0")}`;const x=info(d);
      let lab="";if(x.st==="school"||x.st==="makeup")lab=x.n;else if(x.st==="weekend")lab=x.w===0?"อา":"ส";else if(x.st==="holiday"||x.st==="special")lab="ห";else lab="·";
      const tip=`${fLong(d)}${x.h?" · "+x.h.title:""}${x.n?" · วันเรียนที่ "+x.n:""}`;
      const cls=`c s-${x.st}${d===TODAY&&!P?" today":""}${d===E.d200?" d200":""}`;
      tds+=P?`<td class="${cls}">${lab}</td>`:`<td class="${cls}" title="${esc(tip)}"><button data-act="day" data-v="${d}">${lab}</button></td>`;}
    rows+=`<tr><td class="mname">${ymShort(ym)}</td>${tds}<td class="tot">${E.ms[ym].days}</td></tr>`;}
  const head=`<tr><th class="mname">เดือน</th>${Array.from({length:31},(_,i)=>`<th>${i+1}</th>`).join("")}<th>รวม</th></tr>`;
  const table=`<div class="mx-wrap"><table class="mx"><colgroup><col class="mc">${"<col>".repeat(31)}<col class="tc"></colgroup><thead>${head}</thead><tbody>${rows}</tbody><tfoot><tr><td colspan="32" style="text-align:right;font-weight:600;padding-right:10px">รวมวันทำการเรียนตลอดปีการศึกษา ${S.cfg.year}</td><td class="grand">${E.total}</td></tr></tfoot></table></div>`;
  if(P)return `<div class="month-block">${table}</div>`;
  return `<div class="toolbar"><div class="l">${legend()}</div><div class="r">${canWrite()?`<button class="btn" data-act="add-hol">${ic("hol")}เพิ่มวันหยุด/ชดเชย</button>`:""}${printBtn("days")}</div></div>
  <div class="card" style="padding:10px">${table}</div>
  <p class="ro-note">ห = วันหยุด · ตัวเลขคือลำดับวันเรียนสะสม · กรอบทองคือวันเรียนที่ 200${E.d200?" ("+fLong(E.d200)+")":""} · คลิกวันที่เพื่อดูรายละเอียด${canWrite()?" เพิ่มกิจกรรม หรือกำหนดวันหยุด":""}</p>`;
}

function termMonths(t){const c=S.cfg;return monthsBetween(t===1?c.t1Start:c.t2Start,t===1?c.t1End:c.t2End);}
function termBlock(ym,t,P){const m=E.ms[ym];const cum=t===1?m.c1:m.c2;const a=`${ym}-01`,b=`${ym}-${String(daysIn(ym)).padStart(2,"0")}`;
  const hs=activeH().filter(h=>h.start<=b&&(h.end||h.start)>=a).sort((x,y)=>x.start.localeCompare(y.start));
  const list=hs.length?`<div class="tbl-wrap"><table class="mtable"><thead><tr><th style="width:110px">วันที่</th><th>รายการ</th><th style="width:130px">ประเภท</th>${canWrite()&&!P?'<th style="width:90px"></th>':""}</tr></thead><tbody>${hs.map(h=>`<tr><td class="num">${h.end&&h.end!==h.start?fRange(h.start,h.end,true):fShort(h.start)}</td><td>${esc(h.title)}${h.note?`<div class="muted" style="font-size:12.5px">${esc(h.note)}</div>`:""}</td><td>${hBadge(h.type)}</td>${canWrite()&&!P?`<td class="acts"><button class="icobtn" data-act="edit-hol" data-v="${h.id}" aria-label="แก้ไข">${ic("edit")}</button><button class="icobtn del" data-act="del-hol" data-v="${h.id}" aria-label="ลบ">${ic("trash")}</button></td>`:""}</tr>`).join("")}</tbody></table></div>`:`<div class="empty" style="padding:18px">ไม่มีวันหยุดพิเศษหรือวันเรียนชดเชยในเดือนนี้</div>`;
  return `<div class="mblock month-block"><div class="card mini"><h3>${ymLabel(ym)}</h3><div class="meta">วันเรียน <b>${m.days}</b> วัน · สะสม <b>${cum}</b> วัน</div>${miniCal(ym,{P})}</div><div class="card mlist"><h4>วันหยุดราชการ / วันหยุดพิเศษ / วันเรียนชดเชย · ${ymLabel(ym)}</h4>${list}</div></div>`;}
function termHead(t){const c=S.cfg;const s=t===1?c.t1Start:c.t2Start,e=t===1?c.t1End:c.t2End;return `<div class="termhead"><h2>ภาคเรียนที่ ${t}/${c.year} · ${fRange(s,e)}</h2><div class="tot">รวมวันทำการเรียน<b>${t===1?E.t1:E.t2}</b>วัน</div></div>`;}
function vTerm(t){
  return `<div class="toolbar"><div class="l"><div class="seg"><button data-act="nav" data-v="term1" aria-pressed="${t===1}">ภาคเรียนที่ 1</button><button data-act="nav" data-v="term2" aria-pressed="${t===2}">ภาคเรียนที่ 2</button></div></div><div class="r">${canWrite()?`<button class="btn" data-act="add-hol">${ic("plus")}เพิ่มวันหยุด/ชดเชย</button>`:""}${printBtn("term"+t)}</div></div>${legend()}${termHead(t)}<div style="display:flex;flex-direction:column;gap:16px">${termMonths(t).map(ym=>termBlock(ym,t,false)).join("")}</div>`;
}
function opsTerm(){return S.opsTerm||String(curTerm());}
function opsMonths(){const s=opsTerm();return s==="1"?termMonths(1):s==="2"?termMonths(2):E.months;}
function plansOn(a,b,div){return activeP().filter(p=>(!div||p.division===div)&&p.start<=b&&(p.end||p.start)>=a).sort((x,y)=>x.start.localeCompare(y.start)||(x.time||"").localeCompare(y.time||""));}
function planCard(p,P){return `<div class="plan div-${p.division}"><div><b>${p.end&&p.end!==p.start?fRange(p.start,p.end,true):fShort(p.start)}${p.time?` (${esc(p.time)})`:""}</b> ${esc(p.title)}${p.note?`<div class="muted" style="font-size:12px">${esc(p.note)}</div>`:""}${(p.sample||p.copied)&&!P?` <span class="badge b-sample">${p.copied?"คัดลอกจากปีก่อน":"ตัวอย่าง"}</span>`:""}</div>${canWrite()&&!P?`<div class="pa"><button data-act="edit-plan" data-v="${p.id}" aria-label="แก้ไข">${ic("edit")}</button><button data-act="del-plan" data-v="${p.id}" aria-label="ลบ">${ic("trash")}</button></div>`:""}</div>`;}
function opsBlock(ym,P){
  const m=E.ms[ym];const t=termOf(`${ym}-15`)||termOf(`${ym}-01`)||termOf(`${ym}-${daysIn(ym)}`);const cum=t===2?m.c2:m.c1;
  const a=`${ym}-01`,b=`${ym}-${String(daysIn(ym)).padStart(2,"0")}`;
  const hs=activeH().filter(h=>h.start>=a&&h.start<=b);const divs=prefs.opsDivs.filter(k=>DIVS[k]);
  const cols=divs.map(k=>{const ps=plansOn(a,b,k);
    return `<div class="col div-${k}"><div class="colhead">${DIVS[k]}${canWrite()&&!P?`<button class="btn sm" data-act="add-plan" data-div="${k}" data-ym="${ym}">${ic("plus")}เพิ่ม</button>`:""}</div><div class="colbody">${ps.length?ps.map(p=>planCard(p,P)).join(""):`<div class="none">– ไม่มีรายการ –</div>`}</div></div>`;}).join("");
  return `<section class="ops month-block" style="--nc:${Math.max(divs.length,1)}"><div class="cal"><div class="calhead">เดือน${ymLabel(ym)}</div><div class="calbody">${miniCal(ym,{week:true,P})}</div><div class="sum"><span>รวมวันเรียนเดือนนี้</span><b>${m.days} วัน</b>${t?`<span>สะสมภาคเรียนที่ ${t}/${S.cfg.year}</span><b>${cum} วัน</b>`:""}</div>${hs.length?`<div class="notes">${hs.map(h=>`${fShort(h.start)} ${esc(h.title)}`).join(" · ")}</div>`:""}</div>${cols}</section>`;
}
function vOps(P){
  const blocks=opsMonths().map(ym=>opsBlock(ym,P)).join("");
  if(P)return blocks;
  return `<div class="toolbar"><div class="l"><div class="seg">${[["1","ภาคเรียนที่ 1"],["2","ภาคเรียนที่ 2"],["all","ทั้งปีการศึกษา"]].map(([v,l])=>`<button data-act="ops-term" data-v="${v}" aria-pressed="${opsTerm()===v}">${l}</button>`).join("")}</div></div><div class="r">${canWrite()?`<button class="btn" data-act="add-hol">${ic("hol")}วันหยุด/ชดเชย</button><button class="btn primary" data-act="add-plan">${ic("plus")}เพิ่มกิจกรรม/แผนงาน</button>`:""}${printBtn("ops")}</div></div>
  <div class="toolbar"><div class="l"><span class="muted" style="font-size:13px">แสดงฝ่ายงาน</span>${ticks("opsdiv",DIVS,prefs.opsDivs,{cls:k=>"div-"+k})}</div></div>
  ${legend()}<div style="display:flex;flex-direction:column;gap:18px">${blocks}</div>`;
}

function vHolidays(){
  const q=S.hSearch.trim().toLowerCase();
  const rows=activeH().filter(h=>prefs.hTypes.includes(h.type)&&(!q||(h.title+" "+(h.note||"")).toLowerCase().includes(q))).sort((a,b)=>a.start.localeCompare(b.start));
  return `<div class="toolbar"><div class="l"><input class="inp search" id="hSearch" placeholder="ค้นหารายการ…" value="${esc(S.hSearch)}" data-input="h-search" aria-label="ค้นหา">${ticks("htype",HTYPES,prefs.hTypes,{cls:k=>"t-"+k})}</div><div class="r">${canWrite()?`<button class="btn primary" data-act="add-hol">${ic("plus")}เพิ่มวันหยุด/วันชดเชย</button>`:""}</div></div>
  <div class="card tbl-wrap"><table class="mtable"><thead><tr><th style="width:170px">วันที่ (พ.ศ.)</th><th>ชื่อวันหยุด / กิจกรรม</th><th style="width:140px">ประเภทวัน</th><th style="width:110px">ภาคเรียน</th><th>หมายเหตุ</th>${canWrite()?'<th style="width:90px"></th>':""}</tr></thead><tbody>${rows.map(h=>`<tr><td class="num">${fRange(h.start,h.end)}</td><td>${esc(h.title)}</td><td>${hBadge(h.type)}</td><td>${termOf(h.start)?"ภาคเรียนที่ "+termOf(h.start):'<span class="muted">นอกภาคเรียน</span>'}</td><td class="muted">${esc(h.note||"–")}</td>${canWrite()?`<td class="acts"><button class="icobtn" data-act="edit-hol" data-v="${h.id}" aria-label="แก้ไข">${ic("edit")}</button><button class="icobtn del" data-act="del-hol" data-v="${h.id}" aria-label="ลบ">${ic("trash")}</button></td>`:""}</tr>`).join("")||`<tr><td colspan="6" class="empty">ไม่พบรายการ</td></tr>`}</tbody></table></div>`;
}
function vPlans(){
  const q=S.pSearch.trim().toLowerCase();
  const rows=activeP().filter(p=>prefs.pDivs.includes(p.division)&&(!q||(p.title+" "+(p.note||"")).toLowerCase().includes(q))).sort((a,b)=>a.start.localeCompare(b.start));
  return `<div class="toolbar"><div class="l"><input class="inp search" id="pSearch" placeholder="ค้นหารายการ…" value="${esc(S.pSearch)}" data-input="p-search" aria-label="ค้นหา">${ticks("pdiv",DIVS,prefs.pDivs,{cls:k=>"div-"+k})}</div><div class="r">${canWrite()?`<button class="btn primary" data-act="add-plan">${ic("plus")}เพิ่มกิจกรรม/แผนงาน</button>`:""}</div></div>
  <div class="card tbl-wrap"><table class="mtable"><thead><tr><th style="width:140px">เดือน</th><th style="width:170px">ฝ่ายงาน</th><th style="width:150px">ช่วงวันที่</th><th>รายละเอียดการปฏิบัติงาน</th>${canWrite()?'<th style="width:90px"></th>':""}</tr></thead><tbody>${rows.map(p=>`<tr><td>${ymLabel(ymOf(p.start))}</td><td><span class="dchip div-${p.division}">${DIVS[p.division]||""}</span></td><td class="num">${p.end&&p.end!==p.start?fRange(p.start,p.end,true):fShort(p.start)}${p.time?` (${esc(p.time)})`:""}</td><td>${esc(p.title)}${p.sample?' <span class="badge b-sample">ตัวอย่าง</span>':p.copied?' <span class="badge b-sample">คัดลอกจากปีก่อน</span>':""}${p.note?`<div class="muted" style="font-size:12.5px">${esc(p.note)}</div>`:""}</td>${canWrite()?`<td class="acts"><button class="icobtn" data-act="edit-plan" data-v="${p.id}" aria-label="แก้ไข">${ic("edit")}</button><button class="icobtn del" data-act="del-plan" data-v="${p.id}" aria-label="ลบ">${ic("trash")}</button></td>`:""}</tr>`).join("")||`<tr><td colspan="5" class="empty">ไม่พบรายการ</td></tr>`}</tbody></table></div>`;
}
function vTrash(){
  const items=[...S.holidays.filter(h=>h.deleted).map(h=>({c:"holidays",o:h,k:HTYPES[h.type]})),...S.plans.filter(p=>p.deleted).map(p=>({c:"plans",o:p,k:DIVS[p.division]}))].sort((a,b)=>(b.o.deletedAt||"").localeCompare(a.o.deletedAt||""));
  return `<p class="ro-note">รายการที่ลบจากทุกปีการศึกษาจะอยู่ที่นี่ กู้คืนได้ทุกเมื่อ${isMain()?" · แอดมินหลักลบถาวรได้":""}</p>
  <div class="card tbl-wrap"><table class="mtable"><thead><tr><th style="width:90px">ปีการศึกษา</th><th style="width:150px">วันที่</th><th>รายการ</th><th style="width:170px">หมวด</th><th style="width:170px">ลบเมื่อ</th>${canWrite()?'<th style="width:150px"></th>':""}</tr></thead><tbody>${items.map(i=>`<tr><td class="num">${i.o.start?yearOf(i.o.start):"–"}</td><td class="num">${i.o.start?fRange(i.o.start,i.o.end,true):"–"}</td><td>${esc(i.o.title)}</td><td class="muted">${esc(i.k||"")}</td><td class="muted num">${i.o.deletedAt?new Date(i.o.deletedAt).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"–"}</td>${canWrite()?`<td class="acts"><button class="btn sm" data-act="restore" data-c="${i.c}" data-v="${i.o.id}">${ic("restore")}กู้คืน</button>${isMain()?`<button class="icobtn del" data-act="purge" data-c="${i.c}" data-v="${i.o.id}" aria-label="ลบถาวร">${ic("trash")}</button>`:""}</td>`:""}</tr>`).join("")||`<tr><td colspan="6" class="empty">ถังขยะว่าง</td></tr>`}</tbody></table></div>`;
}
const ACT={create:"เพิ่ม",update:"แก้ไข",delete:"ลบ",restore:"กู้คืน",purge:"ลบถาวร",settings:"เปลี่ยนการตั้งค่า",reset:"ล้างข้อมูลปีการศึกษา",year:"เปิดปีการศึกษา",current:"ตั้งปีการศึกษาปัจจุบัน",terms:"แก้ไขวันเปิด-ปิดภาค"};
const TGT={holiday:"วันหยุด/ชดเชย",plan:"แผนงาน",settings:"ระบบ",school:"ข้อมูลโรงเรียน",year:"ปีการศึกษา",user:"ผู้ใช้"};
const OLDROLE={admin:"main",academic:"school",viewer:"teacher"};
function vPeople(){
  const main=isMain();
  const card=(k,title,items)=>`<div class="card role${S.realRole===k?" me":""}"><h4>${title}${S.realRole===k?' <span class="badge b-makeup">บทบาทของคุณ</span>':""}</h4><ul>${items.map(i=>`<li>${i}</li>`).join("")}</ul></div>`;
  const nameOf=uid=>{const u=S.users.find(x=>x.id===uid);return u?(u.displayName||u.username):"ผู้ใช้งาน";};
  const q=(S.uSearch||"").trim().toLowerCase();const rf=prefs.uRoles||Object.keys(ROLE_LABEL);
  const users=S.users.filter(u=>rf.includes(u.role)&&(!q||((u.displayName||"")+" "+(u.username||"")).toLowerCase().includes(q))).sort((a,b)=>RANK[b.role]-RANK[a.role]||(a.displayName||"").localeCompare(b.displayName||"","th"));
  const urows=users.map(u=>`<tr><td><b>${esc(u.displayName||"-")}</b>${u.id===S.uid?' <span class="badge b-sample">คุณ</span>':""}</td><td class="num">${esc(u.username||"")}</td><td><span class="badge ${u.role==="teacher"?"b-sample":u.role==="main"?"b-holiday":"b-makeup"}">${ROLE_LABEL[u.role]||u.role}</span></td><td>${u.active===false?'<span class="badge b-holiday">ปิดการใช้งาน</span>':'<span class="badge" style="background:var(--d-budget-bg);color:var(--d-budget)">ใช้งานปกติ</span>'}</td><td class="muted num">${u.lastLogin?new Date(u.lastLogin).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"ยังไม่เคยเข้า"}</td>${main?`<td class="acts"><button class="icobtn" data-act="user-edit" data-v="${u.id}" aria-label="แก้ไขผู้ใช้">${ic("edit")}</button></td>`:""}</tr>`).join("");
  const logs=S.audit.slice(0,200).map(a=>`<div class="log"><span class="muted num">${new Date(a.at).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"})}</span><span><b>${esc(nameOf(a.uid))}</b><br><small class="muted">${ROLE_LABEL[a.role]||""}</small></span><span>${ACT[a.action]||a.action} ${TGT[a.target]||""} · ${esc(a.title||"")}${a.year?` <span class="muted">(ปี ${a.year})</span>`:""}</span></div>`).join("");
  return `<div class="roles">
    ${card("main","แอดมินหลัก",["ทุกอย่างที่แอดมินโรงเรียนทำได้","เพิ่มผู้ใช้ กำหนดบทบาท และปิดการใช้งานบัญชี","ตั้งชื่อระบบ เปิดปีการศึกษาใหม่ และเลือกปีปัจจุบัน","ลบถาวร และล้างข้อมูลทั้งปี"])}
    ${card("school","แอดมินโรงเรียน",["เพิ่ม แก้ไข ลบวันหยุดและวันชดเชย","เพิ่มกิจกรรม/แผนงาน 4 ฝ่ายได้ทีละหลายรายการ","แก้ไขข้อมูลโรงเรียนและวันเปิด-ปิดภาค","กู้คืนรายการจากถังขยะ"])}
    ${card("teacher","ครู/บุคลากร",["ดูปฏิทินทุกมุมมองและทุกปีการศึกษา","คลิกวันที่เพื่อดูกิจกรรมของวันนั้น","พิมพ์เอกสาร PDF และรูปภาพ"])}
  </div>
  <div class="toolbar"><div class="l"><input class="inp search" id="uSearch" placeholder="ค้นหาชื่อหรือชื่อผู้ใช้…" value="${esc(S.uSearch||"")}" data-input="u-search" aria-label="ค้นหาผู้ใช้">${ticks("urole",ROLE_LABEL,rf)}</div><div class="r">${RANK[S.realRole]>0?`<button class="btn" data-act="viewas-open">${ic("eye")}ทดลองมุมมองบทบาท</button>`:""}${main?`<button class="btn primary" data-act="user-add">${ic("plus")}เพิ่มผู้ใช้</button>`:""}</div></div>
  <div class="card tbl-wrap"><table class="mtable"><thead><tr><th>ชื่อ-นามสกุล</th><th style="width:150px">ชื่อผู้ใช้</th><th style="width:150px">บทบาท</th><th style="width:130px">สถานะ</th><th style="width:170px">เข้าใช้ล่าสุด</th>${main?'<th style="width:60px"></th>':""}</tr></thead><tbody>${urows||`<tr><td colspan="6" class="empty">ไม่พบผู้ใช้</td></tr>`}</tbody></table></div>
  <div class="card"><div class="cardhead"><h3>ประวัติการแก้ไข</h3><span class="muted" style="font-size:12.5px">${S.audit.length} รายการล่าสุด ทุกปีการศึกษา</span></div>${logs||`<div class="empty">ยังไม่มีการแก้ไข</div>`}</div>`;
}
function userForm(u){
  const isNew=!u;u=u||{displayName:"",username:"",role:"teacher",active:true};const self=!isNew&&u.id===S.uid;
  modal(isNew?"เพิ่มผู้ใช้":"แก้ไขผู้ใช้",
  `<div class="field"><label for="uName">ชื่อ-นามสกุล <i>*</i></label><input class="inp" id="uName" maxlength="80" value="${esc(u.displayName)}" placeholder="เช่น ครูสมใจ ใจดี"></div>
   <div class="grid2"><div class="field"><label for="uUser">ชื่อผู้ใช้ (ใช้เข้าสู่ระบบ) <i>*</i></label><input class="inp" id="uUser" maxlength="30" value="${esc(u.username)}" ${isNew?"":"disabled"} placeholder="a-z 0-9 . _ - อย่างน้อย 3 ตัว" autocomplete="off" autocapitalize="none"></div>
   ${isNew?`<div class="field"><label for="uPw">รหัสผ่านเริ่มต้น <i>*</i></label><input class="inp" id="uPw" type="text" minlength="6" maxlength="64" placeholder="อย่างน้อย 6 ตัวอักษร" autocomplete="new-password"></div>`:"<div></div>"}</div>
   <div class="field"><label>บทบาท</label>${ticks("uRole",ROLE_LABEL,[u.role],{type:"radio",name:"uRole"})}</div>
   ${isNew?"":`<div class="field"><label>สถานะบัญชี</label>${ticks("uAct",{on:"ใช้งานปกติ",off:"ปิดการใช้งาน"},[u.active===false?"off":"on"],{type:"radio",name:"uAct"})}</div>`}
   ${self?'<p class="ro-note">นี่คือบัญชีของคุณเอง เปลี่ยนบทบาทหรือปิดการใช้งานตัวเองไม่ได้</p>':""}
   ${isNew?'<p class="ro-note">แจ้งชื่อผู้ใช้และรหัสผ่านเริ่มต้นให้ครู แล้วให้ครูเปลี่ยนรหัสผ่านเองหลังเข้าสู่ระบบครั้งแรก (กดที่ชื่อมุมขวาบน)</p>':""}<div class="err" id="fErr" hidden></div>`,
  `${!isNew&&!self?`<button class="btn danger l" data-act="user-del" data-v="${u.id}">${ic("trash")}ลบผู้ใช้</button>`:""}<button class="btn" data-act="close">ยกเลิก</button><button class="btn primary" data-act="user-save" data-v="${isNew?"":u.id}">บันทึก</button>`);
  if(self)MR.querySelectorAll('[data-tick="uRole"],[data-tick="uAct"]').forEach(i=>i.disabled=true);
}
async function saveUser(id,btn){
  const name=val("uName").trim();const role=checked("uRole")[0]||"teacher";
  if(!name)return showErr("fErr","กรอกชื่อ-นามสกุล");
  btn.disabled=true;
  try{
    if(id){const patch={displayName:name};if(id!==S.uid){patch.role=role;patch.active=(checked("uAct")[0]||"on")==="on";}
      await updateDoc(doc(fs,"users",id),patch);closeModal();toast("บันทึกข้อมูลผู้ใช้แล้ว");audit("update","user",name);}
    else{const un=val("uUser").trim().toLowerCase();const pw=val("uPw");
      if(!okUsername(un)){btn.disabled=false;return showErr("fErr","ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–30 ตัว");}
      if(pw.length<6){btn.disabled=false;return showErr("fErr","รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");}
      if(S.users.some(u=>u.username===un)){btn.disabled=false;return showErr("fErr","ชื่อผู้ใช้นี้มีอยู่แล้ว");}
      btn.textContent="กำลังสร้างบัญชี…";
      const cred=await createUserWithEmailAndPassword(secondaryAuth(),toEmail(un),pw);
      await setDoc(doc(fs,"users",cred.user.uid),{username:un,displayName:name,role,active:true,createdAt:new Date().toISOString(),createdBy:S.uid});
      await signOut(secondaryAuth()).catch(()=>{});
      closeModal();toast(`เพิ่มผู้ใช้ ${name} แล้ว`);audit("create","user",`${name} (${ROLE_LABEL[role]})`);}
  }catch(e){btn.disabled=false;btn.textContent="บันทึก";showErr("fErr",e&&e.code&&e.code.startsWith("auth/")?authErr(e):errText(e));}
}
async function deleteUser(id){const u=S.users.find(x=>x.id===id);if(!u)return;
  const ok=await confirmBox("ลบผู้ใช้?",`“${esc(u.displayName||u.username)}” จะเข้าสู่ระบบไม่ได้อีก หากต้องการลบบัญชีออกจาก Firebase ทั้งหมด ให้ลบที่ Firebase Console → Authentication ด้วย`,"ลบผู้ใช้");MR.innerHTML="";if(!ok)return;
  try{await deleteDoc(doc(fs,"users",id));toast("ลบผู้ใช้แล้ว");audit("delete","user",u.displayName||u.username);}catch(e){toast(errText(e));}}
function pwForm(){
  modal("เปลี่ยนรหัสผ่าน",`<div class="field"><label for="pwOld">รหัสผ่านปัจจุบัน</label><input class="inp" id="pwOld" type="password" autocomplete="current-password"></div>
   <div class="grid2"><div class="field"><label for="pwNew">รหัสผ่านใหม่</label><input class="inp" id="pwNew" type="password" minlength="6" autocomplete="new-password"></div><div class="field"><label for="pwNew2">ยืนยันรหัสผ่านใหม่</label><input class="inp" id="pwNew2" type="password" autocomplete="new-password"></div></div><div class="err" id="fErr" hidden></div>`,
  `<button class="btn" data-act="close">ยกเลิก</button><button class="btn primary" data-act="pw-save">บันทึกรหัสผ่านใหม่</button>`);
}
async function savePw(btn){const o=val("pwOld"),n=val("pwNew"),n2=val("pwNew2");
  if(n.length<6)return showErr("fErr","รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");if(n!==n2)return showErr("fErr","รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
  btn.disabled=true;try{const u=auth.currentUser;await reauthenticateWithCredential(u,EmailAuthProvider.credential(u.email,o));await updatePassword(u,n);closeModal();toast("เปลี่ยนรหัสผ่านแล้ว");}
  catch(e){btn.disabled=false;showErr("fErr",authErr(e));}}
function vSetup(){
  if(!canWrite())return `<div class="card empty">หน้านี้สำหรับแอดมินเท่านั้น</div>`;
  const c=S.cfg;const cy=currentYear();
  const years=yearList().map(y=>{const yc=yearCfg(y);const nh=S.holidays.filter(h=>!h.deleted&&h.start&&yearOf(h.start)===y).length;const np=S.plans.filter(p=>!p.deleted&&p.start&&yearOf(p.start)===y).length;
    return `<div class="yr"><b class="num">ปีการศึกษา ${y}</b><span class="muted" style="font-size:13px">${fRange(yc.t1Start,yc.t2End,true)} ${String(be(+yc.t2End.slice(0,4))).slice(2)} · วันหยุด ${nh} · แผนงาน ${np}</span><span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${y===cy?'<span class="badge b-makeup">ปีปัจจุบัน</span>':isMain()?`<button class="btn sm" data-act="set-current" data-v="${y}">ตั้งเป็นปีปัจจุบัน</button>`:""}${y!==S.viewYear?`<button class="btn sm" data-act="view-year" data-v="${y}">เปิดดู</button>`:'<span class="badge b-sample">กำลังดู</span>'}</span></div>`;}).join("");
  return `<div id="setupWrap" style="display:flex;flex-direction:column;gap:20px">
  ${S.assets&&isMain()?`<div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px"><div class="sectitle"><h2>โลโก้ / ไอคอนระบบ</h2><span class="muted" style="font-size:13px">แสดงที่หน้าเข้าสู่ระบบ เมนู และหัวเอกสารที่พิมพ์ · ไฟล์ภาพสี่เหลี่ยมจัตุรัส PNG หรือ JPG</span></div>
    <div class="logo-box">${logoHTML()}<label class="btn" for="logoFile">${ic("plus")}อัปโหลดรูป</label><input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden>${S.schoolDoc.logoData?`<button class="btn danger" data-act="logo-remove">ใช้ไอคอนเริ่มต้น</button>`:""}<span class="muted" id="logoMsg" style="font-size:13px"></span></div></div>`:""}
  <form class="card" id="schoolForm" style="padding:20px;display:flex;flex-direction:column;gap:14px">
    <div class="sectitle"><h2>ข้อมูลโรงเรียน</h2><span class="muted" style="font-size:13px">แสดงบนหัวเอกสารที่พิมพ์และทุกหน้า</span></div>
    <div class="grid2"><div class="field"><label for="cName">ชื่อโรงเรียน <i>*</i></label><input class="inp" id="cName" required value="${esc(c.name)}"></div>
      <div class="field"><label for="cAff">หน่วยงานต้นสังกัด / เขตพื้นที่</label><input class="inp" id="cAff" value="${esc(c.affiliation||"")}"></div></div>
    <div class="err" id="schoolErr" hidden></div><div style="display:flex;justify-content:flex-end"><button class="btn primary" type="submit">บันทึกข้อมูลโรงเรียน</button></div></form>
  <form class="card" id="termForm" style="padding:20px;display:flex;flex-direction:column;gap:14px">
    <div class="sectitle"><h2>วันเปิด-ปิดภาคเรียน ปีการศึกษา ${c.year}</h2><span class="muted" style="font-size:13px">ใช้คำนวณวันเรียน Day 1–200 และสัปดาห์ที่</span></div>
    <div class="grid2"><div class="field"><label>วันเปิดภาคเรียนที่ 1 <i>*</i></label>${tdp("c1a",c.t1Start)}</div><div class="field"><label>วันปิดภาคเรียนที่ 1 <i>*</i></label>${tdp("c1b",c.t1End)}</div>
      <div class="field"><label>วันเปิดภาคเรียนที่ 2 <i>*</i></label>${tdp("c2a",c.t2Start)}</div><div class="field"><label>วันปิดภาคเรียนที่ 2 <i>*</i></label>${tdp("c2b",c.t2End)}</div></div>
    <div class="err" id="termErr" hidden></div><div style="display:flex;justify-content:flex-end"><button class="btn primary" type="submit">บันทึกวันเปิด-ปิดภาค</button></div></form>
  <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:12px">
    <div class="sectitle"><h2>ปีการศึกษา</h2><span class="muted" style="font-size:13px">ข้อมูลทุกปีเก็บแยกกันและเปิดดูย้อนหลังได้</span></div>
    <div class="yearlist">${years}</div>
    ${isMain()?`<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn gold" data-act="new-year">${ic("plus")}เปิดปีการศึกษาใหม่</button></div>`:`<p class="ro-note">แอดมินหลักเป็นผู้เปิดปีการศึกษาใหม่และเลือกปีปัจจุบัน</p>`}
  </div>
  ${isMain()?`<form class="card" id="sysForm" style="padding:20px;display:flex;flex-direction:column;gap:14px"><div class="sectitle"><h2>ระบบ</h2><span class="muted" style="font-size:13px">เฉพาะแอดมินหลัก</span></div>
    <div class="field"><label for="cSys">ชื่อระบบ <i>*</i></label><input class="inp" id="cSys" required value="${esc(c.systemName)}"></div><div class="err" id="sysErr" hidden></div><div style="display:flex;justify-content:flex-end"><button class="btn primary" type="submit">บันทึกชื่อระบบ</button></div></form>
  <div class="danger-zone"><div><b>ล้างข้อมูลปีการศึกษา ${c.year}</b><div class="muted" style="font-size:13.5px">ย้ายวันหยุดและแผนงานของปีนี้ (${activeH().length+activeP().length} รายการ) ไปถังขยะ ปีอื่นไม่ได้รับผลกระทบ</div></div><button class="btn danger" data-act="reset">${ic("trash")}ล้างข้อมูลปีนี้</button></div>`:""}
  </div>`;
}

/* ================= Thai date picker ================= */
function tdp(id,val,{optional=false,ph="เลือกวันที่"}={}){return `<div class="tdp" data-tdp="${id}" data-optional="${optional}" data-ph="${ph}"><button type="button" class="tdp-btn" data-act="tdp-open" data-v="${id}" id="${id}-btn">${tdpLabel(val,ph)}</button><input type="hidden" id="${id}" value="${val||""}"></div>`;}
function tdpLabel(v,ph){return `<span class="v">${ic("cal")}${v?`<span>${fLong(v)}</span>`:`<span class="ph">${ph||"เลือกวันที่"}</span>`}</span>${ic("chevr")}`;}
let pk=null;
function openPicker(id){closePicker();const wrap=document.querySelector(`[data-tdp="${id}"]`);if(!wrap)return;const v=document.getElementById(id).value||TODAY;pk={id,y:+v.slice(0,4),m:+v.slice(5,7)-1,wrap};const pop=document.createElement("div");pop.className="tdp-pop";pop.id="tdpPop";wrap.appendChild(pop);drawPicker();}
function drawPicker(){if(!pk)return;const pop=document.getElementById("tdpPop");const cur=document.getElementById(pk.id).value;
  const ym=`${pk.y}-${String(pk.m+1).padStart(2,"0")}`;const off=toD(`${ym}-01`).getUTCDay();const dim=daysIn(ym);const yrs=[];for(let y=pk.y-3;y<=pk.y+3;y++)yrs.push(y);
  let g=DOW.map(d=>`<div class="h">${d}</div>`).join("");for(let i=0;i<off;i++)g+="<span></span>";
  const hm=new Map();for(const h of S.holidays){if(h.deleted||!h.start)continue;let d=h.start;const e=h.end||h.start;let k=0;while(d<=e&&k<60){if(!hm.has(d)||h.type==="makeup")hm.set(d,h);d=add(d,1);k++;}}
  for(let i=1;i<=dim;i++){const d=`${ym}-${String(i).padStart(2,"0")}`;const h=hm.get(d);const cls=[h?(h.type==="makeup"?"mk":"hol"):"",d===cur?"sel":"",d===TODAY?"tod":""].join(" ");g+=`<button type="button" class="${cls}" data-act="tdp-pick" data-v="${d}" title="${h?esc(h.title):""}">${i}</button>`;}
  pop.innerHTML=`<div class="tdp-nav"><button type="button" class="icobtn" data-act="tdp-nav" data-v="-1" aria-label="เดือนก่อน">${ic("chevl")}</button><select data-change="tdp-month" aria-label="เดือน">${MONTHS.map((n,i)=>`<option value="${i}" ${i===pk.m?"selected":""}>${n}</option>`).join("")}</select><select data-change="tdp-year" aria-label="ปี พ.ศ.">${yrs.map(y=>`<option value="${y}" ${y===pk.y?"selected":""}>${be(y)}</option>`).join("")}</select><button type="button" class="icobtn" data-act="tdp-nav" data-v="1" aria-label="เดือนถัดไป">${ic("chevr")}</button></div><div class="tdp-grid">${g}</div><div class="tdp-foot"><button type="button" class="btn sm ghost" data-act="tdp-pick" data-v="${TODAY}">วันนี้</button>${pk.wrap.dataset.optional==="true"?`<button type="button" class="btn sm ghost" data-act="tdp-pick" data-v="">ล้างค่า</button>`:""}</div>`;}
function closePicker(){const p=document.getElementById("tdpPop");if(p)p.remove();pk=null;}

/* ================= modal ================= */
const MR=document.getElementById("modalRoot");
function modal(title,body,foot,wide){MR.innerHTML=`<div class="scrim" id="scrim"><div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${wide?'style="width:min(680px,100%)"':""}><div class="dh"><h2>${esc(title)}</h2><button class="icobtn" data-act="close" aria-label="ปิด">${ic("close")}</button></div><div class="db">${body}</div><div class="df">${foot}</div></div></div>`;const f=MR.querySelector(".db input:not([type=hidden]):not([type=checkbox]):not([type=radio]),.db textarea");if(f)f.focus();}
function closeModal(){MR.innerHTML="";closePicker();if(MR._res){const r=MR._res;MR._res=null;r(false);}}
function confirmBox(title,msg,ok){return new Promise(res=>{modal(title,`<p style="margin:0">${msg}</p>`,`<button class="btn" data-act="cf-no">ยกเลิก</button><button class="btn primary" data-act="cf-yes">${esc(ok)}</button>`);MR._res=res;});}
function errText(e){return e&&(e.code==="invalid_argument"||e.code==="permission-denied")?"บัญชีนี้ไม่มีสิทธิ์บันทึก ขอสิทธิ์จากแอดมินหลัก":e&&e.code==="quota_exceeded"?"พื้นที่เก็บข้อมูลเต็ม ลบถาวรรายการในถังขยะก่อน":e&&e.code==="unavailable"?"เชื่อมต่อไม่ได้ชั่วคราว ลองอีกครั้ง":(e&&e.message)||"บันทึกไม่สำเร็จ";}
function showErr(id,m){const el=document.getElementById(id);if(el){el.hidden=false;el.textContent=m;}}
let tt;function toast(m){const t=document.getElementById("toast");t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,2800);}

/* day panel */
function openDay(d){
  const x=info(d);const hs=S.holidays.filter(h=>!h.deleted&&h.start<=d&&(h.end||h.start)>=d);const ps=S.plans.filter(p=>!p.deleted&&p.start<=d&&(p.end||p.start)>=d).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
  const stat=x?(x.n?`<span class="badge b-makeup">วันเรียนที่ ${x.n}</span>`:x.st==="off"?`<span class="badge b-sample">นอกช่วงเปิดภาคเรียน</span>`:x.st==="weekend"?`<span class="badge b-sample">วันหยุดสุดสัปดาห์</span>`:""):"";
  const tw=x&&x.t?`<span class="muted" style="font-size:13px">ภาคเรียนที่ ${x.t} · สัปดาห์ที่ ${weekOf(d)}</span>`:"";
  const hb=hs.length?hs.map(h=>`<div class="plan" style="--dc:var(--st-${h.type==="makeup"?"makeup":h.type==="special"?"special":"holiday"}-bg)"><div>${hBadge(h.type)} ${esc(h.title)}${h.note?`<div class="muted" style="font-size:12px">${esc(h.note)}</div>`:""}</div>${canWrite()?`<div class="pa"><button data-act="edit-hol" data-v="${h.id}" aria-label="แก้ไข">${ic("edit")}</button><button data-act="del-hol" data-v="${h.id}" aria-label="ลบ">${ic("trash")}</button></div>`:""}</div>`).join(""):"";
  const pb=ps.length?ps.map(p=>planCard(p,false)).join(""):`<div class="none">ยังไม่มีกิจกรรมในวันนี้</div>`;
  modal(`${DOWF[toD(d).getUTCDay()]} ${fLong(d)}`,`<div class="daystat">${stat}${tw}</div>${hb?`<div class="dayblock"><h4>วันหยุด / วันชดเชย</h4>${hb}</div>`:""}<div class="dayblock"><h4>กิจกรรม / แผนงาน (${ps.length})</h4>${pb}</div>`,
  canWrite()?`<button class="btn l" data-act="add-hol" data-date="${d}">${ic("hol")}${hs.length?"เพิ่มวันหยุดอื่น":"กำหนดเป็นวันหยุด/ชดเชย"}</button><button class="btn primary" data-act="add-plan" data-date="${d}">${ic("plus")}เพิ่มกิจกรรมวันนี้</button>`:`<button class="btn" data-act="close">ปิด</button>`);
}
function holidayForm(h,date){
  const isNew=!h;h=h||{start:date||TODAY,end:"",title:"",type:"holiday",note:""};
  modal(isNew?"เพิ่มวันหยุด / วันเรียนชดเชย":"แก้ไขวันหยุด / วันเรียนชดเชย",
  `<div class="grid2"><div class="field"><label>วันที่ <i>*</i></label>${tdp("hS",h.start)}</div><div class="field"><label>ถึงวันที่ (ถ้าหลายวัน)</label>${tdp("hE",h.end&&h.end!==h.start?h.end:"",{optional:true,ph:"วันเดียว"})}</div></div>
   <div class="field"><label>ประเภทวัน</label>${ticks("hY",HTYPES,[h.type],{type:"radio",name:"hY",cls:k=>"t-"+k})}</div>
   <div class="field"><label for="hT">ชื่อวันหยุด / กิจกรรม <i>*</i></label><input class="inp" id="hT" maxlength="200" value="${esc(h.title)}" placeholder="เช่น วันหยุดพิเศษ / สอนชดเชย ใช้ตารางวันอังคาร"></div>
   <div class="field"><label for="hN">หมายเหตุ</label><input class="inp" id="hN" maxlength="300" value="${esc(h.note||"")}"></div><div class="err" id="fErr" hidden></div>`,
  `${isNew?"":`<button class="btn danger l" data-act="del-hol" data-v="${h.id}">${ic("trash")}ลบ</button>`}<button class="btn" data-act="close">ยกเลิก</button><button class="btn primary" data-act="save-hol" data-v="${isNew?"":h.id}">บันทึก</button>`);
}
function rowHTML(time,title){return `<div class="prow"><span class="k"></span><input class="inp pt" maxlength="20" placeholder="เวลา" value="${esc(time||"")}" aria-label="เวลา"><input class="inp pn" maxlength="300" placeholder="ชื่อกิจกรรม / รายละเอียดงาน" value="${esc(title||"")}" aria-label="ชื่อกิจกรรม"><button type="button" class="icobtn del" data-act="row-del" aria-label="ลบแถว">${ic("close")}</button></div>`;}
function planForm(p,preset){
  const isNew=!p;preset=preset||{};
  const start=preset.date||(preset.ym?(ymOf(TODAY)===preset.ym?TODAY:`${preset.ym}-01`):(isPast()?S.cfg.t1Start:TODAY));
  p=p||{division:preset.div||"",start,end:"",time:"",title:"",note:""};
  const sel=isNew?(preset.div?[preset.div]:[]):[p.division];
  modal(isNew?"เพิ่มกิจกรรม / แผนปฏิบัติงาน":"แก้ไขแผนปฏิบัติงาน",
  `<div class="grid2"><div class="field"><label>วันที่ <i>*</i></label>${tdp("pS",p.start)}</div><div class="field"><label>ถึงวันที่ (ถ้าหลายวัน)</label>${tdp("pE",p.end&&p.end!==p.start?p.end:"",{optional:true,ph:"วันเดียว"})}</div></div>
   <div class="field"><label>ฝ่ายงาน <i>*</i>${isNew?' <span class="muted" style="font-weight:400">ติ๊กได้หลายฝ่าย</span>':""}</label>${ticks("pD",DIVS,sel,{type:isNew?"checkbox":"radio",name:"pD",cls:k=>"div-"+k})}</div>
   <div class="field"><label>กิจกรรม <i>*</i>${isNew?' <span class="muted" style="font-weight:400">กด Enter เพื่อเพิ่มบรรทัด หรือวางรายการหลายบรรทัดพร้อมกันได้</span>':""}</label><div class="rows" id="rows">${rowHTML(p.time,p.title)}</div>${isNew?`<div><button type="button" class="btn sm" data-act="row-add">${ic("plus")}เพิ่มอีกกิจกรรม</button></div>`:""}</div>
   <div class="field"><label for="pN">ผู้รับผิดชอบ / หมายเหตุ</label><input class="inp" id="pN" maxlength="300" value="${esc(p.note||"")}"></div>
   ${isNew?'<div class="sumline" id="pSum"></div>':""}<div class="err" id="fErr" hidden></div>`,
  `${isNew?"":`<button class="btn danger l" data-act="del-plan" data-v="${p.id}">${ic("trash")}ลบ</button>`}<button class="btn" data-act="close">ยกเลิก</button><button class="btn primary" data-act="save-plan" data-v="${isNew?"":p.id}" id="pSave">บันทึก</button>`,true);
  const f0=MR.querySelector(".pn");if(f0)f0.focus();if(isNew)updSum();else{const d0=MR.querySelector(".prow .del");if(d0)d0.hidden=true;}
  numberRows();
}
function numberRows(){const rs=MR.querySelectorAll(".prow");rs.forEach((r,i)=>{r.querySelector(".k").textContent=rs.length>1?i+1:"";const d=r.querySelector('[data-act="row-del"]');if(d&&document.getElementById("pSum"))d.hidden=rs.length<2;});}
function updSum(){const el=document.getElementById("pSum");if(!el)return;const nd=MR.querySelectorAll('[data-tick="pD"]:checked').length;const nr=[...MR.querySelectorAll(".pn")].filter(i=>i.value.trim()).length;
  el.innerHTML=`จะบันทึก <b>${nd*nr}</b> รายการ (${nr} กิจกรรม × ${nd} ฝ่าย)`;const b=document.getElementById("pSave");if(b)b.textContent=nd*nr>1?`บันทึก ${nd*nr} รายการ`:"บันทึก";}
function addRow(time,title,after){const html=rowHTML(time,title);if(after)after.insertAdjacentHTML("afterend",html);else document.getElementById("rows").insertAdjacentHTML("beforeend",html);numberRows();updSum();}
function viewAsDialog(){
  const opts=Object.keys(ROLE_LABEL).filter(k=>RANK[k]<=RANK[S.realRole]);
  modal("มุมมองบทบาท",`<p class="muted" style="margin:0;font-size:13.5px">ทดลองดูระบบในมุมมองของบทบาทอื่น ใช้ตรวจสอบว่าผู้ใช้แต่ละระดับเห็นอะไรบ้าง สิทธิ์จริงของคุณไม่เปลี่ยน</p>${ticks("va",Object.fromEntries(opts.map(k=>[k,ROLE_LABEL[k]+(k===S.realRole?" (บทบาทจริง)":"")])),[role()],{type:"radio",name:"va"})}`,
  `<button class="btn" data-act="close">ยกเลิก</button><button class="btn primary" data-act="viewas-apply">ใช้มุมมองนี้</button>`);
}
function newYearDialog(){
  const ny=Math.max(...yearList())+1;const d=defaultsFor(ny);const src=Math.max(...yearList());
  const nSrc=S.plans.filter(p=>!p.deleted&&p.start&&yearOf(p.start)===src).length;
  modal(`เปิดปีการศึกษา ${ny}`,`<div class="field"><label for="nyY">ปีการศึกษา (พ.ศ.)</label><input class="inp num" id="nyY" type="number" value="${ny}" min="2560" max="2700"></div>
   <div class="grid2"><div class="field"><label>วันเปิดภาคเรียนที่ 1</label>${tdp("n1a",d.t1Start)}</div><div class="field"><label>วันปิดภาคเรียนที่ 1</label>${tdp("n1b",d.t1End)}</div><div class="field"><label>วันเปิดภาคเรียนที่ 2</label>${tdp("n2a",d.t2Start)}</div><div class="field"><label>วันปิดภาคเรียนที่ 2</label>${tdp("n2b",d.t2End)}</div></div>
   <div class="field"><label>ตัวเลือก</label><div class="ticks" style="flex-direction:column;align-items:flex-start"><label class="tick"><input type="checkbox" id="nyCur" checked><span>ตั้งเป็นปีการศึกษาปัจจุบันทันที</span></label><label class="tick"><input type="checkbox" id="nyCopy" ${nSrc?"checked":""} ${nSrc?"":"disabled"}><span>คัดลอกแผนงาน 4 ฝ่ายจากปี ${src} (${nSrc} รายการ) เลื่อนไป 52 สัปดาห์ให้ตรงวันในสัปดาห์เดิม</span></label></div></div>
   <p class="ro-note">ข้อมูลปี ${src} และปีก่อนหน้ายังอยู่ครบ เปิดดูได้จากเมนูเลือกปีการศึกษาด้านบน วันหยุดราชการของปีใหม่ต้องเพิ่มตามประกาศ</p><div class="err" id="fErr" hidden></div>`,
  `<button class="btn" data-act="close">ยกเลิก</button><button class="btn gold" data-act="new-year-save" data-src="${src}">เปิดปีการศึกษา</button>`,true);
}

/* ================= writes ================= */
async function audit(action,target,title,year){try{await S.db.collection("audit").add({at:new Date().toISOString(),uid:S.uid||"",role:S.realRole,action,target,title:String(title||"").slice(0,200),year:year||S.viewYear});}catch(e){}}
function readRange(prefix){const s=document.getElementById(prefix+"S").value;const e=document.getElementById(prefix+"E").value;return{s,e:e&&e>=s?e:s,bad:!!(e&&e<s)};}
const checked=(g)=>[...MR.querySelectorAll(`[data-tick="${g}"]:checked`)].map(i=>i.value);
async function saveHol(id){
  const{s,e,bad}=readRange("h");const title=document.getElementById("hT").value.trim();const type=checked("hY")[0]||"holiday";
  if(!s||!title)return showErr("fErr","กรอกวันที่และชื่อรายการ");if(bad)return showErr("fErr","วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
  const body={start:s,end:e,title,type,note:document.getElementById("hN").value.trim(),deleted:false,updatedAt:new Date().toISOString(),by:S.uid||""};
  try{const ref=id?S.db.collection("holidays").doc(id):S.db.collection("holidays").doc();await ref.set(body);closeModal();toast(id?"บันทึกการแก้ไขแล้ว":"เพิ่มรายการแล้ว");audit(id?"update":"create","holiday",title,yearOf(s));}catch(err){showErr("fErr",errText(err));}
}
async function savePlan(id,btn){
  const{s,e,bad}=readRange("p");const divs=checked("pD");const note=document.getElementById("pN").value.trim();
  const rows=[...MR.querySelectorAll(".prow")].map(r=>({time:r.querySelector(".pt").value.trim(),title:r.querySelector(".pn").value.trim()})).filter(r=>r.title);
  if(!s)return showErr("fErr","เลือกวันที่");if(bad)return showErr("fErr","วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
  if(!divs.length)return showErr("fErr","ติ๊กเลือกฝ่ายงานอย่างน้อย 1 ฝ่าย");if(!rows.length)return showErr("fErr","กรอกชื่อกิจกรรมอย่างน้อย 1 รายการ");
  const now=new Date().toISOString();btn.disabled=true;
  try{
    if(id){const r=rows[0];const old=S.plans.find(x=>x.id===id)||{};await S.db.collection("plans").doc(id).set({division:divs[0],start:s,end:e,time:r.time,title:r.title,note,deleted:false,sample:false,copied:false,updatedAt:now,by:S.uid||"",createdAt:old.createdAt||now});closeModal();toast("บันทึกการแก้ไขแล้ว");audit("update","plan",r.title,yearOf(s));}
    else{let n=0;const total=divs.length*rows.length;
      for(const d of divs)for(const r of rows){btn.textContent=`กำลังบันทึก ${n+1}/${total}`;await S.db.collection("plans").add({division:d,start:s,end:e,time:r.time,title:r.title,note,deleted:false,sample:false,updatedAt:now,createdAt:now,by:S.uid||""});n++;}
      closeModal();toast(`เพิ่ม ${n} รายการแล้ว`);audit("create","plan",n>1?`${rows.map(r=>r.title).join(", ")} (${n} รายการ)`:rows[0].title,yearOf(s));}
  }catch(err){showErr("fErr",errText(err));btn.disabled=false;updSum();}
}
async function softDelete(col,id){
  const o=(col==="holidays"?S.holidays:S.plans).find(x=>x.id===id);if(!o)return;
  const ok=await confirmBox("ย้ายไปถังขยะ?",`“${esc(o.title)}” จะถูกย้ายไปถังขยะ กู้คืนได้ภายหลัง`,"ย้ายไปถังขยะ");MR.innerHTML="";if(!ok)return;
  try{await S.db.collection(col).doc(id).update({deleted:true,deletedAt:new Date().toISOString(),deletedBy:S.uid||""});toast("ย้ายไปถังขยะแล้ว");audit("delete",col==="holidays"?"holiday":"plan",o.title,yearOf(o.start));}catch(err){toast(errText(err));}
}
async function restore(col,id){const o=(col==="holidays"?S.holidays:S.plans).find(x=>x.id===id);try{await S.db.collection(col).doc(id).update({deleted:false});toast("กู้คืนแล้ว");audit("restore",col==="holidays"?"holiday":"plan",o&&o.title,o&&o.start&&yearOf(o.start));}catch(err){toast(errText(err));}}
async function purge(col,id){const o=(col==="holidays"?S.holidays:S.plans).find(x=>x.id===id);
  const ok=await confirmBox("ลบถาวร?",`“${esc(o?o.title:"")}” จะหายไปถาวรและกู้คืนไม่ได้`,"ลบถาวร");MR.innerHTML="";if(!ok)return;
  try{await S.db.collection(col).doc(id).delete();toast("ลบถาวรแล้ว");audit("purge",col==="holidays"?"holiday":"plan",o&&o.title,o&&o.start&&yearOf(o.start));}catch(err){toast(errText(err));}}
async function resetYear(){
  const items=[...activeH().map(o=>["holidays",o]),...activeP().map(o=>["plans",o])];
  const ok=await confirmBox(`ล้างข้อมูลปีการศึกษา ${S.viewYear}?`,`ย้ายวันหยุดและแผนงานของปี ${S.viewYear} ทั้งหมด ${items.length} รายการไปถังขยะ ปีการศึกษาอื่นไม่ได้รับผลกระทบ`,"ล้างข้อมูลปีนี้");MR.innerHTML="";if(!ok)return;
  const at=new Date().toISOString();let n=0;
  for(const[c,o]of items){try{await S.db.collection(c).doc(o.id).update({deleted:true,deletedAt:at,deletedBy:S.uid||""});n++;}catch(e){}}
  toast(`ย้าย ${n} รายการไปถังขยะแล้ว`);audit("reset","year",`${n} รายการ`);
}
const val=id=>(document.getElementById(id)||{}).value||"";
async function saveSchool(){const n={name:val("cName").trim(),affiliation:val("cAff").trim()};if(!n.name)return showErr("schoolErr","กรอกชื่อโรงเรียน");
  try{await S.db.doc("config/school").update(n);S.setupDirty=false;render();toast("บันทึกข้อมูลโรงเรียนแล้ว");audit("settings","school",n.name);}catch(e){
    if(e&&e.code==="invalid_argument"){try{await S.db.doc("config/school").set({...S.schoolDoc,...n});S.setupDirty=false;render();toast("บันทึกข้อมูลโรงเรียนแล้ว");return;}catch(e2){e=e2;}}showErr("schoolErr",errText(e));}}
async function saveTerms(){const n={year:S.viewYear,t1Start:val("c1a"),t1End:val("c1b"),t2Start:val("c2a"),t2End:val("c2b")};
  if(!(n.t1Start&&n.t1Start<=n.t1End&&n.t1End<n.t2Start&&n.t2Start<=n.t2End))return showErr("termErr","ลำดับวันที่ไม่ถูกต้อง ภาคเรียนที่ 1 ต้องจบก่อนภาคเรียนที่ 2 เริ่ม");
  try{await S.db.doc("years/"+S.viewYear).set(n);S.setupDirty=false;render();toast("บันทึกวันเปิด-ปิดภาคแล้ว");audit("terms","year",`${fRange(n.t1Start,n.t2End,true)}`);}catch(e){showErr("termErr",errText(e));}}
async function saveSys(){const n=val("cSys").trim();if(!n)return showErr("sysErr","กรอกชื่อระบบ");
  try{await S.db.doc("config/system").set({...S.sysDoc,systemName:n,currentYear:currentYear()});S.setupDirty=false;render();toast("บันทึกชื่อระบบแล้ว");audit("settings","settings",n);}catch(e){showErr("sysErr",errText(e));}}
async function setCurrent(y){try{await S.db.doc("config/system").set({...S.sysDoc,systemName:S.cfg.systemName,currentYear:y});toast(`ตั้งปีการศึกษา ${y} เป็นปีปัจจุบันแล้ว`);audit("current","year",`ปีการศึกษา ${y}`,y);}catch(e){toast(errText(e));}}
async function newYearSave(btn){
  const y=+val("nyY");const n={year:y,t1Start:val("n1a"),t1End:val("n1b"),t2Start:val("n2a"),t2End:val("n2b")};const src=+btn.dataset.src;
  if(!(y>2500))return showErr("fErr","ระบุปีการศึกษา");if(S.yearsDocs[y])return showErr("fErr",`มีปีการศึกษา ${y} อยู่แล้ว`);
  if(!(n.t1Start<=n.t1End&&n.t1End<n.t2Start&&n.t2Start<=n.t2End))return showErr("fErr","ลำดับวันที่ไม่ถูกต้อง");
  btn.disabled=true;
  try{
    if(!S.yearsDocs[src]){const sc=yearCfg(src);await S.db.doc("years/"+src).set({year:src,...sc});}
    await S.db.doc("years/"+y).set(n);
    let copied=0;
    if(document.getElementById("nyCopy").checked){const list=S.plans.filter(p=>!p.deleted&&p.start&&yearOf(p.start)===src);const now=new Date().toISOString();
      for(const p of list){btn.textContent=`คัดลอก ${copied+1}/${list.length}`;const s=add(p.start,364),e=add(p.end||p.start,364);
        await S.db.collection("plans").add({division:p.division,start:s,end:e,time:p.time||"",title:p.title,note:p.note||"",deleted:false,sample:false,copied:true,createdAt:now,updatedAt:now,by:S.uid||""});copied++;}}
    if(document.getElementById("nyCur").checked)await S.db.doc("config/system").set({...S.sysDoc,systemName:S.cfg.systemName,currentYear:y});
    S.viewYear=y;S.yearPinned=false;try{localStorage.removeItem("acal-year");}catch(e){}
    MR.innerHTML="";toast(`เปิดปีการศึกษา ${y} แล้ว${copied?` คัดลอกแผนงาน ${copied} รายการ`:""}`);audit("year","year",`ปีการศึกษา ${y}${copied?` (คัดลอก ${copied} แผนงาน)`:""}`,y);rerender();
  }catch(e){showErr("fErr",errText(e));btn.disabled=false;btn.textContent="เปิดปีการศึกษา";}
}

/* ================= print preview / PDF / PNG ================= */
const LIBS={h2c:"https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",pdf:"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",zip:"https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"};
const libP={};
function loadLib(k){return libP[k]||(libP[k]=new Promise((res,rej)=>{const sc=document.createElement("script");sc.src=LIBS[k];sc.onload=()=>res();sc.onerror=()=>{delete libP[k];rej(new Error("load"));};document.head.appendChild(sc);}));}
const SHEET={landscape:[1123,794],portrait:[794,1123]};
const PTITLE={days:"ปฏิทินการจัดการเวลาเรียนตลอดปีการศึกษา (Day 1 – Day 200)",term1:"ปฏิทินการจัดการเวลาเรียน ภาคเรียนที่ 1",term2:"ปฏิทินการจัดการเวลาเรียน ภาคเรียนที่ 2",ops:"ปฏิทินกิจกรรมวิชาการและตารางการปฏิบัติงาน 4 ฝ่าย"};
const PV={view:null,orient:"landscape",brk:"flow",canvases:[],busy:false,token:0};
function printBlocks(view){
  if(view==="days")return[{h:vDays(true)},{h:legend()}];
  if(view==="term1"||view==="term2"){const t=+view.slice(-1);return[{h:termHead(t)},{h:legend()},...termMonths(t).map(ym=>({h:termBlock(ym,t,true),m:1}))];}
  return opsMonths().map(ym=>({h:opsBlock(ym,true),m:1}));
}
function sheetHead(view){const c=S.cfg;return `<div class="sh-head">${logoHTML()}<div><h1>${esc(PTITLE[view])}${view==="ops"&&opsTerm()!=="all"?` ภาคเรียนที่ ${opsTerm()}`:""}</h1><p>${esc(c.name)}${c.affiliation?" · "+esc(c.affiliation):""}</p></div><div class="yr">ปีการศึกษา ${c.year}<small>รวมวันเรียน ${E.total} วัน</small></div></div>`;}
function sheetFoot(n,N){return `<div class="sh-foot"><span>${esc(S.cfg.systemName)} · พิมพ์เมื่อ ${fLong(TODAY)} · พัฒนาโดย ครูซอสสอนสังคม 2569</span><span>หน้า ${n} / ${N}</span></div>`;}
function openPreview(view){
  PV.view=view;PV.canvases=[];
  document.getElementById("pvRoot").innerHTML=`<div class="pv" role="dialog" aria-modal="true" aria-label="ตัวอย่างก่อนพิมพ์"><div class="pv-host" id="pvHost"></div>
   <div class="pv-bar"><h2>ตัวอย่างก่อนพิมพ์</h2>
    <div class="grp"><span>กระดาษ</span>${ticks("pvO",{landscape:"A4 แนวนอน",portrait:"A4 แนวตั้ง"},[PV.orient],{type:"radio",name:"pvO"})}</div>
    ${view!=="days"?`<div class="grp"><span>แบ่งหน้า</span>${ticks("pvB",{flow:"ต่อเนื่อง",month:"เดือนละหน้า"},[PV.brk],{type:"radio",name:"pvB"})}</div>`:""}
    <div class="grp"><button class="btn primary" data-act="pv-print" id="pvPrint" disabled>${ic("print")}สั่งพิมพ์</button><button class="btn" data-act="pv-pdf" id="pvPdf" disabled>ดาวน์โหลด PDF</button><button class="btn gold" data-act="pv-png" id="pvPng" disabled>${ic("copy")}ดาวน์โหลดรูป PNG</button><button class="btn" data-act="pv-close">${ic("close")}ปิด</button></div></div>
   <div class="pv-body" id="pvBody"></div></div>`;
  buildPreview();
}
function closePreview(){PV.token++;document.getElementById("pvRoot").innerHTML="";PV.canvases=[];}
function pvMsg(t,pct){const b=document.getElementById("pvBody");if(b)b.innerHTML=`<div class="pv-msg"><span>${t}</span>${pct!=null?`<div class="pv-prog"><i style="width:${pct}%"></i></div>`:""}</div>`;}
async function buildPreview(){
  const tok=++PV.token;const view=PV.view,orient=PV.orient,brk=PV.brk;const[W,H]=SHEET[orient];
  ["pvPdf","pvPng","pvPrint"].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=true;});
  pvMsg("กำลังจัดหน้าเอกสาร…",5);
  try{await loadLib("h2c");}catch(e){pvMsg("โหลดเครื่องมือสร้างเอกสารไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองเปิดใหม่");return;}
  if(tok!==PV.token)return;
  try{if(document.fonts&&document.fonts.ready)await document.fonts.ready;}catch(e){}
  const host=document.getElementById("pvHost");const blocks=printBlocks(view);
  host.innerHTML=`<div class="sheet ${orient}" style="width:${W}px;height:${H}px">${sheetHead(view)}<div class="sh-body" id="pvMeasure">${blocks.map((b,i)=>`<div class="pblk" data-i="${i}">${b.h}</div>`).join("")}</div>${sheetFoot(1,1)}</div>`;
  const body=host.querySelector("#pvMeasure");const avail=body.clientHeight;const gap=10;
  const hs=[...body.querySelectorAll(".pblk")].map(e=>e.offsetHeight);
  const pages=[];let cur=[],used=0,curHasMonth=false;
  blocks.forEach((b,i)=>{const h=Math.min(hs[i],avail);const need=(cur.length?gap:0)+h;
    if(cur.length&&((brk==="month"&&b.m&&curHasMonth)||used+need>avail)){pages.push(cur);cur=[];used=0;curHasMonth=false;}
    cur.push(i);used+=(cur.length>1?gap:0)+h;if(b.m)curHasMonth=true;});
  if(cur.length)pages.push(cur);
  const N=pages.length;
  host.innerHTML=pages.map((pg,pi)=>`<div class="sheet ${orient}" style="width:${W}px;height:${H}px">${sheetHead(view)}<div class="sh-body">${pg.map(i=>{const h=hs[i];if(h<=avail)return `<div class="pblk">${blocks[i].h}</div>`;const k=avail/h;return `<div class="pblk" style="height:${Math.floor(avail)}px;overflow:hidden"><div class="pscale" style="transform:scale(${k});width:${100/k}%">${blocks[i].h}</div></div>`;}).join("")}</div>${sheetFoot(pi+1,N)}</div>`).join("");
  const sheets=[...host.querySelectorAll(".sheet")];const canv=[];
  for(let i=0;i<sheets.length;i++){
    if(tok!==PV.token)return;pvMsg(`กำลังสร้างหน้า ${i+1} จาก ${N}…`,Math.round((i+.3)/N*100));
    try{canv.push(await window.html2canvas(sheets[i],{scale:2,backgroundColor:"#ffffff",logging:false,useCORS:true,windowWidth:Math.max(window.innerWidth,W+40),windowHeight:Math.max(window.innerHeight,H+40),scrollX:0,scrollY:0}));}
    catch(e){pvMsg("สร้างภาพหน้าเอกสารไม่สำเร็จ ลองเปลี่ยนแนวกระดาษหรือเปิดใหม่อีกครั้ง");return;}
  }
  if(tok!==PV.token)return;
  host.innerHTML="";PV.canvases=canv;
  const maxW=Math.min(W,1000);
  document.getElementById("pvBody").innerHTML=canv.map((c,i)=>`<div class="pv-page" style="max-width:${maxW}px"><img alt="หน้า ${i+1}" src="${c.toDataURL("image/jpeg",.9)}"><div class="pn"><span>หน้า ${i+1} / ${N}</span>${S.downloads?`<button class="btn sm" data-act="pv-png1" data-v="${i}">บันทึกรูปหน้านี้</button>`:""}</div></div>`).join("")+`<div style="height:20px"></div>`;
  ["pvPdf","pvPng","pvPrint"].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=false;});
  const b2=document.getElementById("pvPng");if(b2)b2.innerHTML=`${ic("copy")}${N>1?`ดาวน์โหลดรูป PNG ทั้งหมด (.zip)`:"ดาวน์โหลดรูป PNG"}`;
}
const fname=ext=>`${PTITLE[PV.view].replace(/[\\/:*?"<>|()]/g,"").slice(0,70)} ${S.cfg.name} ปี ${S.cfg.year}.${ext}`;
const toBlob=c=>new Promise(r=>c.toBlob(r,"image/png"));
async function saveFile(name,data,btn,label){
  try{await saveBlob({filename:name,data});toast("ดาวน์โหลดไฟล์แล้ว");}catch(e){toast("ดาวน์โหลดไม่สำเร็จ");}
  if(btn){btn.disabled=false;btn.innerHTML=label;}
}
function pvPrint(){
  const L=PV.orient==="landscape";const W=L?"297mm":"210mm",H=L?"210mm":"297mm";
  const f=document.createElement("iframe");f.setAttribute("aria-hidden","true");f.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";document.body.appendChild(f);
  const d=f.contentWindow.document;d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(PTITLE[PV.view])}</title><style>@page{size:A4 ${L?"landscape":"portrait"};margin:0}html,body{margin:0;padding:0}img{display:block;width:${W};height:${H};page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}</style></head><body>${PV.canvases.map(c=>`<img src="${c.toDataURL("image/jpeg",.95)}">`).join("")}</body></html>`);
  d.close();
  const imgs=[...d.images];Promise.all(imgs.map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r;}))).then(()=>{f.contentWindow.focus();f.contentWindow.print();setTimeout(()=>f.remove(),60000);});
}
async function pvPdf(btn){const label=btn.innerHTML;btn.disabled=true;btn.textContent="กำลังสร้าง PDF…";
  try{await loadLib("pdf");}catch(e){toast("โหลดเครื่องมือ PDF ไม่สำเร็จ");btn.disabled=false;btn.innerHTML=label;return;}
  const L=PV.orient==="landscape";const doc=new window.jspdf.jsPDF({orientation:L?"landscape":"portrait",unit:"mm",format:"a4",compress:true});
  const w=L?297:210,h=L?210:297;
  PV.canvases.forEach((c,i)=>{if(i)doc.addPage("a4",L?"landscape":"portrait");doc.addImage(c.toDataURL("image/jpeg",.92),"JPEG",0,0,w,h,undefined,"FAST");});
  await saveFile(fname("pdf"),doc.output("arraybuffer"),btn,label);}
async function pvPng(btn){const label=btn.innerHTML;btn.disabled=true;btn.textContent="กำลังเตรียมรูป…";
  if(PV.canvases.length===1){await saveFile(fname("png"),await toBlob(PV.canvases[0]),btn,label);return;}
  try{await loadLib("zip");}catch(e){toast("โหลดเครื่องมือบีบอัดไม่สำเร็จ");btn.disabled=false;btn.innerHTML=label;return;}
  const z=new window.JSZip();for(let i=0;i<PV.canvases.length;i++)z.file(`หน้า-${String(i+1).padStart(2,"0")}.png`,await toBlob(PV.canvases[i]));
  await saveFile(fname("zip"),await z.generateAsync({type:"blob"}),btn,label);}
async function pvPng1(i,btn){const label=btn.innerHTML;btn.disabled=true;await saveFile(fname("png").replace(/\.png$/,` หน้า ${i+1}.png`),await toBlob(PV.canvases[i]),btn,label);}

/* ================= entrance & account ================= */
let signedIn=false;
function gateMode(){if(!S.bootChecked||!S.authChecked)return"loading";if(S.connErr)return"conn";if(!S.bootstrapped)return"setup";return"login";}
function renderGate(){
  const g=document.getElementById("gate");document.documentElement.classList.toggle("gated",!signedIn);if(signedIn){g.hidden=true;S.gateMode="";return;}g.hidden=false;
  const c=S.cfg||{};const ts=termStatus();const yc=ts.c;
  const span=Math.max(diff(yc.t1Start,yc.t2End),1);const pct=d=>Math.max(0,Math.min(100,diff(yc.t1Start,d)/span*100));
  const w1=pct(yc.t1End),wb=pct(yc.t2Start)-w1,w2=100-pct(yc.t2Start);
  const now=TODAY>=yc.t1Start&&TODAY<=yc.t2End?`<span class="tl-now" style="left:${pct(TODAY)}%"></span>`:"";
  const tl=`<div class="tl"><div class="tl-bar"><span class="tl-seg t" style="width:${w1}%">ภาคเรียนที่ 1</span><span class="tl-seg b" style="width:${wb}%">ปิดภาค</span><span class="tl-seg t" style="width:${w2}%">ภาคเรียนที่ 2</span>${now}</div><div class="tl-lab"><span>${fShortY(yc.t1Start)}</span><span>${fShortY(yc.t1End)} · ${fShortY(yc.t2Start)}</span><span>${fShortY(yc.t2End)}</span></div></div>`;
  const st=ts.t?`${fLong(TODAY)} · ${ts.label}`:ts.next?`${fLong(TODAY)} · อีก<b>${diff(TODAY,ts.next)}</b>วัน ${ts.nextLabel} (${fLong(ts.next)})`:`${fLong(TODAY)} · ${ts.label}`;
  const top=`<div class="gate-id">${logoHTML()}<div><b>${esc(c.name||"โรงเรียนของเรา")}</b><small>${esc(c.affiliation||"")}</small></div><span class="sysn">${esc(c.systemName||DEF_SYS)}</span></div>
    <div class="gate-year"><div><div class="k">ปฏิทินการศึกษา</div><div class="y"><span>ปีการศึกษา</span>${ts.Y}</div></div><span class="termpill${ts.t?"":" off"}"><i></i>${ts.label}</span></div>
    ${tl}<div class="gate-status">${st}</div>`;
  if(!g.querySelector(".gate-wrap"))g.innerHTML=`<div class="gate-wrap"><div class="gate-card"><div class="gate-top" id="gateTop"></div><div class="gate-bot" id="gateBot"></div></div><div class="credit">พัฒนาโดย <b>ครูซอสสอนสังคม</b> 2569</div></div>`;
  document.getElementById("gateTop").innerHTML=top;
  const mode=gateMode();
  if(mode!==S.gateMode){S.gateMode=mode;const b=document.getElementById("gateBot");
    if(mode==="loading")b.innerHTML=`<div class="loading" style="padding:12px 0">กำลังเชื่อมต่อระบบ…</div>`;
    else if(mode==="conn")b.innerHTML=`<h2>เชื่อมต่อฐานข้อมูลไม่ได้</h2><p class="lead">ตรวจสอบค่าในไฟล์ js/firebase-config.js และการตั้งค่า Firestore Rules ตามคู่มือ README</p>`;
    else if(mode==="setup")b.innerHTML=`<h2>ตั้งค่าระบบครั้งแรก</h2><p class="lead">สร้างบัญชีแอดมินหลักของโรงเรียน ทำครั้งเดียวเท่านั้น</p>
      <form id="setupFirst" class="gate-form" autocomplete="off"><div class="grid2"><input class="inp" id="sfSchool" placeholder="ชื่อโรงเรียน" required><input class="inp" id="sfAff" placeholder="หน่วยงานต้นสังกัด / เขตพื้นที่"></div>
      <div class="grid2"><input class="inp" id="sfName" placeholder="ชื่อ-นามสกุลแอดมินหลัก" required><input class="inp" id="sfUser" placeholder="ชื่อผู้ใช้ (a-z 0-9)" autocapitalize="none" required></div>
      <div class="grid2"><input class="inp" id="sfPw" type="password" placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)" autocomplete="new-password" required><input class="inp" id="sfPw2" type="password" placeholder="ยืนยันรหัสผ่าน" autocomplete="new-password" required></div>
      <label class="tick"><input type="checkbox" id="sfSeed" checked><span>ใส่วันหยุดราชการปี 2569 และแผนงานตัวอย่างให้อัตโนมัติ</span></label>
      <div class="err" id="sfErr" hidden></div><button class="gate-btn" type="submit" id="sfBtn">สร้างบัญชีและเริ่มใช้งาน ${ic("chevr")}</button></form>`;
    else b.innerHTML=`<h2>เข้าสู่ระบบ</h2>
      <form id="loginForm" class="gate-form"><div class="lg-field">${ic("users")}<input class="inp" id="lgU" placeholder="ชื่อผู้ใช้" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
      <div class="lg-field">${ic("gear")}<input class="inp" id="lgP" type="password" placeholder="รหัสผ่าน" autocomplete="current-password" required><button type="button" class="eye" data-act="pw-eye" aria-label="แสดงหรือซ่อนรหัสผ่าน">${ic("eye")}</button></div>
      <div class="err" id="lgErr" ${S.loginErr?"":"hidden"}>${esc(S.loginErr)}</div><div class="muted" id="lgStat" style="font-size:13px" hidden></div>
      <button class="gate-btn" type="submit" id="lgBtn">เข้าสู่ระบบ ${ic("chevr")}</button>
      <div class="gate-note">${ic("users")}<span>ลืมรหัสผ่านหรือยังไม่มีบัญชี ติดต่อแอดมินหลักของโรงเรียน</span></div></form>`;
  } else if(mode==="login"){const e=document.getElementById("lgErr");if(e&&S.loginErr){e.hidden=false;e.textContent=S.loginErr;}}
  fitGate();
}
function authErr(e){const c=e&&e.code||"";
  if(["auth/invalid-credential","auth/wrong-password","auth/user-not-found","auth/invalid-email","auth/invalid-login-credentials"].includes(c))return"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
  if(c==="auth/too-many-requests")return"ลองผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่";
  if(c==="auth/network-request-failed")return"เชื่อมต่ออินเทอร์เน็ตไม่ได้";
  if(c==="auth/email-already-in-use")return"ชื่อผู้ใช้นี้มีอยู่แล้ว";
  if(c==="auth/weak-password")return"รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
  if(c==="auth/operation-not-allowed")return"ยังไม่ได้เปิดการเข้าสู่ระบบแบบ Email/Password ใน Firebase";
  return"ดำเนินการไม่สำเร็จ ("+(c||"unknown")+")";}
function lgStat(t){const el=document.getElementById("lgStat");if(el){el.hidden=!t;el.textContent=t||"";}}
async function doLogin(){const u=val("lgU").trim(),p=val("lgP");const btn=document.getElementById("lgBtn");
  if(!u||!p)return showErr("lgErr","กรอกชื่อผู้ใช้และรหัสผ่าน");
  btn.disabled=true;S.loginErr="";const e=document.getElementById("lgErr");if(e)e.hidden=true;
  lgStat("กำลังตรวจสอบชื่อผู้ใช้และรหัสผ่าน…");
  try{const cred=await signInWithEmailAndPassword(auth,toEmail(u),p);
    lgStat("รหัสผ่านถูกต้อง กำลังโหลดข้อมูลบัญชี…");await handleAuth(cred.user);}
  catch(err){console.error("[login]",err);lgStat("");showErr("lgErr",authErr(err));}
  btn.disabled=false;}
async function doSetup(){
  const school=val("sfSchool").trim(),aff=val("sfAff").trim(),name=val("sfName").trim(),un=val("sfUser").trim().toLowerCase(),pw=val("sfPw"),pw2=val("sfPw2");
  if(!school||!name)return showErr("sfErr","กรอกชื่อโรงเรียนและชื่อแอดมินหลัก");
  if(!okUsername(un))return showErr("sfErr","ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–30 ตัว");
  if(pw.length<6)return showErr("sfErr","รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");if(pw!==pw2)return showErr("sfErr","รหัสผ่านทั้งสองช่องไม่ตรงกัน");
  const btn=document.getElementById("sfBtn");btn.disabled=true;btn.textContent="กำลังสร้างระบบ…";S.settingUp=true;
  try{
    let cred;try{cred=await createUserWithEmailAndPassword(auth,toEmail(un),pw);}catch(e){if(e.code==="auth/email-already-in-use")cred=await signInWithEmailAndPassword(auth,toEmail(un),pw);else throw e;}
    const uid=cred.user.uid;const Y=yearOf(TODAY);const at=new Date().toISOString();
    const b=writeBatch(fs);
    b.set(doc(fs,"users",uid),{username:un,displayName:name,role:"main",active:true,createdAt:at});
    b.set(doc(fs,"config","bootstrap"),{at,by:uid});
    b.set(doc(fs,"config","system"),{systemName:DEF_SYS,currentYear:Y});
    b.set(doc(fs,"config","school"),{name:school,affiliation:aff});
    b.set(doc(fs,"years",String(Y)),{year:Y,...defaultsFor(Y)});
    await b.commit();
    if(document.getElementById("sfSeed").checked){const b2=writeBatch(fs);
      SEED_H.forEach(([s,e,t])=>b2.set(doc(collection(fs,"holidays")),{start:s,end:e||s,title:t,type:"holiday",note:"",deleted:false,createdAt:at}));
      SEED_P.forEach(([d,s,e,t])=>b2.set(doc(collection(fs,"plans")),{division:d,start:s,end:e||s,time:"",title:t,note:"",deleted:false,sample:true,createdAt:at}));
      await b2.commit().catch(()=>{});}
    S.settingUp=false;await handleAuth(auth.currentUser);toast("ตั้งค่าระบบเรียบร้อย ยินดีต้อนรับ");
  }catch(e){S.settingUp=false;btn.disabled=false;btn.innerHTML=`สร้างบัญชีและเริ่มใช้งาน ${ic("chevr")}`;showErr("sfErr",e&&e.code&&e.code.startsWith("auth/")?authErr(e):errText(e));}
}
const SEED_H=[["2026-05-31",0,"วันวิสาขบูชา"],["2026-06-01",0,"วันหยุดชดเชยวันวิสาขบูชา"],["2026-06-03",0,"วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าสุทิดาฯ พระบรมราชินี"],["2026-07-28",0,"วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว"],["2026-07-29",0,"วันอาสาฬหบูชา"],["2026-07-30",0,"วันเข้าพรรษา"],["2026-08-12",0,"วันเฉลิมพระชนมพรรษา สมเด็จพระบรมราชชนนีพันปีหลวง และวันแม่แห่งชาติ"],["2026-10-13",0,"วันนวมินทรมหาราช"],["2026-10-23",0,"วันปิยมหาราช"],["2026-12-05",0,"วันคล้ายวันพระบรมราชสมภพ ร.9 วันชาติ และวันพ่อแห่งชาติ"],["2026-12-07",0,"วันหยุดชดเชยวันพ่อแห่งชาติ"],["2026-12-10",0,"วันรัฐธรรมนูญ"],["2026-12-31",0,"วันสิ้นปี"],["2027-01-01",0,"วันขึ้นปีใหม่"],["2027-04-06",0,"วันจักรี"],["2027-04-13","2027-04-15","วันสงกรานต์"]];
const SEED_P=[["academic","2026-05-18",0,"เปิดภาคเรียนที่ 1/2569"],["academic","2026-07-20","2026-07-24","สอบกลางภาคเรียนที่ 1"],["academic","2026-09-28","2026-10-02","สอบปลายภาคเรียนที่ 1"],["academic","2026-10-09",0,"ปิดภาคเรียนที่ 1/2569"],["academic","2026-10-16",0,"ส่งผลการเรียนภาคเรียนที่ 1 / ประชุมอนุมัติผลการเรียน"],["academic","2026-11-02",0,"เปิดภาคเรียนที่ 2/2569"],["academic","2026-12-21","2026-12-25","สอบกลางภาคเรียนที่ 2"],["academic","2027-03-01","2027-03-05","สอบปลายภาคเรียนที่ 2"],["academic","2027-03-31",0,"ปิดภาคเรียนที่ 2/2569"],["general","2026-06-11",0,"พิธีไหว้ครู"],["general","2026-06-20",0,"ประชุมผู้ปกครองนักเรียน ภาคเรียนที่ 1"],["general","2026-07-27",0,"กิจกรรมแห่เทียนพรรษา"],["general","2026-08-11",0,"กิจกรรมวันแม่"],["general","2026-12-04",0,"กิจกรรมวันพ่อ"],["general","2027-01-08",0,"กิจกรรมวันเด็กแห่งชาติ"],["general","2027-01-09",0,"ประชุมผู้ปกครองนักเรียน ภาคเรียนที่ 2"],["general","2027-01-27","2027-01-29","กีฬาสีภายใน"],["personnel","2026-05-11","2026-05-15","ประชุมครูเตรียมความพร้อมก่อนเปิดภาคเรียน"],["personnel","2026-09-25",0,"งานมุทิตาจิตผู้เกษียณอายุราชการ"],["personnel","2026-10-29","2026-10-30","ประชุมครูเตรียมความพร้อมภาคเรียนที่ 2"],["personnel","2027-01-16",0,"วันครู"],["budget","2026-05-25",0,"จัดทำแผนการใช้จ่ายงบประมาณ ภาคเรียนที่ 1"],["budget","2026-09-30",0,"สิ้นปีงบประมาณ 2569 / สรุปการใช้จ่าย"],["budget","2026-10-01",0,"เริ่มปีงบประมาณ 2570"],["budget","2027-03-29","2027-04-02","รายงานผลการใช้งบประมาณประจำปีการศึกษา"]];
function fitGate(){const g=document.getElementById("gate");const w=g&&g.querySelector(".gate-wrap");if(!w||g.hidden)return;w.style.transform="";
  const cs=getComputedStyle(g);const availH=g.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);const h=w.offsetHeight;
  if(h>availH&&h>0)w.style.transform=`scale(${Math.max(.5,availH/h)})`;}
window.addEventListener("resize",()=>{if(!signedIn)fitGate();});
function meMenu(){
  const nm=(S.me&&S.me.name)||"ผู้ใช้งาน";const un=S.myUser&&S.myUser.username;
  modal("บัญชีผู้ใช้",`<div class="acct"><span class="av">${esc(nm.charAt(0))}</span><div><b>${esc(nm)}</b>${un?`<span class="muted num" style="font-size:13px">${esc(un)}</span> `:""}<span class="badge b-makeup">${ROLE_LABEL[S.realRole]}</span>${S.viewAs?` <span class="badge b-sample">กำลังดูแบบ${ROLE_LABEL[S.viewAs]}</span>`:""}</div></div>`,
  `${RANK[S.realRole]>0?`<button class="btn l" data-act="viewas-open">${ic("eye")}ทดลองมุมมองบทบาท</button>`:""}<button class="btn" data-act="pw-open">เปลี่ยนรหัสผ่าน</button><button class="btn danger" data-act="sign-out">ออกจากระบบ</button>`);
}
/* ================= logo ================= */
function fileToLogo(file){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{const N=256;const cv=document.createElement("canvas");cv.width=N;cv.height=N;const cx=cv.getContext("2d");const k=Math.min(N/im.width,N/im.height);const w=im.width*k,h=im.height*k;cx.drawImage(im,(N-w)/2,(N-h)/2,w,h);res(cv.toDataURL("image/png"));};im.src=r.result;};r.readAsDataURL(file);});}
async function uploadLogo(file){const m=document.getElementById("logoMsg");if(!file)return;
  if(file.size>8*1024*1024){if(m)m.textContent="ไฟล์ใหญ่เกิน 8 MB";return;}
  if(m)m.textContent="กำลังบันทึก…";
  try{const data=await fileToLogo(file);await S.db.doc("config/school").set({...S.schoolDoc,logoData:data});toast("เปลี่ยนโลโก้แล้ว");audit("settings","school","เปลี่ยนโลโก้");}
  catch(e){if(m)m.textContent="บันทึกไม่สำเร็จ ลองไฟล์ PNG หรือ JPG";}}
async function removeLogo(){const n={...S.schoolDoc};delete n.logoData;try{await S.db.doc("config/school").set(n);toast("กลับไปใช้ไอคอนเริ่มต้นแล้ว");}catch(e){toast(errText(e));}}

function loadNames(){}

/* ================= events ================= */
function go(r){S.route=r;S.setupDirty=false;MR.innerHTML="";render();window.scrollTo(0,0);}
document.addEventListener("click",async ev=>{
  const t=ev.target.closest("[data-act]");
  if(pk&&!ev.target.closest(".tdp"))closePicker();
  if(!t){if(ev.target.id==="scrim")closeModal();return;}
  const a=t.dataset.act,v=t.dataset.v;
  switch(a){
    case "nav":go(v);break;
    case "more":modal("เมนู",`<div class="sheet">${ROUTES.filter(r=>!["home","days","ops"].includes(r.id)&&!(r.min&&RANK[role()]<RANK[r.min])).map(r=>`<button class="nav" data-act="nav" data-v="${r.id}">${ic(r.icon)}<span>${r.label}</span></button>`).join("")}</div>`,`<button class="btn" data-act="close">ปิด</button>`);break;
    case "ops-term":S.opsTerm=v;render();break;
    case "day":openDay(v);break;
    case "add-hol":holidayForm(null,t.dataset.date);break;
    case "edit-hol":holidayForm(S.holidays.find(h=>h.id===v));break;
    case "del-hol":softDelete("holidays",v);break;
    case "save-hol":t.disabled=true;await saveHol(v);t.disabled=false;break;
    case "add-plan":planForm(null,{div:t.dataset.div,ym:t.dataset.ym,date:t.dataset.date});break;
    case "edit-plan":planForm(S.plans.find(p=>p.id===v));break;
    case "del-plan":softDelete("plans",v);break;
    case "save-plan":await savePlan(v,t);break;
    case "row-add":addRow();MR.querySelectorAll(".pn")[MR.querySelectorAll(".pn").length-1].focus();break;
    case "row-del":{const r=t.closest(".prow");if(MR.querySelectorAll(".prow").length>1){r.remove();numberRows();updSum();}break;}
    case "restore":restore(t.dataset.c,v);break;
    case "purge":purge(t.dataset.c,v);break;
    case "reset":resetYear();break;
    case "viewas":meMenu();break;
    case "viewas-open":viewAsDialog();break;
    case "sign-out":S.viewAs=null;MR.innerHTML="";closePreview();S.route="home";S.loginErr="";signOut(auth);break;
    case "pw-open":pwForm();break;
    case "pw-save":savePw(t);break;
    case "pw-eye":{const i=document.getElementById("lgP");if(i)i.type=i.type==="password"?"text":"password";break;}
    case "user-add":userForm(null);break;
    case "user-edit":userForm(S.users.find(u=>u.id===v));break;
    case "user-save":saveUser(v,t);break;
    case "user-del":deleteUser(v);break;
    case "pv-print":pvPrint();break;
    case "pv-close":closePreview();break;
    case "logo-remove":removeLogo();break;
    case "pv-pdf":pvPdf(t);break;
    case "pv-png":pvPng(t);break;
    case "pv-png1":pvPng1(+v,t);break;
    case "viewas-apply":{const r=checked("va")[0]||S.realRole;S.viewAs=r===S.realRole?null:r;MR.innerHTML="";toast(S.viewAs?`กำลังดูในมุมมอง${ROLE_LABEL[r]}`:"กลับสู่บทบาทจริงแล้ว");render();break;}
    case "print":openPreview(v);break;
    case "close":closeModal();break;
    case "cf-yes":if(MR._res){const r=MR._res;MR._res=null;r(true);}break;
    case "cf-no":closeModal();break;
    case "year-now":S.viewYear=currentYear();S.yearPinned=false;try{localStorage.removeItem("acal-year");}catch(e){}S.opsTerm=null;rerender();break;
    case "view-year":S.viewYear=+v;S.yearPinned=true;try{localStorage.setItem("acal-year",v);}catch(e){}S.opsTerm=null;S.setupDirty=false;rerender();break;
    case "set-current":setCurrent(+v);break;
    case "new-year":newYearDialog();break;
    case "new-year-save":await newYearSave(t);break;
    case "tdp-open":if(pk&&pk.id===v)closePicker();else openPicker(v);break;
    case "tdp-nav":pk.m+=Number(v);if(pk.m<0){pk.m=11;pk.y--;}if(pk.m>11){pk.m=0;pk.y++;}drawPicker();break;
    case "tdp-pick":{const id=pk.id;const inp=document.getElementById(id);inp.value=v;document.getElementById(id+"-btn").innerHTML=tdpLabel(v,pk.wrap.dataset.ph);if(document.getElementById("setupWrap")&&document.getElementById("setupWrap").contains(inp))S.setupDirty=true;closePicker();break;}
  }
});
document.addEventListener("change",ev=>{const tg=ev.target;const k=tg.dataset.change;
  if(tg.id==="logoFile"){uploadLogo(tg.files&&tg.files[0]);return;}
  if(k==="tdp-month"){pk.m=+tg.value;drawPicker();return;}
  if(k==="tdp-year"){pk.y=+tg.value;drawPicker();return;}
  if(k==="year"){S.viewYear=+tg.value;S.yearPinned=true;try{localStorage.setItem("acal-year",tg.value);}catch(e){}S.opsTerm=null;S.setupDirty=false;rerender();return;}
  const g=tg.dataset.tick;if(!g)return;
  const group=[...document.querySelectorAll(`[data-tick="${g}"]`)].filter(i=>i.checked).map(i=>i.value);
  if(g==="pvO"){PV.orient=group[0];buildPreview();return;}
  if(g==="pvB"){PV.brk=group[0];buildPreview();return;}
  if(g==="opsdiv"){prefs.opsDivs=group;savePrefs();render();}
  else if(g==="pdiv"){prefs.pDivs=group;savePrefs();render();}
  else if(g==="htype"){prefs.hTypes=group;savePrefs();render();}
  else if(g==="urole"){prefs.uRoles=group;savePrefs();render();}
  else if(g==="pD")updSum();
});
document.addEventListener("input",ev=>{const tg=ev.target;
  if(tg.closest&&tg.closest("#setupWrap"))S.setupDirty=true;
  if(tg.classList&&tg.classList.contains("pn"))updSum();
  const k=tg.dataset&&tg.dataset.input;if(!k)return;clearTimeout(S._st);const v=tg.value;
  S._st=setTimeout(()=>{if(k==="h-search")S.hSearch=v;else if(k==="u-search")S.uSearch=v;else S.pSearch=v;const pos=tg.selectionStart;render();const el=document.getElementById(k==="h-search"?"hSearch":k==="u-search"?"uSearch":"pSearch");if(el){el.focus();try{el.setSelectionRange(pos,pos);}catch(e){}}},200);});
document.addEventListener("paste",ev=>{const tg=ev.target;if(!tg.classList||!tg.classList.contains("pn")||!document.getElementById("pSum"))return;
  const txt=(ev.clipboardData||window.clipboardData).getData("text");const lines=txt.split(/\r?\n/).map(s=>s.replace(/^\s*[-•*\d.)]+\s*/,"").trim()).filter(Boolean);if(lines.length<2)return;
  ev.preventDefault();tg.value=(tg.value?tg.value+" ":"")+lines[0];let after=tg.closest(".prow");for(const l of lines.slice(1)){addRow("",l,after);after=after.nextElementSibling;}updSum();});
document.addEventListener("keydown",ev=>{
  if(ev.key==="Enter"&&ev.target.classList&&ev.target.classList.contains("pn")&&document.getElementById("pSum")){ev.preventDefault();const row=ev.target.closest(".prow");addRow("","",row);row.nextElementSibling.querySelector(".pn").focus();return;}
  if(ev.key==="Escape"){if(pk)closePicker();else if(MR.innerHTML)closeModal();else if(document.getElementById("pvRoot").innerHTML)closePreview();}});
document.addEventListener("submit",ev=>{const id=ev.target.id;if(id==="loginForm"){ev.preventDefault();doLogin();return;}if(id==="setupFirst"){ev.preventDefault();doSetup();return;}if(!["schoolForm","termForm","sysForm"].includes(id))return;ev.preventDefault();if(id==="schoolForm")saveSchool();else if(id==="termForm")saveTerms();else saveSys();});

/* ================= boot ================= */
compute();render();renderGate();
S.db=DB;S.downloads={save:saveBlob};S.assets=true;
let subs=[];const unsubAll=()=>{subs.forEach(u=>{try{u();}catch(e){}});subs=[];};
const done=k=>{S.loaded[k]=true;rerender();};
/* public: school info, academic years, setup state (shown on the entrance before sign-in) */
DB.doc("config/bootstrap").onSnapshot(s=>{S.bootstrapped=s.exists;S.bootChecked=true;S.connErr=false;renderGate();},()=>{S.bootChecked=true;S.connErr=true;renderGate();});
DB.doc("config/system").onSnapshot(s=>{S.sysDoc=s.exists?s.data():{};if(!S.yearPinned)S.viewYear=currentYear();done("sys");},()=>done("sys"));
DB.doc("config/school").onSnapshot(s=>{S.schoolDoc=s.exists?s.data():{};done("school");},()=>done("school"));
DB.collection("years").onSnapshot(s=>{const m={};for(const d of s.docs)m[+d.id]=d.data();S.yearsDocs=m;done("years");},()=>done("years"));
let authRun=null;
function withTimeout(p,ms){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej({code:"timeout"}),ms))]);}
async function handleAuth(u){
  const key=u?u.uid:"-";if(authRun&&authRun.key===key)return authRun.p;
  const p=handleAuthInner(u);authRun={key,p};try{return await p;}finally{if(authRun&&authRun.p===p)authRun=null;}
}
async function handleAuthInner(u){
  if(u&&signedIn&&S.uid===u.uid)return;
  unsubAll();S.loaded.h=false;S.loaded.p=false;S.holidays=[];S.plans=[];S.audit=[];S.users=[];
  if(!u){S.uid=null;S.me=null;S.myUser=null;S.realRole="teacher";signedIn=false;S.authChecked=true;renderGate();render();return;}
  try{const s=await withTimeout(getDoc(doc(fs,"users",u.uid)),15000);
    if(!s.exists()||s.data().active===false){S.loginErr=!s.exists()?`บัญชีนี้ยังไม่ได้ลงทะเบียนในระบบ (ไม่พบข้อมูลผู้ใช้ ${u.uid.slice(0,8)}…) ติดต่อแอดมินหลัก`:"บัญชีนี้ถูกปิดการใช้งาน ติดต่อแอดมินหลัก";lgStat("");await signOut(auth);return;}
    const d=s.data();S.uid=u.uid;S.myUser=d;S.me={name:d.displayName||d.username};S.realRole=d.role||"teacher";
  }catch(e){console.error("[account]",e);S.loginErr=e&&e.code==="timeout"?"โหลดข้อมูลบัญชีไม่สำเร็จ (หมดเวลา) ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่":`ตรวจสอบบัญชีไม่สำเร็จ (${(e&&e.code)||"unknown"})`;lgStat("");await signOut(auth);return;}
  signedIn=true;S.authChecked=true;S.loginErr="";S.gateMode="";
  updateDoc(doc(fs,"users",u.uid),{lastLogin:new Date().toISOString()}).catch(()=>{});
  subs.push(DB.collection("holidays").onSnapshot(s=>{S.holidays=s.docs.map(d=>({id:d.id,...d.data()}));done("h");},()=>done("h")));
  subs.push(DB.collection("plans").onSnapshot(s=>{S.plans=s.docs.map(d=>({id:d.id,...d.data()}));done("p");},()=>done("p")));
  subs.push(DB.collection("audit").orderBy("at","desc").limit(200).onSnapshot(s=>{S.audit=s.docs.map(d=>({id:d.id,...d.data()}));if(S.route==="people")render();},()=>{}));
  subs.push(DB.collection("users").onSnapshot(s=>{S.users=s.docs.map(d=>({id:d.id,...d.data()}));const me=S.users.find(x=>x.id===S.uid);
    if(me){if(me.active===false){S.loginErr="บัญชีนี้ถูกปิดการใช้งาน ติดต่อแอดมินหลัก";signOut(auth);return;}S.realRole=me.role;S.myUser=me;S.me={name:me.displayName||me.username};}
    else if(S.uid){S.loginErr="บัญชีนี้ถูกลบออกจากระบบแล้ว";signOut(auth);return;}
    renderNav();if(S.route==="people")render();},()=>{}));
  renderGate();render();toast(`ยินดีต้อนรับ ${S.me.name}`);
}
onAuthStateChanged(auth,u=>{if(S.settingUp)return;handleAuth(u);});
function gateError(m){console.error(m);if(signedIn)return;const e=document.getElementById("lgErr")||document.getElementById("sfErr");if(e){e.hidden=false;e.textContent="เกิดข้อผิดพลาด: "+String(m&&m.message||m).slice(0,200);}lgStat("");}
window.addEventListener("error",ev=>gateError(ev.error||ev.message));
window.addEventListener("unhandledrejection",ev=>gateError(ev.reason&&(ev.reason.code||ev.reason.message)||ev.reason));
})();
