self.addEventListener('message',function(e){
  if (e.data.action == 'skipWaiting')
    self.skipWaiting();
});


var cacheVersion = '0.01966';
var cacheItem = 'tmp'+cacheVersion;

self.addEventListener('install',function(event) {
  
  var urls = [
    '/',
    '/idb.js',
    ];
 
  event.waitUntil(
    caches.open(cacheItem).then(function(cache){
      return cache.addAll(urls);
    })
  );
  
});

self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(c){
      c.map(function(cname){
        if (!cname.endsWith(cacheVersion))
          caches.delete(cname);
      });
    })
  );
});

self.addEventListener('fetch', function(e) {
  
  if (e.request.url.includes('/mymy/')) {
    e.respondWith(
      new Response(`{
  "name": "TMP App",
  "icons": [{
    "src": "https://images.wallpapersden.com/image/download/levi-ackerman-attack-on-titan_65300_128x128.jpg",
    "type": "image/jpg",
    "sizes": "128x128"
  }, {
    "src": "https://avatarfiles.alphacoders.com/207/thumb-207140.png",
    "type": "image/png",
    "sizes": "192x192"
  }],
  "scope": "http://localhost:5005/localapp/tmp-app",
  "start_url": "http://localhost:5005/localapp/tmp-app",
  "display": "standalone",
  "background_color": "#596d92",
  "theme_color": "#3f5173"
}`, {
        headers: {'Content-Type': 'text/html'}
      })
    );
  }
  else if (e.request.url.includes('/localapp/')) {
    e.respondWith(
      caches.match(e.request.url.split('localapp/')[0]).then(function(resp) {
        if (resp)
          return resp;
        
        return fetch(e.request).then(function(r) {
          return r;
        }).catch(function() {
          console.error('Check connection.');
        });
      })
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(function(resp) {
        if (resp)
          return resp;
        
        return fetch(e.request).then(function(r) {
          return r;
        }).catch(function() {
          console.error('Check connection.');
        });
      })
    );
  }
  
});