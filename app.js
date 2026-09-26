/* Quản Lý Nội Dung YouTube — toàn bộ logic ứng dụng */
(function(){
"use strict";

/* ========================= Hằng số & mô hình dữ liệu ========================= */
const STORAGE_KEY = "ytcm_data_v1";
const BACKUP_KEY = "ytcm_backups_v1";
const UNDO_LIMIT = 15;
const TRASH_RETENTION_DAYS = 30;
const BACKUP_MIN_INTERVAL_MS = 10*60*1000;
const EXPORT_REMIND_DAYS = 7;

const STATUS_LIST = [
  {key:"idea", label:"Ý tưởng"},
  {key:"research", label:"Nghiên cứu"},
  {key:"script", label:"Viết kịch bản"},
  {key:"voice", label:"Thu âm/Voice"},
  {key:"edit", label:"Dựng video"},
  {key:"thumbnail", label:"Thumbnail"},
  {key:"scheduled", label:"Đã lên lịch"},
  {key:"published", label:"Đã đăng"}
];
const STATUS_MAP = Object.fromEntries(STATUS_LIST.map(s=>[s.key,s.label]));
const VALID_VIEWS = ["dashboard","ideas","kanban","calendar","stats","trash","settings"];
const WEEKDAY_LABELS = ["Th 2","Th 3","Th 4","Th 5","Th 6","Th 7","CN"];
const PRIORITY_LABELS = {low:"Thấp", medium:"Trung bình", high:"Cao"};

/* ========================= Trạng thái toàn cục ========================= */
let state = null;
let undoStack = [];
let currentView = "dashboard";
let calAnchor = new Date();
let calMode = "month";
let activeVideoId = null;
let activeVideoTab = "info";
let chartsRegistry = {};
let sortableInstances = [];
let kanbanFilters = {channel:"all", type:"all", tag:"", q:""};
let ideasFilter = {channel:"all"};
let trashFilter = "all";
let lastFocusEl = null;

/* ========================= Tiện ích ========================= */
function uid(p){ return p+"_"+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function pad2(n){ return n<10 ? "0"+n : ""+n; }
function esc(s){ return (s==null?"":String(s)).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function qs(sel, root){ return (root||document).querySelector(sel); }
function qsa(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }

function toISODate(d){ if(!(d instanceof Date)) d=new Date(d); return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate()); }
function todayISO(){ return toISODate(new Date()); }
function parseISO(s){ if(!s) return null; const parts=s.split("-").map(Number); return new Date(parts[0],parts[1]-1,parts[2]); }
function fmtDate(iso){ if(!iso) return "—"; const d=parseISO(iso); if(!d||isNaN(d)) return "—"; return pad2(d.getDate())+"/"+pad2(d.getMonth()+1)+"/"+d.getFullYear(); }
function fmtDateTime(ts){ if(!ts) return "—"; const d=new Date(ts); return pad2(d.getDate())+"/"+pad2(d.getMonth()+1)+"/"+d.getFullYear()+" "+pad2(d.getHours())+":"+pad2(d.getMinutes()); }
function daysBetweenISO(aISO,bISO){ const a=parseISO(aISO), b=parseISO(bISO); if(!a||!b) return null; return Math.round((b-a)/86400000); }
function startOfWeek(d){ const dt=new Date(d.getFullYear(),d.getMonth(),d.getDate()); const day=(dt.getDay()+6)%7; dt.setDate(dt.getDate()-day); return dt; }
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function addMonths(d,n){ return new Date(d.getFullYear(), d.getMonth()+n, 1); }
function sameISO(a,b){ return a===b; }
function timeToSeconds(t){ if(!t) return 0; const parts=String(t).split(":").map(Number); if(parts.some(isNaN)) return 0; let s=0; for(const p of parts) s=s*60+p; return s; }
function wordCount(text){ const m=(text||"").trim().match(/\S+/g); return m?m.length:0; }
function num(v){ const n=Number(v); return isNaN(n)?0:n; }

/* ========================= Mô hình mặc định ========================= */
function defaultChannels(){
  return [
    {id:"ch_verlox", name:"VΞRLOX", color:"#6c5ce7", description:"Video khoa học/kiến thức kiểu Kurzgesagt, Vsauce", goalPerWeek:2, archived:false,
      checklistTemplate:["Nghiên cứu chủ đề","Viết kịch bản","Ghi âm voice","Dựng video & hiệu ứng","Làm thumbnail","Viết tiêu đề & mô tả","Lên lịch đăng"],
      descriptionTemplate:"{title}\n\nTrong video này, chúng ta sẽ cùng khám phá một hiện tượng khoa học thú vị.\n\n⏱ Chương:\n\n🔔 Đăng ký kênh VΞRLOX để không bỏ lỡ video mới!\n\n#khoahoc #verlox #kienthuc"},
    {id:"ch_matmadithuong", name:"Mật Mã Dị Thường", color:"#e17055", description:"SCP, Backrooms, truyện kinh dị, bí ẩn", goalPerWeek:2, archived:false,
      checklistTemplate:["Nghiên cứu & chọn chủ đề","Viết kịch bản","Ghi âm voice","Dựng video","Làm thumbnail rùng rợn","Viết tiêu đề & mô tả","Lên lịch đăng"],
      descriptionTemplate:"{title}\n\nCảnh báo: nội dung có thể gây ám ảnh nhẹ.\n\n🔔 Đăng ký Mật Mã Dị Thường để theo dõi các bí ẩn tiếp theo!\n\n#scp #backrooms #bianho #kinhdi"},
    {id:"ch_pttbt", name:"Phát Triển Bản Thân", color:"#00b894", description:"Kênh phát triển bản thân, video dài (đang chuẩn bị)", goalPerWeek:1, archived:false,
      checklistTemplate:["Lên ý tưởng & dàn bài","Viết kịch bản chi tiết","Ghi âm voice","Dựng video","Làm thumbnail","Viết tiêu đề & mô tả","Lên lịch đăng"],
      descriptionTemplate:"{title}\n\nVideo này chia sẻ những bài học giúp bạn phát triển bản thân mỗi ngày.\n\n🔔 Đăng ký kênh để nhận video mới!\n\n#pháttriểnbảnthân #kynang"}
  ];
}
function newChannel(o){
  return Object.assign({id:uid("ch"), name:"Kênh mới", color:"#6c5ce7", description:"", goalPerWeek:1, archived:false,
    checklistTemplate:["Nghiên cứu","Viết kịch bản","Dựng video","Đăng bài"],
    descriptionTemplate:"{title}\n\n#video"}, o);
}
function newVideo(o){
  const ch = (o&&o.channelId) || (state.channels[0] && state.channels[0].id) || null;
  return Object.assign({
    id:uid("v"), channelId:ch, title:"Video mới", status:"idea", type:"long", series:"",
    deadline:"", publishDate:"", tags:[], notes:"",
    checklist:[], research:[], script:{content:"", wpm: (state.settings && state.settings.wpm)||150},
    titleOptions:[], thumbnailIdeas:[], descriptionTemplate:"", description:"", chapters:[],
    resources:[], links:{drive:"", scriptExternal:"", youtube:""}, shortsIds:[],
    performance:{h48:{}, d7:{}, d30:{}},
    createdAt:Date.now(), updatedAt:Date.now(), publishedAt:null,
    archived:false, deletedAt:null, sample:false
  }, o);
}
function newIdea(o){
  return Object.assign({
    id:uid("i"), title:"Ý tưởng mới", channelId:(state.channels[0]&&state.channels[0].id)||null,
    note:"", priority:"medium", inspirationLink:"",
    scores:{appeal:3, difficulty:3, viewPotential:3},
    createdAt:Date.now(), deletedAt:null, sample:false
  }, o);
}
function defaultState(){
  return {channels: defaultChannels(), videos:[], ideas:[], settings:{theme:"dark", wpm:150, lastExportAt:null, seeded:false}};
}
function applyChecklistTemplate(video){
  const ch = channelById(video.channelId);
  const tpl = (ch && ch.checklistTemplate) || [];
  video.checklist = tpl.map(t=>({id:uid("c"), text:t, done:false}));
}

/* ========================= Dữ liệu mẫu ========================= */
function seedSampleData(){
  const [ch1,ch2,ch3] = state.channels;
  const today = new Date();
  function d(offset){ return toISODate(addDays(today, offset)); }
  const sVideos = [
    newVideo({channelId:ch1.id, title:"Vì sao lỗ đen không hề đen?", status:"published", type:"long", tags:["lỗ đen","vật lý"],
      publishDate:d(-20), publishedAt:addDays(today,-20).getTime(), createdAt:addDays(today,-33).getTime(),
      performance:{h48:{views:12000,likes:900,comments:80,ctr:"6.2%",avgDuration:"4:10"}, d7:{views:45000,likes:2600,comments:210,ctr:"5.8%",avgDuration:"4:32"}, d30:{views:98000,likes:5400,comments:390,ctr:"5.1%",avgDuration:"4:40"}}, sample:true}),
    newVideo({channelId:ch1.id, title:"Điều gì xảy ra nếu Trái Đất ngừng quay?", status:"edit", type:"long", tags:["trái đất","giả tưởng khoa học"],
      deadline:d(4), publishDate:d(7), createdAt:addDays(today,-6).getTime(), sample:true}),
    newVideo({channelId:ch1.id, title:"Nghịch lý sinh đôi của Einstein", status:"script", type:"long", tags:["thuyết tương đối"],
      deadline:d(9), createdAt:addDays(today,-3).getTime(), sample:true}),
    newVideo({channelId:ch1.id, title:"3 nghịch lý lượng tử khiến bạn mất ngủ", status:"idea", type:"short", tags:["lượng tử","shorts"],
      createdAt:addDays(today,-1).getTime(), sample:true}),
    newVideo({channelId:ch2.id, title:"SCP-096: Sinh vật không được nhìn mặt", status:"published", type:"long", tags:["scp"],
      publishDate:d(-14), publishedAt:addDays(today,-14).getTime(), createdAt:addDays(today,-25).getTime(),
      performance:{h48:{views:20000,likes:1500,comments:150,ctr:"7.1%",avgDuration:"5:02"}, d7:{views:80000,likes:4900,comments:520,ctr:"6.6%",avgDuration:"5:20"}, d30:{views:0,likes:0,comments:0,ctr:"",avgDuration:""}}, sample:true}),
    newVideo({channelId:ch2.id, title:"Backrooms: Thực tại lệch tầng là gì?", status:"thumbnail", type:"long", tags:["backrooms"],
      deadline:d(2), publishDate:d(3), createdAt:addDays(today,-8).getTime(), sample:true}),
    newVideo({channelId:ch2.id, title:"5 SCP đáng sợ nhất từng được ghi nhận", status:"voice", type:"long", tags:["scp","top5"],
      deadline:d(-1), publishDate:d(2), createdAt:addDays(today,-10).getTime(), sample:true}),
    newVideo({channelId:ch2.id, title:"Bí ẩn ngôi làng biến mất sau một đêm", status:"research", type:"long", tags:["bí ẩn"],
      deadline:d(12), createdAt:addDays(today,-2).getTime(), sample:true}),
    newVideo({channelId:ch3.id, title:"Cách xây dựng thói quen buổi sáng hiệu quả", status:"scheduled", type:"long", tags:["thói quen"],
      publishDate:d(1), createdAt:addDays(today,-15).getTime(), sample:true}),
    newVideo({channelId:ch3.id, title:"Kỷ luật bản thân bắt đầu từ đâu?", status:"idea", type:"long", tags:["kỷ luật"],
      createdAt:addDays(today,-1).getTime(), sample:true})
  ];
  sVideos.forEach(v=>{ if(!v.checklist.length) applyChecklistTemplate(v); if(v.status==="published" && !v.deletedAt){} });
  state.videos.push(...sVideos);

  const sIdeas = [
    newIdea({channelId:ch1.id, title:"Vì sao thời gian chỉ chảy về một hướng?", note:"Liên quan entropy, mũi tên thời gian", priority:"high", scores:{appeal:5,difficulty:4,viewPotential:4}, sample:true}),
    newIdea({channelId:ch1.id, title:"Đa vũ trụ có thật hay không?", note:"", priority:"medium", scores:{appeal:4,difficulty:3,viewPotential:5}, sample:true}),
    newIdea({channelId:ch2.id, title:"Hiện tượng Mandela Effect", note:"Nhiều case study thú vị", priority:"high", scores:{appeal:5,difficulty:2,viewPotential:5}, sample:true}),
    newIdea({channelId:ch2.id, title:"Thị trấn ma ở Nhật Bản", note:"", priority:"low", scores:{appeal:3,difficulty:3,viewPotential:3}, sample:true}),
    newIdea({channelId:ch3.id, title:"7 cuốn sách thay đổi tư duy", note:"Series nhiều phần", priority:"medium", scores:{appeal:4,difficulty:2,viewPotential:3}, sample:true})
  ];
  state.ideas.push(...sIdeas);
  state.settings.seeded = true;
}

/* ========================= Lưu trữ / Backup / Undo / Thùng rác ========================= */
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ console.error("Lỗi đọc dữ liệu:", e); }
  return null;
}
let saveTimer=null;
function scheduleSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(persist, 250); }
function persist(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    maybeBackup();
  }catch(e){ console.error("Lỗi lưu dữ liệu:", e); toast("Không thể lưu dữ liệu (bộ nhớ đầy?)", "danger"); }
}
function getBackups(){ try{ return JSON.parse(localStorage.getItem(BACKUP_KEY))||[]; }catch(e){ return []; } }
function maybeBackup(){
  const backups = getBackups();
  const last = backups[backups.length-1];
  const now = Date.now();
  if(!last || (now-last.ts) > BACKUP_MIN_INTERVAL_MS){
    backups.push({ts:now, data:clone(state)});
    while(backups.length>5) backups.shift();
    try{ localStorage.setItem(BACKUP_KEY, JSON.stringify(backups)); }catch(e){ console.error(e); }
  }
}
function forceBackupNow(){
  const backups = getBackups();
  backups.push({ts:Date.now(), data:clone(state)});
  while(backups.length>5) backups.shift();
  localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
}

