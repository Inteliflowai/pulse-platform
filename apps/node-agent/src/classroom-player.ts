export function renderClassroomPlayer(classroomName: string, token: string, nodeStatus: string): string {
  // This is a self-contained HTML page with no external dependencies.
  // It includes: student login, filtered content, sequenced learning,
  // quiz engine, and conductor sync — all inline.
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${classroomName} — Pulse</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e5e7eb;min-height:100vh}
.hdr{background:#1e2130;border-bottom:1px solid #374151;padding:12px 24px;display:flex;align-items:center;justify-content:space-between}
.hdr h1{font-size:18px;font-weight:700;color:#fff}.logo{display:flex;align-items:center;gap:10px}
.li{width:28px;height:28px;background:#6366f1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px}
.st{display:flex;align-items:center;gap:8px;font-size:12px;color:#9ca3af}
.dot{width:8px;height:8px;border-radius:50%}.dot.on{background:#10b981}.dot.off{background:#ef4444}
.ui{display:flex;align-items:center;gap:8px;font-size:12px;color:#9ca3af}.ui .nm{color:#e5e7eb;font-weight:500}
.ui button{background:none;border:none;color:#9ca3af;cursor:pointer;font-size:11px;text-decoration:underline}
.ct{padding:20px;max-width:1000px;margin:0 auto}
.ls{display:flex;align-items:center;justify-content:center;min-height:70vh}
.lc{background:#1e2130;border:1px solid #374151;border-radius:16px;padding:40px;max-width:400px;width:100%;text-align:center}
.lc h2{font-size:22px;margin-bottom:8px}.lc p{color:#9ca3af;font-size:13px;margin-bottom:24px}
.lc input{width:100%;padding:12px 16px;background:#0f1117;border:1px solid #374151;border-radius:8px;color:#e5e7eb;font-size:14px;margin-bottom:12px;outline:none}
.lc input:focus{border-color:#6366f1}
.sl{max-height:200px;overflow-y:auto;margin:12px 0;text-align:left}
.si{padding:10px 14px;border-radius:6px;cursor:pointer;transition:all .15s;font-size:13px}.si:hover{background:rgba(99,102,241,.1)}
.si.sel{background:rgba(99,102,241,.2);border:1px solid #6366f1}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:#6366f1;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background .2s}
.btn:hover{background:#4f46e5}.btn:disabled{opacity:.5;cursor:not-allowed}
.bo{background:transparent;border:1px solid #4b5563;color:#e5e7eb}.bo:hover{background:#1e2130}
.bs{padding:6px 12px;font-size:12px}
.cb{background:rgba(99,102,241,.15);border:1px solid #6366f1;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
.cb .lb{font-size:12px;color:#a5b4fc}.cb .tt{font-size:14px;font-weight:600;margin-top:2px}
.tl{display:flex;gap:4px;margin:16px 0;overflow-x:auto;padding:4px 0}
.sp{flex:0 0 40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s;border:2px solid transparent}
.sp.video{background:#1e3a5f;color:#60a5fa}.sp.quiz{background:#3f3520;color:#fbbf24}
.sp.document{background:#1a3a2a;color:#34d399}.sp.break{background:#1e2130;color:#9ca3af}
.sp.act{border-color:#6366f1;transform:scale(1.1)}.sp.done{opacity:.5}
.cn{width:16px;display:flex;align-items:center;justify-content:center;color:#374151}
.vc{background:#000;border-radius:12px;overflow:hidden;aspect-ratio:16/9;margin-bottom:16px}
.vc video{width:100%;height:100%}
.qc{background:#1e2130;border:1px solid #374151;border-radius:12px;padding:24px}
.qt{font-size:18px;font-weight:600;margin-bottom:4px}.qm{font-size:12px;color:#9ca3af;margin-bottom:20px}
.qu{margin-bottom:20px;padding:16px;background:#0f1117;border-radius:8px;border:1px solid #374151}
.qx{font-size:14px;margin-bottom:12px;font-weight:500}.qn{font-size:11px;color:#9ca3af;margin-bottom:6px}
.op{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:4px 0;border-radius:6px;cursor:pointer;transition:all .15s;border:1px solid #374151}
.op:hover{border-color:#6366f1}.op.sel{background:rgba(99,102,241,.15);border-color:#6366f1}
.or{width:18px;height:18px;border-radius:50%;border:2px solid #4b5563;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.op.sel .or{border-color:#6366f1;background:#6366f1}.op.sel .or::after{content:'';width:6px;height:6px;background:#fff;border-radius:50%}
.rs{text-align:center;padding:32px}
.sc{width:120px;height:120px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:20px auto;font-size:32px;font-weight:700}
.sc.ps{background:rgba(16,185,129,.15);border:3px solid #10b981;color:#10b981}
.sc.fl{background:rgba(239,68,68,.15);border:3px solid #ef4444;color:#ef4444}
.tm{background:#3f3520;color:#fbbf24;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
.pk{background:#1e2130;border:1px solid #374151;border-radius:12px;margin-bottom:16px;overflow:hidden;cursor:pointer;transition:border-color .2s}
.pk:hover{border-color:#6366f1}.ph{padding:14px 18px;border-bottom:1px solid #374151}.ph h2{font-size:15px;font-weight:600}
.ag{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;padding:14px 18px}
.ai{background:#0f1117;border:1px solid #374151;border-radius:8px;padding:12px;transition:border-color .2s}.ai:hover{border-color:#6366f1}
.em{text-align:center;padding:60px 20px;color:#6b7280}
@media(max-width:640px){
.hdr{padding:8px 12px}.hdr h1{font-size:14px}.li{width:24px;height:24px;font-size:12px}
.ct{padding:12px}
.lc{padding:24px;margin:0 8px}.lc h2{font-size:18px}.lc input{padding:10px 12px;font-size:13px}
.btn{padding:10px 16px;font-size:13px;min-height:44px}
.bs{padding:8px 14px;min-height:40px}
.sp{flex:0 0 36px;height:36px;font-size:10px}
.cn{width:10px}
.vc{aspect-ratio:16/9;border-radius:8px}
.op{padding:12px 14px;min-height:44px}
.qu{padding:12px}
.qx{font-size:13px}
.pk{margin-bottom:12px}.ph{padding:10px 14px}
.ag{grid-template-columns:1fr;padding:10px 14px;gap:8px}
.ai{padding:10px}
.sc{width:100px;height:100px;font-size:28px}
.si{padding:12px 14px;min-height:44px}
.tl{gap:2px}
}
@media(max-width:380px){
.hdr h1{font-size:12px}.ct{padding:8px}
.ag{grid-template-columns:1fr}
.sp{flex:0 0 32px;height:32px}
}
</style></head><body>
<div class="hdr"><div class="logo"><img src="/pulse-logo.png" alt="Pulse" style="height:28px;width:auto;margin-right:8px" onerror="this.outerHTML='<div class=li>P</div>'"><h1>${classroomName}</h1></div><div id="hr"><div class="st"><div class="dot ${nodeStatus === 'online' ? 'on' : 'off'}"></div><span>${nodeStatus === 'online' ? 'Online' : 'Offline'}</span></div></div></div>
<div class="ct" id="ct"><div class="em">Loading...</div></div>
<script>
(function(){
var T='${token}',S=null,CS=null,CI=0,QS=null,CD=null;
var sv=localStorage.getItem('ps_'+T);if(sv){try{S=JSON.parse(sv)}catch{}}
function init(){if(!S){showLogin();return;}updHdr();loadC();setInterval(pollCD,5000);setInterval(loadC,60000)}
function showLogin(){
  var h='<div class="ls"><div class="lc"><img src="/pulse-logo.png" alt="Pulse" style="height:48px;width:auto;margin:0 auto 16px;display:block" onerror="this.style.display=\\'none\\'">';
  h+='<h2>Welcome</h2><p>Enter your student number to get started</p>';
  h+='<input id="si" placeholder="Student number or name" autofocus />';
  h+='<div id="slist" class="sl"></div>';
  h+='<button class="btn" style="width:100%" onclick="doLogin()" id="lb" disabled>Sign In</button></div></div>';
  document.getElementById('ct').innerHTML=h;
  document.getElementById('si').addEventListener('input',srch);
  document.getElementById('si').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin()});
}
var SR=[],SS=null;
function srch(e){var q=e.target.value.trim();if(q.length<2){document.getElementById('slist').innerHTML='';return;}
  fetch('/students/search?token='+T+'&q='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){
    SR=d.students||[];var h='';SR.forEach(function(s,i){h+='<div class="si" onclick="selS('+i+')">'+E(s.name)+' <span style="color:#9ca3af;font-size:11px">#'+E(s.student_number||'')+'</span></div>'});
    if(!SR.length)h='<div style="padding:12px;color:#6b7280;font-size:12px">No students found</div>';
    document.getElementById('slist').innerHTML=h}).catch(function(){})}
window.selS=function(i){SS=SR[i];var els=document.querySelectorAll('.si');els.forEach(function(el,j){el.className='si'+(j===i?' sel':'')});document.getElementById('lb').disabled=false};
window.doLogin=function(){
  var body={token:T};
  if(SS){body.student_id=SS.id}else{var v=document.getElementById('si').value.trim();if(!v)return;body.student_number=v}
  fetch('/students/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json()}).then(function(d){
    if(d.student){S=d.student;localStorage.setItem('ps_'+T,JSON.stringify(S));updHdr();loadC()}else{alert(d.error||'Not found')}
  }).catch(function(){alert('Login failed')})};
window.doLogout=function(){S=null;SS=null;localStorage.removeItem('ps_'+T);
  fetch('/students/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:T})}).catch(function(){});
  document.getElementById('hr').innerHTML='<div class="st"><div class="dot ${nodeStatus === 'online' ? 'on' : 'off'}"></div><span>${nodeStatus === 'online' ? 'Online' : 'Offline'}</span></div>';showLogin()};
function updHdr(){if(!S)return;document.getElementById('hr').innerHTML='<div class="ui"><span class="nm">'+E(S.name)+'</span><button onclick="doLogout()">Switch</button></div>'}
function loadC(){if(!S)return;var u='/sequences?token='+T;
  if(S.class_group_ids&&S.class_group_ids.length)u+='&class_groups='+encodeURIComponent(JSON.stringify(S.class_group_ids));
  if(S.grade_id)u+='&grade_id='+S.grade_id;
  fetch(u).then(function(r){return r.json()}).then(function(d){
    if(d.sequences&&d.sequences.length){rSeqL(d.sequences)}else{fetch('/packages?token='+T).then(function(r){return r.json()}).then(function(d){rPkg(d.packages||[])}).catch(function(){})}
  }).catch(function(){fetch('/packages?token='+T).then(function(r){return r.json()}).then(function(d){rPkg(d.packages||[])}).catch(function(){})})}
function pollCD(){fetch('/conductor/state?token='+T).then(function(r){return r.json()}).then(function(d){
  if(d.active&&d.sequence_id){if(!CD||CD.sequence_id!==d.sequence_id||CD.current_item_index!==d.current_item_index){CD=d;
    if(CS&&CS.id===d.sequence_id){CI=d.current_item_index;rItem()}else{window.goSeq(d.sequence_id)}}}else{CD=null}}).catch(function(){})}
function rSeqL(seqs){var h='';if(CD)h+='<div class="cb"><div><div class="lb">Teacher is conducting a session</div><div class="tt">Content will advance automatically</div></div></div>';
  h+='<div style="margin-bottom:16px"><div style="font-size:20px;font-weight:700">Your Learning Content</div><div style="font-size:12px;color:#9ca3af;margin-top:4px">'+seqs.length+' sequence(s)</div></div>';
  seqs.forEach(function(s){h+='<div class="pk" onclick="goSeq(\\''+s.id+'\\')"><div class="ph"><h2>'+E(s.name)+'</h2><div style="font-size:11px;color:#9ca3af;margin-top:4px">'+(s.items?s.items.length:0)+' items'+(s.grade?' &middot; '+E(s.grade):'')+(s.subject?' &middot; '+E(s.subject):'')+'</div></div></div>'});
  document.getElementById('ct').innerHTML=h}
window.goSeq=function(id){fetch('/sequences/'+id+'?token='+T).then(function(r){return r.json()}).then(function(d){CS=d;CI=0;if(CD&&CD.sequence_id===id)CI=CD.current_item_index;rItem()})};
function rItem(){if(!CS||!CS.items||CI>=CS.items.length){rDone();return;}var it=CS.items[CI];
  var h=rTL();if(CD&&CD.sequence_id===CS.id)h+='<div class="cb"><div><div class="lb">Teacher-led</div><div class="tt">'+E(it.title)+'</div></div></div>';
  if(it.item_type==='video')h+=rVid(it);else if(it.item_type==='quiz'){h+='<div id="qc"></div>';document.getElementById('ct').innerHTML=h;iQuiz(it.quiz);return}
  else if(it.item_type==='document')h+=rDoc(it);else h+=rBrk(it);document.getElementById('ct').innerHTML=h}
function rTL(){var h='<div style="font-size:20px;font-weight:700;margin-bottom:16px">'+E(CS.name)+'</div><div class="tl">';
  CS.items.forEach(function(it,i){var c=it.item_type+(i===CI?' act':'')+(i<CI?' done':'');
    var l=it.item_type==='video'?'&#9654;':it.item_type==='quiz'?'?':'&#128196;';
    h+='<div class="sp '+c+'" title="'+E(it.title)+'" onclick="gTo('+i+')">'+l+'</div>';if(i<CS.items.length-1)h+='<div class="cn">&rarr;</div>'});return h+'</div>'}
function rVid(it){var h='<div class="vc">';if(it.stream_url)h+='<video controls autoplay src="'+E(it.stream_url)+'" id="vp"></video>';
  else h+='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af">Not available</div>';
  h+='</div><div style="display:flex;justify-content:space-between;align-items:center"><h3>'+E(it.title)+'</h3><div>';
  if(CI>0)h+='<button class="btn bo bs" onclick="gTo('+(CI-1)+')">Back</button> ';
  if(!CD)h+='<button class="btn bs" onclick="nxt()">Next &rarr;</button>';
  h+='</div></div>';setTimeout(function(){var v=document.getElementById('vp');if(v)v.onended=function(){if(it.auto_advance&&!CD)nxt()}},100);return h}
function iQuiz(q){if(!q){document.getElementById('qc').innerHTML='<div class="em">Quiz not loaded</div>';return;}
  QS={q:q,a:{},sub:false,st:Date.now()};rQ()}
function rQ(){var q=QS.q,h='<div class="qc"><div class="qt">'+E(q.title)+'</div><div class="qm">'+(q.questions?q.questions.length:0)+' questions';
  if(q.time_limit_minutes)h+=' &middot; <span class="tm" id="qt">'+q.time_limit_minutes+':00</span>';h+='</div>';
  if(!QS.sub){(q.questions||[]).forEach(function(qu,qi){h+='<div class="qu"><div class="qn">Q'+(qi+1)+'</div><div class="qx">'+E(qu.question_text)+'</div>';
    (qu.options||[]).forEach(function(o){var s=QS.a[qu.id]===o.id?' sel':'';h+='<div class="op'+s+'" onclick="pA(\\''+qu.id+'\\',\\''+o.id+'\\')"><div class="or"></div><span>'+E(o.text)+'</span></div>'});h+='</div>'});
    h+='<div style="text-align:right;margin-top:16px"><button class="btn" onclick="sQ()" style="width:auto">Submit</button></div>'}else{h+=rQR()}
  h+='</div>';var el=document.getElementById('qc');if(el)el.innerHTML=h;else document.getElementById('ct').innerHTML=rTL()+h;
  if(q.time_limit_minutes&&!QS.sub)sTmr(q.time_limit_minutes)}
window.pA=function(qi,oi){QS.a[qi]=oi;rQ()};
window.sQ=function(){QS.sub=true;var q=QS.q,c=0,t=(q.questions||[]).length;
  (q.questions||[]).forEach(function(qu){var s=QS.a[qu.id],co=(qu.options||[]).find(function(o){return o.is_correct});if(co&&s===co.id)c++});
  QS.sc=c;QS.t=t;QS.pct=t>0?Math.round(c/t*100):0;QS.p=QS.pct>=(q.pass_percentage||50);
  fetch('/quiz/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:T,quiz_id:q.id,answers:QS.a,score:c,max_score:t,percentage:QS.pct,passed:QS.p,time_spent:Math.floor((Date.now()-QS.st)/1000),student_id:S?S.id:null,student_name:S?S.name:null})}).catch(function(){});rQ()};
function rQR(){return'<div class="rs"><div class="sc '+(QS.p?'ps':'fl')+'"><div>'+QS.pct+'%</div><div style="font-size:12px;font-weight:400">'+(QS.p?'Passed':'Try Again')+'</div></div><h2>'+QS.sc+'/'+QS.t+' correct</h2><div style="margin-top:16px">'+(CD?'':'<button class="btn bs" onclick="nxt()" style="width:auto">Continue &rarr;</button>')+'</div></div>'}
function sTmr(m){var s=m*60;var el=document.getElementById('qt');setInterval(function(){if(QS.sub)return;s--;if(s<=0){sQ();return;}var mm=Math.floor(s/60),ss=s%60;if(el)el.textContent=mm+':'+(ss<10?'0':'')+ss},1000)}
function rDoc(it){return'<div style="background:#1e2130;border:1px solid #374151;border-radius:12px;padding:32px;text-align:center"><h3>'+E(it.title)+'</h3>'+(it.stream_url?'<a href="'+E(it.stream_url)+'" target="_blank" class="btn" style="margin-top:16px;width:auto">Open</a>':'<p style="color:#6b7280;margin-top:8px">Not available offline</p>')+'<div style="margin-top:16px">'+(CD?'':'<button class="btn bo bs" onclick="nxt()">Next &rarr;</button>')+'</div></div>'}
function rBrk(it){return'<div style="text-align:center;padding:60px"><h2>'+E(it.title)+'</h2><p style="color:#9ca3af;margin:12px 0">'+(it.duration_minutes?it.duration_minutes+' min break':'Short break')+'</p>'+(CD?'':'<button class="btn bs" onclick="nxt()" style="width:auto">Continue &rarr;</button>')+'</div>'}
function rDone(){document.getElementById('ct').innerHTML='<div style="text-align:center;padding:60px"><h2 style="color:#10b981;font-size:24px">&#10003; Complete!</h2><p style="color:#9ca3af;margin:12px 0">Well done'+(S?', '+E(S.name):'')+'!</p><button class="btn bs" onclick="loadC()" style="width:auto">Back to Content</button></div>'}
window.nxt=function(){CI++;rItem()};window.gTo=function(i){if(!CD){CI=i;rItem()}};
function rPkg(pk){var el=document.getElementById('ct');if(!pk||!pk.length){el.innerHTML='<div class="em"><h2>No Content</h2></div>';return;}
  var h='';pk.forEach(function(p){h+='<div class="pk"><div class="ph"><h2>'+E(p.name)+'</h2></div><div class="ag">';
    if(p.assets)p.assets.forEach(function(a){h+='<div class="ai"><div style="font-size:12px;font-weight:500;margin-bottom:8px">'+E(a.filename)+'</div>';
      if(a.stream_url)h+='<button class="btn bs" onclick="window.open(\\''+E(a.stream_url)+'\\',\\'_blank\\')">Play</button>';h+='</div>'});h+='</div></div>'});el.innerHTML=h}
function E(s){if(!s)return'';var d=document.createElement('div');d.textContent=s;return d.innerHTML}
init()})();
</script></body></html>`;
}
