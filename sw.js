/* PB Inspections offline cache (v1.9.0, 02.10.2026).
   Handles ONLY the inspection app page and its four pinned libraries. Every other request on the
   site (Hub, Jobs, Apps Script, Microsoft sign-in, Graph uploads) passes straight through untouched.
   The page is network first: with signal you always get the live version, the copy on the phone is
   used only when the network fails or takes longer than 4 seconds. */
var CACHE = 'pb-insp-v190';
var PAGE = './inspect.html';
var LIBS = [
  'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.38.4/lib/msal-browser.min.js',
  'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
];
self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all([PAGE].concat(LIBS).map(function(u){
      return fetch(u, {cache:'no-cache'}).then(function(r){ if(r.ok) return c.put(u, r); }).catch(function(){});
    }));
  }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k.indexOf('pb-insp-')===0 && k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
function pageNetFirst(req){
  return new Promise(function(resolve){
    var done=false;
    var fromCache=function(){ return caches.open(CACHE).then(function(c){ return c.match(PAGE); }); };
    var t=setTimeout(function(){ fromCache().then(function(m){ if(m && !done){ done=true; resolve(m); } }); }, 4000);
    fetch(req).then(function(r){
      if(r && r.ok){ var cp=r.clone(); caches.open(CACHE).then(function(c){ c.put(PAGE, cp); }); }
      if(!done){ done=true; clearTimeout(t); resolve(r); }
    }).catch(function(){
      fromCache().then(function(m){ if(!done){ done=true; clearTimeout(t); resolve(m || Response.error()); } });
    });
  });
}
self.addEventListener('fetch', function(e){
  var req=e.request;
  if(req.method!=='GET') return;
  var url;
  try{ url=new URL(req.url); }catch(x){ return; }
  if(url.origin===self.location.origin && /\/inspect(\.html)?$/.test(url.pathname)){
    e.respondWith(pageNetFirst(req)); return;
  }
  if(LIBS.indexOf(req.url)>-1){
    e.respondWith(caches.open(CACHE).then(function(c){
      return c.match(req.url).then(function(m){
        return m || fetch(req).then(function(r){ if(r && r.ok) c.put(req.url, r.clone()); return r; });
      });
    }));
  }
});