function pushUndo(label){
  undoStack.push({label, ts:Date.now(), snapshot:clone(state)});
  if(undoStack.length>UNDO_LIMIT) undoStack.shift();
  updateUndoBtn();
}
function undo(){
  if(!undoStack.length) return;
  const last = undoStack.pop();
  state = last.snapshot;
  persist();
  renderView(currentView);
  updateUndoBtn();
  toast("Đã hoàn tác: "+last.label);
}
function updateUndoBtn(){
  const btn = qs("#btn-undo");
  if(!btn) return;
  btn.disabled = undoStack.length===0;
  btn.title = undoStack.length ? "Hoàn tác: "+undoStack[undoStack.length-1].label+" (Ctrl+Z)" : "Không có gì để hoàn tác";
}
function purgeOldTrash(){
  const now = Date.now();
  const lim = TRASH_RETENTION_DAYS*86400000;
  state.videos = state.videos.filter(v=> !(v.deletedAt && (now-v.deletedAt)>lim));
  state.ideas = state.ideas.filter(i=> !(i.deletedAt && (now-i.deletedAt)>lim));
}

/* ========================= Trợ giúp truy vấn dữ liệu ========================= */
function channelById(id){ return state.channels.find(c=>c.id===id); }
function channelName(id){ const c=channelById(id); return c? c.name : "—"; }
function channelColor(id){ const c=channelById(id); return c? c.color : "#888"; }
function activeChannels(){ return state.channels.filter(c=>!c.archived); }
function activeVideos(){ return state.videos.filter(v=>!v.deletedAt && !v.archived); }
function activeIdeas(){ return state.ideas.filter(i=>!i.deletedAt); }
function videoById(id){ return state.videos.find(v=>v.id===id); }
function chDot(color){ return '<span class="ch-dot" style="background:'+esc(color)+'"></span>'; }
function statusLabel(k){ return STATUS_MAP[k]||k; }

/* ========================= Toast & Modal & Confirm ========================= */
function toast(msg, kind){
  const c = qs("#toast-container");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = '<span>'+esc(msg)+'</span>';
  c.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .3s"; setTimeout(()=>el.remove(),300); }, 3200);
}
function closeModal(){
  qs("#modal-root").innerHTML = "";
  if(lastFocusEl){ try{ lastFocusEl.focus(); }catch(e){} lastFocusEl=null; }
}
function openModalHTML(html){
  lastFocusEl = document.activeElement;
  qs("#modal-root").innerHTML = html;
}
function confirmDialog(message, onYes, opts){
  opts = opts||{};
  lastFocusEl = document.activeElement;
  qs("#modal-root").innerHTML =
    '<div class="modal-overlay" id="confirm-overlay"><div class="modal-box" style="max-width:420px">'+
    '<div class="modal-head"><h3>'+esc(opts.title||"Xác nhận")+'</h3></div>'+
    '<div class="modal-body">'+esc(message)+'</div>'+
    '<div class="modal-foot"><button class="btn" id="confirm-no">Hủy</button><button class="btn '+(opts.danger?"btn-danger":"btn-primary")+'" id="confirm-yes">'+esc(opts.yesLabel||"Xác nhận")+'</button></div>'+
    '</div></div>';
  qs("#confirm-no").addEventListener("click", closeModal);
  qs("#confirm-overlay").addEventListener("click", e=>{ if(e.target.id==="confirm-overlay") closeModal(); });
  qs("#confirm-yes").addEventListener("click", ()=>{ closeModal(); onYes(); });
}

/* ========================= Điều hướng ========================= */
function switchView(view){
  if(!VALID_VIEWS.includes(view)) view="dashboard";
  currentView = view;
  qsa(".view").forEach(el=> el.classList.toggle("hidden", el.id !== "view-"+view));
  qsa("#sidenav .nav-btn[data-view]").forEach(b=> b.classList.toggle("active", b.dataset.view===view));
  qsa("#bottomnav button[data-view]").forEach(b=> b.classList.toggle("active", b.dataset.view===view));
  if(location.hash.replace("#","") !== view) history.replaceState(null,"","#"+view);
  closeMobileNav();
  renderView(view);
}
function renderView(view){
  destroySortables();
  if(view==="dashboard") renderDashboard();
  else if(view==="ideas") renderIdeas();
  else if(view==="kanban") renderKanban();
  else if(view==="calendar") renderCalendar();
  else if(view==="stats") renderStats();
  else if(view==="trash") renderTrash();
  else if(view==="settings") renderSettings();
}
function closeMobileNav(){
  qs("#sidenav").classList.remove("mobile-open");
  qs("#nav-overlay").classList.remove("show");
}
function destroySortables(){
  sortableInstances.forEach(s=>{ try{ s.destroy(); }catch(e){} });
  sortableInstances = [];
}

/* ========================= TRANG TỔNG QUAN ========================= */
function renderDashboard(){
  const root = qs("#view-dashboard");
  const vids = activeVideos();
  const chans = activeChannels();
  const now = new Date();

  let banner = "";
  if(needsExportReminder()){
    banner = '<div class="banner"><span>⚠️ Bạn chưa xuất dữ liệu sao lưu trong hơn '+EXPORT_REMIND_DAYS+' ngày. Hãy xuất file .json để tránh mất dữ liệu.</span>'+
      '<span class="row"><button class="btn btn-sm btn-primary" id="dash-export-now">Xuất dữ liệu ngay</button></span></div>';
  }

  // Bảng số lượng theo trạng thái & kênh
  let statusTable = '<table class="status-table"><thead><tr><th>Kênh</th>'+STATUS_LIST.map(s=>'<th>'+esc(s.label)+'</th>').join("")+'<th>Tổng</th></tr></thead><tbody>';
  chans.forEach(c=>{
    const cv = vids.filter(v=>v.channelId===c.id);
    statusTable += '<tr><td>'+chDot(c.color)+' '+esc(c.name)+'</td>'+
      STATUS_LIST.map(s=>'<td>'+cv.filter(v=>v.status===s.key).length+'</td>').join("")+
      '<td><b>'+cv.length+'</b></td></tr>';
  });
  statusTable += '</tbody></table>';

  // Hạn chót & trễ hạn
  const withDeadline = vids.filter(v=>v.deadline && v.status!=="published").map(v=>({v, days: daysBetweenISO(todayISO(), v.deadline)}))
    .filter(x=> x.days<=7).sort((a,b)=>a.days-b.days);
  let deadlineHTML = withDeadline.length ? withDeadline.map(x=>{
    const overdue = x.days<0;
    return '<div class="deadline-item">'+chDot(channelColor(x.v.channelId))+
      '<span style="flex:1" class="dashlink" data-openvideo="'+x.v.id+'">'+esc(x.v.title)+'</span>'+
      '<span class="'+(overdue?"overdue":"")+'">'+(overdue? Math.abs(x.days)+" ngày trễ" : (x.days===0? "Hôm nay" : "Còn "+x.days+" ngày"))+'</span></div>';
  }).join("") : '<div class="empty-hint">Không có video nào sắp đến hạn 🎉</div>';

  // Mục tiêu đăng theo tuần/tháng
  const weekStartISO = toISODate(startOfWeek(now));
  const monthStartISO = toISODate(startOfMonth(now));
  let goalsHTML = chans.map(c=>{
    const cv = vids.filter(v=>v.channelId===c.id && v.status==="published" && v.publishDate);
    const wCount = cv.filter(v=> v.publishDate>=weekStartISO).length;
    const mCount = cv.filter(v=> v.publishDate>=monthStartISO).length;
    const wGoal = c.goalPerWeek||1;
    const mGoal = Math.max(1, Math.round(wGoal*4.33));
    const wPct = clamp(Math.round(wCount/wGoal*100),0,100);
    const mPct = clamp(Math.round(mCount/mGoal*100),0,100);
    return '<div class="channel-goal-row"><div class="name">'+chDot(c.color)+' '+esc(c.name)+'</div>'+
      '<div class="bars">'+
      '<div><div class="lbl"><span>Tuần này</span><span>'+wCount+'/'+wGoal+'</span></div><div class="progress"><div style="width:'+wPct+'%;background:'+c.color+'"></div></div></div>'+
      '<div><div class="lbl"><span>Tháng này</span><span>'+mCount+'/'+mGoal+'</span></div><div class="progress"><div style="width:'+mPct+'%;background:'+c.color+'"></div></div></div>'+
      '</div></div>';
  }).join("") || '<div class="empty-hint">Chưa có kênh nào</div>';

  // Streak & video trong tháng
  const publishedDates = new Set(vids.filter(v=>v.status==="published" && v.publishDate).map(v=>v.publishDate));
  let streak=0; let cursor = new Date(now);
  if(!publishedDates.has(todayISO())) cursor = addDays(cursor,-1);
  while(publishedDates.has(toISODate(cursor))){ streak++; cursor=addDays(cursor,-1); }
  const monthCount = vids.filter(v=>v.status==="published" && v.publishDate && v.publishDate>=monthStartISO).length;
  const totalActive = vids.length;
  const overdueCount = vids.filter(v=>v.deadline && v.status!=="published" && daysBetweenISO(todayISO(),v.deadline)<0).length;

  root.innerHTML =
    '<h1 class="page-title">Tổng quan</h1>'+
    banner+
    '<div class="grid grid-4" style="margin-bottom:18px">'+
      statCard(totalActive,"Video đang quản lý")+
      statCard(streak+" ngày","🔥 Chuỗi đăng liên tục")+
      statCard(monthCount,"Video đã đăng trong tháng")+
      statCard(overdueCount,"Video trễ hạn", overdueCount>0?"var(--danger)":null)+
    '</div>'+
    '<div class="grid grid-2">'+
      '<div class="card"><div class="section-title">Số video theo trạng thái &amp; kênh</div><div style="overflow-x:auto">'+statusTable+'</div></div>'+
      '<div class="card"><div class="section-title">Hạn chót trong 7 ngày tới</div>'+deadlineHTML+'</div>'+
      '<div class="card"><div class="section-title">Mục tiêu đăng bài</div>'+goalsHTML+'</div>'+
      '<div class="card"><div class="section-title">Video sắp đăng</div>'+renderUpcomingPublish(vids)+'</div>'+
    '</div>';

  qsa("[data-openvideo]", root).forEach(el=> el.style.cursor="pointer");
  qsa("[data-openvideo]", root).forEach(el=> el.addEventListener("click", ()=>openVideoModal(el.dataset.openvideo)));
  const expBtn = qs("#dash-export-now"); if(expBtn) expBtn.addEventListener("click", exportData);
}
function renderUpcomingPublish(vids){
  const list = vids.filter(v=>v.publishDate && v.status!=="published" && v.publishDate>=todayISO()).sort((a,b)=>a.publishDate.localeCompare(b.publishDate)).slice(0,6);
  if(!list.length) return '<div class="empty-hint">Chưa có video nào được lên lịch</div>';
  return list.map(v=> '<div class="deadline-item">'+chDot(channelColor(v.channelId))+'<span style="flex:1" class="dashlink" data-openvideo="'+v.id+'">'+esc(v.title)+'</span><span class="text-dim">'+fmtDate(v.publishDate)+'</span></div>').join("");
}
function statCard(num,label,color){
  return '<div class="card stat-card"><div class="num" '+(color?('style="color:'+color+'"'):"")+'>'+num+'</div><div class="lbl">'+esc(label)+'</div></div>';
}
function needsExportReminder(){
  const last = state.settings.lastExportAt;
  if(!last) return (state.videos.length + state.ideas.length) > 0;
  return (Date.now()-last) > EXPORT_REMIND_DAYS*86400000;
}

