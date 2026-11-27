(function(){
'use strict';
var SUPABASE_URL='https://lulijpkeslesdeyemada.supabase.co';
var SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bGlqcGtlc2xlc2RleWVtYWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMjM1MDMsImV4cCI6MjEwMDg5OTUwM30.ptWL1GF5DrshvF6VhwIs3HjRiA_qWgVlux3uk61Hi_A';
var FULL='id,pair,timeframe,type,entry,sl,tp,created_at,status,exit_price,closed_at,result_r';
var BASIC='id,pair,timeframe,type,entry,sl,tp,created_at';
var FEED_PAGE=10,HIST_PAGE=25,MAX_ROWS=20000;
var $=function(id){return document.getElementById(id)};
var db=null;try{if(window.supabase&&window.supabase.createClient)db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY)}catch(e){}
var byId={},rows=[],range='30',tab='all',feedShown=FEED_PAGE,histShown=HIST_PAGE,loading=false,tracking=true,cols=FULL;

function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function num(v){if(v===null||v===undefined||v==='')return null;var n=Number(v);return isFinite(n)?n:null}
function fmtP(v){return v===null?'—':v.toFixed(2)}
function fmtR(v){if(v===null||v===undefined)return '—';return (v>0?'+':'')+v.toFixed(2)+'R'}
function fmtDate(v){if(!v)return '—';var d=new Date(v);return isNaN(d)?'—':d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}
function fmtDur(a,b){var x=new Date(a),y=new Date(b);if(isNaN(x)||isNaN(y)||y<x)return '—';var m=Math.round((y-x)/60000);if(m<60)return m+' min';var h=Math.floor(m/60);if(h<48)return h+'h '+(m%60)+'m';return Math.round(h/24)+' days'}
function monthKey(v){var d=new Date(v);if(isNaN(d))return '';return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')}
function monthLabel(k){var p=k.split('-');return new Date(Date.UTC(+p[0],+p[1]-1,1)).toLocaleString(undefined,{month:'long',year:'numeric',timeZone:'UTC'})}
var LABEL={open:'OPEN',tp_hit:'TP HIT',sl_hit:'SL HIT',expired:'EXPIRED'};

function norm(r){
  var type=String(r.type||'').trim().toUpperCase();
  var e=num(r.entry),s=num(r.sl),t=num(r.tp);
  var risk=(e!==null&&s!==null)?Math.abs(e-s):null;
  var rew=(e!==null&&t!==null)?Math.abs(t-e):null;
  var rr=(risk&&rew)?rew/risk:null;
  var status=String(r.status||'open').toLowerCase();
  if(LABEL[status]===undefined)status='open';
  var res=num(r.result_r);
  if(res===null){if(status==='tp_hit'&&rr!==null)res=rr;else if(status==='sl_hit')res=-1}
  return {id:r.id,pair:r.pair||'XAU/USD',tf:r.timeframe||'',type:type,e:e,s:s,t:t,rr:rr,status:status,res:res,exit:num(r.exit_price),created:r.created_at,closed:r.closed_at};
}
function rebuild(){rows=Object.keys(byId).map(function(k){return byId[k]}).sort(function(a,b){return new Date(b.created)-new Date(a.created)})}
function merge(list){list.forEach(function(r){var n=norm(r);byId[n.id!==undefined&&n.id!==null?n.id:(n.created+n.type+n.e)]=n});rebuild()}
function isClosed(r){return r.status==='tp_hit'||r.status==='sl_hit'}
function inRange(r){if(range==='all')return true;var d=new Date(r.created);if(isNaN(d))return false;return (Date.now()-d.getTime())<=Number(range)*86400000}

/* ---------- stats ---------- */
function summary(list){
  var closed=list.filter(isClosed),w=closed.filter(function(r){return r.status==='tp_hit'}),l=closed.filter(function(r){return r.status==='sl_hit'});
  var net=closed.reduce(function(a,r){return a+(r.res||0)},0);
  var gw=w.reduce(function(a,r){return a+(r.res||0)},0),gl=Math.abs(l.reduce(function(a,r){return a+(r.res||0)},0));
  return {closed:closed,wins:w.length,losses:l.length,net:net,gw:gw,gl:gl,open:list.filter(function(r){return r.status==='open'}).length,rate:closed.length?w.length/closed.length*100:null};
}
function renderStats(){
  var box=$('stats');box.replaceChildren();
  var S=summary(rows.filter(inRange));
  function tile(k,v,s,cls){var d=el('div','stat');d.appendChild(el('div','k',k));d.appendChild(el('div','v'+(cls?' '+cls:''),v));if(s)d.appendChild(el('div','s',s));box.appendChild(d)}
  if(!tracking){tile('Tracking','Not live','Outcome tracking has not been switched on yet.')}
  else if(!S.closed.length){tile('Closed signals','0','Results appear after the first signal closes.');tile('Open now',String(S.open))}
  else{
    tile('Win rate',S.rate.toFixed(0)+'%',S.wins+' wins · '+S.losses+' losses');
    tile('Net result',fmtR(S.net),'sum of closed signals',S.net>0?'pos':S.net<0?'neg':'');
    tile('Profit factor',S.gl>0?(S.gw/S.gl).toFixed(2):(S.gw>0?'∞':'—'),'gross win ÷ gross loss');
    tile('Closed',String(S.closed.length),'in selected range');
    tile('Open now',String(S.open));
  }
  drawChart(S.closed);
}
function drawChart(closed){
  var wrap=$('chart-wrap'),svg=$('chart');
  if(closed.length<2){wrap.hidden=true;return}
  wrap.hidden=false;
  var pts=closed.slice().sort(function(a,b){return new Date(a.closed||a.created)-new Date(b.closed||b.created)});
  var cum=0,vals=[0];pts.forEach(function(r){cum+=(r.res||0);vals.push(cum)});
  var min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);if(max===min){max+=1;min-=1}
  var W=600,H=90,pad=6;
  function x(i){return pad+(W-2*pad)*i/(vals.length-1)}
  function y(v){return H-pad-(H-2*pad)*(v-min)/(max-min)}
  var d=vals.map(function(v,i){return (i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)}).join(' ');
  var zeroY=y(0).toFixed(1),up=vals[vals.length-1]>=0,ns='http://www.w3.org/2000/svg';
  svg.innerHTML='';
  var z=document.createElementNS(ns,'line');z.setAttribute('x1',0);z.setAttribute('x2',W);z.setAttribute('y1',zeroY);z.setAttribute('y2',zeroY);z.setAttribute('stroke','currentColor');z.setAttribute('stroke-opacity','.25');z.setAttribute('stroke-dasharray','4 4');svg.appendChild(z);
  var p=document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('fill','none');p.setAttribute('stroke',up?'#10b981':'#e11d48');p.setAttribute('stroke-width','2.5');p.setAttribute('vector-effect','non-scaling-stroke');svg.appendChild(p);
}

/* ---------- monthly ---------- */
function renderMonthly(){
  var tb=$('monthly').querySelector('tbody');tb.replaceChildren();
  var groups={};rows.forEach(function(r){var k=monthKey(r.created);if(k){(groups[k]=groups[k]||[]).push(r)}});
  var keys=Object.keys(groups).sort().reverse();
  if(!keys.length){var tr=el('tr');var td=el('td','', 'No signals yet.');td.colSpan=6;tr.appendChild(td);tb.appendChild(tr);return}
  keys.forEach(function(k){
    var S=summary(groups[k]),tr=el('tr');
    tr.appendChild(el('td','',monthLabel(k)));
    tr.appendChild(el('td','',String(groups[k].length)));
    tr.appendChild(el('td','',tracking?String(S.wins):'—'));
    tr.appendChild(el('td','',tracking?String(S.losses):'—'));
    tr.appendChild(el('td','',S.rate===null?'—':S.rate.toFixed(0)+'%'));
    tr.appendChild(el('td',S.net>0?'pos':S.net<0?'neg':'',S.closed.length?fmtR(S.net):'—'));
    tb.appendChild(tr);
  });
  // month filter options
  var sel=$('h-month'),cur=sel.value;
  sel.replaceChildren();var o=el('option','','All months');o.value='all';sel.appendChild(o);
  keys.forEach(function(k){var op=el('option','',monthLabel(k));op.value=k;sel.appendChild(op)});
  sel.value=keys.indexOf(cur)>=0?cur:'all';
}

/* ---------- feed (recent) ---------- */
function priceBox(label,val,cls){var b=el('div','pb');b.appendChild(el('span','',label));b.appendChild(el('b',cls||'',fmtP(val)));return b}
function card(r){
  var a=el('article','sig');
  var hd=el('div','hd');var left=el('div');left.appendChild(el('span','pair',r.pair));if(r.tf)left.appendChild(el('span','tf',r.tf));hd.appendChild(left);
  var right=el('div');right.style.cssText='display:flex;gap:6px;flex-wrap:wrap';
  right.appendChild(el('span','badge '+(r.type==='BUY'?'buy':r.type==='SELL'?'sell':'st-expired'),r.type==='BUY'?'↗ BUY':r.type==='SELL'?'↘ SELL':(r.type||'—')));
  right.appendChild(el('span','badge st-'+r.status,LABEL[r.status]));
  hd.appendChild(right);a.appendChild(hd);
  var pr=el('div','prices');pr.appendChild(priceBox('Entry',r.e));pr.appendChild(priceBox('Stop Loss',r.s,'neg'));pr.appendChild(priceBox('Take Profit',r.t,'pos'));a.appendChild(pr);
  var ft=el('div','ft');
  ft.appendChild(el('span','',r.rr!==null?'Reward:Risk 1:'+r.rr.toFixed(2):'Reward:Risk —'));
  if(isClosed(r)){var s=el('span',r.res>0?'pos':'neg','Result '+fmtR(r.res)+(r.exit!==null?' · exit '+fmtP(r.exit):''));s.style.fontWeight='800';ft.appendChild(s)}
  var t=document.createElement('time');t.dateTime=r.created||'';t.textContent='Issued '+fmtDate(r.created);ft.appendChild(t);
  if(r.closed&&r.status!=='open')ft.appendChild(el('span','','Closed '+fmtDate(r.closed)));
  a.appendChild(ft);return a;
}
function renderFeed(){
  var box=$('signals-container');box.replaceChildren();
  var list=rows.filter(function(r){if(tab==='open')return r.status==='open';if(tab==='closed')return r.status!=='open';return true});
  if(!list.length){box.appendChild(el('div','note',rows.length?'No signals in this view.':'No signals have been published yet. New signals appear here as soon as they are added.'));$('more-btn').hidden=true;return}
  list.slice(0,feedShown).forEach(function(r){box.appendChild(card(r))});
  $('more-btn').hidden=list.length<=feedShown;
}

/* ---------- history table ---------- */
function histList(){
  var m=$('h-month').value,res=$('h-res').value,dir=$('h-dir').value;
  return rows.filter(function(r){
    if(m!=='all'&&monthKey(r.created)!==m)return false;
    if(res!=='all'&&r.status!==res)return false;
    if(dir!=='all'&&r.type!==dir)return false;
    return true;
  });
}
function renderHistory(){
  var tb=$('hist-table').querySelector('tbody');tb.replaceChildren();
  var list=histList();
  $('h-count').textContent=list.length+' signal'+(list.length===1?'':'s')+' match your filters';
  if(!list.length){var tr=el('tr');var td=el('td','','No signals match.');td.colSpan=8;tr.appendChild(td);tb.appendChild(tr);$('hist-more').hidden=true;return}
  list.slice(0,histShown).forEach(function(r){
    var tr=el('tr');
    tr.appendChild(el('td','',fmtDate(r.created)));
    tr.appendChild(el('td',r.type==='BUY'?'pos':r.type==='SELL'?'neg':'',r.type||'—'));
    tr.appendChild(el('td','',fmtP(r.e)));tr.appendChild(el('td','',fmtP(r.s)));tr.appendChild(el('td','',fmtP(r.t)));
    var st=el('td','');st.appendChild(el('span','badge st-'+r.status,LABEL[r.status]));tr.appendChild(st);
    tr.appendChild(el('td',r.res>0?'pos':r.res<0?'neg':'',isClosed(r)?fmtR(r.res):'—'));
    tr.appendChild(el('td','',isClosed(r)?fmtDur(r.created,r.closed):'—'));
    tb.appendChild(tr);
  });
  $('hist-more').hidden=list.length<=histShown;
}
function csvCell(v){
  if(v===null||v===undefined)return '';
  var s=String(v);
  if(/^[=+\-@\t\r]/.test(s)&&isNaN(Number(s)))s="'"+s;   // block spreadsheet formula injection
  return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function downloadCsv(){
  var head=['issued_utc','pair','timeframe','type','entry','stop_loss','take_profit','status','result_r','exit_price','closed_utc'];
  var lines=[head.join(',')];
  histList().forEach(function(r){lines.push([r.created,r.pair,r.tf,r.type,r.e,r.s,r.t,r.status,r.res,r.exit,r.closed].map(csvCell).join(','))});
  var blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='sudusi-xauusd-signal-history.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
}

function renderAll(){renderStats();renderMonthly();renderFeed();renderHistory()}
function setStatus(t){$('connection-status').textContent=t}

/* ---------- data loading ---------- */
async function pageAll(select){
  var all=[],from=0,step=1000;
  for(;;){
    var r=await db.from('signals').select(select).order('created_at',{ascending:false}).range(from,from+step-1);
    if(r.error)return r;
    all=all.concat(r.data||[]);
    if(!r.data||r.data.length<step||all.length>=MAX_ROWS)break;
    from+=step;
  }
  return {data:all,error:null};
}
async function loadAll(){
  if(!db){setStatus('Unable to connect to signal database');$('signals-container').replaceChildren(el('div','note','Signals could not be loaded. Please try again later.'));return}
  loading=true;$('signals-container').setAttribute('aria-busy','true');
  try{
    var r=await pageAll(FULL);
    if(r.error){tracking=false;cols=BASIC;r=await pageAll(BASIC)}
    if(r.error)throw r.error;
    byId={};merge(r.data);renderAll();
    setStatus('Signal database connected · '+rows.length+' signals loaded');
  }catch(err){
    console.error('SUDUSI signals error',err);
    $('signals-container').replaceChildren(el('div','note','Signals could not be loaded. Please try again later.'));
    setStatus('Unable to connect to signal database');
  }finally{loading=false;$('signals-container').setAttribute('aria-busy','false')}
}
async function refreshRecent(){
  if(!db||loading)return;
  var btn=$('refresh-btn');btn.disabled=true;btn.textContent='Loading…';
  try{
    var r=await db.from('signals').select(cols).order('created_at',{ascending:false}).limit(200);
    if(r.error)throw r.error;
    merge(r.data||[]);renderAll();
    if(!$('connection-status').dataset.live)setStatus('Signal database connected · updated '+new Date().toLocaleTimeString());
  }catch(e){console.error(e)}finally{btn.disabled=false;btn.textContent='↻ Refresh'}
}

/* ---------- wiring ---------- */
function seg(attr,cb){
  document.querySelectorAll('['+attr+']').forEach(function(b){
    b.addEventListener('click',function(){
      document.querySelectorAll('['+attr+']').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});
      cb(b.getAttribute(attr));
    });
  });
}
seg('data-range',function(v){range=v;renderStats()});
seg('data-tab',function(v){tab=v;feedShown=FEED_PAGE;renderFeed()});
$('more-btn').addEventListener('click',function(){feedShown+=FEED_PAGE;renderFeed()});
$('hist-more').addEventListener('click',function(){histShown+=HIST_PAGE;renderHistory()});
['h-month','h-res','h-dir'].forEach(function(id){$(id).addEventListener('change',function(){histShown=HIST_PAGE;renderHistory()})});
$('csv-btn').addEventListener('click',downloadCsv);
$('refresh-btn').addEventListener('click',refreshRecent);

