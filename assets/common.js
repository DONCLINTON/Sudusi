(function(){
  var K='sudusi_cookie_consent_v1';
  function ensureGtag(){window.dataLayer=window.dataLayer||[];if(!window.gtag){window.gtag=function(){window.dataLayer.push(arguments)}}}
  function push(v){ensureGtag();var g=v==='accepted'?'granted':'denied';window.gtag('consent','update',{ad_storage:g,analytics_storage:g,ad_user_data:g,ad_personalization:g})}
  function banner(){
    var b=document.getElementById('cookie-banner');
    if(b)return b;
    b=document.createElement('div');b.id='cookie-banner';b.setAttribute('role','dialog');b.setAttribute('aria-label','Cookie consent');b.hidden=true;
    b.innerHTML='<div class="in"><p>We use cookies and similar technologies to analyse traffic and, where you allow it, personalise ads. Read our <a href="/privacy/">Privacy Policy</a> and <a href="/cookies/">Cookie Policy</a>. You can change your choice at any time.</p><div class="acts"><button type="button" class="btn" data-c="declined">Decline</button><button type="button" class="btn primary" data-c="accepted">Accept</button></div></div>';
    b.addEventListener('click',function(e){var c=e.target&&e.target.getAttribute&&e.target.getAttribute('data-c');if(c)window.sudusiSetConsent(c)});
    document.body.appendChild(b);return b;
  }
  window.sudusiSetConsent=function(v){try{localStorage.setItem(K,v)}catch(e){}push(v);var b=document.getElementById('cookie-banner');if(b)b.hidden=true};
  window.sudusiResetConsent=function(){try{localStorage.removeItem(K)}catch(e){}banner().hidden=false};
  function init(){var v=null;try{v=localStorage.getItem(K)}catch(e){}if(!v)banner().hidden=false}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