/* ========================= KHO Ý TƯỞNG ========================= */
function ideaScore(i){ return num(i.scores.appeal)+num(i.scores.viewPotential)+(6-num(i.scores.difficulty)); }
function renderIdeas(){
  const root = qs("#view-ideas");
  const chans = activeChannels();
  const filterOpt = '<option value="all">Tất cả kênh</option>'+chans.map(c=>'<option value="'+c.id+'" '+(ideasFilter.channel===c.id?"selected":"")+'>'+esc(c.name)+'</option>').join("");
  root.innerHTML =
    '<div class="row-between" style="margin-bottom:14px"><h1 class="page-title" style="margin:0">Kho ý tưởng</h1>'+
    '<select id="ideas-channel-filter" style="width:auto">'+filterOpt+'</select></div>'+
    '<div class="card" style="margin-bottom:16px"><div class="section-title">➕ Thêm ý tưởng nhanh</div>'+ideaFormHTML()+'</div>'+
    '<div id="ideas-list"></div>';
  qs("#ideas-channel-filter").value = ideasFilter.channel;
  qs("#ideas-channel-filter").addEventListener("change", e=>{ ideasFilter.channel=e.target.value; renderIdeasList(); });
  bindIdeaForm();
  renderIdeasList();
}
function ideaFormHTML(){
  const chans = activeChannels();
  return '<div class="grid grid-2">'+
    '<label class="field"><span>Tiêu đề</span><input id="if-title" placeholder="Ví dụ: Vì sao bầu trời màu xanh?"></label>'+
    '<label class="field"><span>Kênh</span><select id="if-channel">'+chans.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join("")+'</select></label>'+
    '<label class="field"><span>Nguồn cảm hứng (link)</span><input id="if-link" placeholder="https://..."></label>'+
    '<label class="field"><span>Mức ưu tiên</span><select id="if-priority"><option value="low">Thấp</option><option value="medium" selected>Trung bình</option><option value="high">Cao</option></select></label>'+
    '</div>'+
    '<label class="field"><span>Ghi chú</span><textarea id="if-note" rows="2" placeholder="Ghi chú thêm..."></textarea></label>'+
    '<div class="grid grid-3">'+scoreSlider("if-appeal","Mức hấp dẫn",3)+scoreSlider("if-difficulty","Độ khó sản xuất",3)+scoreSlider("if-viewpotential","Tiềm năng view",3)+'</div>'+
    '<button class="btn btn-primary" id="if-submit" style="margin-top:6px">Thêm ý tưởng</button>';
}
function scoreSlider(id,label,val){
  return '<label class="field"><span>'+esc(label)+': <b id="'+id+'-val">'+val+'</b>/5</span><input type="range" min="1" max="5" value="'+val+'" id="'+id+'"></label>';
}
function bindIdeaForm(){
  ["if-appeal","if-difficulty","if-viewpotential"].forEach(id=>{
    qs("#"+id).addEventListener("input", e=> qs("#"+id+"-val").textContent = e.target.value);
  });
  qs("#if-submit").addEventListener("click", ()=>{
    const title = qs("#if-title").value.trim();
    if(!title){ toast("Vui lòng nhập tiêu đề ý tưởng","danger"); qs("#if-title").focus(); return; }
    pushUndo("Thêm ý tưởng");
    state.ideas.push(newIdea({
      title, channelId: qs("#if-channel").value, note: qs("#if-note").value.trim(),
      inspirationLink: qs("#if-link").value.trim(), priority: qs("#if-priority").value,
      scores:{appeal:num(qs("#if-appeal").value), difficulty:num(qs("#if-difficulty").value), viewPotential:num(qs("#if-viewpotential").value)}
    }));
    scheduleSave();
    toast("Đã thêm ý tưởng");
    renderIdeas();
  });
}
function renderIdeasList(){
  const cont = qs("#ideas-list");
  let list = activeIdeas();
  if(ideasFilter.channel!=="all") list = list.filter(i=>i.channelId===ideasFilter.channel);
  list = list.slice().sort((a,b)=> ideaScore(b)-ideaScore(a) || b.createdAt-a.createdAt);
  if(!list.length){ cont.innerHTML = '<div class="empty-hint">Chưa có ý tưởng nào. Hãy thêm ý tưởng đầu tiên!</div>'; return; }
  cont.innerHTML = list.map(i=>{
    const c = channelById(i.channelId);
    return '<div class="card idea-card" style="border-left-color:'+(c?c.color:"#888")+'">'+
      '<div class="row-between"><div style="font-weight:700;font-size:14px">'+esc(i.title)+'</div>'+
      '<span class="badge">'+ideaScore(i)+' điểm</span></div>'+
      '<div class="row" style="margin-top:4px"><span class="badge">'+chDot(c?c.color:"#888")+' '+esc(c?c.name:"—")+'</span>'+
      '<span class="badge">Ưu tiên: '+PRIORITY_LABELS[i.priority]+'</span>'+
      (i.inspirationLink?'<a href="'+esc(i.inspirationLink)+'" target="_blank" rel="noopener" class="badge">🔗 Nguồn</a>':"")+
      '</div>'+
      (i.note? '<div class="text-dim" style="margin-top:6px;font-size:12.5px">'+esc(i.note)+'</div>' : "")+
      '<div class="scores">Hấp dẫn: <b>'+i.scores.appeal+'</b> · Độ khó: <b>'+i.scores.difficulty+'</b> · Tiềm năng view: <b>'+i.scores.viewPotential+'</b></div>'+
      '<div class="row" style="margin-top:10px">'+
      '<button class="btn btn-sm" data-editidea="'+i.id+'">Sửa</button>'+
      '<button class="btn btn-sm btn-success" data-toideo="'+i.id+'">Chuyển thành video</button>'+
      '<button class="btn btn-sm btn-danger" data-delidea="'+i.id+'">Xóa</button>'+
      '</div></div>';
  }).join("");
  qsa("[data-editidea]",cont).forEach(b=> b.addEventListener("click", ()=>openIdeaEditModal(b.dataset.editidea)));
  qsa("[data-toideo]",cont).forEach(b=> b.addEventListener("click", ()=>convertIdeaToVideo(b.dataset.toideo)));
  qsa("[data-delidea]",cont).forEach(b=> b.addEventListener("click", ()=>{
    confirmDialog("Xóa ý tưởng này? Ý tưởng sẽ được chuyển vào Thùng rác trong 30 ngày.", ()=>{
      pushUndo("Xóa ý tưởng");
      const idea = state.ideas.find(x=>x.id===b.dataset.delidea);
      if(idea) idea.deletedAt = Date.now();
      scheduleSave(); toast("Đã chuyển ý tưởng vào thùng rác"); renderIdeasList();
    }, {danger:true, yesLabel:"Xóa"});
  }));
}
function convertIdeaToVideo(id){
  const idea = state.ideas.find(x=>x.id===id);
  if(!idea) return;
  pushUndo("Chuyển ý tưởng thành video");
  const v = newVideo({channelId:idea.channelId, title:idea.title, notes:idea.note, status:"idea"});
  applyChecklistTemplate(v);
  state.videos.push(v);
  idea.deletedAt = Date.now();
  scheduleSave();
  toast("Đã chuyển thành video");
  renderIdeasList();
  openVideoModal(v.id);
}
function openIdeaEditModal(id){
  const idea = state.ideas.find(x=>x.id===id);
  if(!idea) return;
  const chans = activeChannels();
  openModalHTML(
    '<div class="modal-overlay" id="idea-edit-overlay"><div class="modal-box">'+
    '<div class="modal-head"><h3>Sửa ý tưởng</h3><button class="btn btn-icon btn-ghost" id="idea-edit-close">✕</button></div>'+
    '<div class="modal-body">'+
    '<label class="field"><span>Tiêu đề</span><input id="ie-title" value="'+esc(idea.title)+'"></label>'+
    '<label class="field"><span>Kênh</span><select id="ie-channel">'+chans.map(c=>'<option value="'+c.id+'" '+(c.id===idea.channelId?"selected":"")+'>'+esc(c.name)+'</option>').join("")+'</select></label>'+
    '<label class="field"><span>Nguồn cảm hứng</span><input id="ie-link" value="'+esc(idea.inspirationLink)+'"></label>'+
    '<label class="field"><span>Mức ưu tiên</span><select id="ie-priority">'+
      Object.keys(PRIORITY_LABELS).map(k=>'<option value="'+k+'" '+(k===idea.priority?"selected":"")+'>'+PRIORITY_LABELS[k]+'</option>').join("")+
    '</select></label>'+
    '<label class="field"><span>Ghi chú</span><textarea id="ie-note" rows="2">'+esc(idea.note)+'</textarea></label>'+
    '<div class="grid grid-3">'+scoreSlider("ie-appeal","Mức hấp dẫn",idea.scores.appeal)+scoreSlider("ie-difficulty","Độ khó sản xuất",idea.scores.difficulty)+scoreSlider("ie-viewpotential","Tiềm năng view",idea.scores.viewPotential)+'</div>'+
    '</div><div class="modal-foot"><button class="btn" id="idea-edit-cancel">Hủy</button><button class="btn btn-primary" id="idea-edit-save">Lưu</button></div>'+
    '</div></div>'
  );
  ["ie-appeal","ie-difficulty","ie-viewpotential"].forEach(id2=> qs("#"+id2).addEventListener("input", e=> qs("#"+id2+"-val").textContent=e.target.value));
  qs("#idea-edit-close").addEventListener("click", closeModal);
  qs("#idea-edit-cancel").addEventListener("click", closeModal);
  qs("#idea-edit-overlay").addEventListener("click", e=>{ if(e.target.id==="idea-edit-overlay") closeModal(); });
  qs("#idea-edit-save").addEventListener("click", ()=>{
    pushUndo("Sửa ý tưởng");
    idea.title = qs("#ie-title").value.trim() || idea.title;
    idea.channelId = qs("#ie-channel").value;
    idea.inspirationLink = qs("#ie-link").value.trim();
    idea.priority = qs("#ie-priority").value;
    idea.note = qs("#ie-note").value.trim();
    idea.scores = {appeal:num(qs("#ie-appeal").value), difficulty:num(qs("#ie-difficulty").value), viewPotential:num(qs("#ie-viewpotential").value)};
    scheduleSave(); closeModal(); toast("Đã lưu ý tưởng"); renderIdeasList();
  });
}

/* ========================= BẢNG KANBAN ========================= */
function renderKanban(){
  const root = qs("#view-kanban");
  const chans = activeChannels();
  root.innerHTML =
    '<div class="row-between" style="margin-bottom:14px;flex-wrap:wrap"><h1 class="page-title" style="margin:0">Bảng Kanban</h1>'+
    '<div class="row">'+
    '<input id="kb-search" placeholder="🔍 Tìm kiếm... (/)" value="'+esc(kanbanFilters.q)+'" style="width:170px">'+
    '<select id="kb-channel" style="width:auto"><option value="all">Tất cả kênh</option>'+chans.map(c=>'<option value="'+c.id+'" '+(kanbanFilters.channel===c.id?"selected":"")+'>'+esc(c.name)+'</option>').join("")+'</select>'+
    '<select id="kb-type" style="width:auto"><option value="all">Tất cả loại</option><option value="long" '+(kanbanFilters.type==="long"?"selected":"")+'>Video dài</option><option value="short" '+(kanbanFilters.type==="short"?"selected":"")+'>Shorts</option></select>'+
    '<input id="kb-tag" placeholder="Lọc theo tag" value="'+esc(kanbanFilters.tag)+'" style="width:120px">'+
    '</div></div>'+
    '<div id="kanban-board"></div>';
  qs("#kb-search").value = kanbanFilters.q;
  qs("#kb-search").addEventListener("input", e=>{ kanbanFilters.q=e.target.value; renderKanbanBoard(); });
  qs("#kb-channel").addEventListener("change", e=>{ kanbanFilters.channel=e.target.value; renderKanbanBoard(); });
  qs("#kb-type").addEventListener("change", e=>{ kanbanFilters.type=e.target.value; renderKanbanBoard(); });
  qs("#kb-tag").addEventListener("input", e=>{ kanbanFilters.tag=e.target.value; renderKanbanBoard(); });
  renderKanbanBoard();
}
function kanbanFilteredVideos(){
  let list = activeVideos();
  if(kanbanFilters.channel!=="all") list = list.filter(v=>v.channelId===kanbanFilters.channel);
  if(kanbanFilters.type!=="all") list = list.filter(v=>v.type===kanbanFilters.type);
  if(kanbanFilters.tag.trim()) list = list.filter(v=> v.tags.some(t=>t.toLowerCase().includes(kanbanFilters.tag.trim().toLowerCase())));
  if(kanbanFilters.q.trim()){
    const q = kanbanFilters.q.trim().toLowerCase();
    list = list.filter(v=> v.title.toLowerCase().includes(q) || v.tags.some(t=>t.toLowerCase().includes(q)));
  }
  return list;
}
function renderKanbanBoard(){
  const board = qs("#kanban-board");
  if(!board) return;
  const vids = kanbanFilteredVideos();
  destroySortables();
  board.innerHTML = STATUS_LIST.map(s=>{
    const items = vids.filter(v=>v.status===s.key);
    return '<div class="kanban-col"><div class="kanban-col-head"><span>'+esc(s.label)+' <span class="text-dim">('+items.length+')</span></span>'+
      '<button class="btn btn-icon btn-ghost btn-sm" style="width:26px;height:26px" data-addstatus="'+s.key+'" title="Thêm video vào cột này">＋</button></div>'+
      '<div class="kanban-list" data-status="'+s.key+'">'+items.map(v=>kanbanCardHTML(v)).join("")+'</div></div>';
  }).join("");
  qsa("[data-addstatus]",board).forEach(b=> b.addEventListener("click", ()=> openQuickAdd("video", {status:b.dataset.addstatus})));
  qsa(".kanban-card",board).forEach(el=> el.addEventListener("click", ()=> openVideoModal(el.dataset.id)));
  qsa(".kanban-list",board).forEach(list=>{
    const s = Sortable.create(list, {
      group:"kanban", animation:150, delay:80, delayOnTouchOnly:true, touchStartThreshold:5,
      onEnd:function(evt){
        const id = evt.item.dataset.id;
        const newStatus = evt.to.dataset.status;
        const v = videoById(id);
        if(!v) return;
        if(v.status !== newStatus){
          pushUndo("Di chuyển video trên Kanban");
          v.status = newStatus;
          v.updatedAt = Date.now();
          if(newStatus==="published" && !v.publishedAt){ v.publishedAt = Date.now(); if(!v.publishDate) v.publishDate = todayISO(); }
          scheduleSave();
          renderKanbanBoard();
        }
      }
    });
    sortableInstances.push(s);
  });
}
function kanbanCardHTML(v){
  const overdue = v.deadline && v.status!=="published" && daysBetweenISO(todayISO(), v.deadline)<0;
  return '<div class="kanban-card" data-id="'+v.id+'" style="border-left-color:'+channelColor(v.channelId)+'">'+
    '<div class="t">'+esc(v.title)+'</div>'+
    '<div class="meta">'+
    '<span class="badge">'+chDot(channelColor(v.channelId))+' '+esc(channelName(v.channelId))+'</span>'+
    '<span class="badge">'+(v.type==="short"?"Shorts":"Video dài")+'</span>'+
    (v.deadline? '<span class="badge '+(overdue?"overdue":"")+'">⏰ '+fmtDate(v.deadline)+'</span>' : "")+
    '</div>'+
    (v.tags.length? '<div class="meta" style="margin-top:5px">'+v.tags.map(t=>'<span class="chip">#'+esc(t)+'</span>').join("")+'</div>' : "")+
    '</div>';
}

