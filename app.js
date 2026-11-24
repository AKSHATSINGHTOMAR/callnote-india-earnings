(function(){
"use strict";
try{
  var demo={id:"demo-aarohan",company:"Aarohan Consumer Products",ticker:"ACPL · NSE",title:"Q4 FY26 earnings call",date:"May 22, 2026",isDemo:true,timingMode:"demo",segments:[
    {speaker:"Rhea Menon",role:"Head of Investor Relations",section:"Opening remarks",text:"Good morning, everyone, and welcome to Aarohan Consumer Products' fourth quarter and full year results call."}
  ]};
  var initialCalls=window.callnoteRealCalls&&window.callnoteRealCalls.length?window.callnoteRealCalls:[demo];
  var state={
    calls:initialCalls,
    active:initialCalls[0].id,
    playing:false,
    mode:initialCalls[0].audioUrl?"audio":"demo",
    demoIndex:-1,
    timer:null,
    duration:0,
    now:0,
    toast:null,
    pendingSeek:null,
    activeSegmentNode:null,
    activeWordNode:null,
    audioFrame:0,
    waveBarIndex:-1
  };
  var $=function(id){return document.getElementById(id)};
  var audio=$("audio");

  function esc(s){
    return String(s).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function secEstimate(t){
    return Math.max(2.4,String(t).trim().split(/\s+/).length*60/154);
  }
  function prepare(c){
    var t=0;
    c.segments=c.segments.map(function(s,i){
      s=Object.assign({},s);
      s.id=s.id||c.id+"-s"+i;
      s.speaker=s.speaker||"Speaker";
      s.role=s.role||"";
      s.text=String(s.text||"").trim();
      s.section=s.section||"Call";
      if(s.start==null)s.start=t;
      s.start=Number(s.start);
      if(s.end==null||Number(s.end)<=s.start)s.end=s.start+secEstimate(s.text);
      s.end=Number(s.end);
      t=s.end;
      s.words=Array.isArray(s.words)?s.words:null;
      return s;
    });
    c.estimatedDuration=c.segments.length?c.segments[c.segments.length-1].end:0;
    return c;
  }
  prepare(demo);

  function time(t){
    t=Math.max(0,Number(t)||0);
    var n=Math.floor(t),h=Math.floor(n/3600),m=Math.floor(n%3600/60),sec=n%60;
    if(h)return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");
    return String(Math.floor(n/60)).padStart(2,"0")+":"+String(sec).padStart(2,"0");
  }
  function active(){
    return state.calls.find(function(c){return c.id===state.active})||state.calls[0];
  }
  function buildWave(){
    var out="";
    for(var i=0;i<84;i++){
      var h=8+Math.round(Math.abs(Math.sin(i*12.9898)*Math.cos(i*.7))*20+Math.abs(Math.sin(i*.31)*8));
      out+='<i class="bar" style="--h:'+Math.min(34,h)+'px"></i>';
    }
    $("bars").innerHTML=out;
  }

  function library(){
    var q=$("companySearch").value.trim().toLowerCase();
    var calls=state.calls.filter(function(c){
      return (c.company+" "+c.ticker+" "+c.title).toLowerCase().includes(q);
    });
    $("callCount").textContent=String(state.calls.length);
    $("callList").innerHTML=calls.length?calls.map(function(c){
      return '<button class="call-card '+(c.id===state.active?"selected":"")+'" type="button" data-call="'+esc(c.id)+'">'+
        '<span class="call-company">'+esc(c.company)+'</span>'+
        '<span class="call-meta"><span>'+esc(c.title)+'</span><span>'+esc(c.date||"")+'</span></span>'+
      '</button>';
    }).join(""):'<div class="empty-lib">No matching companies.</div>';
    Array.from($("callList").querySelectorAll("[data-call]")).forEach(function(b){
      b.onclick=function(){selectCall(b.dataset.call)};
    });
  }

  function wordHtml(s){
    if(!s.words||!s.words.length){
      var words=s.text.match(/\S+\s*/g)||[s.text],off=0;
      return words.map(function(w,i){
        var out='<span class="word" data-word="'+i+'" data-a="'+off+'" data-b="'+(off+w.length)+'">'+esc(w)+'</span>';
        off+=w.length;
        return out;
      }).join("");
    }
    return s.words.map(function(w,i){
      return '<span class="word" data-word="'+i+'" data-ws="'+Number(w.start)+'" data-we="'+Number(w.end)+'">'+esc(w.text||"")+'</span>'+(i<s.words.length-1?" ":"");
    }).join("");
  }

  function transcript(){
    var c=active();
    var q=$("transSearch").value.trim().toLowerCase();
    var items=c.segments;
    if(!items.length){
      $("transcript").innerHTML='<div class="empty-transcript">No transcript lines.</div>';
      return;
    }
    $("transcript").innerHTML=items.map(function(s){
      var match=!q||(s.speaker+" "+s.role+" "+s.text).toLowerCase().includes(q);
      return '<article class="segment '+(match?"":"hidden")+'" data-id="'+esc(s.id)+'" tabindex="0">'+
        '<div class="segment-time">'+time(s.start)+'</div>'+
        '<div class="segment-body">'+
          '<div class="speaker-row">'+
            '<span class="speaker-name">'+esc(s.speaker)+'</span>'+
            (s.role?'<span class="speaker-role">'+esc(s.role)+'</span>':'')+
          '</div>'+
          '<p class="segment-text">'+wordHtml(s)+'</p>'+
        '</div>'+
      '</article>';
    }).join("");
    state.activeSegmentNode=null;
    state.activeWordNode=null;

    Array.from($("transcript").querySelectorAll("[data-id]")).forEach(function(row){
      row.onclick=function(e){
        var w=e.target.closest(".word[data-ws]");
        if(w&&Number.isFinite(Number(w.dataset.ws))){
          seek(Number(w.dataset.ws));
          return;
        }
        seekSegment(row.dataset.id);
      };
      row.onkeydown=function(e){
        if(e.key==="Enter"||e.key===" "){
          e.preventDefault();
          seekSegment(row.dataset.id);
        }
      };
    });

    if(q){
      Array.from($("transcript").querySelectorAll(".segment:not(.hidden) .word")).forEach(function(w){
        if(w.textContent.toLowerCase().includes(q)){
          var m=document.createElement("mark");
          m.textContent=w.textContent;
          w.textContent="";
          w.appendChild(m);
        }
      });
    }
    $("showAll").style.visibility=q?"visible":"hidden";
    if(state.now>0)highlight(state.now,false);
  }

  function highlight(t,scroll,forced){
    var c=active();
    var i=forced==null?-1:forced;
    if(i<0){
      i=c.segments.findIndex(function(s){return t>=s.start&&t<s.end});
      if(i<0){
        i=c.segments.findIndex(function(s){return s.start>t});
        i=i<0?c.segments.length-1:Math.max(0,i-1);
      }
    }
    var s=c.segments[i];
    if(!s)return;
    var row=document.querySelector('[data-id="'+CSS.escape(s.id)+'"]');
    if(!row){
      if(state.activeSegmentNode)state.activeSegmentNode.classList.remove("active");
      if(state.activeWordNode)state.activeWordNode.classList.remove("active-word");
      state.activeSegmentNode=null;
      state.activeWordNode=null;
      return;
    }
    if(state.activeSegmentNode!==row){
      if(state.activeSegmentNode)state.activeSegmentNode.classList.remove("active");
      row.classList.add("active");
      state.activeSegmentNode=row;
      if(scroll!==false)row.scrollIntoView({block:"nearest",behavior:"smooth"});
    }
    var wi=s.words?s.words.findIndex(function(w){return t>=Number(w.start)&&t<Number(w.end)}):-1;
    var word=wi>=0?row.querySelector('[data-word="'+wi+'"]'):null;
    if(state.activeWordNode!==word){
      if(state.activeWordNode)state.activeWordNode.classList.remove("active-word");
      if(word)word.classList.add("active-word");
      state.activeWordNode=word;
    }
  }

  function update(){
    var d=state.duration||active().estimatedDuration;
    var p=d?Math.max(0,Math.min(100,state.now/d*100)):0;
    $("nowLabel").textContent=time(state.now);
    $("durationLabel").textContent=time(d);
    $("wave").style.setProperty("--progress",p+"%");
    var bars=$("bars").children;
    var played=Math.ceil(p/100*bars.length);
    if(state.waveBarIndex!==played){
      for(var i=0;i<bars.length;i++)bars[i].classList.toggle("played",i<played);
      state.waveBarIndex=played;
    }
    $("wave").setAttribute("aria-valuemin","0");
    $("wave").setAttribute("aria-valuemax",String(Math.floor(d)));
    $("wave").setAttribute("aria-valuenow",String(Math.floor(state.now)));
    $("wave").setAttribute("aria-valuetext",time(state.now)+" of "+time(d));
    $("play").setAttribute("aria-label",state.playing?"Pause call":"Play call");
    $("playIcon").innerHTML=state.playing
      ?'<path d="M5 3.8h2.7v10.4H5zM10.3 3.8h2.7v10.4h-2.7z"/>'
      :'<path d="M5.7 3.8c0-.6.7-1 1.2-.6l7 5.1a.9.9 0 0 1 0 1.4l-7 5.1c-.5.4-1.2 0-1.2-.6V3.8Z"/>';
  }

  function stop(){
    clearInterval(state.timer);
    state.timer=null;
    if(state.audioFrame){cancelAnimationFrame(state.audioFrame);state.audioFrame=0}
    if(window.speechSynthesis)speechSynthesis.cancel();
    if(!audio.paused)audio.pause();
    state.playing=false;
    state.demoIndex=-1;
  }

  function render(){
    var c=active();
    stop();
    $("companyName").textContent=c.company;
    $("callTitle").textContent=c.title;
    $("callDate").textContent=c.date||"";
    $("tickerPill").textContent=c.ticker||"";
    var transcriptHref=c.transcriptPdf||c.transcriptSourceUrl;
    $("pdfLink").href=transcriptHref||"#";
    $("pdfLink").textContent=c.transcriptSourceUrl?"Transcript ↗":"PDF ↗";
    $("pdfLink").style.display=transcriptHref?"inline-flex":"none";
    $("sourceLink").href=c.sourceUrl||"#";
    $("sourceLink").style.display=c.sourceUrl?"inline-flex":"none";
    if($("copyAiLink"))$("copyAiLink").style.display=c.isDemo||String(c.id).startsWith("call-")?"none":"inline-flex";
    $("chip").textContent=c.isDemo?"SAMPLE":c.wordsTimed?"WORD SYNC":c.timingMode==="estimated"?"EST. TIMING":"TIMED";
    var detail=c.timingMode==="word-aligned"
      ?"Click any word to jump · "+(c.timingDirectMatchRate||0).toFixed(1)+"% matched"
      :"Click any line to jump";
    $("note").textContent=detail;

    state.pendingSeek=null;
    if(!c.isDemo&&c.audioUrl){
      state.mode="audio";
      var nextSrc=new URL(c.audioUrl,document.baseURI).href;
      if(audio.src!==nextSrc){
        audio.removeAttribute("src");
        audio.load();
        audio.src=nextSrc;
        audio.load();
      }
      audio.playbackRate=Number($("speed").value);
    }else{
      state.mode=c.isDemo?"demo":"transcript";
      audio.removeAttribute("src");
      audio.load();
    }
    state.duration=c.isDemo||!c.audioUrl?c.estimatedDuration:(Number.isFinite(audio.duration)?audio.duration:c.estimatedDuration);
    state.now=0;
    state.waveBarIndex=-1;
    if($("transcriptScroll"))$("transcriptScroll").scrollTop=0;
    transcript();
    library();
    update();
  }

  function selectCall(id){
    if(id===state.active)return;
    state.active=id;
    $("transSearch").value="";
    render();
  }

  function toast(s){
    var el=$("toast");
    el.textContent=s;
    el.classList.add("show");
    clearTimeout(state.toast);
    state.toast=setTimeout(function(){el.classList.remove("show")},2800);
  }

  function demoSpeak(i){
    var c=active();
    if(!window.speechSynthesis){toast("Speech playback is unavailable in this browser.");return}
    if(i>=c.segments.length){state.playing=false;state.demoIndex=-1;clearInterval(state.timer);update();return}
    var s=c.segments[i];
    state.demoIndex=i;
    state.now=s.start;
    highlight(state.now,true,i);
    update();
    var u=new SpeechSynthesisUtterance(s.text);
    u.rate=Number($("speed").value);
    u.onend=function(){if(state.playing&&state.demoIndex===i)demoSpeak(i+1)};
    u.onerror=function(){state.playing=false;clearInterval(state.timer);update()};
    speechSynthesis.speak(u);
  }

  function play(){
    if(state.mode==="audio"){
      if(!audio.getAttribute("src")){toast("This call has no recording attached.");return}
      if(!audio.paused){
        audio.pause();
      }else{
        if(audio.ended||(Number.isFinite(audio.duration)&&audio.duration>0&&audio.currentTime>=audio.duration-.1)){
          try{audio.currentTime=0;state.now=0}catch(e){state.pendingSeek=0}
        }
        state.duration=Number.isFinite(audio.duration)?audio.duration:active().estimatedDuration;
        audio.playbackRate=Number($("speed").value);
        var req=audio.play();
        if(req&&typeof req.catch==="function")req.catch(function(){state.playing=false;update();toast("Could not start audio playback.")});
      }
      update();
      return;
    }
    if(state.playing){speechSynthesis.pause();state.playing=false}
    else{state.playing=true;var n=active().segments.findIndex(function(s){return state.now<s.end});demoSpeak(n<0?0:n)}
    update();
  }

  function seekAudio(t){
    var duration=Number.isFinite(audio.duration)?audio.duration:state.duration;
    t=Math.max(0,Math.min(duration||t,t));
    state.now=t;
    if(audio.readyState>=1&&Number.isFinite(audio.duration)){
      audio.currentTime=Math.min(t,audio.duration);
      state.pendingSeek=null;
    }else{
      state.pendingSeek=t;
    }
    update();
    highlight(t);
  }

  function syncWordFrame(){
    if(state.mode!=="audio"||audio.paused||audio.ended){state.audioFrame=0;return}
    state.now=audio.currentTime;
    if(Number.isFinite(audio.duration))state.duration=audio.duration;
    update();
    highlight(state.now);
    state.audioFrame=requestAnimationFrame(syncWordFrame);
  }

  function seekSegment(id){
    var c=active(),i=c.segments.findIndex(function(s){return s.id===id}),s=c.segments[i];
    if(!s)return;
    if(state.mode==="audio"){
      seekAudio(s.start);
    }else{
      state.now=s.start;
      if(state.playing){speechSynthesis.cancel();demoSpeak(i)}
      else{state.demoIndex=i;highlight(s.start,true,i)}
    }
    update();
  }

  function seek(t){
    t=Math.max(0,Math.min(state.duration||active().estimatedDuration,t));
    if(state.mode==="audio"){
      seekAudio(t);
    }else{
      state.now=t;
      var i=active().segments.findIndex(function(s){return t>=s.start&&t<s.end});
      if(state.playing&&i>=0){speechSynthesis.cancel();demoSpeak(i)}
      else highlight(t);
    }
    update();
  }

  function jump(delta){
    var segs=active().segments,i=segs.findIndex(function(s){return state.now>=s.start&&state.now<s.end});
    if(i<0){
      if(delta>0){i=segs.findIndex(function(s){return s.start>state.now});if(i<0)i=segs.length-1}
      else{i=-1;for(var n=0;n<segs.length;n++){if(segs[n].end<=state.now)i=n;else break}if(i<0)i=0}
    }else{
      i=Math.max(0,Math.min(segs.length-1,i+delta));
    }
    if(segs[i])seekSegment(segs[i].id);
  }

  function parseTime(v){
    if(typeof v==="number")return v;
    if(typeof v!=="string")return Number(v)||0;
    if(/^\d+(\.\d+)?$/.test(v))return Number(v);
    return v.split(":").reduce(function(n,p){return n*60+Number(p)},0);
  }

  function parse(raw){
    var txt=raw.trim();
    if(!txt)throw Error("Paste a transcript before adding this call.");
    if(txt[0]==="["||txt[0]==="{"){
      var obj;
      try{obj=JSON.parse(txt)}catch(e){throw Error("That JSON could not be read.")}
      var arr=Array.isArray(obj)?obj:obj.segments;
      if(!Array.isArray(arr))throw Error("JSON needs a segments array.");
      return{
        segments:arr.map(function(s){
          return Object.assign({},s,{
            start:parseTime(s.start==null?s.start_time||0:s.start),
            end:parseTime(s.end==null?s.end_time||0:s.end),
            words:Array.isArray(s.words)?s.words.map(function(w){return Object.assign({},w,{start:parseTime(w.start),end:parseTime(w.end)})}):null
          });
        }),
        timing:"timed",
        words:arr.some(function(s){return Array.isArray(s.words)})
      };
    }
    var lines=txt.split(/\r?\n/).map(function(x){return x.trim()}).filter(Boolean);
    var rows=lines.map(function(line){
      var p=line.split("|").map(function(x){return x.trim()});
      return p.length>=3&&/^\d{1,2}:\d{2}(:\d{2})?(\.\d+)?$/.test(p[0])?{start:parseTime(p[0]),speaker:p[1],text:p.slice(2).join(" | ")}:null;
    });
    if(rows.every(Boolean)){
      return{
        segments:rows.map(function(s,i){return Object.assign({},s,{end:i<rows.length-1?rows[i+1].start:s.start+secEstimate(s.text)})}),
        timing:"timed",
        words:false
      };
    }
    var t=0,paras=txt.split(/\n\s*\n|\r?\n/).filter(Boolean);
    return{
      segments:paras.map(function(line){
        var m=line.match(/^([^:]{2,50}):\s*(.+)$/),speaker=m?m[1]:"Speaker",text=m?m[2]:line,start=t;
        t+=secEstimate(text);
        return{start:start,end:t,speaker:speaker,text:text};
      }),
      timing:"estimated",
      words:false
    };
  }

  function openModal(){$("backdrop").classList.add("open");setTimeout(function(){$("inCompany").focus()},50)}
  function closeModal(){$("backdrop").classList.remove("open")}

  function importCall(e){
    e.preventDefault();
    var p;
    try{p=parse($("inTranscript").value)}catch(err){toast(err.message);return}
    if(!p.segments.length||p.segments.some(function(s){return!s.text})){toast("Add at least one transcript line.");return}
    var f=$("inAudio").files[0],d=$("inDate").value;
    var date=d?new Date(d+"T12:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"Added today";
    var c=prepare({
      id:"call-"+Date.now(),
      company:$("inCompany").value.trim(),
      ticker:$("inTicker").value.trim()||"LOCAL",
      title:$("inTitle").value.trim(),
      date:date,
      isDemo:false,
      segments:p.segments,
      timingMode:p.timing,
      wordsTimed:p.words,
      audioUrl:f?URL.createObjectURL(f):null,
      audioName:f?f.name:null
    });
    state.calls.unshift(c);
    state.active=c.id;
    $("companySearch").value="";
    $("transSearch").value="";
    $("form").reset();
    closeModal();
    render();
    toast(f?"Call added.":"Transcript added.");
  }

  function template(){
    var sample={company:"Example Industries Ltd.",ticker:"EXAMPLE · NSE",call_title:"Q2 FY27 earnings call",segments:[{start:8.2,end:14.6,speaker:"Rhea Menon",role:"Chief Financial Officer",text:"Thank you for joining us today.",words:[{start:8.2,end:8.5,text:"Thank"},{start:8.5,end:8.7,text:"you"},{start:8.7,end:8.9,text:"for"},{start:8.9,end:9.2,text:"joining"},{start:9.2,end:9.4,text:"us"},{start:9.4,end:9.8,text:"today."}]}]};
    var url=URL.createObjectURL(new Blob([JSON.stringify(sample,null,2)],{type:"application/json"}));
    var a=document.createElement("a");
    a.href=url;
    a.download="callnote-transcript-template.json";
    a.click();
    setTimeout(function(){URL.revokeObjectURL(url)},1000);
  }

  $("play").onclick=play;
  $("prev").onclick=function(){jump(-1)};
  $("next").onclick=function(){jump(1)};
  $("back").onclick=function(){seek(state.now-15)};
  $("forward").onclick=function(){seek(state.now+30)};

  var waveDragging=false;
  function seekWavePointer(e){
    var r=$("wave").getBoundingClientRect();
    if(!r.width||!state.duration)return;
    seek(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*state.duration);
  }
  $("wave").onpointerdown=function(e){waveDragging=true;if(this.setPointerCapture)this.setPointerCapture(e.pointerId);seekWavePointer(e);e.preventDefault()};
  $("wave").onpointermove=function(e){if(waveDragging)seekWavePointer(e)};
  $("wave").onpointerup=function(e){if(waveDragging)seekWavePointer(e);waveDragging=false};
  $("wave").onpointercancel=function(){waveDragging=false};
  $("wave").onkeydown=function(e){
    if(e.key==="ArrowRight"){seek(state.now+5);e.preventDefault()}
    if(e.key==="ArrowLeft"){seek(state.now-5);e.preventDefault()}
    if(e.key==="Home"){seek(0);e.preventDefault()}
    if(e.key==="End"){seek(state.duration);e.preventDefault()}
  };

  $("speed").onchange=function(){
    audio.playbackRate=Number(this.value);
  };
  $("transSearch").oninput=transcript;
  $("showAll").onclick=function(){$("transSearch").value="";transcript()};
  $("companySearch").oninput=library;

  $("libraryAdd").onclick=openModal;
  if($("copyAiLink")){
    $("copyAiLink").onclick=function(){
      var c=active();
      var url="https://akshatsinghtomar.github.io/callnote-india-earnings/transcripts/"+encodeURIComponent(c.id)+".txt";
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).then(function(){toast("Copied transcript link for Claude / AI")}).catch(function(){window.open("transcripts/"+encodeURIComponent(c.id)+".txt","_blank","noopener")});
      }else{
        window.open("transcripts/"+encodeURIComponent(c.id)+".txt","_blank","noopener");
      }
    };
  }
  $("close").onclick=closeModal;
  $("cancel").onclick=closeModal;
  $("backdrop").onclick=function(e){if(e.target===$("backdrop"))closeModal()};
  $("form").onsubmit=importCall;
  $("modalTemplate").onclick=template;

  audio.ontimeupdate=function(){
    if(state.mode!=="audio")return;
    state.now=audio.currentTime;
    state.duration=Number.isFinite(audio.duration)?audio.duration:state.duration;
    update();
    highlight(state.now);
  };
  audio.onloadedmetadata=function(){
    if(state.mode!=="audio")return;
    state.duration=audio.duration||state.duration;
    if(state.pendingSeek!=null){
      var pending=state.pendingSeek;
      state.pendingSeek=null;
      try{audio.currentTime=Math.min(pending,audio.duration)}catch(e){state.pendingSeek=pending}
    }
    state.now=audio.currentTime||state.now;
    update();
    highlight(state.now,false);
  };
  audio.onplay=function(){
    if(state.mode!=="audio")return;
    state.playing=true;
    if(!state.audioFrame)state.audioFrame=requestAnimationFrame(syncWordFrame);
    update();
  };
  audio.onpause=function(){
    if(state.mode!=="audio")return;
    state.playing=false;
    if(state.audioFrame){cancelAnimationFrame(state.audioFrame);state.audioFrame=0}
    update();
  };
  audio.onended=function(){
    if(state.mode!=="audio")return;
    state.playing=false;
    if(state.audioFrame){cancelAnimationFrame(state.audioFrame);state.audioFrame=0}
    state.now=audio.duration||state.now;
    update();
    highlight(state.now,false);
  };
  audio.onerror=function(){
    if(state.mode!=="audio"||!audio.getAttribute("src"))return;
    state.playing=false;
    update();
    toast("This recording could not be loaded.");
  };

  document.addEventListener("keydown",function(e){
    if(e.key==="Escape")closeModal();
    if(e.code==="Space"&&!["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)&&!$("backdrop").classList.contains("open")){
      e.preventDefault();
      play();
    }
  });

  buildWave();
  render();
}catch(error){
  console.error("Callnote initialization failed",error);
  var errorToast=document.getElementById("toast");
  if(errorToast){
    errorToast.textContent="Callnote could not start: "+(error&&error.message||"unknown error");
    errorToast.classList.add("show");
  }
}
})();
