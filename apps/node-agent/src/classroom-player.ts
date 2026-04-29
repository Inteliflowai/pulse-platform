export interface ScheduleInfo {
  class_group_name: string | null;
  sequence_name: string | null;
  teacher_name: string | null;
  minutes_remaining: number | null;
  upcoming_class: string | null;
  upcoming_minutes: number | null;
}

export function renderClassroomPlayer(classroomName: string, token: string, nodeStatus: string, schedule?: ScheduleInfo | null): string {
  const scheduleJson = JSON.stringify(schedule ?? null);
  // This is a self-contained HTML page with no external dependencies.
  // It includes: student login, filtered content, sequenced learning,
  // quiz engine (offline fallback only), CORE redirect on lesson complete,
  // and conductor sync — all inline.
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${classroomName} — Pulse</title>
<style>
:root{--pulse-primary:var(--pulse-primary);--pulse-primary-light:var(--pulse-primary-light);--pulse-primary-dark:var(--pulse-primary-dark)}
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e5e7eb;min-height:100vh}
.hdr{background:#1e2130;border-bottom:1px solid #374151;padding:12px 24px;display:flex;align-items:center;justify-content:space-between}
.hdr h1{font-size:18px;font-weight:700;color:#fff}.logo{display:flex;align-items:center;gap:10px}
.li{width:28px;height:28px;background:var(--pulse-primary);border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px}
.st{display:flex;align-items:center;gap:8px;font-size:12px;color:#9ca3af}
.dot{width:8px;height:8px;border-radius:50%}.dot.on{background:#10b981}.dot.off{background:#ef4444}
.ui{display:flex;align-items:center;gap:8px;font-size:12px;color:#9ca3af}.ui .nm{color:#e5e7eb;font-weight:500}
.ui button{background:none;border:none;color:#9ca3af;cursor:pointer;font-size:11px;text-decoration:underline}
.ct{padding:20px;max-width:1000px;margin:0 auto}
.ls{display:flex;align-items:center;justify-content:center;min-height:70vh}
.lc{background:#1e2130;border:1px solid #374151;border-radius:16px;padding:40px;max-width:400px;width:100%;text-align:center}
.lc h2{font-size:22px;margin-bottom:8px}.lc p{color:#9ca3af;font-size:13px;margin-bottom:24px}
.lc input{width:100%;padding:12px 16px;background:#0f1117;border:1px solid #374151;border-radius:8px;color:#e5e7eb;font-size:14px;margin-bottom:12px;outline:none}
.lc input:focus{border-color:var(--pulse-primary)}
.sl{max-height:200px;overflow-y:auto;margin:12px 0;text-align:left}
.si{padding:10px 14px;border-radius:6px;cursor:pointer;transition:all .15s;font-size:13px}.si:hover{background:rgba(242,101,34,.1)}
.si.sel{background:rgba(242,101,34,.2);border:1px solid var(--pulse-primary)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--pulse-primary);color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background .2s}
.btn:hover{background:var(--pulse-primary-dark)}.btn:disabled{opacity:.5;cursor:not-allowed}
.bo{background:transparent;border:1px solid #4b5563;color:#e5e7eb}.bo:hover{background:#1e2130}
.bs{padding:6px 12px;font-size:12px}
.cb{background:rgba(242,101,34,.15);border:1px solid var(--pulse-primary);border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
.cb .lb{font-size:12px;color:var(--pulse-primary-light)}.cb .tt{font-size:14px;font-weight:600;margin-top:2px}
.tl{display:flex;gap:4px;margin:16px 0;overflow-x:auto;padding:4px 0}
.sp{flex:0 0 40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s;border:2px solid transparent}
.sp.video{background:#1e3a5f;color:#60a5fa}.sp.quiz{background:#3f3520;color:#fbbf24}
.sp.document{background:#1a3a2a;color:#34d399}.sp.break{background:#1e2130;color:#9ca3af}
.sp.act{border-color:var(--pulse-primary);transform:scale(1.1)}.sp.done{opacity:.5}
.cn{width:16px;display:flex;align-items:center;justify-content:center;color:#374151}
.vc{background:#000;border-radius:12px;overflow:hidden;aspect-ratio:16/9;margin-bottom:16px}
.vc video{width:100%;height:100%}
.qc{background:#1e2130;border:1px solid #374151;border-radius:12px;padding:24px}
.qt{font-size:18px;font-weight:600;margin-bottom:4px}.qm{font-size:12px;color:#9ca3af;margin-bottom:20px}
.qu{margin-bottom:20px;padding:16px;background:#0f1117;border-radius:8px;border:1px solid #374151}
.qx{font-size:14px;margin-bottom:12px;font-weight:500}.qn{font-size:11px;color:#9ca3af;margin-bottom:6px}
.op{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:4px 0;border-radius:6px;cursor:pointer;transition:all .15s;border:1px solid #374151}
.op:hover{border-color:var(--pulse-primary)}.op.sel{background:rgba(242,101,34,.15);border-color:var(--pulse-primary)}
.or{width:18px;height:18px;border-radius:50%;border:2px solid #4b5563;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.op.sel .or{border-color:var(--pulse-primary);background:var(--pulse-primary)}.op.sel .or::after{content:'';width:6px;height:6px;background:#fff;border-radius:50%}
.rs{text-align:center;padding:32px}
.sc{width:120px;height:120px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:20px auto;font-size:32px;font-weight:700}
.sc.ps{background:rgba(16,185,129,.15);border:3px solid #10b981;color:#10b981}
.sc.fl{background:rgba(239,68,68,.15);border:3px solid #ef4444;color:#ef4444}
.tm{background:#3f3520;color:#fbbf24;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
.pk{background:#1e2130;border:1px solid #374151;border-radius:12px;margin-bottom:16px;overflow:hidden;cursor:pointer;transition:border-color .2s}
.pk:hover{border-color:var(--pulse-primary)}.ph{padding:14px 18px;border-bottom:1px solid #374151}.ph h2{font-size:15px;font-weight:600}
.ag{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;padding:14px 18px}
.ai{background:#0f1117;border:1px solid #374151;border-radius:8px;padding:12px;transition:border-color .2s}.ai:hover{border-color:var(--pulse-primary)}
.em{text-align:center;padding:60px 20px;color:#6b7280}
.core-redirect{background:#1e2130;border:1px solid var(--pulse-primary);border-radius:16px;padding:40px;max-width:500px;margin:60px auto;text-align:center}
.core-redirect h2{font-size:20px;color:#fff;margin-bottom:12px}
.core-redirect .countdown{font-size:48px;font-weight:700;color:var(--pulse-primary-light);margin:20px 0}
.core-redirect p{color:#9ca3af;font-size:14px;margin-bottom:16px}
.offline-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(239,68,68,.15);border:1px solid #ef4444;color:#ef4444;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:16px}
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
.core-redirect{padding:24px;margin:24px 12px}.core-redirect .countdown{font-size:36px}
}
@media(max-width:380px){
.hdr h1{font-size:12px}.ct{padding:8px}
.ag{grid-template-columns:1fr}
.sp{flex:0 0 32px;height:32px}
}
/* Enhanced MCQ buttons */
.op{min-height:56px;gap:12px;margin:6px 0}
.op .letter{width:28px;height:28px;border-radius:50%;background:#374151;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.op.sel .letter{background:var(--pulse-primary);color:#fff}
@media(hover:none){.op:hover{border-color:#374151}.op:active{border-color:var(--pulse-primary);background:rgba(242,101,34,.15)}}
/* Quiz timer fixed */
.quiz-timer-fixed{position:fixed;top:60px;right:16px;background:#3f3520;color:#fbbf24;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:700;z-index:50;transition:all .3s}
.quiz-timer-fixed.warn{background:#7c2d12;color:#f97316}
.quiz-timer-fixed.critical{background:#7f1d1d;color:#ef4444;animation:pulse-timer 1s infinite}
@keyframes pulse-timer{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
/* Video progress */
.video-time{font-size:12px;color:#9ca3af;margin-top:4px;font-variant-numeric:tabular-nums}
/* Sequence progress */
.seq-progress{display:flex;align-items:center;gap:6px;padding:8px 0;font-size:12px;color:#9ca3af}
.seq-progress .step{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;border:2px solid #374151;flex-shrink:0}
.seq-progress .step.current{border-color:#06b6d4;background:#06b6d4;color:#fff}
.seq-progress .step.done{border-color:#10b981;background:#10b981;color:#fff}
.seq-progress .step-line{width:12px;height:2px;background:#374151;flex-shrink:0}
/* Waiting state */
.wait-wrap{text-align:center;padding:40px 20px}
.wait-clock{font-size:48px;font-weight:700;color:#fff;margin:20px 0;font-variant-numeric:tabular-nums}
.wait-schedule{max-width:400px;margin:24px auto 0;text-align:left}
.wait-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #1e2130;font-size:13px}
.wait-item .time{font-family:monospace;color:#9ca3af;width:50px}
.wait-item .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
/* Offline banner */
.offline-banner{background:rgba(239,68,68,.08);border-bottom:1px solid rgba(239,68,68,.2);padding:8px 16px;display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#f87171}
.offline-banner button{background:none;border:none;color:#f87171;cursor:pointer;font-size:14px}
/* Accessibility panel */
.a11y-btn{position:fixed;bottom:16px;right:16px;width:40px;height:40px;border-radius:50%;background:#1e2130;border:1px solid #374151;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;z-index:100;color:#9ca3af}
.a11y-panel{position:fixed;bottom:70px;right:16px;background:#1e2130;border:1px solid #374151;border-radius:12px;padding:16px;width:220px;z-index:100;display:none}
.a11y-panel.show{display:block}
.a11y-panel h4{font-size:13px;font-weight:600;margin-bottom:8px}
.a11y-panel .opt{display:flex;gap:4px;margin-bottom:12px}
.a11y-panel .opt button{flex:1;padding:6px;border:1px solid #374151;background:transparent;color:#e5e7eb;border-radius:6px;font-size:11px;cursor:pointer}
.a11y-panel .opt button.active{border-color:var(--pulse-primary);background:rgba(242,101,34,.15)}
/* Font size classes */
body.fs-sm{font-size:14px}body.fs-md{font-size:16px}body.fs-lg{font-size:19px}body.fs-xl{font-size:22px}
/* High contrast */
body.hc{background:#000;color:#fff}body.hc .hdr{background:#111;border-color:#444}body.hc .lc,body.hc .qc,body.hc .pk{background:#111;border-color:#444}
body.hc .op.sel{background:rgba(255,255,0,.15);border-color:#ff0}body.hc .btn{background:#ff0;color:#000}
/* Ambient animation for waiting state */
@keyframes ambient{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.ambient{background:linear-gradient(135deg,#0f1117,#151825,#0f1117);background-size:200% 200%;animation:ambient 8s ease infinite}
</style></head><body>
<div class="hdr"><div class="logo"><img src="/pulse-logo.png" alt="Pulse" style="height:28px;width:auto;margin-right:8px" onerror="this.outerHTML='<div class=li>P</div>'"><h1>${classroomName}</h1><span id="sched-info" style="font-size:12px;color:#9ca3af;margin-left:12px"></span></div><div id="hr"><div class="st"><div class="dot ${nodeStatus === 'online' ? 'on' : 'off'}"></div><span>${nodeStatus === 'online' ? 'Online' : 'Offline'}</span></div></div></div>
<div class="ct" id="ct"><div class="em">Loading...</div></div>
<script>
(function(){
var T='${token}',S=null,CS=null,CI=0,QS=null,CD=null,WAN='${nodeStatus}'==='online';
var SCHED=${scheduleJson};
var I18N={
  en:{welcome:'Welcome',sign_in:'Sign In',enter_student_number:'Enter your student number to get started',student_number_placeholder:'Student number or name',no_students_found:'No students found',switch_user:'Switch',online:'Online',offline:'Offline',your_learning_content:'Your Learning Content',sequences_available:'sequence(s) available',items:'items',no_content:'No Content Available',play:'Play',open:'Open',next:'Next',back:'Back',submit:'Submit Answers',question:'Question',questions:'questions',passed:'Passed',try_again:'Try Again',correct:'correct',continue_btn:'Continue',complete:'Complete!',well_done:'Well done',back_to_content:'Back to Content',not_available:'Not available',not_available_offline:'Not available offline',short_break:'Take a short break',min_break:'minute break',teacher_led:'Teacher-led session',teacher_conducting:'Teacher is conducting a session',auto_advance:'Content will advance automatically',loading:'Loading...',login_failed:'Login failed',not_found:'Not found',quiz_not_loaded:'Quiz not loaded',open_document:'Open Document',opening_core_quiz:'Opening your quiz in CORE...',log_into_core:'Log into CORE to take your quiz',continue_without_core:'Continue without CORE',no_internet_standard_quiz:'No internet \\u2014 standard quiz',offline_quiz_3mcq:'Offline quiz (3 questions)',lesson_complete_title:'Lesson Complete',open_core_now:'Open CORE Now'},
  pt:{welcome:'Bem-vindo',sign_in:'Entrar',enter_student_number:'Digite seu n\\u00famero de estudante para come\\u00e7ar',student_number_placeholder:'N\\u00famero ou nome do estudante',no_students_found:'Nenhum estudante encontrado',switch_user:'Trocar',online:'Online',offline:'Offline',your_learning_content:'Seu conte\\u00fado de aprendizagem',sequences_available:'sequ\\u00eancia(s) dispon\\u00edvel(is)',items:'itens',no_content:'Nenhum conte\\u00fado dispon\\u00edvel',play:'Reproduzir',open:'Abrir',next:'Pr\\u00f3ximo',back:'Voltar',submit:'Enviar respostas',question:'Quest\\u00e3o',questions:'quest\\u00f5es',passed:'Aprovado',try_again:'Tente novamente',correct:'correto(s)',continue_btn:'Continuar',complete:'Completo!',well_done:'Parab\\u00e9ns',back_to_content:'Voltar ao conte\\u00fado',not_available:'N\\u00e3o dispon\\u00edvel',not_available_offline:'N\\u00e3o dispon\\u00edvel offline',short_break:'Fa\\u00e7a uma pausa',min_break:'minutos de pausa',teacher_led:'Sess\\u00e3o dirigida pelo professor',teacher_conducting:'O professor est\\u00e1 conduzindo uma sess\\u00e3o',auto_advance:'O conte\\u00fado avan\\u00e7ar\\u00e1 automaticamente',loading:'Carregando...',login_failed:'Falha no login',not_found:'N\\u00e3o encontrado',quiz_not_loaded:'Quiz n\\u00e3o carregado',open_document:'Abrir documento',opening_core_quiz:'Abrindo seu quiz no CORE...',log_into_core:'Entre no CORE para fazer seu quiz',continue_without_core:'Continuar sem o CORE',no_internet_standard_quiz:'Sem internet \\u2014 quiz padr\\u00e3o',offline_quiz_3mcq:'Quiz offline (3 quest\\u00f5es)',lesson_complete_title:'Li\\u00e7\\u00e3o Completa',open_core_now:'Abrir CORE Agora'},
  es:{welcome:'Bienvenido',sign_in:'Iniciar sesi\\u00f3n',enter_student_number:'Ingresa tu n\\u00famero de estudiante para comenzar',student_number_placeholder:'N\\u00famero o nombre del estudiante',no_students_found:'No se encontraron estudiantes',switch_user:'Cambiar',online:'En l\\u00ednea',offline:'Sin conexi\\u00f3n',your_learning_content:'Tu contenido de aprendizaje',sequences_available:'secuencia(s) disponible(s)',items:'elementos',no_content:'No hay contenido disponible',play:'Reproducir',open:'Abrir',next:'Siguiente',back:'Atr\\u00e1s',submit:'Enviar respuestas',question:'Pregunta',questions:'preguntas',passed:'Aprobado',try_again:'Int\\u00e9ntalo de nuevo',correct:'correcto(s)',continue_btn:'Continuar',complete:'\\u00a1Completado!',well_done:'Bien hecho',back_to_content:'Volver al contenido',not_available:'No disponible',not_available_offline:'No disponible sin conexi\\u00f3n',short_break:'Toma un breve descanso',min_break:'minutos de descanso',teacher_led:'Sesi\\u00f3n dirigida por el profesor',teacher_conducting:'El profesor est\\u00e1 dirigiendo una sesi\\u00f3n',auto_advance:'El contenido avanzar\\u00e1 autom\\u00e1ticamente',loading:'Cargando...',login_failed:'Error al iniciar sesi\\u00f3n',not_found:'No encontrado',quiz_not_loaded:'Cuestionario no cargado',open_document:'Abrir documento',opening_core_quiz:'Abriendo tu quiz en CORE...',log_into_core:'Inicia sesi\\u00f3n en CORE para hacer tu quiz',continue_without_core:'Continuar sin CORE',no_internet_standard_quiz:'Sin internet \\u2014 quiz est\\u00e1ndar',offline_quiz_3mcq:'Quiz sin conexi\\u00f3n (3 preguntas)',lesson_complete_title:'Lecci\\u00f3n Completa',open_core_now:'Abrir CORE Ahora'}
};
var LANG=(navigator.language||'en').substring(0,2);
if(!I18N[LANG])LANG='en';
function t(k){return I18N[LANG][k]||I18N.en[k]||k}

var sv=localStorage.getItem('ps_'+T);if(sv){try{S=JSON.parse(sv)}catch{}}
var lastEventId=null;

function updSchedInfo(){
  var el=document.getElementById('sched-info');if(!el)return;
  if(SCHED&&SCHED.class_group_name){
    el.textContent=SCHED.class_group_name+(SCHED.sequence_name?' \\u00b7 '+SCHED.sequence_name:'')+(SCHED.teacher_name?' \\u00b7 '+SCHED.teacher_name:'');
  } else if(SCHED&&SCHED.upcoming_class){
    el.textContent=t('next')+': '+SCHED.upcoming_class+' ('+SCHED.upcoming_minutes+'min)';
  } else {
    el.textContent='';
  }
}
function pollSchedule(){
  fetch('/classroom/current-schedule?token='+T).then(function(r){return r.json()}).then(function(d){
    if(d.active){SCHED={class_group_name:d.active.class_group_name,sequence_name:d.active.sequence_name,teacher_name:d.active.teacher_name,minutes_remaining:d.active.minutes_remaining,upcoming_class:null,upcoming_minutes:null}}
    else if(d.upcoming){SCHED={class_group_name:null,sequence_name:null,teacher_name:null,minutes_remaining:null,upcoming_class:d.upcoming.class_group_name,upcoming_minutes:d.upcoming.minutes_remaining}}
    else{SCHED=null}
    updSchedInfo();
  }).catch(function(){})
}
function validateStudentGroup(){
  if(!S||!S.id)return;
  fetch('/classroom/validate-student?token='+T+'&student_id='+S.id).then(function(r){return r.json()}).then(function(d){
    if(d.valid===false&&d.class_group_name){
      var el=document.getElementById('ct');
      if(el){
        var h='<div style="text-align:center;padding:60px"><div style="background:rgba(239,68,68,.15);border:1px solid #ef4444;border-radius:12px;padding:24px;max-width:400px;margin:0 auto">';
        h+='<h2 style="color:#ef4444;margin-bottom:8px">Wrong Classroom</h2>';
        h+='<p style="color:#9ca3af;font-size:14px">You are not enrolled in <strong>'+E(d.class_group_name)+'</strong>. Please check your room assignment.</p>';
        h+='<button class="btn bo bs" style="margin-top:16px" onclick="loadC()">'+t('continue_btn')+'</button>';
        h+='</div></div>';
        el.innerHTML=h;
      }
    }
  }).catch(function(){})
}
function init(){if(!S){showLogin();return;}updHdr();updSchedInfo();loadC();validateStudentGroup();setInterval(pollCD,5000);setInterval(pollEvents,5000);setInterval(pollSchedule,60000);setInterval(loadC,60000)}

function showLogin(){
  var h='<div class="ls"><div class="lc"><img src="/pulse-logo.png" alt="Pulse" style="height:48px;width:auto;margin:0 auto 16px;display:block" onerror="this.style.display=\\'none\\'">';
  h+='<h2>'+t('welcome')+'</h2><p>'+t('enter_student_number')+'</p>';
  h+='<input id="si" placeholder="'+t('student_number_placeholder')+'" autofocus />';
  h+='<div id="slist" class="sl"></div>';
  h+='<button class="btn" style="width:100%" onclick="doLogin()" id="lb" disabled>'+t('sign_in')+'</button></div></div>';
  document.getElementById('ct').innerHTML=h;
  document.getElementById('si').addEventListener('input',srch);
  document.getElementById('si').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin()});
}
var SR=[],SS=null;
function srch(e){var q=e.target.value.trim();
  if(q.length>=1)document.getElementById('lb').disabled=false;
  else document.getElementById('lb').disabled=true;
  if(q.length<2){document.getElementById('slist').innerHTML='';return;}
  fetch('/students/search?token='+T+'&q='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){
    SR=d.students||[];var h='';SR.forEach(function(s,i){h+='<div class="si" onclick="selS('+i+')">'+E(s.name)+' <span style="color:#9ca3af;font-size:11px">#'+E(s.student_number||'')+'</span></div>'});
    if(!SR.length&&q.length>=2)h='<div style="padding:12px;color:#6b7280;font-size:12px">'+t('no_students_found')+'</div>';
    document.getElementById('slist').innerHTML=h}).catch(function(){})}
window.selS=function(i){SS=SR[i];var els=document.querySelectorAll('.si');els.forEach(function(el,j){el.className='si'+(j===i?' sel':'')});document.getElementById('lb').disabled=false};
window.doLogin=function(){
  var body={token:T};
  if(SS){body.student_id=SS.id}else{var v=document.getElementById('si').value.trim();if(!v)return;body.student_number=v}
  fetch('/students/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json()}).then(function(d){
    if(d.student){S=d.student;localStorage.setItem('ps_'+T,JSON.stringify(S));updHdr();loadC();setInterval(pollCD,5000);setInterval(pollEvents,5000)}else{alert(d.error||t('not_found'))}
  }).catch(function(){alert(t('login_failed'))})};
window.doLogout=function(){S=null;SS=null;localStorage.removeItem('ps_'+T);
  fetch('/students/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:T})}).catch(function(){});
  document.getElementById('hr').innerHTML='<div class="st"><div class="dot ${nodeStatus === 'online' ? 'on' : 'off'}"></div><span>${nodeStatus === 'online' ? 'Online' : 'Offline'}</span></div>';showLogin()};
function updHdr(){if(!S)return;document.getElementById('hr').innerHTML='<div class="ui"><span class="nm">'+E(S.name)+'</span><button onclick="doLogout()">'+t('switch_user')+'</button></div>'}

function loadC(){if(!S)return;var u='/sequences?token='+T;
  if(S.class_group_ids&&S.class_group_ids.length)u+='&class_groups='+encodeURIComponent(JSON.stringify(S.class_group_ids));
  if(S.grade_id)u+='&grade_id='+S.grade_id;
  fetch(u).then(function(r){return r.json()}).then(function(d){
    if(d.sequences&&d.sequences.length){rSeqL(d.sequences)}else{fetch('/packages?token='+T).then(function(r){return r.json()}).then(function(d){rPkg(d.packages||[])}).catch(function(){})}
  }).catch(function(){fetch('/packages?token='+T).then(function(r){return r.json()}).then(function(d){rPkg(d.packages||[])}).catch(function(){})})}

function pollCD(){fetch('/conductor/state?token='+T).then(function(r){return r.json()}).then(function(d){
  if(d.active&&d.sequence_id){if(!CD||CD.sequence_id!==d.sequence_id||CD.current_item_index!==d.current_item_index){CD=d;
    if(CS&&CS.id===d.sequence_id){CI=d.current_item_index;rItem()}else{window.goSeq(d.sequence_id)}}}else{CD=null}}).catch(function(){})}

/* Poll for classroom events (lesson_complete) */
function pollEvents(){
  fetch('/classroom-events?token='+T+(lastEventId?'&after='+lastEventId:'')).then(function(r){return r.json()}).then(function(d){
    if(d.events&&d.events.length){
      d.events.forEach(function(ev){
        lastEventId=ev.id||lastEventId;
        if(ev.type==='lesson_complete')handleLessonComplete(ev);
      });
    }
  }).catch(function(){})
}

/* Handle lesson_complete event from server.
   CORE decides the mode; Pulse just renders the matching UI.
   - 'individual'   → this student's device redirects to CORE quiz_url
   - 'class_fanout' → shared STB: show "quiz posted" overlay
   - 'pending'      → WAN down or CORE unreachable: "quiz pending" holding screen */
function handleLessonComplete(ev){
  if(ev.mode==='individual'&&ev.core_quiz_url){
    if(S&&S.id)showCoreRedirect(ev.core_quiz_url);
    else showCoreLoginPrompt(ev.core_quiz_url);
  } else if(ev.mode==='class_fanout'){
    showClassFanoutNotice(ev.students_notified||0);
  } else if(ev.mode==='pending'){
    showQuizPending();
  } else {
    // Unknown/missing mode — graceful no-op, just advance.
    nxt();
  }
}

/* CORE redirect with 5-second countdown */
var coreCountdownTimer=null;
function showCoreRedirect(url){
  var seconds=5;
  var h='<div class="core-redirect">';
  h+='<h2>'+t('lesson_complete_title')+'</h2>';
  h+='<p>'+t('opening_core_quiz')+'</p>';
  h+='<div class="countdown" id="core-cd">'+seconds+'</div>';
  h+='<button class="btn" onclick="openCoreNow()" id="core-go-btn" style="margin-bottom:12px">'+t('open_core_now')+'</button><br>';
  h+='<button class="btn bo bs" onclick="skipCore()">'+t('continue_btn')+' &rarr;</button>';
  h+='</div>';
  document.getElementById('ct').innerHTML=h;
  var coreUrl=url;
  if(coreCountdownTimer)clearInterval(coreCountdownTimer);
  coreCountdownTimer=setInterval(function(){
    seconds--;
    var el=document.getElementById('core-cd');
    if(el)el.textContent=seconds;
    if(seconds<=0){
      clearInterval(coreCountdownTimer);coreCountdownTimer=null;
      window.open(coreUrl,'_blank');
      setTimeout(function(){nxt()},1000);
    }
  },1000);
  window.openCoreNow=function(){
    if(coreCountdownTimer){clearInterval(coreCountdownTimer);coreCountdownTimer=null}
    window.open(coreUrl,'_blank');
    setTimeout(function(){nxt()},500);
  };
  window.skipCore=function(){
    if(coreCountdownTimer){clearInterval(coreCountdownTimer);coreCountdownTimer=null}
    nxt();
  };
}

/* Student not logged into CORE */
function showCoreLoginPrompt(url){
  var h='<div class="core-redirect">';
  h+='<h2>'+t('lesson_complete_title')+'</h2>';
  h+='<p>'+t('log_into_core')+'</p>';
  if(url){h+='<a href="'+E(url)+'" target="_blank" class="btn" style="margin-bottom:12px">'+t('open_core_now')+'</a><br>';}
  h+='<button class="btn bo bs" onclick="nxt()">'+t('continue_btn')+' &rarr;</button>';
  h+='</div>';
  document.getElementById('ct').innerHTML=h;
}

/* Shared-STB (classroom_fanout): CORE published the quiz to every enrolled
   student's CORE account. The STB shows a static card; students open CORE
   on their own devices to take the quiz. No redirect happens from the STB. */
function showClassFanoutNotice(studentsNotified){
  var h='<div class="core-redirect">';
  h+='<h2>'+t('lesson_complete_title')+'</h2>';
  h+='<p>Nice work! The quiz is now available in CORE for all students in this class';
  if(studentsNotified)h+=' ('+studentsNotified+' students notified)';
  h+='.</p>';
  h+='<p style="font-size:13px;color:#9ca3af;margin-top:8px">Open CORE on your own device to take it when ready.</p>';
  h+='<button class="btn bo bs" onclick="nxt()" style="margin-top:16px">'+t('continue_btn')+' &rarr;</button>';
  h+='</div>';
  document.getElementById('ct').innerHTML=h;
}

/* Quiz pending: WAN is down (or CORE is unreachable). We don't fake a quiz
   because CORE does real diagnostic scoring + personalized homework that we
   can't approximate offline. The lesson_complete is already queued locally
   and the sync worker will flush to CORE when connectivity returns. */
function showQuizPending(){
  var h='<div class="core-redirect">';
  h+='<h2>'+t('lesson_complete_title')+'</h2>';
  h+='<p>Nice work! Your quiz will be ready when we\\'re back online.</p>';
  h+='<p style="font-size:13px;color:#9ca3af;margin-top:8px">We saved your completion locally and will send it to CORE automatically.</p>';
  h+='<button class="btn bo bs" onclick="nxt()" style="margin-top:16px">'+t('continue_btn')+' &rarr;</button>';
  h+='</div>';
  document.getElementById('ct').innerHTML=h;
}

function rSeqL(seqs){var h='';if(CD)h+='<div class="cb"><div><div class="lb">'+t('teacher_conducting')+'</div><div class="tt">'+t('auto_advance')+'</div></div></div>';
  h+='<div style="margin-bottom:16px"><div style="font-size:20px;font-weight:700">'+t('your_learning_content')+'</div><div style="font-size:12px;color:#9ca3af;margin-top:4px">'+seqs.length+' '+t('sequences_available')+'</div></div>';
  seqs.forEach(function(s){h+='<div class="pk" onclick="goSeq(\\''+s.id+'\\')"><div class="ph"><h2>'+E(s.name)+'</h2><div style="font-size:11px;color:#9ca3af;margin-top:4px">'+(s.items?s.items.length:0)+' '+t('items')+(s.grade?' &middot; '+E(s.grade):'')+(s.subject?' &middot; '+E(s.subject):'')+'</div></div></div>'});
  document.getElementById('ct').innerHTML=h}
window.goSeq=function(id){fetch('/sequences/'+id+'?token='+T).then(function(r){return r.json()}).then(function(d){CS=d;CI=0;if(CD&&CD.sequence_id===id)CI=CD.current_item_index;rItem()})};

function rItem(){if(!CS||!CS.items||CI>=CS.items.length){rDone();return;}var it=CS.items[CI];
  var h=rTL();if(CD&&CD.sequence_id===CS.id)h+='<div class="cb"><div><div class="lb">'+t('teacher_led')+'</div><div class="tt">'+E(it.title)+'</div></div></div>';
  if(it.item_type==='video')h+=rVid(it);else if(it.item_type==='quiz'){h+='<div id="qc"></div>';document.getElementById('ct').innerHTML=h;iQuiz(it.quiz);return}
  else if(it.item_type==='document')h+=rDoc(it);else h+=rBrk(it);document.getElementById('ct').innerHTML=h}

function rTL(){var h='<div style="font-size:20px;font-weight:700;margin-bottom:16px">'+E(CS.name)+'</div><div class="tl">';
  CS.items.forEach(function(it,i){var c=it.item_type+(i===CI?' act':'')+(i<CI?' done':'');
    var l=it.item_type==='video'?'&#9654;':it.item_type==='quiz'?'?':'&#128196;';
    h+='<div class="sp '+c+'" title="'+E(it.title)+'" onclick="gTo('+i+')">'+l+'</div>';if(i<CS.items.length-1)h+='<div class="cn">&rarr;</div>'});return h+'</div>'}

function rVid(it){var h=rSeqProgress();h+='<div class="vc">';if(it.stream_url)h+='<video controls autoplay src="'+E(it.stream_url)+'" id="vp"></video>';
  else h+='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af">'+t('not_available')+'</div>';
  h+='</div><div class="video-time" id="vtime"></div>';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><h3>'+E(it.title)+'</h3><div>';
  if(CI>0)h+='<button class="btn bo bs" onclick="gTo('+(CI-1)+')">'+t('back')+'</button> ';
  if(!CD)h+='<button class="btn bs" onclick="nxt()">'+t('next')+' &rarr;</button>';
  h+='</div></div>';
  setTimeout(function(){var v=document.getElementById('vp');if(v){
    // Video time display
    v.ontimeupdate=function(){
      var el=document.getElementById('vtime');if(!el)return;
      var cur=Math.floor(v.currentTime),dur=Math.floor(v.duration||0);
      function fmt(s){var m=Math.floor(s/60);var sec=s%60;return m+':'+(sec<10?'0':'')+sec}
      el.textContent=dur>0?fmt(cur)+' / '+fmt(dur):fmt(cur);
    };
    v.onended=function(){
      // Fire lesson-complete to server
      var watchDuration=Math.round(v.currentTime);
      var watchPct=v.duration>0?Math.round((v.currentTime/v.duration)*100):100;
      fetch('/lesson-complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        token:T,asset_id:it.asset_id||'',sequence_id:CS?CS.id:null,sequence_item_index:CI,
        student_id:S?S.id:null,watch_pct:watchPct,watch_duration_seconds:watchDuration
      })}).then(function(r){return r.json()}).then(function(d){
        if(d.event){handleLessonComplete(d.event)}
        else if(!CD){nxt()}
      }).catch(function(){if(!CD)nxt()});
    };
  }},100);return h}

function iQuiz(q){if(!q){document.getElementById('qc').innerHTML='<div class="em">'+t('quiz_not_loaded')+'</div>';return;}
  QS={q:q,a:{},sub:false,st:Date.now(),offline:false};rQ()}

function rQ(){var q=QS.q,LETTERS='ABCDEFGHIJKLMNOP';
  var h=rSeqProgress()+'<div class="qc"><div class="qt">'+E(q.title)+'</div><div class="qm">'+(q.questions?q.questions.length:0)+' '+t('questions');
  if(QS.offline)h+=' <span class="offline-badge" style="margin-left:8px"><div class="dot off"></div>'+t('offline_quiz_3mcq')+'</span>';
  h+='</div>';
  // Fixed timer rendered separately
  if(q.time_limit_minutes&&!QS.sub)h+='<div class="quiz-timer-fixed" id="qt">'+q.time_limit_minutes+':00</div>';
  if(!QS.sub){(q.questions||[]).forEach(function(qu,qi){h+='<div class="qu"><div class="qn">'+t('question')+' '+(qi+1)+'</div><div class="qx">'+E(qu.question_text)+'</div>';
    (qu.options||[]).forEach(function(o,oi){var s=QS.a[qu.id]===o.id?' sel':'';h+='<div class="op'+s+'" onclick="pA(\\''+qu.id+'\\',\\''+o.id+'\\')"><div class="letter">'+(LETTERS[oi]||oi)+'</div><span>'+E(o.text)+'</span></div>'});h+='</div>'});
    h+='<div style="text-align:right;margin-top:16px"><button class="btn" onclick="sQ()" style="width:auto">'+t('submit')+'</button></div>'}else{h+=rQR()}
  h+='</div>';var el=document.getElementById('qc');if(el)el.innerHTML=h;else document.getElementById('ct').innerHTML=h;
  if(q.time_limit_minutes&&!QS.sub)sTmr(q.time_limit_minutes)}
window.pA=function(qi,oi){QS.a[qi]=oi;rQ()};
window.sQ=function(){QS.sub=true;var q=QS.q,c=0,tt=(q.questions||[]).length;
  (q.questions||[]).forEach(function(qu){var s=QS.a[qu.id],co=(qu.options||[]).find(function(o){return o.is_correct});if(co&&s===co.id)c++});
  QS.sc=c;QS.t=tt;QS.pct=tt>0?Math.round(c/tt*100):0;QS.p=QS.pct>=(q.pass_percentage||50);
  fetch('/quiz/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:T,quiz_id:q.id,answers:QS.a,score:c,max_score:tt,percentage:QS.pct,passed:QS.p,time_spent:Math.floor((Date.now()-QS.st)/1000),student_id:S?S.id:null,student_name:S?S.name:null})}).catch(function(){});rQ()};
function rQR(){return'<div class="rs"><div class="sc '+(QS.p?'ps':'fl')+'"><div>'+QS.pct+'%</div><div style="font-size:12px;font-weight:400">'+(QS.p?t('passed'):t('try_again'))+'</div></div><h2>'+QS.sc+'/'+QS.t+' '+t('correct')+'</h2><div style="margin-top:16px">'+(CD?'':'<button class="btn bs" onclick="nxt()" style="width:auto">'+t('continue_btn')+' &rarr;</button>')+'</div></div>'}
function sTmr(m){var s=m*60;var el=document.getElementById('qt');setInterval(function(){if(QS.sub){if(el)el.style.display='none';return;}s--;if(s<=0){sQ();return;}var mm=Math.floor(s/60),ss=s%60;if(el){el.textContent=mm+':'+(ss<10?'0':'')+ss;el.className='quiz-timer-fixed'+(s<=60?' critical':s<=120?' warn':'')}},1000)}
function rDoc(it){return'<div style="background:#1e2130;border:1px solid #374151;border-radius:12px;padding:32px;text-align:center"><h3>'+E(it.title)+'</h3>'+(it.stream_url?'<a href="'+E(it.stream_url)+'" target="_blank" class="btn" style="margin-top:16px;width:auto">'+t('open_document')+'</a>':'<p style="color:#6b7280;margin-top:8px">'+t('not_available_offline')+'</p>')+'<div style="margin-top:16px">'+(CD?'':'<button class="btn bo bs" onclick="nxt()">'+t('next')+' &rarr;</button>')+'</div></div>'}
function rBrk(it){return'<div style="text-align:center;padding:60px"><h2>'+E(it.title)+'</h2><p style="color:#9ca3af;margin:12px 0">'+(it.duration_minutes?it.duration_minutes+' '+t('min_break'):t('short_break'))+'</p>'+(CD?'':'<button class="btn bs" onclick="nxt()" style="width:auto">'+t('continue_btn')+' &rarr;</button>')+'</div>'}
function rDone(){document.getElementById('ct').innerHTML='<div style="text-align:center;padding:60px"><h2 style="color:#10b981;font-size:24px">&#10003; '+t('complete')+'</h2><p style="color:#9ca3af;margin:12px 0">'+t('well_done')+(S?', '+E(S.name):'')+'!</p><button class="btn bs" onclick="loadC()" style="width:auto">'+t('back_to_content')+'</button></div>'}
window.nxt=function(){CI++;rItem()};window.gTo=function(i){if(!CD){CI=i;rItem()}};
function rPkg(pk){var el=document.getElementById('ct');if(!pk||!pk.length){el.innerHTML='<div class="em"><h2>'+t('no_content')+'</h2></div>';return;}
  var h='';pk.forEach(function(p){h+='<div class="pk"><div class="ph"><h2>'+E(p.name)+'</h2></div><div class="ag">';
    if(p.assets)p.assets.forEach(function(a){h+='<div class="ai"><div style="font-size:12px;font-weight:500;margin-bottom:8px">'+E(a.filename)+'</div>';
      if(a.stream_url)h+='<button class="btn bs" onclick="window.open(\\''+E(a.stream_url)+'\\',\\'_blank\\')">'+t('play')+'</button>';h+='</div>'});h+='</div></div>'});el.innerHTML=h}
function E(s){if(!s)return'';var d=document.createElement('div');d.textContent=s;return d.innerHTML}

/* ── Sequence progress indicator ── */
function rSeqProgress(){
  if(!CS||!CS.items)return'';
  var h='<div class="seq-progress">';
  CS.items.forEach(function(it,i){
    var cls=i<CI?'done':i===CI?'current':'';
    var icon=i<CI?'\\u2713':(i+1);
    h+='<div class="step '+cls+'">'+icon+'</div>';
    if(i<CS.items.length-1)h+='<div class="step-line"></div>';
  });
  h+='<span style="margin-left:8px">'+t('question')+' '+(CI+1)+' / '+CS.items.length+'</span>';
  h+='</div>';
  return h;
}

/* ── Waiting state with clock and schedule ── */
function showWaitState(){
  var h='<div class="wait-wrap ambient">';
  h+='<div class="wait-clock" id="wait-clock"></div>';
  h+='<h2 style="font-size:18px;margin-bottom:4px">'+E('${classroomName}')+'</h2>';
  if(SCHED&&SCHED.class_group_name)h+='<p style="color:var(--pulse-primary-light);font-size:14px">'+E(SCHED.class_group_name)+'</p>';
  if(SCHED&&SCHED.upcoming_class)h+='<div style="background:#1e2130;border:1px solid #374151;border-radius:12px;padding:16px;max-width:300px;margin:24px auto;text-align:left"><div style="font-size:11px;color:#9ca3af">'+t('next')+':</div><div style="font-size:16px;font-weight:600;margin-top:4px">'+E(SCHED.upcoming_class)+'</div><div style="font-size:12px;color:#9ca3af;margin-top:2px">'+SCHED.upcoming_minutes+' min</div></div>';
  h+='<div id="day-sched" class="wait-schedule"></div>';
  h+='</div>';
  document.getElementById('ct').innerHTML=h;
  // Update clock
  function tick(){var el=document.getElementById('wait-clock');if(el){var n=new Date();el.textContent=n.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}}
  tick();setInterval(tick,1000);
  // Load day schedule
  fetch('/classroom/current-schedule?token='+T).then(function(r){return r.json()}).then(function(d){
    if(d.day_schedule&&d.day_schedule.length){
      var sh='';d.day_schedule.forEach(function(s){
        var isNow=s.minutes_remaining>0&&s.started_at;
        sh+='<div class="wait-item"><span class="time">'+E((s.started_at||'').substring(11,16))+'</span>';
        sh+='<div class="dot" style="background:'+(isNow?'#06b6d4':'#374151')+'"></div>';
        sh+='<span>'+E(s.class_group_name)+' \\u00b7 '+E(s.sequence_name)+'</span></div>';
      });
      var el=document.getElementById('day-sched');if(el)el.innerHTML=sh;
    }
  }).catch(function(){});
}

/* ── Accessibility controls ── */
function initA11y(){
  // Load saved preferences
  var fs=localStorage.getItem('pulse_fs')||'md';
  var hc=localStorage.getItem('pulse_hc')==='1';
  document.body.className='fs-'+fs+(hc?' hc':'');
  // Render panel
  var html='<button class="a11y-btn" onclick="toggleA11y()">\\u2699</button>';
  html+='<div class="a11y-panel" id="a11y-panel"><h4>Accessibility</h4>';
  html+='<div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Font Size</div>';
  html+='<div class="opt" id="fs-opts"><button onclick="setFs(\\'sm\\')" data-fs="sm">S</button><button onclick="setFs(\\'md\\')" data-fs="md">M</button><button onclick="setFs(\\'lg\\')" data-fs="lg">L</button><button onclick="setFs(\\'xl\\')" data-fs="xl">XL</button></div>';
  html+='<div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Contrast</div>';
  html+='<div class="opt"><button onclick="setHc(false)" id="hc-off">Normal</button><button onclick="setHc(true)" id="hc-on">High</button></div>';
  html+='</div>';
  var wrap=document.createElement('div');wrap.innerHTML=html;
  while(wrap.firstChild)document.body.appendChild(wrap.firstChild);
  updA11yBtns();
}
window.toggleA11y=function(){var p=document.getElementById('a11y-panel');if(p)p.classList.toggle('show')};
window.setFs=function(s){localStorage.setItem('pulse_fs',s);document.body.className=document.body.className.replace(/fs-\\w+/,'fs-'+s);updA11yBtns()};
window.setHc=function(on){localStorage.setItem('pulse_hc',on?'1':'0');if(on)document.body.classList.add('hc');else document.body.classList.remove('hc');updA11yBtns()};
function updA11yBtns(){
  var fs=localStorage.getItem('pulse_fs')||'md';var hc=localStorage.getItem('pulse_hc')==='1';
  document.querySelectorAll('#fs-opts button').forEach(function(b){b.className=b.getAttribute('data-fs')===fs?'active':''});
  var off=document.getElementById('hc-off');var on=document.getElementById('hc-on');
  if(off)off.className=hc?'':'active';if(on)on.className=hc?'active':'';
}
initA11y();

init()})();
</script></body></html>`;
}