/* ========================= LỊCH ========================= */
function renderCalendar(){
  const root = qs("#view-calendar");
  root.innerHTML =
    '<div class="row-between" style="margin-bottom:14px;flex-wrap:wrap"><h1 class="page-title" style="margin:0">Lịch</h1>'+
    '<div class="row">'+
    '<button class="btn btn-sm" id="cal-prev">‹</button>'+
    '<button class="btn btn-sm" id="cal-today">Hôm nay</button>'+
    '<button class="btn btn-sm" id="cal-next">›</button>'+
    '<select id="cal-mode" style="width:auto"><option value="month" '+(calMode==="month"?"selected":"")+'>Theo tháng</option><option value="week" '+(calMode==="week"?"selected":"")+'>Theo tuần</option></select>'+
    '</div></div>'+
    '<div id="cal-label" style="font-weight:700;margin-bottom:10px;font-size:15px"></div>'+
    '<div id="cal-body"></div>';
  qs("#cal-prev").addEventListener("click", ()=>{ calAnchor = calMode==="month"? addMonths(calAnchor,-1) : addDays(calAnchor,-7); renderCalendarBody(); });
  qs("#cal-next").addEventListener("click", ()=>{ calAnchor = calMode==="month"? addMonths(calAnchor,1) : addDays(calAnchor,7); renderCalendarBody(); });
  qs("#cal-today").addEventListener("click", ()=>{ calAnchor = new Date(); renderCalendarBody(); });
  qs("#cal-mode").addEventListener("change", e=>{ calMode = e.target.value; renderCalendarBody(); });
  renderCalendarBody();
}
function videosForDate(iso){
  return activeVideos().filter(v=> v.publishDate===iso || v.deadline===iso);
}
function renderCalendarBody(){
  destroySortables();
  const body = qs("#cal-body");
  const label = qs("#cal-label");
  const todayStr = todayISO();
  if(calMode==="month"){
    const first = startOfMonth(calAnchor);
    const gridStart = startOfWeek(first);
    label.textContent = "Tháng "+(first.getMonth()+1)+"/"+first.getFullYear();
    let html = '<div class="cal-grid">'+WEEKDAY_LABELS.map(w=>'<div class="cal-daylbl">'+w+'</div>').join("");
    for(let i=0;i<42;i++){
      const d = addDays(gridStart,i);
      const iso = toISODate(d);
      const otherMonth = d.getMonth()!==first.getMonth();
      const items = videosForDate(iso);
      html += '<div class="cal-day '+(otherMonth?"other-month":"")+' '+(iso===todayStr?"today":"")+'" data-date="'+iso+'">'+
        '<div class="daynum">'+d.getDate()+'</div>'+
        items.map(v=>calItemHTML(v,iso)).join("")+
        '</div>';
    }
    html += '</div>';
    body.innerHTML = html;
  } else {
    const start = startOfWeek(calAnchor);
    label.textContent = "Tuần "+fmtDate(toISODate(start))+" – "+fmtDate(toISODate(addDays(start,6)));
    let html = '<div class="cal-grid cal-week">'+WEEKDAY_LABELS.map(w=>'<div class="cal-daylbl">'+w+'</div>').join("");
    for(let i=0;i<7;i++){
      const d = addDays(start,i);
      const iso = toISODate(d);
      const items = videosForDate(iso);
      html += '<div class="cal-day '+(iso===todayStr?"today":"")+'" data-date="'+iso+'">'+
        '<div class="daynum">'+d.getDate()+'/'+(d.getMonth()+1)+'</div>'+
        items.map(v=>calItemHTML(v,iso)).join("")+
        '</div>';
    }
    html += '</div>';
    body.innerHTML = html;
  }
  qsa(".cal-item",body).forEach(el=> el.addEventListener("click", e=>{ e.stopPropagation(); openVideoModal(el.dataset.id); }));
  qsa(".cal-day",body).forEach(el=> el.addEventListener("click", e=>{
    if(e.target.classList.contains("cal-item")) return;
    openQuickAdd("video", {publishDate: el.dataset.date});
  }));
  qsa(".cal-day",body).forEach(dayEl=>{
    const s = Sortable.create(dayEl, {
      group:"calendar", animation:150, delay:80, delayOnTouchOnly:true, touchStartThreshold:5,
      onEnd:function(evt){
        const id = evt.item.dataset.id;
        const kind = evt.item.dataset.kind;
        const newDate = evt.to.dataset.date;
        const v = videoById(id);
        if(!v) { renderCalendarBody(); return; }
        pushUndo("Dời ngày trên lịch");
        if(kind==="deadline") v.deadline = newDate; else v.publishDate = newDate;
        v.updatedAt = Date.now();
        scheduleSave();
        renderCalendarBody();
      }
    });
    sortableInstances.push(s);
  });
}
function calItemHTML(v, iso){
  const kind = (v.publishDate===iso) ? "publish" : "deadline";
  const icon = kind==="publish" ? "📤" : "⏰";
  return '<div class="cal-item" data-id="'+v.id+'" data-kind="'+kind+'" style="background:'+channelColor(v.channelId)+'" title="'+esc(v.title)+'">'+icon+' '+esc(v.title)+'</div>';
}

/* ========================= THỐNG KÊ ========================= */
function viewsBest(v){
  return num(v.performance.d30 && v.performance.d30.views) || num(v.performance.d7 && v.performance.d7.views) || num(v.performance.h48 && v.performance.h48.views) || 0;
}
function destroyCharts(){ Object.values(chartsRegistry).forEach(c=>{ try{c.destroy();}catch(e){} }); chartsRegistry={}; }
function renderStats(){
  const root = qs("#view-stats");
  const vids = activeVideos();
  const chans = activeChannels();
  root.innerHTML =
    '<h1 class="page-title">Thống kê</h1>'+
    '<div class="grid grid-2" style="margin-bottom:16px">'+
      '<div class="card"><div class="section-title">Top video theo lượt xem</div><canvas id="chart-topvideos" height="220"></canvas></div>'+
      '<div class="card"><div class="section-title">So sánh lượt xem giữa các kênh</div><canvas id="chart-bychannel" height="220"></canvas></div>'+
      '<div class="card"><div class="section-title">Số video hoàn thành theo tháng</div><canvas id="chart-bymonth" height="220"></canvas></div>'+
      '<div class="card"><div class="section-title">Top video tốt nhất của từng kênh</div><div id="stats-top-table"></div></div>'+
    '</div>'+
    '<div class="grid grid-4">'+statCard(avgIdeaToPublishDays(vids).toFixed(1)+" ngày","Thời gian trung bình từ ý tưởng đến lúc đăng")+'</div>';

  destroyCharts();
  if(!window.Chart){
    const noLib = '<div class="empty-hint">Không tải được thư viện biểu đồ (cần kết nối internet ở lần đầu mở trang). Bảng "Top video tốt nhất" bên dưới vẫn hoạt động bình thường.</div>';
    qs("#chart-topvideos").replaceWith(elDiv(noLib));
    qs("#chart-bychannel").replaceWith(elDiv(noLib));
    qs("#chart-bymonth").replaceWith(elDiv(noLib));
  }
  // Top 10 video theo view
  const topVids = vids.slice().sort((a,b)=>viewsBest(b)-viewsBest(a)).filter(v=>viewsBest(v)>0).slice(0,10);
  if(topVids.length && window.Chart){
    chartsRegistry.top = new Chart(qs("#chart-topvideos"), {
      type:"bar",
      data:{labels: topVids.map(v=>v.title.length>24? v.title.slice(0,24)+"…":v.title),
        datasets:[{label:"Lượt xem", data: topVids.map(viewsBest), backgroundColor: topVids.map(v=>channelColor(v.channelId))}]},
      options:{indexAxis:"y", plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}}}
    });
  } else if(window.Chart) {
    qs("#chart-topvideos").replaceWith(elDiv('<div class="empty-hint">Chưa có dữ liệu hiệu quả video nào</div>'));
  }
  // Theo kênh
  const byChannel = chans.map(c=> vids.filter(v=>v.channelId===c.id).reduce((s,v)=>s+viewsBest(v),0));
  if(chans.length && window.Chart){
    chartsRegistry.byChannel = new Chart(qs("#chart-bychannel"), {
      type:"bar",
      data:{labels: chans.map(c=>c.name), datasets:[{label:"Tổng lượt xem", data: byChannel, backgroundColor: chans.map(c=>c.color)}]},
      options:{plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}
    });
  }
  // theo tháng
  const months = [];
  for(let i=11;i>=0;i--) months.push(toISODate(addMonths(new Date(),-i)).slice(0,7));
  const counts = months.map(m=> vids.filter(v=>v.status==="published" && v.publishDate && v.publishDate.slice(0,7)===m).length);
  if(window.Chart){
    chartsRegistry.byMonth = new Chart(qs("#chart-bymonth"), {
      type:"bar",
      data:{labels: months, datasets:[{label:"Video đã đăng", data: counts, backgroundColor:"#6c5ce7"}]},
      options:{plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, ticks:{precision:0}}}}
    });
  }
  // top theo kênh table
  let rows = chans.map(c=>{
    const cv = vids.filter(v=>v.channelId===c.id);
    const best = cv.slice().sort((a,b)=>viewsBest(b)-viewsBest(a))[0];
    return '<tr><td>'+chDot(c.color)+' '+esc(c.name)+'</td><td>'+(best? esc(best.title):"—")+'</td><td>'+(best?viewsBest(best).toLocaleString("vi-VN"):"—")+'</td></tr>';
  }).join("");
  qs("#stats-top-table").innerHTML = '<table class="simple"><thead><tr><th>Kênh</th><th>Video</th><th>Lượt xem</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
function elDiv(html){ const d=document.createElement("div"); d.innerHTML=html; return d.firstChild; }
function avgIdeaToPublishDays(vids){
  const pub = vids.filter(v=>v.publishedAt && v.createdAt);
  if(!pub.length) return 0;
  const total = pub.reduce((s,v)=> s+((v.publishedAt-v.createdAt)/86400000), 0);
  return total/pub.length;
}

/* ========================= THÙNG RÁC ========================= */
function renderTrash(){
  const root = qs("#view-trash");
  root.innerHTML =
    '<div class="row-between" style="margin-bottom:14px"><h1 class="page-title" style="margin:0">Thùng rác</h1>'+
    '<select id="trash-filter" style="width:auto"><option value="all">Tất cả</option><option value="video">Video</option><option value="idea">Ý tưởng</option></select></div>'+
    '<div class="card"><div class="text-dim" style="margin-bottom:10px;font-size:12.5px">Các mục trong thùng rác sẽ tự động bị xóa vĩnh viễn sau '+TRASH_RETENTION_DAYS+' ngày.</div><div id="trash-list"></div></div>';
  qs("#trash-filter").value = trashFilter;
  qs("#trash-filter").addEventListener("change", e=>{ trashFilter=e.target.value; renderTrashList(); });
  renderTrashList();
}
function renderTrashList(){
  const cont = qs("#trash-list");
  const trashedVideos = trashFilter!=="idea" ? state.videos.filter(v=>v.deletedAt).map(v=>({type:"video", item:v})) : [];
  const trashedIdeas = trashFilter!=="video" ? state.ideas.filter(i=>i.deletedAt).map(i=>({type:"idea", item:i})) : [];
  const all = trashedVideos.concat(trashedIdeas).sort((a,b)=>b.item.deletedAt-a.item.deletedAt);
  if(!all.length){ cont.innerHTML = '<div class="empty-hint">Thùng rác trống</div>'; return; }
  cont.innerHTML = all.map(x=>{
    const daysLeft = TRASH_RETENTION_DAYS - Math.floor((Date.now()-x.item.deletedAt)/86400000);
    const name = x.type==="video" ? x.item.title : x.item.title;
    return '<div class="trash-item"><div><span class="badge">'+(x.type==="video"?"Video":"Ý tưởng")+'</span> '+esc(name)+
      '<div class="text-dim" style="font-size:11.5px">Còn '+Math.max(0,daysLeft)+' ngày trước khi xóa vĩnh viễn</div></div>'+
      '<div class="row"><button class="btn btn-sm btn-success" data-restore="'+x.type+':'+x.item.id+'">Khôi phục</button>'+
      '<button class="btn btn-sm btn-danger" data-purge="'+x.type+':'+x.item.id+'">Xóa vĩnh viễn</button></div></div>';
  }).join("");
  qsa("[data-restore]",cont).forEach(b=> b.addEventListener("click", ()=>{
    const [type,id] = b.dataset.restore.split(":");
    pushUndo("Khôi phục từ thùng rác");
    const arr = type==="video"? state.videos : state.ideas;
    const it = arr.find(x=>x.id===id);
    if(it) it.deletedAt = null;
    scheduleSave(); toast("Đã khôi phục"); renderTrashList();
  }));
  qsa("[data-purge]",cont).forEach(b=> b.addEventListener("click", ()=>{
    const [type,id] = b.dataset.purge.split(":");
    confirmDialog("Xóa vĩnh viễn mục này? Không thể hoàn tác.", ()=>{
      if(type==="video") state.videos = state.videos.filter(x=>x.id!==id);
      else state.ideas = state.ideas.filter(x=>x.id!==id);
      scheduleSave(); toast("Đã xóa vĩnh viễn"); renderTrashList();
    }, {danger:true, yesLabel:"Xóa vĩnh viễn"});
  }));
}