/* ---------- calculator ---------- */
function calc(){
  var bal=num($('c-bal').value),rk=num($('c-risk').value),e=num($('c-entry').value),s=num($('c-sl').value),o=$('c-out');
  if(!bal||!rk||e===null||s===null||e===s){o.textContent='Enter entry and stop loss to see a lot size.';return}
  var risk$=bal*rk/100,dist=Math.abs(e-s),lots=risk$/(dist*100);
  o.textContent='Risk ≈ $'+risk$.toFixed(2)+' · stop distance $'+dist.toFixed(2)+' · position ≈ '+(Math.floor(lots*100)/100).toFixed(2)+' lots';
}
['c-bal','c-risk','c-entry','c-sl'].forEach(function(id){$(id).addEventListener('input',calc)});

/* ---------- widgets ---------- */
var dark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
function widget(host,src,cfg){
  var c=document.createElement('div');c.className='tradingview-widget-container';
  var w=document.createElement('div');w.className='tradingview-widget-container__widget';c.appendChild(w);
  var s=document.createElement('script');s.async=true;s.src=src;s.text=JSON.stringify(cfg);c.appendChild(s);host.appendChild(c);
}
widget($('ticker'),'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js',{
  symbols:[
    {proName:'OANDA:XAUUSD',title:'XAUUSD'},{proName:'FX_IDC:USDUGX',title:'USDUGX'},{proName:'FX_IDC:EURUSD',title:'EURUSD'},
    {proName:'BITSTAMP:BTCUSD',title:'BTCUSD'},{proName:'FOREXCOM:NSXUSD',title:'NASDAQ 100'},{proName:'FOREXCOM:DJI',title:'US30'},{proName:'FOREXCOM:SPXUSD',title:'S&P 500'}
  ],
  showSymbolLogo:false,isTransparent:true,displayMode:'adaptive',colorTheme:dark?'dark':'light',locale:'en'
});
var cal=$('calendar');
function loadCal(){if(cal.dataset.l)return;cal.dataset.l='1';widget(cal,'https://s3.tradingview.com/external-embedding/embed-widget-events.js',{colorTheme:dark?'dark':'light',isTransparent:false,width:'100%',height:'420',locale:'en',importanceFilter:'0,1',currencyFilter:'USD,EUR,GBP'})}
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(en){if(en[0].isIntersecting){loadCal();io.disconnect()}},{rootMargin:'300px'});io.observe(cal)}else loadCal();

/* ---------- boot + live updates ---------- */
loadAll();
setInterval(refreshRecent,60000);
if(db){try{db.channel('sudusi-signals').on('postgres_changes',{event:'*',schema:'public',table:'signals'},function(){refreshRecent()}).subscribe(function(st){if(st==='SUBSCRIBED'){$('connection-status').dataset.live='1';setStatus('Live database updates connected')}})}catch(e){}}
})();
