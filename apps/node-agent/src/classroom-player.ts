export function renderClassroomPlayer(classroomName: string, token: string, nodeStatus: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${classroomName} — Pulse</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e5e7eb;min-height:100vh}
.header{background:#1e2130;border-bottom:1px solid #374151;padding:12px 24px;display:flex;align-items:center;justify-content:space-between}
.header h1{font-size:18px;font-weight:700;color:#fff}
.status{display:flex;align-items:center;gap:8px;font-size:12px;color:#9ca3af}
.status-dot{width:8px;height:8px;border-radius:50%;background:#10b981}
.status-dot.offline{background:#ef4444}
.logo{display:flex;align-items:center;gap:10px}
.logo-icon{width:28px;height:28px;background:#6366f1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px}
.content{padding:20px;max-width:1000px;margin:0 auto}
/* Sequence view */
.seq-header{margin-bottom:16px}
.seq-title{font-size:20px;font-weight:700}
.seq-meta{font-size:12px;color:#9ca3af;margin-top:4px}
.seq-timeline{display:flex;gap:4px;margin:16px 0;overflow-x:auto;padding:4px 0}
.seq-step{flex:0 0 40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s;border:2px solid transparent}
.seq-step.video{background:#1e3a5f;color:#60a5fa}
.seq-step.quiz{background:#3f3520;color:#fbbf24}
.seq-step.document{background:#1a3a2a;color:#34d399}
.seq-step.break{background:#1e2130;color:#9ca3af}
.seq-step.active{border-color:#6366f1;transform:scale(1.1)}
.seq-step.completed{opacity:.5}
.seq-connector{width:16px;display:flex;align-items:center;justify-content:center;color:#374151}
/* Video player */
.video-container{background:#000;border-radius:12px;overflow:hidden;aspect-ratio:16/9;margin-bottom:16px;position:relative}
.video-container video{width:100%;height:100%}
.video-container iframe{width:100%;height:100%;border:none}
/* Quiz view */
.quiz-container{background:#1e2130;border:1px solid #374151;border-radius:12px;padding:24px}
.quiz-title{font-size:18px;font-weight:600;margin-bottom:4px}
.quiz-meta{font-size:12px;color:#9ca3af;margin-bottom:20px}
.question{margin-bottom:20px;padding:16px;background:#0f1117;border-radius:8px;border:1px solid #374151}
.q-text{font-size:14px;margin-bottom:12px;font-weight:500}
.q-num{font-size:11px;color:#9ca3af;margin-bottom:6px}
.option{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:4px 0;border-radius:6px;cursor:pointer;transition:all .15s;border:1px solid #374151}
.option:hover{border-color:#6366f1}
.option.selected{background:#6366f1/20;border-color:#6366f1}
.option.correct{background:rgba(16,185,129,.15);border-color:#10b981}
.option.incorrect{background:rgba(239,68,68,.15);border-color:#ef4444}
.option input{display:none}
.option-radio{width:18px;height:18px;border-radius:50%;border:2px solid #4b5563;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.option.selected .option-radio{border-color:#6366f1;background:#6366f1}
.option.selected .option-radio::after{content:'';width:6px;height:6px;background:#fff;border-radius:50%}
.btn{display:inline-flex;align-items:center;gap:6px;background:#6366f1;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background .2s}
.btn:hover{background:#4f46e5}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-outline{background:transparent;border:1px solid #4b5563;color:#e5e7eb}
.btn-outline:hover{background:#1e2130}
/* Results */
.results{text-align:center;padding:32px}
.results h2{font-size:24px;margin-bottom:8px}
.score-circle{width:120px;height:120px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:20px auto;font-size:32px;font-weight:700}
.score-circle.pass{background:rgba(16,185,129,.15);border:3px solid #10b981;color:#10b981}
.score-circle.fail{background:rgba(239,68,68,.15);border:3px solid #ef4444;color:#ef4444}
/* Package grid fallback */
.package-card{background:#1e2130;border:1px solid #374151;border-radius:12px;margin-bottom:16px;overflow:hidden}
.package-header{padding:14px 18px;border-bottom:1px solid #374151}
.package-header h2{font-size:15px;font-weight:600}
.assets-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;padding:14px 18px}
.asset-item{background:#0f1117;border:1px solid #374151;border-radius:8px;padding:12px;transition:border-color .2s}
.asset-item:hover{border-color:#6366f1}
.asset-name{font-size:12px;font-weight:500;margin-bottom:8px;word-break:break-all}
.empty{text-align:center;padding:60px 20px;color:#6b7280}
.timer{background:#3f3520;color:#fbbf24;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px}
</style>
</head>
<body>
<div class="header">
  <div class="logo"><div class="logo-icon">P</div><h1>${classroomName}</h1></div>
  <div class="status"><div class="status-dot ${nodeStatus === 'online' ? '' : 'offline'}"></div><span>${nodeStatus === 'online' ? 'Online' : 'Offline'}</span></div>
</div>
<div class="content" id="content"><div class="empty">Loading...</div></div>

<script>
(function(){
  var TOKEN = '${token}';
  var currentSequence = null;
  var currentItemIdx = 0;
  var quizState = null;

  function load(){
    fetch('/sequences?token='+TOKEN).then(function(r){return r.json()}).then(function(data){
      if(data.sequences && data.sequences.length > 0){
        renderSequenceList(data.sequences);
      } else {
        // Fallback to packages
        fetch('/packages?token='+TOKEN).then(function(r){return r.json()}).then(function(d){renderPackages(d.packages||[])}).catch(function(){});
      }
    }).catch(function(){
      fetch('/packages?token='+TOKEN).then(function(r){return r.json()}).then(function(d){renderPackages(d.packages||[])}).catch(function(){});
    });
  }

  function renderSequenceList(sequences){
    var html='<div class="seq-header"><div class="seq-title">Learning Content</div><div class="seq-meta">'+sequences.length+' sequence(s) available</div></div>';
    sequences.forEach(function(seq){
      html+='<div class="package-card" style="cursor:pointer" onclick="startSequence(\\''+seq.id+'\\')"><div class="package-header"><h2>'+esc(seq.name)+'</h2><div style="font-size:11px;color:#9ca3af;margin-top:4px">'+(seq.items?seq.items.length:0)+' items &middot; '+(seq.grade||'')+' '+(seq.subject||'')+'</div></div></div>';
    });
    document.getElementById('content').innerHTML=html;
  }

  window.startSequence = function(seqId){
    fetch('/sequences/'+seqId+'?token='+TOKEN).then(function(r){return r.json()}).then(function(data){
      currentSequence=data;
      currentItemIdx=0;
      renderCurrentItem();
    });
  };

  function renderCurrentItem(){
    if(!currentSequence||!currentSequence.items||currentItemIdx>=currentSequence.items.length){
      renderSequenceComplete();
      return;
    }
    var item=currentSequence.items[currentItemIdx];
    var html=renderTimeline();
    if(item.item_type==='video') html+=renderVideoItem(item);
    else if(item.item_type==='quiz') html+=renderQuizItem(item);
    else if(item.item_type==='document') html+=renderDocItem(item);
    else if(item.item_type==='break') html+=renderBreakItem(item);
    else html+='<div class="empty">Unknown item type</div>';
    document.getElementById('content').innerHTML=html;
    if(item.item_type==='quiz'&&item.quiz) initQuiz(item.quiz);
  }

  function renderTimeline(){
    var html='<div class="seq-header"><div class="seq-title">'+esc(currentSequence.name)+'</div></div><div class="seq-timeline">';
    currentSequence.items.forEach(function(it,i){
      var cls=it.item_type+(i===currentItemIdx?' active':'')+(i<currentItemIdx?' completed':'');
      var label=it.item_type==='video'?'&#9654;':it.item_type==='quiz'?'?':it.item_type==='document'?'&#128196;':'&#9726;';
      html+='<div class="seq-step '+cls+'" title="'+esc(it.title)+'">'+label+'</div>';
      if(i<currentSequence.items.length-1) html+='<div class="seq-connector">&rarr;</div>';
    });
    html+='</div>';
    return html;
  }

  function renderVideoItem(item){
    var html='<div class="video-container">';
    if(item.stream_url) html+='<video controls autoplay src="'+esc(item.stream_url)+'" id="videoPlayer"></video>';
    else html+='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af">Video not available locally</div>';
    html+='</div><div style="display:flex;justify-content:space-between;align-items:center"><h3>'+esc(item.title)+'</h3><div>';
    if(currentItemIdx>0) html+='<button class="btn btn-outline" onclick="prevItem()">Back</button> ';
    html+='<button class="btn" onclick="nextItem()">Next &rarr;</button></div></div>';
    // Auto-advance when video ends
    setTimeout(function(){
      var v=document.getElementById('videoPlayer');
      if(v) v.onended=function(){if(item.auto_advance) nextItem();};
    },100);
    return html;
  }

  function renderQuizItem(item){
    if(!item.quiz) return '<div class="empty">Quiz not loaded</div>';
    return '<div id="quizContainer"></div>';
  }

  function initQuiz(quiz){
    quizState={quiz:quiz,answers:{},submitted:false,startTime:Date.now()};
    renderQuiz();
  }

  function renderQuiz(){
    var q=quizState.quiz;
    var html='<div class="quiz-container"><div class="quiz-title">'+esc(q.title)+'</div>';
    html+='<div class="quiz-meta">'+(q.questions?q.questions.length:0)+' questions';
    if(q.time_limit_minutes) html+=' &middot; <span class="timer" id="quizTimer">'+q.time_limit_minutes+':00</span>';
    html+='</div>';
    if(!quizState.submitted){
      (q.questions||[]).forEach(function(question,qi){
        html+='<div class="question"><div class="q-num">Question '+(qi+1)+'</div><div class="q-text">'+esc(question.question_text)+'</div>';
        (question.options||[]).forEach(function(opt,oi){
          var sel=quizState.answers[question.id]===opt.id?' selected':'';
          html+='<div class="option'+sel+'" onclick="selectAnswer(\\''+question.id+'\\',\\''+opt.id+'\\')"><div class="option-radio"></div><span>'+esc(opt.text)+'</span></div>';
        });
        html+='</div>';
      });
      html+='<div style="text-align:right;margin-top:16px"><button class="btn" onclick="submitQuiz()">Submit Answers</button></div>';
    } else {
      html+=renderQuizResults();
    }
    html+='</div>';
    var el=document.getElementById('quizContainer');
    if(el) el.innerHTML=html;
    else document.getElementById('content').innerHTML=renderTimeline()+html;
    if(q.time_limit_minutes&&!quizState.submitted) startTimer(q.time_limit_minutes);
  }

  window.selectAnswer=function(qId,optId){
    quizState.answers[qId]=optId;
    renderQuiz();
  };

  window.submitQuiz=function(){
    quizState.submitted=true;
    // Calculate score
    var q=quizState.quiz;
    var correct=0,total=(q.questions||[]).length;
    (q.questions||[]).forEach(function(question){
      var selected=quizState.answers[question.id];
      var correctOpt=(question.options||[]).find(function(o){return o.is_correct});
      if(correctOpt&&selected===correctOpt.id) correct++;
    });
    quizState.score=correct;
    quizState.total=total;
    quizState.pct=total>0?Math.round(correct/total*100):0;
    quizState.passed=quizState.pct>=(q.pass_percentage||50);
    // Submit to node
    fetch('/quiz/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TOKEN,quiz_id:q.id,answers:quizState.answers,score:correct,max_score:total,percentage:quizState.pct,passed:quizState.passed,time_spent:Math.floor((Date.now()-quizState.startTime)/1000)})}).catch(function(){});
    renderQuiz();
  };

  function renderQuizResults(){
    var html='<div class="results"><div class="score-circle '+(quizState.passed?'pass':'fail')+'"><div>'+quizState.pct+'%</div><div style="font-size:12px;font-weight:400">'+(quizState.passed?'Passed':'Try Again')+'</div></div>';
    html+='<h2>'+quizState.score+' / '+quizState.total+' correct</h2>';
    html+='<div style="margin-top:16px">';
    if(currentItemIdx>0) html+='<button class="btn btn-outline" onclick="prevItem()">Back</button> ';
    html+='<button class="btn" onclick="nextItem()">Continue &rarr;</button></div></div>';
    return html;
  }

  function startTimer(minutes){
    var seconds=minutes*60;
    var el=document.getElementById('quizTimer');
    var interval=setInterval(function(){
      if(quizState.submitted){clearInterval(interval);return;}
      seconds--;
      if(seconds<=0){clearInterval(interval);submitQuiz();return;}
      var m=Math.floor(seconds/60),s=seconds%60;
      if(el) el.textContent=m+':'+(s<10?'0':'')+s;
    },1000);
  }

  function renderDocItem(item){
    return '<div style="background:#1e2130;border:1px solid #374151;border-radius:12px;padding:32px;text-align:center"><h3>'+esc(item.title)+'</h3><p style="color:#9ca3af;margin:12px 0">Document viewer</p>'+(item.stream_url?'<a href="'+esc(item.stream_url)+'" target="_blank" class="btn">Open Document</a>':'<p style="color:#6b7280">Not available offline</p>')+'<div style="margin-top:16px"><button class="btn btn-outline" onclick="nextItem()">Next &rarr;</button></div></div>';
  }

  function renderBreakItem(item){
    return '<div style="text-align:center;padding:60px"><h2>'+esc(item.title)+'</h2><p style="color:#9ca3af;margin:12px 0">'+(item.duration_minutes?item.duration_minutes+' minute break':'Take a short break')+'</p><button class="btn" onclick="nextItem()">Continue &rarr;</button></div>';
  }

  function renderSequenceComplete(){
    document.getElementById('content').innerHTML='<div style="text-align:center;padding:60px"><h2 style="color:#10b981;font-size:24px">&#10003; Sequence Complete!</h2><p style="color:#9ca3af;margin:12px 0">You have completed all items in this sequence.</p><button class="btn" onclick="load()">Back to Content</button></div>';
  }

  window.nextItem=function(){
    currentItemIdx++;
    renderCurrentItem();
  };
  window.prevItem=function(){
    if(currentItemIdx>0){currentItemIdx--;renderCurrentItem();}
  };

  function renderPackages(packages){
    var el=document.getElementById('content');
    if(!packages||packages.length===0){el.innerHTML='<div class="empty"><h2>No Content Available</h2></div>';return;}
    var html='';
    packages.forEach(function(pkg){
      html+='<div class="package-card"><div class="package-header"><h2>'+esc(pkg.name)+'</h2></div><div class="assets-grid">';
      if(pkg.assets) pkg.assets.forEach(function(a){
        var isVideo=(a.mime_type||'').startsWith('video');
        html+='<div class="asset-item"><div class="asset-name">'+esc(a.filename)+'</div>';
        if(a.stream_url) html+='<button class="btn" onclick="window.open(\\''+esc(a.stream_url)+'\\',\\'_blank\\')">'+(isVideo?'&#9654; Play':'Open')+'</button>';
        html+='</div>';
      });
      html+='</div></div>';
    });
    el.innerHTML=html;
  }

  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  load();
  setInterval(load,60000);
})();
</script>
</body>
</html>`;
}