/* ========================= CÀI ĐẶT ========================= */
function renderSettings(){
  const root = qs("#view-settings");
  root.innerHTML =
    '<h1 class="page-title">Cài đặt</h1>'+
    '<div class="settings-block card"><div class="section-title">Kênh của bạn</div><div id="settings-channels"></div>'+
    '<button class="btn btn-primary btn-sm" id="add-channel" style="margin-top:10px">＋ Thêm kênh mới</button></div>'+
    '<div class="settings-block card"><div class="section-title">Giao diện &amp; mặc định</div>'+
    '<label class="field"><span>Chế độ giao diện</span><select id="set-theme"><option value="dark">Tối (mặc định)</option><option value="light">Sáng</option></select></label>'+
    '<label class="field"><span>Tốc độ đọc mặc định (từ/phút) — dùng để ước tính thời lượng kịch bản</span><input type="number" id="set-wpm" min="50" max="400"></label>'+
    '</div>'+
    '<div class="settings-block card"><div class="section-title">Dữ liệu</div>'+
    '<div class="row" style="margin-bottom:10px">'+
    '<button class="btn btn-primary" id="btn-export">⬇️ Xuất dữ liệu (.json)</button>'+
    '<button class="btn" id="btn-import">⬆️ Nhập dữ liệu</button>'+
    '<input type="file" id="file-import" accept="application/json" class="hidden">'+
    (state.settings.seeded ? '<button class="btn btn-danger" id="btn-clear-sample">Xóa dữ liệu mẫu</button>' : "")+
    '</div>'+
    '<div class="text-dim" style="font-size:12px">Lần xuất gần nhất: '+(state.settings.lastExportAt? fmtDateTime(state.settings.lastExportAt) : "Chưa từng xuất")+'</div>'+
    '</div>'+
    '<div class="settings-block card"><div class="section-title">Bản sao lưu tự động (5 gần nhất)</div><div id="backup-list"></div></div>'+
    '<div class="settings-block card"><div class="section-title">Phím tắt</div>'+shortcutsTableHTML()+'</div>';

  qs("#set-theme").value = state.settings.theme;
  qs("#set-wpm").value = state.settings.wpm;
  qs("#set-theme").addEventListener("change", e=>{ state.settings.theme=e.target.value; applyTheme(); scheduleSave(); });
  qs("#set-wpm").addEventListener("change", e=>{ state.settings.wpm = clamp(num(e.target.value)||150, 50, 400); scheduleSave(); toast("Đã lưu"); });
  qs("#btn-export").addEventListener("click", exportData);
  qs("#btn-import").addEventListener("click", ()=> qs("#file-import").click());
  qs("#file-import").addEventListener("change", handleImportFile);
  const clearBtn = qs("#btn-clear-sample");
  if(clearBtn) clearBtn.addEventListener("click", clearSampleData);
  qs("#add-channel").addEventListener("click", ()=>{
    pushUndo("Thêm kênh");
    state.channels.push(newChannel({name:"Kênh mới "+(state.channels.length+1)}));
    scheduleSave(); renderSettings();
  });
  renderChannelSettings();
  renderBackupList();
}
function renderChannelSettings(){
  const cont = qs("#settings-channels");
  cont.innerHTML = state.channels.map(c=>{
    return '<div class="card" style="margin-bottom:10px;background:var(--bg-elev2)">'+
      '<div class="channel-edit-row">'+
      '<input type="color" value="'+c.color+'" data-cfield="color" data-ch="'+c.id+'" style="width:40px;height:36px;padding:2px">'+
      '<input value="'+esc(c.name)+'" data-cfield="name" data-ch="'+c.id+'" placeholder="Tên kênh">'+
      '<input value="'+esc(c.description)+'" data-cfield="description" data-ch="'+c.id+'" placeholder="Mô tả kênh">'+
      '<label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap"><span>Mục tiêu/tuần</span><input type="number" min="1" max="30" value="'+c.goalPerWeek+'" data-cfield="goalPerWeek" data-ch="'+c.id+'" style="width:56px"></label>'+
      '<label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap"><input type="checkbox" '+(c.archived?"checked":"")+' data-cfield="archived" data-ch="'+c.id+'"> Lưu trữ</label>'+
      '<button class="btn btn-sm" data-tpl="'+c.id+'">Mẫu checklist &amp; mô tả</button>'+
      '</div></div>';
  }).join("");
  qsa("[data-cfield]",cont).forEach(el=>{
    const evt = el.type==="checkbox"||el.type==="color" ? "change" : "change";
    el.addEventListener(evt, ()=>{
      const ch = channelById(el.dataset.ch);
      if(!ch) return;
      pushUndo("Sửa kênh");
      const f = el.dataset.cfield;
      if(f==="archived") ch[f]=el.checked;
      else if(f==="goalPerWeek") ch[f]=clamp(num(el.value)||1,1,30);
      else ch[f]=el.value;
      scheduleSave();
      if(f==="name"||f==="color") { /* nhẹ, không cần render lại toàn view */ }
      toast("Đã lưu kênh");
    });
  });
  qsa("[data-tpl]",cont).forEach(b=> b.addEventListener("click", ()=> openChannelTemplateModal(b.dataset.tpl)));
}
function openChannelTemplateModal(chId){
  const ch = channelById(chId);
  if(!ch) return;
  openModalHTML(
    '<div class="modal-overlay" id="tpl-overlay"><div class="modal-box">'+
    '<div class="modal-head"><h3>Mẫu của kênh: '+esc(ch.name)+'</h3><button class="btn btn-icon btn-ghost" id="tpl-close">✕</button></div>'+
    '<div class="modal-body">'+
    '<label class="field"><span>Mẫu checklist (mỗi dòng một bước)</span><textarea id="tpl-checklist" rows="7">'+esc(ch.checklistTemplate.join("\n"))+'</textarea></label>'+
    '<label class="field"><span>Mẫu mô tả video (dùng {title} để tự điền tiêu đề)</span><textarea id="tpl-desc" rows="7">'+esc(ch.descriptionTemplate)+'</textarea></label>'+
    '</div><div class="modal-foot"><button class="btn" id="tpl-cancel">Hủy</button><button class="btn btn-primary" id="tpl-save">Lưu</button></div>'+
    '</div></div>'
  );
  qs("#tpl-close").addEventListener("click", closeModal);
  qs("#tpl-cancel").addEventListener("click", closeModal);
  qs("#tpl-overlay").addEventListener("click", e=>{ if(e.target.id==="tpl-overlay") closeModal(); });
  qs("#tpl-save").addEventListener("click", ()=>{
    pushUndo("Sửa mẫu kênh");
    ch.checklistTemplate = qs("#tpl-checklist").value.split("\n").map(s=>s.trim()).filter(Boolean);
    ch.descriptionTemplate = qs("#tpl-desc").value;
    scheduleSave(); closeModal(); toast("Đã lưu mẫu kênh");
  });
}
function renderBackupList(){
  const cont = qs("#backup-list");
  const backups = getBackups().slice().reverse();
  if(!backups.length){ cont.innerHTML = '<div class="empty-hint">Chưa có bản sao lưu nào</div>'; return; }
  cont.innerHTML = backups.map((b,idx)=>{
    const realIdx = backups.length-1-idx;
    return '<div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--border)"><span>🕐 '+fmtDateTime(b.ts)+'</span>'+
      '<button class="btn btn-sm" data-restorebk="'+realIdx+'">Khôi phục</button></div>';
  }).join("");
  qsa("[data-restorebk]",cont).forEach(btn=> btn.addEventListener("click", ()=>{
    confirmDialog("Khôi phục về bản sao lưu này? Dữ liệu hiện tại sẽ được thay thế (bạn vẫn có thể Hoàn tác sau đó).", ()=>{
      const backups = getBackups();
      const b = backups[Number(btn.dataset.restorebk)];
      if(!b) return;
      pushUndo("Khôi phục bản sao lưu");
      state = clone(b.data);
      persist();
      renderView(currentView);
      toast("Đã khôi phục bản sao lưu");
    }, {yesLabel:"Khôi phục"});
  }));
}
function shortcutsTableHTML(){
  return '<table class="simple"><tbody>'+
    '<tr><td><span class="kbd">N</span></td><td>Thêm video mới</td></tr>'+
    '<tr><td><span class="kbd">I</span></td><td>Thêm ý tưởng mới</td></tr>'+
    '<tr><td><span class="kbd">/</span></td><td>Tìm kiếm</td></tr>'+
    '<tr><td><span class="kbd">Ctrl</span>+<span class="kbd">Z</span></td><td>Hoàn tác thao tác vừa làm</td></tr>'+
    '<tr><td><span class="kbd">Esc</span></td><td>Đóng hộp thoại / thoát teleprompter</td></tr>'+
    '<tr><td><span class="kbd">Space</span></td><td>Tạm dừng/tiếp tục Teleprompter</td></tr>'+
    '</tbody></table>';
}
function clearSampleData(){
  confirmDialog("Xóa toàn bộ dữ liệu mẫu (video và ý tưởng demo)? Hành động này không thể hoàn tác qua nút Hoàn tác thường (đã có xác nhận riêng).", ()=>{
    pushUndo("Xóa dữ liệu mẫu");
    state.videos = state.videos.filter(v=>!v.sample);
    state.ideas = state.ideas.filter(i=>!i.sample);
    state.settings.seeded = false;
    scheduleSave();
    toast("Đã xóa dữ liệu mẫu");
    renderSettings();
  }, {danger:true, yesLabel:"Xóa dữ liệu mẫu"});
}

/* ========================= Xuất / Nhập dữ liệu ========================= */
function exportData(){
  const payload = {channels:state.channels, videos:state.videos, ideas:state.ideas, settings:state.settings, exportedAt:Date.now(), version:1};
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "ytcm-backup-"+todayISO()+".json";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  state.settings.lastExportAt = Date.now();
  scheduleSave();
  forceBackupNow();
  toast("Đã xuất dữ liệu thành công");
  if(currentView==="dashboard" || currentView==="settings") renderView(currentView);
}
function handleImportFile(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    let data;
    try{ data = JSON.parse(ev.target.result); }
    catch(err){ toast("File không hợp lệ (không đọc được JSON)","danger"); e.target.value=""; return; }
    if(!data || !Array.isArray(data.channels) || !Array.isArray(data.videos) || !Array.isArray(data.ideas)){
      toast("File không đúng cấu trúc dữ liệu của ứng dụng","danger"); e.target.value=""; return;
    }
    confirmDialog("Nhập dữ liệu sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại. Bạn có chắc chắn muốn tiếp tục?", ()=>{
      pushUndo("Nhập dữ liệu từ file");
      state.channels = data.channels; state.videos = data.videos; state.ideas = data.ideas;
      state.settings = Object.assign({theme:"dark",wpm:150,lastExportAt:null,seeded:false}, data.settings||{});
      purgeOldTrash();
      persist();
      applyTheme();
      renderView(currentView);
      toast("Đã nhập dữ liệu thành công");
      e.target.value="";
    }, {danger:true, yesLabel:"Ghi đè & Nhập"});
  };
  reader.readAsText(file);
}

/* ========================= Giao diện sáng/tối ========================= */
function applyTheme(){
  document.documentElement.setAttribute("data-theme", state.settings.theme==="light"?"light":"dark");
  const btn = qs("#btn-theme");
  if(btn) btn.textContent = state.settings.theme==="light" ? "☀️" : "🌙";
}
function toggleTheme(){
  state.settings.theme = state.settings.theme==="light" ? "dark" : "light";
  applyTheme(); scheduleSave();
}

