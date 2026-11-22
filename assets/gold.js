(function(){
'use strict';
var SUPABASE_URL='https://lulijpkeslesdeyemada.supabase.co';
var SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bGlqcGtlc2xlc2RleWVtYWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMjM1MDMsImV4cCI6MjEwMDg5OTUwM30.ptWL1GF5DrshvF6VhwIs3HjRiA_qWgVlux3uk61Hi_A';
var FULL='id,pair,timeframe,type,entry,sl,tp,created_at,status,exit_price,closed_at,result_r';
var BASIC='pair,timeframe,type,entry,sl,tp,created_at';
var PAGE=10;
var $=function(id){return document.getElementById(id)};
var db=null;try{if(window.supabase&&window.supabase.createClient)db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY)}catch(e){}
var rows=[],range='30',tab='all',shown=PAGE,loading=false,trackingColumns=true;

function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function num(v){if(v===null||v===undefined||v==='')return null;var n=Number(v);return isFinite(n)?n:null}
function fmtP(v){return v===null?'—':v.toFixed(2)}
function fmtR(v){if(v===null||v===undefined)return '—';return (v>0?'+':'')+v.toFixed(2)+'R'}
function fmtDate(v){if(!v)return '—';var d=new Date(v);return isNaN(d)?'—':d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}
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

function inRange(r){
  if(range==='all')return true;
  var d=new Date(r.created);if(isNaN(d))return false;
  return (Date.now()-d.getTime())<=Number(range)*86400000;
}

function renderStats(){
  var box=$('stats');box.replaceChildren();
  var set=rows.filter(inRange);
  var closed=set.filter(function(r){return r.status==='tp_hit'||r.status==='sl_hit'});
  var wins=closed.filter(function(r){return r.status==='tp_hit'});
  var losses=closed.filter(function(r){return r.status==='sl_hit'});
  var open=set.filter(function(r){return r.status==='open'}).length;
  var net=closed.reduce(function(a,r){return a+(r.res||0)},0);
  var gw=wins.reduce(function(a,r){return a+(r.res||0)},0);
  var gl=Math.abs(losses.reduce(function(a,r){return a+(r.res||0)},0));
  function tile(k,v,s,cls){var d=el('div','stat');d.appendChild(el('div','k',k));d.appendChild(el('div','v'+(cls?' '+cls:''),v));if(s)d.appendChild(el('div','s',s));box.appendChild(d)}
  if(!trackingColumns){tile('Tracking','Not live','Outcome tracking has not been switched on yet.');}
  else if(closed.length===0){tile('Closed signals','0','Results appear after the first signal closes.');tile('Open now',String(open));}
  else{
    tile('Win rate',(wins.length/closed.length*100).toFixed(0)+'%',wins.length+' wins · '+losses.length+' losses');
    tile('Net result',fmtR(net),'sum of all closed signals',net>0?'pos':net<0?'neg':'');
    tile('Profit factor',gl>0?(gw/gl).toFixed(2):(gw>0?'∞':'—'),'gross win ÷ gross loss');
    tile('Closed',String(closed.length),'in selected range');
    tile('Open now',String(open));
  }
  drawChart(closed);
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
  var zeroY=y(0).toFixed(1);
  var up=vals[vals.length-1]>=0;
  svg.innerHTML='';
  var ns='http://www.w3.org/2000/svg';
  var z=document.createElementNS(ns,'line');z.setAttribute('x1',0);z.setAttribute('x2',W);z.setAttribute('y1',zeroY);z.setAttribute('y2',zeroY);z.setAttribute('stroke','currentColor');z.setAttribute('stroke-opacity','.25');z.setAttribute('stroke-dasharray','4 4');svg.appendChild(z);
  var p=document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('fill','none');p.setAttribute('stroke',up?'#10b981':'#e11d48');p.setAttribute('stroke-width','2.5');p.setAttribute('vector-effect','non-scaling-stroke');svg.appendChild(p);
}

function priceBox(label,val,cls){var b=el('div','pb');b.appendChild(el('span','',label));var s=el('b',cls||'',fmtP(val));b.appendChild(s);return b}

function card(r){
  var a=el('article','sig');
  var hd=el('div','hd');var left=el('div');left.appendChild(el('span','pair',r.pair));if(r.tf)left.appendChild(el('span','tf',r.tf));hd.appendChild(left);
  var right=el('div');right.style.cssText='display:flex;gap:6px;flex-wrap:wrap';
  right.appendChild(el('span','badge '+(r.type==='BUY'?'buy':r.type==='SELL'?'sell':'st-expired'),r.type==='BUY'?'↗ BUY':r.type==='SELL'?'↘ SELL':(r.type||'—')));
  right.appendChild(el('span','badge st-'+r.status,LABEL[r.status]));
  hd.appendChild(right);a.appendChild(hd);
  var pr=el('div','prices');pr.appendChild(priceBox('Entry',r.e));pr.appendChild(priceBox('Stop Loss',r.s,'neg'));pr.appendChild(priceBox('Take Profit',r.t,'pos'));a.appendChild(pr);
  var ft=el('div','ft');
  var l=el('span','', r.rr!==null?'Reward:Risk 1:'+r.rr.toFixed(2):'Reward:Risk —');
  ft.appendChild(l);
  if(r.status==='tp_hit'||r.status==='sl_hit'){
    var s=el('span',r.res>0?'pos':'neg','Result '+fmtR(r.res)+(r.exit!==null?' · exit '+fmtP(r.exit):''));s.style.fontWeight='800';ft.appendChild(s);
  }
  var t=document.createElement('time');t.dateTime=r.created||'';t.textContent='Issued '+fmtDate(r.created);ft.appendChild(t);
  if(r.closed&&(r.status==='tp_hit'||r.status==='sl_hit'||r.status==='expired')){ft.appendChild(el('span','','Closed '+fmtDate(r.closed)))}
  a.appendChild(ft);
  return a;
}

function renderFeed(){
  var box=$('signals-container');box.replaceChildren();
  var list=rows.filter(function(r){
    if(tab==='open')return r.status==='open';
    if(tab==='closed')return r.status!=='open';
    return true;
  });
  if(!list.length){box.appendChild(el('div','note',rows.length?'No signals in this view.':'No signals have been published yet. New signals appear here as soon as they are added.'));$('more-btn').hidden=true;return}
  list.slice(0,shown).forEach(function(r){box.appendChild(card(r))});
  $('more-btn').hidden=list.length<=shown;
}

function setStatus(t){$('connection-status').textContent=t}

async function load(){
  if(loading)return;
  if(!db){setStatus('Unable to connect to signal database');$('signals-container').replaceChildren(el('div','note','Signals could not be loaded. Please try again later.'));return}
  loading=true;var btn=$('refresh-btn');btn.disabled=true;btn.textContent='Loading…';$('signals-container').setAttribute('aria-busy','true');
  try{
    var res=await db.from('signals').select(FULL).order('created_at',{ascending:false}).limit(500);
    if(res.error){
      trackingColumns=false;
      res=await db.from('signals').select(BASIC).order('created_at',{ascending:false}).limit(500);
    }else{trackingColumns=true}
    if(res.error)throw res.error;
    rows=(res.data||[]).map(norm);
    renderStats();renderFeed();
    if(!$('connection-status').dataset.live)setStatus('Signal database connected · updated '+new Date().toLocaleTimeString());
  }catch(err){
    console.error('SUDUSI signals error',err);
    $('signals-container').replaceChildren(el('div','note','Signals could not be loaded. Please try again later.'));
    setStatus('Unable to connect to signal database');
  }finally{loading=false;btn.disabled=false;btn.textContent='↻ Refresh';$('signals-container').setAttribute('aria-busy','false')}
}

function seg(attr,cb){
  document.querySelectorAll('['+attr+']').forEach(function(b){
    b.addEventListener('click',function(){
      document.querySelectorAll('['+attr+']').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});
      cb(b.getAttribute(attr));
    });
  });
}
seg('data-range',function(v){range=v;renderStats()});
seg('data-tab',function(v){tab=v;shown=PAGE;renderFeed()});
$('more-btn').addEventListener('click',function(){shown+=PAGE;renderFeed()});
$('refresh-btn').addEventListener('click',load);

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
    {proName:'OANDA:XAUUSD',title:'XAUUSD'},
    {proName:'FX_IDC:USDUGX',title:'USDUGX'},
    {proName:'FX_IDC:EURUSD',title:'EURUSD'},
    {proName:'BITSTAMP:BTCUSD',title:'BTCUSD'},
    {proName:'FOREXCOM:NSXUSD',title:'NASDAQ 100'},
    {proName:'FOREXCOM:DJI',title:'US30'},
    {proName:'FOREXCOM:SPXUSD',title:'S&P 500'}
  ],
  showSymbolLogo:false,isTransparent:true,displayMode:'adaptive',colorTheme:dark?'dark':'light',locale:'en'
});
var cal=$('calendar');
function loadCal(){if(cal.dataset.l)return;cal.dataset.l='1';widget(cal,'https://s3.tradingview.com/external-embedding/embed-widget-events.js',{colorTheme:dark?'dark':'light',isTransparent:false,width:'100%',height:'420',locale:'en',importanceFilter:'0,1',currencyFilter:'USD,EUR,GBP'})}
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(en){if(en[0].isIntersecting){loadCal();io.disconnect()}},{rootMargin:'300px'});io.observe(cal)}else loadCal();

/* ---------- boot + live updates ---------- */
load();
setInterval(load,60000);
if(db){try{db.channel('sudusi-signals').on('postgres_changes',{event:'*',schema:'public',table:'signals'},function(){load()}).subscribe(function(st){if(st==='SUBSCRIBED'){$('connection-status').dataset.live='1';setStatus('Live database updates connected')}})}catch(e){}}
})();