/* ========================= THÊM NHANH ========================= */
function openQuickAdd(kind, prefill){
  prefill = prefill || {};
  kind = kind || "video";
  const chans = activeChannels();
  if(!chans.length){ toast("Vui lòng thêm kênh trong Cài đặt trước","danger"); return; }
  openModalHTML(
    '<div class="modal-overlay" id="qa-overlay"><div class="modal-box">'+
    '<div class="modal-head"><h3>Thêm nhanh</h3><button class="btn btn-icon btn-ghost" id="qa-close">✕</button></div>'+
    '<div class="modal-body">'+
    '<div class="row" style="margin-bottom:14px">'+
    '<button class="btn btn-sm '+(kind==="video"?"btn-primary":"")+'" id="qa-tab-video">🎬 Video</button>'+
    '<button class="btn btn-sm '+(kind==="idea"?"btn-primary":"")+'" id="qa-tab-idea">💡 Ý tưởng</button>'+
    '</div>'+
    '<div id="qa-body"></div>'+
    '</div><div class="modal-foot"><button class="btn" id="qa-cancel">Hủy</button><button class="btn btn-primary" id="qa-submit">Thêm</button></div>'+
    '</div></div>'
  );
  function renderBody(k){
    const chanOpts = chans.map(c=>'<option value="'+c.id+'" '+(c.id===prefill.channelId?"selected":"")+'>'+esc(c.name)+'</option>').join("");
    if(k==="video"){
      qs("#qa-body").innerHTML =
        '<label class="field"><span>Tiêu đề</span><input id="qa-title" placeholder="Tiêu đề video"></label>'+
        '<div class="grid grid-2">'+
        '<label class="field"><span>Kênh</span><select id="qa-channel">'+chanOpts+'</select></label>'+
        '<label class="field"><span>Loại</span><select id="qa-type"><option value="long">Video dài</option><option value="short">Shorts</option></select></label>'+
        '<label class="field"><span>Trạng thái</span><select id="qa-status">'+STATUS_LIST.map(s=>'<option value="'+s.key+'" '+(s.key===(prefill.status||"idea")?"selected":"")+'>'+esc(s.label)+'</option>').join("")+'</select></label>'+
        '<label class="field"><span>Hạn chót</span><input type="date" id="qa-deadline"></label>'+
        '<label class="field"><span>Ngày đăng dự kiến</span><input type="date" id="qa-publish" value="'+(prefill.publishDate||"")+'"></label>'+
        '</div>';
    } else {
      qs("#qa-body").innerHTML =
        '<label class="field"><span>Tiêu đề ý tưởng</span><input id="qa-title" placeholder="Ý tưởng mới"></label>'+
        '<label class="field"><span>Kênh</span><select id="qa-channel">'+chanOpts+'</select></label>'+
        '<label class="field"><span>Ghi chú</span><textarea id="qa-note" rows="2"></textarea></label>';
    }
    qs("#qa-title").focus();
  }
  renderBody(kind);
  qs("#qa-tab-video").addEventListener("click", ()=>{ kind="video"; qs("#qa-tab-video").classList.add("btn-primary"); qs("#qa-tab-idea").classList.remove("btn-primary"); renderBody("video"); });
  qs("#qa-tab-idea").addEventListener("click", ()=>{ kind="idea"; qs("#qa-tab-idea").classList.add("btn-primary"); qs("#qa-tab-video").classList.remove("btn-primary"); renderBody("idea"); });
  qs("#qa-close").addEventListener("click", closeModal);
  qs("#qa-cancel").addEventListener("click", closeModal);
  qs("#qa-overlay").addEventListener("click", e=>{ if(e.target.id==="qa-overlay") closeModal(); });
  qs("#qa-submit").addEventListener("click", ()=>{
    const title = qs("#qa-title").value.trim();
    if(!title){ toast("Vui lòng nhập tiêu đề","danger"); qs("#qa-title").focus(); return; }
    if(kind==="video"){
      pushUndo("Thêm video");
      const v = newVideo({title, channelId:qs("#qa-channel").value, type:qs("#qa-type").value, status:qs("#qa-status").value,
        deadline:qs("#qa-deadline").value, publishDate:qs("#qa-publish").value});
      applyChecklistTemplate(v);
      state.videos.push(v);
      scheduleSave(); closeModal(); toast("Đã thêm video");
      renderView(currentView);
      openVideoModal(v.id);
    } else {
      pushUndo("Thêm ý tưởng");
      state.ideas.push(newIdea({title, channelId:qs("#qa-channel").value, note:qs("#qa-note").value.trim()}));
      scheduleSave(); closeModal(); toast("Đã thêm ý tưởng");
      renderView(currentView);
    }
  });
}

/* ========================= CHI TIẾT VIDEO ========================= */
const VD_TABS = [
  {key:"info", label:"Thông tin"}, {key:"checklist", label:"Checklist"}, {key:"research", label:"Nghiên cứu"},
  {key:"script", label:"Kịch bản"}, {key:"titles", label:"Tiêu đề & Thumbnail"}, {key:"desc", label:"Mô tả & Tag"},
  {key:"resources", label:"Tài nguyên"}, {key:"links", label:"Liên kết"}, {key:"shorts", label:"Shorts liên quan"},
  {key:"perf", label:"Hiệu quả"}
];
function openVideoModal(id){
  const v = videoById(id);
  if(!v) return;
  activeVideoId = id;
  activeVideoTab = "info";
  lastFocusEl = document.activeElement;
  qs("#modal-root").innerHTML = '<div class="modal-overlay" id="video-modal"><div class="modal-box wide"></div></div>';
  qs("#video-modal").addEventListener("mousedown", e=>{ if(e.target.id==="video-modal") closeModal(); });
  renderVideoModal();
}
function currentVideo(){ return videoById(activeVideoId); }
function renderVideoModal(){
  const v = currentVideo();
  if(!v){ closeModal(); return; }
  const box = qs("#video-modal .modal-box");
  box.innerHTML =
    '<div class="vd-head">'+
    '<input class="title-input" id="vd-title" value="'+esc(v.title)+'">'+
    '<select id="vd-channel" style="width:auto">'+state.channels.map(c=>'<option value="'+c.id+'" '+(c.id===v.channelId?"selected":"")+'>'+esc(c.name)+(c.archived?" (lưu trữ)":"")+'</option>').join("")+'</select>'+
    '<select id="vd-status" style="width:auto">'+STATUS_LIST.map(s=>'<option value="'+s.key+'" '+(s.key===v.status?"selected":"")+'>'+esc(s.label)+'</option>').join("")+'</select>'+
    '<select id="vd-type" style="width:auto"><option value="long" '+(v.type==="long"?"selected":"")+'>Video dài</option><option value="short" '+(v.type==="short"?"selected":"")+'>Shorts</option></select>'+
    '<button class="btn btn-sm" id="vd-dup">Nhân bản</button>'+
    '<button class="btn btn-sm btn-danger" id="vd-del">Xóa</button>'+
    '<button class="btn btn-icon btn-ghost" id="vd-close">✕</button>'+
    '</div>'+
    '<div class="vd-tabs">'+VD_TABS.map(t=>'<button data-tab="'+t.key+'" class="'+(t.key===activeVideoTab?"active":"")+'">'+esc(t.label)+'</button>').join("")+'</div>'+
    '<div class="vd-tabbody" id="vd-tabbody"></div>';

  qs("#vd-close").addEventListener("click", closeModal);
  qs("#vd-title").addEventListener("change", e=>{ pushUndo("Sửa tiêu đề video"); v.title=e.target.value.trim()||v.title; v.updatedAt=Date.now(); scheduleSave(); renderView(currentView); });
  qs("#vd-channel").addEventListener("change", e=>{ pushUndo("Đổi kênh video"); v.channelId=e.target.value; v.updatedAt=Date.now(); scheduleSave(); });
  qs("#vd-status").addEventListener("change", e=>{
    pushUndo("Đổi trạng thái video"); v.status=e.target.value;
    if(v.status==="published" && !v.publishedAt){ v.publishedAt=Date.now(); if(!v.publishDate) v.publishDate=todayISO(); }
    v.updatedAt=Date.now(); scheduleSave(); renderVideoModal();
  });
  qs("#vd-type").addEventListener("change", e=>{ pushUndo("Đổi loại video"); v.type=e.target.value; v.updatedAt=Date.now(); scheduleSave(); });
  qs("#vd-dup").addEventListener("click", ()=>{
    pushUndo("Nhân bản video");
    const copy = clone(v); copy.id=uid("v"); copy.title=v.title+" (bản sao)"; copy.createdAt=Date.now(); copy.updatedAt=Date.now();
    copy.publishedAt=null; copy.status="idea"; copy.publishDate=""; copy.sample=false;
    state.videos.push(copy);
    scheduleSave(); toast("Đã nhân bản video"); closeModal(); renderView(currentView); openVideoModal(copy.id);
  });
  qs("#vd-del").addEventListener("click", ()=>{
    confirmDialog("Xóa video này? Video sẽ được chuyển vào Thùng rác trong 30 ngày.", ()=>{
      pushUndo("Xóa video");
      v.deletedAt = Date.now();
      scheduleSave(); toast("Đã chuyển video vào thùng rác"); closeModal(); renderView(currentView);
    }, {danger:true, yesLabel:"Xóa"});
  });
  qsa(".vd-tabs button", box).forEach(b=> b.addEventListener("click", ()=>{ activeVideoTab=b.dataset.tab; qsa(".vd-tabs button",box).forEach(x=>x.classList.toggle("active",x===b)); renderVideoTabBody(); }));
  renderVideoTabBody();
}
function renderVideoTabBody(){
  const v = currentVideo(); if(!v) return;
  const body = qs("#vd-tabbody");
  if(!body) return;
  if(activeVideoTab==="info") body.innerHTML = tabInfoHTML(v);
  else if(activeVideoTab==="checklist") body.innerHTML = tabChecklistHTML(v);
  else if(activeVideoTab==="research") body.innerHTML = tabResearchHTML(v);
  else if(activeVideoTab==="script") body.innerHTML = tabScriptHTML(v);
  else if(activeVideoTab==="titles") body.innerHTML = tabTitlesHTML(v);
  else if(activeVideoTab==="desc") body.innerHTML = tabDescHTML(v);
  else if(activeVideoTab==="resources") body.innerHTML = tabResourcesHTML(v);
  else if(activeVideoTab==="links") body.innerHTML = tabLinksHTML(v);
  else if(activeVideoTab==="shorts") body.innerHTML = tabShortsHTML(v);
  else if(activeVideoTab==="perf") body.innerHTML = tabPerfHTML(v);
  bindTabEvents(v);
}

/* --- Tab: Thông tin --- */
function tabInfoHTML(v){
  return '<div class="grid grid-2">'+
    '<label class="field"><span>Series / Playlist</span><input id="f-series" value="'+esc(v.series)+'"></label>'+
    '<label class="field"><span>Hạn chót</span><input type="date" id="f-deadline" value="'+esc(v.deadline)+'"></label>'+
    '<label class="field"><span>Ngày đăng dự kiến</span><input type="date" id="f-publish" value="'+esc(v.publishDate)+'"></label>'+
    '<label class="field"><span>Tag</span><div class="tag-input-wrap" id="f-tags-wrap">'+
      v.tags.map((t,idx)=>'<span class="chip">#'+esc(t)+'<button data-rmtag="'+idx+'">✕</button></span>').join("")+
      '<input id="f-tag-new" placeholder="Nhập tag rồi Enter"></div></label>'+
    '</div>'+
    '<label class="field"><span>Ghi chú</span><textarea id="f-notes" rows="4">'+esc(v.notes)+'</textarea></label>'+
    '<div class="text-dim" style="font-size:11.5px">Tạo lúc: '+fmtDateTime(v.createdAt)+' · Cập nhật: '+fmtDateTime(v.updatedAt)+(v.publishedAt?(' · Đã đăng: '+fmtDateTime(v.publishedAt)):"")+'</div>';
}
function bindInfoTab(v){
  qs("#f-series").addEventListener("change", e=>{ v.series=e.target.value; touch(v); });
  qs("#f-deadline").addEventListener("change", e=>{ v.deadline=e.target.value; touch(v); renderDashOrKanbanQuiet(); });
  qs("#f-publish").addEventListener("change", e=>{ v.publishDate=e.target.value; touch(v); renderDashOrKanbanQuiet(); });
  qs("#f-notes").addEventListener("input", e=>{ v.notes=e.target.value; touch(v,true); });
  qs("#f-tag-new").addEventListener("keydown", e=>{
    if(e.key==="Enter"){ e.preventDefault(); const t=e.target.value.trim().replace(/^#/,""); if(t){ v.tags.push(t); touch(v); renderVideoTabBody(); } e.target.value=""; }
  });
  qsa("[data-rmtag]").forEach(b=> b.addEventListener("click", ()=>{ v.tags.splice(Number(b.dataset.rmtag),1); touch(v); renderVideoTabBody(); }));
}
function touch(v, skipUndo){
  if(!skipUndo) pushUndo("Sửa video");
  v.updatedAt = Date.now();
  scheduleSave();
}
function renderDashOrKanbanQuiet(){ /* dữ liệu sẽ tự cập nhật khi người dùng chuyển view */ }

/* --- Tab: Checklist --- */
function tabChecklistHTML(v){
  const total = v.checklist.length, done = v.checklist.filter(c=>c.done).length;
  return '<div class="row-between" style="margin-bottom:10px"><div class="text-dim">Hoàn thành '+done+'/'+total+'</div><button class="btn btn-sm" id="ck-reset">Áp dụng mẫu của kênh</button></div>'+
    '<div class="list-editable" id="ck-list">'+v.checklist.map(c=>
      '<div class="check-item '+(c.done?"done":"")+'"><input type="checkbox" data-ckdone="'+c.id+'" '+(c.done?"checked":"")+'>'+
      '<input class="txt" data-cktext="'+c.id+'" value="'+esc(c.text)+'">'+
      '<button class="btn btn-icon btn-ghost btn-sm" data-ckdel="'+c.id+'">🗑</button></div>').join("")+'</div>'+
    '<div class="row"><input id="ck-new" placeholder="Thêm bước mới..." style="flex:1"><button class="btn btn-sm btn-primary" id="ck-add">Thêm</button></div>';
}
function bindChecklistTab(v){
  qsa("[data-ckdone]").forEach(cb=> cb.addEventListener("change", ()=>{ const it=v.checklist.find(c=>c.id===cb.dataset.ckdone); it.done=cb.checked; touch(v); renderVideoTabBody(); }));
  qsa("[data-cktext]").forEach(inp=> inp.addEventListener("change", ()=>{ const it=v.checklist.find(c=>c.id===inp.dataset.cktext); it.text=inp.value; touch(v); }));
  qsa("[data-ckdel]").forEach(b=> b.addEventListener("click", ()=>{ v.checklist=v.checklist.filter(c=>c.id!==b.dataset.ckdel); touch(v); renderVideoTabBody(); }));
  qs("#ck-add").addEventListener("click", ()=>{ const val=qs("#ck-new").value.trim(); if(!val) return; v.checklist.push({id:uid("c"),text:val,done:false}); touch(v); renderVideoTabBody(); });
  qs("#ck-new").addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); qs("#ck-add").click(); } });
  qs("#ck-reset").addEventListener("click", ()=> confirmDialog("Áp dụng mẫu checklist của kênh? Checklist hiện tại sẽ bị thay thế.", ()=>{ applyChecklistTemplate(v); touch(v); renderVideoTabBody(); }, {yesLabel:"Áp dụng"}));
}

/* --- Tab: Nghiên cứu --- */
function tabResearchHTML(v){
  return '<div class="list-editable" id="rs-list">'+v.research.map(r=>
    '<div class="row-item"><input placeholder="Tên nguồn" value="'+esc(r.name)+'" data-rsf="name" data-rsid="'+r.id+'">'+
    '<input placeholder="Link" value="'+esc(r.link)+'" data-rsf="link" data-rsid="'+r.id+'">'+
    '<input placeholder="Ghi chú" value="'+esc(r.note)+'" data-rsf="note" data-rsid="'+r.id+'">'+
    '<button class="btn btn-icon btn-ghost btn-sm" data-rsdel="'+r.id+'">🗑</button></div>').join("")+'</div>'+
    '<button class="btn btn-sm btn-primary" id="rs-add">＋ Thêm nguồn tham khảo</button>';
}
function bindResearchTab(v){
  qsa("[data-rsf]").forEach(inp=> inp.addEventListener("change", ()=>{ const it=v.research.find(r=>r.id===inp.dataset.rsid); it[inp.dataset.rsf]=inp.value; touch(v); }));
  qsa("[data-rsdel]").forEach(b=> b.addEventListener("click", ()=>{ v.research=v.research.filter(r=>r.id!==b.dataset.rsdel); touch(v); renderVideoTabBody(); }));
  qs("#rs-add").addEventListener("click", ()=>{ v.research.push({id:uid("r"),name:"",link:"",note:""}); touch(v); renderVideoTabBody(); });
}

/* --- Tab: Kịch bản --- */
function tabScriptHTML(v){
  const wc = wordCount(v.script.content);
  const mins = v.script.wpm>0 ? wc/v.script.wpm : 0;
  const outline = (v.script.content||"").split("\n").map((l,idx)=>({l,idx})).filter(o=>/^#+\s*/.test(o.l));
  return '<div class="row" style="margin-bottom:8px">'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px"><span>Tốc độ đọc (từ/phút)</span><input type="number" id="sc-wpm" value="'+v.script.wpm+'" style="width:70px"></label>'+
    '<span class="badge" id="sc-count">'+wc+' từ · ~'+mins.toFixed(1)+' phút</span>'+
    '<button class="btn btn-sm" id="sc-copy">📋 Sao chép</button>'+
    '<button class="btn btn-sm" id="sc-export">⬇️ Xuất .txt</button>'+
    '<button class="btn btn-sm btn-primary" id="sc-tele">🎤 Chế độ Teleprompter</button>'+
    '</div>'+
    '<textarea id="sc-content" rows="14" placeholder="Viết kịch bản ở đây... Dùng # Tiêu đề để chia phần">'+esc(v.script.content)+'</textarea>'+
    (outline.length? '<div style="margin-top:10px"><div class="text-dim" style="font-size:12px;margin-bottom:4px">Các phần:</div>'+outline.map(o=>'<span class="chip" style="cursor:pointer;margin-right:4px" data-jumpline="'+o.idx+'">'+esc(o.l.replace(/^#+\s*/,""))+'</span>').join("")+'</div>' : "");
}
function bindScriptTab(v){
  qs("#sc-wpm").addEventListener("change", e=>{ v.script.wpm=clamp(num(e.target.value)||150,20,600); touch(v); renderVideoTabBody(); });
  qs("#sc-content").addEventListener("input", e=>{
    v.script.content = e.target.value; touch(v,true);
    const wc = wordCount(v.script.content); const mins = v.script.wpm>0 ? wc/v.script.wpm : 0;
    qs("#sc-count").textContent = wc+" từ · ~"+mins.toFixed(1)+" phút";
  });
  qs("#sc-copy").addEventListener("click", ()=> copyText(v.script.content, "Đã sao chép kịch bản"));
  qs("#sc-export").addEventListener("click", ()=> downloadText(v.title.replace(/[^\wÀ-ỹ ]/g,"")+".txt", v.script.content));
  qs("#sc-tele").addEventListener("click", ()=> openTeleprompter(v));
  qsa("[data-jumpline]").forEach(chip=> chip.addEventListener("click", ()=>{
    const ta = qs("#sc-content"); const lines=ta.value.split("\n"); let pos=0;
    for(let i=0;i<Number(chip.dataset.jumpline);i++) pos+=lines[i].length+1;
    ta.focus(); ta.setSelectionRange(pos,pos+lines[Number(chip.dataset.jumpline)].length);
  }));
}
function copyText(text, msg){
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text||"").then(()=>toast(msg)).catch(()=>fallbackCopy(text,msg)); }
  else fallbackCopy(text,msg);
}
function fallbackCopy(text,msg){
  const ta=document.createElement("textarea"); ta.value=text||""; document.body.appendChild(ta); ta.select();
  try{ document.execCommand("copy"); toast(msg); }catch(e){ toast("Không thể sao chép","danger"); }
  document.body.removeChild(ta);
}
function downloadText(filename, content){
  const blob = new Blob([content||""], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename||"script.txt";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* --- Teleprompter --- */
let tpTimer=null, tpPaused=true, tpSpeed=40, tpSize=32, tpMirror=false;
function openTeleprompter(v){
  tpPaused=true;
  qs("#modal-root").insertAdjacentHTML("beforeend",
    '<div id="teleprompter">'+
    '<div class="tp-controls">'+
    '<button class="btn btn-sm" id="tp-playpause">▶️ Chạy (Space)</button>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#fff">Tốc độ<input type="range" id="tp-speed" min="10" max="150" value="'+tpSpeed+'"></label>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#fff">Cỡ chữ<input type="range" id="tp-size" min="16" max="64" value="'+tpSize+'"></label>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#fff"><input type="checkbox" id="tp-mirror"> Lật gương</label>'+
    '<button class="btn btn-sm" id="tp-close">✕ Đóng (Esc)</button>'+
    '</div>'+
    '<div class="tp-text" id="tp-text" style="font-size:'+tpSize+'px">'+esc(v.script.content||"(Chưa có kịch bản)")+'</div>'+
    '</div>');
  qs("#tp-close").addEventListener("click", closeTeleprompter);
  qs("#tp-playpause").addEventListener("click", toggleTelePlay);
  qs("#tp-speed").addEventListener("input", e=>{ tpSpeed=Number(e.target.value); });
  qs("#tp-size").addEventListener("input", e=>{ tpSize=Number(e.target.value); qs("#tp-text").style.fontSize=tpSize+"px"; });
  qs("#tp-mirror").addEventListener("change", e=>{ tpMirror=e.target.checked; qs("#tp-text").classList.toggle("mirror",tpMirror); });
}
function toggleTelePlay(){
  tpPaused=!tpPaused;
  qs("#tp-playpause").textContent = tpPaused? "▶️ Chạy (Space)" : "⏸ Tạm dừng (Space)";
  if(!tpPaused) runTeleScroll();
}
function runTeleScroll(){
  clearInterval(tpTimer);
  tpTimer = setInterval(()=>{
    if(tpPaused) return;
    const el = qs("#tp-text");
    if(!el){ clearInterval(tpTimer); return; }
    el.scrollTop += tpSpeed/25;
  }, 40);
}
function closeTeleprompter(){
  clearInterval(tpTimer); tpPaused=true;
  const el = qs("#teleprompter"); if(el) el.remove();
}

/* --- Tab: Tiêu đề & Thumbnail --- */
function tabTitlesHTML(v){
  return '<div class="section-title" style="font-size:13px">Phương án tiêu đề</div>'+
    '<div class="list-editable" id="tt-list">'+v.titleOptions.map(t=>{
      const over = t.text.length>60;
      return '<div class="row-item"><input type="radio" name="tt-selected" data-ttsel="'+t.id+'" '+(t.selected?"checked":"")+' title="Chọn phương án này">'+
      '<input value="'+esc(t.text)+'" data-ttf="'+t.id+'" style="flex:1">'+
      '<span class="charcount '+(over?"over":"")+'">'+t.text.length+'/60</span>'+
      '<button class="btn btn-icon btn-ghost btn-sm" data-ttdel="'+t.id+'">🗑</button></div>';
    }).join("")+'</div>'+
    '<button class="btn btn-sm btn-primary" id="tt-add" style="margin-bottom:18px">＋ Thêm phương án tiêu đề</button>'+
    '<div class="section-title" style="font-size:13px">Ý tưởng chữ trên thumbnail</div>'+
    '<div class="list-editable" id="th-list">'+v.thumbnailIdeas.map(t=>
      '<div class="row-item"><input value="'+esc(t.text)+'" data-thf="'+t.id+'" style="flex:1"><button class="btn btn-icon btn-ghost btn-sm" data-thdel="'+t.id+'">🗑</button></div>').join("")+'</div>'+
    '<button class="btn btn-sm btn-primary" id="th-add">＋ Thêm ý tưởng thumbnail</button>';
}
function bindTitlesTab(v){
  qsa("[data-ttsel]").forEach(r=> r.addEventListener("change", ()=>{ v.titleOptions.forEach(t=>t.selected=(t.id===r.dataset.ttsel)); touch(v); renderVideoTabBody(); }));
  qsa("[data-ttf]").forEach(inp=> inp.addEventListener("input", e=>{ const it=v.titleOptions.find(t=>t.id===inp.dataset.ttf); it.text=e.target.value; touch(v,true); e.target.parentElement.querySelector(".charcount").textContent=it.text.length+"/60"; e.target.parentElement.querySelector(".charcount").classList.toggle("over", it.text.length>60); }));
  qsa("[data-ttdel]").forEach(b=> b.addEventListener("click", ()=>{ v.titleOptions=v.titleOptions.filter(t=>t.id!==b.dataset.ttdel); touch(v); renderVideoTabBody(); }));
  qs("#tt-add").addEventListener("click", ()=>{ v.titleOptions.push({id:uid("t"),text:"Tiêu đề mới",selected:v.titleOptions.length===0}); touch(v); renderVideoTabBody(); });
  qsa("[data-thf]").forEach(inp=> inp.addEventListener("change", e=>{ const it=v.thumbnailIdeas.find(t=>t.id===inp.dataset.thf); it.text=e.target.value; touch(v); }));
  qsa("[data-thdel]").forEach(b=> b.addEventListener("click", ()=>{ v.thumbnailIdeas=v.thumbnailIdeas.filter(t=>t.id!==b.dataset.thdel); touch(v); renderVideoTabBody(); }));
  qs("#th-add").addEventListener("click", ()=>{ v.thumbnailIdeas.push({id:uid("th"),text:""}); touch(v); renderVideoTabBody(); });
}

/* --- Tab: Mô tả & Tag --- */
function tabDescHTML(v){
  const ch = channelById(v.channelId);
  return '<label class="field"><span>Mẫu mô tả của kênh (chỉ đọc, sửa trong Cài đặt)</span><textarea rows="4" disabled>'+esc(ch?ch.descriptionTemplate:"")+'</textarea></label>'+
    '<button class="btn btn-sm" id="dc-fill" style="margin-bottom:10px">⤵️ Điền tiêu đề vào mẫu</button>'+
    '<label class="field"><span>Mô tả video</span><textarea id="dc-content" rows="8">'+esc(v.description)+'</textarea></label>'+
    '<div class="row" style="margin-bottom:16px"><button class="btn btn-sm" id="dc-copy">📋 Sao chép mô tả</button></div>'+
    '<div class="section-title" style="font-size:13px">Chương (chapters)</div>'+
    '<div class="list-editable" id="cp-list">'+v.chapters.slice().sort((a,b)=>timeToSeconds(a.time)-timeToSeconds(b.time)).map(c=>
      '<div class="row-item"><input placeholder="00:00" value="'+esc(c.time)+'" data-cpf="time" data-cpid="'+c.id+'" style="width:80px;flex:none">'+
      '<input placeholder="Tên chương" value="'+esc(c.label)+'" data-cpf="label" data-cpid="'+c.id+'">'+
      '<button class="btn btn-icon btn-ghost btn-sm" data-cpdel="'+c.id+'">🗑</button></div>').join("")+'</div>'+
    '<div class="row"><button class="btn btn-sm btn-primary" id="cp-add">＋ Thêm chương</button><button class="btn btn-sm" id="cp-copy">📋 Sao chép chương</button></div>';
}
function bindDescTab(v){
  qs("#dc-fill").addEventListener("click", ()=>{
    const ch=channelById(v.channelId);
    v.description = (ch?ch.descriptionTemplate:"{title}").replaceAll("{title}", v.title);
    touch(v); renderVideoTabBody();
  });
  qs("#dc-content").addEventListener("input", e=>{ v.description=e.target.value; touch(v,true); });
  qs("#dc-copy").addEventListener("click", ()=> copyText(v.description, "Đã sao chép mô tả"));
  qsa("[data-cpf]").forEach(inp=> inp.addEventListener("change", ()=>{ const it=v.chapters.find(c=>c.id===inp.dataset.cpid); it[inp.dataset.cpf]=inp.value; touch(v); renderVideoTabBody(); }));
  qsa("[data-cpdel]").forEach(b=> b.addEventListener("click", ()=>{ v.chapters=v.chapters.filter(c=>c.id!==b.dataset.cpdel); touch(v); renderVideoTabBody(); }));
  qs("#cp-add").addEventListener("click", ()=>{ v.chapters.push({id:uid("cp"),time:"00:00",label:""}); touch(v); renderVideoTabBody(); });
  qs("#cp-copy").addEventListener("click", ()=>{
    const text = v.chapters.slice().sort((a,b)=>timeToSeconds(a.time)-timeToSeconds(b.time)).map(c=>c.time+" "+c.label).join("\n");
    copyText(text, "Đã sao chép danh sách chương");
  });
}

/* --- Tab: Tài nguyên & bản quyền --- */
function tabResourcesHTML(v){
  return '<div class="list-editable" id="rc-list">'+v.resources.map(r=>
    '<div class="row-item"><input placeholder="Tên" value="'+esc(r.name)+'" data-rcf="name" data-rcid="'+r.id+'">'+
    '<input placeholder="Nguồn" value="'+esc(r.source)+'" data-rcf="source" data-rcid="'+r.id+'">'+
    '<input placeholder="Loại giấy phép" value="'+esc(r.license)+'" data-rcf="license" data-rcid="'+r.id+'">'+
    '<input placeholder="Link" value="'+esc(r.link)+'" data-rcf="link" data-rcid="'+r.id+'">'+
    '<button class="btn btn-icon btn-ghost btn-sm" data-rcdel="'+r.id+'">🗑</button></div>').join("")+'</div>'+
    '<div class="row" style="margin-bottom:14px"><button class="btn btn-sm btn-primary" id="rc-add">＋ Thêm tài nguyên</button></div>'+
    '<label class="field"><span>Đoạn credit (để dán vào mô tả)</span><textarea id="rc-credit" rows="4" readonly>'+esc(buildCreditText(v))+'</textarea></label>'+
    '<button class="btn btn-sm" id="rc-copy">📋 Sao chép credit</button>';
}
function buildCreditText(v){
  return v.resources.filter(r=>r.name||r.source).map(r=> [r.name, r.source && ("— "+r.source), r.license && ("("+r.license+")"), r.link].filter(Boolean).join(" ")).join("\n");
}
function bindResourcesTab(v){
  qsa("[data-rcf]").forEach(inp=> inp.addEventListener("change", ()=>{ const it=v.resources.find(r=>r.id===inp.dataset.rcid); it[inp.dataset.rcf]=inp.value; touch(v); renderVideoTabBody(); }));
  qsa("[data-rcdel]").forEach(b=> b.addEventListener("click", ()=>{ v.resources=v.resources.filter(r=>r.id!==b.dataset.rcdel); touch(v); renderVideoTabBody(); }));
  qs("#rc-add").addEventListener("click", ()=>{ v.resources.push({id:uid("rc"),name:"",source:"",license:"",link:""}); touch(v); renderVideoTabBody(); });
  qs("#rc-copy").addEventListener("click", ()=> copyText(buildCreditText(v), "Đã sao chép credit"));
}

/* --- Tab: Liên kết --- */
function tabLinksHTML(v){
  return '<label class="field"><span>📁 Link thư mục Google Drive</span><input id="lk-drive" value="'+esc(v.links.drive)+'"></label>'+
    '<label class="field"><span>📝 Link kịch bản ngoài (Google Docs...)</span><input id="lk-script" value="'+esc(v.links.scriptExternal)+'"></label>'+
    '<label class="field"><span>▶️ Link YouTube sau khi đăng</span><input id="lk-yt" value="'+esc(v.links.youtube)+'"></label>';
}
function bindLinksTab(v){
  qs("#lk-drive").addEventListener("change", e=>{ v.links.drive=e.target.value; touch(v); });
  qs("#lk-script").addEventListener("change", e=>{ v.links.scriptExternal=e.target.value; touch(v); });
  qs("#lk-yt").addEventListener("change", e=>{ v.links.youtube=e.target.value; touch(v); });
}

/* --- Tab: Shorts liên quan --- */
function tabShortsHTML(v){
  const linked = v.shortsIds.map(id=>videoById(id)).filter(Boolean);
  const candidates = activeVideos().filter(x=>x.type==="short" && x.id!==v.id && !v.shortsIds.includes(x.id));
  return '<div class="list-editable" id="sh-list">'+(linked.length? linked.map(s=>
    '<div class="row-item"><span style="flex:1">'+chDot(channelColor(s.channelId))+' '+esc(s.title)+' <span class="badge">'+statusLabel(s.status)+'</span></span>'+
    '<button class="btn btn-sm" data-shopen="'+s.id+'">Mở</button>'+
    '<button class="btn btn-icon btn-ghost btn-sm" data-shunlink="'+s.id+'">✕</button></div>').join("") : '<div class="empty-hint">Chưa liên kết Shorts nào</div>')+'</div>'+
    '<div class="row"><select id="sh-pick" style="flex:1"><option value="">— Chọn Shorts có sẵn để liên kết —</option>'+candidates.map(c=>'<option value="'+c.id+'">'+esc(c.title)+'</option>').join("")+'</select>'+
    '<button class="btn btn-sm" id="sh-link">Liên kết</button></div>'+
    '<button class="btn btn-sm btn-primary" id="sh-new" style="margin-top:10px">＋ Tạo Short mới liên kết</button>';
}
function bindShortsTab(v){
  qsa("[data-shopen]").forEach(b=> b.addEventListener("click", ()=> openVideoModal(b.dataset.shopen)));
  qsa("[data-shunlink]").forEach(b=> b.addEventListener("click", ()=>{ v.shortsIds=v.shortsIds.filter(id=>id!==b.dataset.shunlink); touch(v); renderVideoTabBody(); }));
  qs("#sh-link").addEventListener("click", ()=>{ const id=qs("#sh-pick").value; if(!id) return; v.shortsIds.push(id); touch(v); renderVideoTabBody(); });
  qs("#sh-new").addEventListener("click", ()=>{
    pushUndo("Tạo Short liên kết");
    const s = newVideo({channelId:v.channelId, title:v.title+" (Short)", type:"short", status:"idea"});
    applyChecklistTemplate(s);
    state.videos.push(s);
    v.shortsIds.push(s.id);
    scheduleSave(); renderVideoTabBody();
  });
}

/* --- Tab: Hiệu quả sau khi đăng --- */
function tabPerfHTML(v){
  function block(key,label){
    const p = v.performance[key]||{};
    return '<div class="card" style="background:var(--bg-elev2)"><div class="section-title" style="font-size:13px">'+label+'</div>'+
      '<label class="field"><span>Lượt xem</span><input type="number" data-pf="'+key+'.views" value="'+(p.views!=null?p.views:"")+'"></label>'+
      '<label class="field"><span>Lượt thích</span><input type="number" data-pf="'+key+'.likes" value="'+(p.likes!=null?p.likes:"")+'"></label>'+
      '<label class="field"><span>Bình luận</span><input type="number" data-pf="'+key+'.comments" value="'+(p.comments!=null?p.comments:"")+'"></label>'+
      '<label class="field"><span>CTR</span><input data-pf="'+key+'.ctr" value="'+esc(p.ctr||"")+'" placeholder="ví dụ 5.2%"></label>'+
      '<label class="field"><span>Thời lượng xem TB</span><input data-pf="'+key+'.avgDuration" value="'+esc(p.avgDuration||"")+'" placeholder="mm:ss"></label>'+
      '</div>';
  }
  return '<div class="grid grid-3">'+block("h48","48 giờ")+block("d7","7 ngày")+block("d30","30 ngày")+'</div>';
}
function bindPerfTab(v){
  qsa("[data-pf]").forEach(inp=> inp.addEventListener("change", ()=>{
    const [key,field] = inp.dataset.pf.split(".");
    if(!v.performance[key]) v.performance[key]={};
    v.performance[key][field] = inp.type==="number" ? (inp.value===""?"":num(inp.value)) : inp.value;
    touch(v);
  }));
}
function bindTabEvents(v){
  if(activeVideoTab==="info") bindInfoTab(v);
  else if(activeVideoTab==="checklist") bindChecklistTab(v);
  else if(activeVideoTab==="research") bindResearchTab(v);
  else if(activeVideoTab==="script") bindScriptTab(v);
  else if(activeVideoTab==="titles") bindTitlesTab(v);
  else if(activeVideoTab==="desc") bindDescTab(v);
  else if(activeVideoTab==="resources") bindResourcesTab(v);
  else if(activeVideoTab==="links") bindLinksTab(v);
  else if(activeVideoTab==="shorts") bindShortsTab(v);
  else if(activeVideoTab==="perf") bindPerfTab(v);
}

/* ========================= Sự kiện toàn cục & khởi động ========================= */
function bindGlobalEvents(){
  qsa("#sidenav .nav-btn[data-view]").forEach(b=> b.addEventListener("click", ()=> switchView(b.dataset.view)));
  qsa("#bottomnav button[data-view]").forEach(b=> b.addEventListener("click", ()=> switchView(b.dataset.view)));
  qs("#hamburger").addEventListener("click", ()=>{ qs("#sidenav").classList.add("mobile-open"); qs("#nav-overlay").classList.add("show"); });
  qs("#nav-overlay").addEventListener("click", closeMobileNav);
  qs("#btn-theme").addEventListener("click", toggleTheme);
  qs("#btn-undo").addEventListener("click", undo);
  qs("#btn-quick-add").addEventListener("click", ()=> openQuickAdd("video"));
  qs("#btn-shortcuts").addEventListener("click", ()=>{ switchView("settings"); setTimeout(()=>{ const el=qs("#view-settings .settings-block:last-child"); if(el) el.scrollIntoView({behavior:"smooth"}); },50); });

  document.addEventListener("keydown", e=>{
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    const typing = tag==="INPUT" || tag==="TEXTAREA" || tag==="SELECT" || document.activeElement.isContentEditable;
    if(e.key==="Escape"){
      if(qs("#teleprompter")) closeTeleprompter();
      else if(qs("#modal-root").innerHTML.trim()) closeModal();
      return;
    }
    if(qs("#teleprompter")){
      if(e.code==="Space"){ e.preventDefault(); toggleTelePlay(); }
      return;
    }
    if(qs("#modal-root").innerHTML.trim()) return; // không bắt phím tắt khi có modal khác đang mở
    if(typing) return;
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="z"){ e.preventDefault(); undo(); return; }
    if(e.key==="n" || e.key==="N"){ e.preventDefault(); openQuickAdd("video"); return; }
    if(e.key==="i" || e.key==="I"){ e.preventDefault(); openQuickAdd("idea"); return; }
    if(e.key==="/"){
      e.preventDefault();
      const searchEl = qs("#kb-search") || qs("#ideas-title-search");
      if(searchEl) searchEl.focus();
      else { switchView("kanban"); setTimeout(()=>{ const s=qs("#kb-search"); if(s) s.focus(); },50); }
      return;
    }
  });

  window.addEventListener("beforeunload", ()=>{ if(saveTimer) persist(); });
}

function init(){
  state = loadState();
  let isFirstRun = false;
  if(!state){ state = defaultState(); seedSampleData(); isFirstRun = true; }
  if(!state.settings) state.settings = {theme:"dark", wpm:150, lastExportAt:null, seeded:false};
  purgeOldTrash();
  if(isFirstRun) persist();
  applyTheme();
  bindGlobalEvents();
  updateUndoBtn();
  const initial = (location.hash||"").replace("#","");
  switchView(VALID_VIEWS.includes(initial) ? initial : "dashboard");
}
document.addEventListener("DOMContentLoaded", init);
window.addEventListener("hashchange", ()=>{
  const v = location.hash.replace("#","");
  if(VALID_VIEWS.includes(v) && v!==currentView) switchView(v);
});

})();
