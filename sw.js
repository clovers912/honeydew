/* 서비스워커 — 안드로이드에서 '앱 설치'(WebAPK)가 되게 하려고만 있다.
   크롬은 서비스워커가 없으면 설치를 안 해주고 단순 바로가기만 만든다.

   🔴 아무것도 캐시하지 않는다. 일부러다.
   캐시하면 낡은 화면이 기기에 영구히 눌러앉는다 — 이 앱은 이미
   "옛 버전인 것 같다"는 오해를 한 번 겪었고(실제로는 브라우저가
   색을 뒤집은 것이었다), 진짜 캐시까지 끼면 원인을 못 가른다.
   오프라인 동작도 필요 없다. 방 데이터가 어차피 네트워크에 있다. */

self.addEventListener('install', function(){
  self.skipWaiting();                 /* 새 버전이 즉시 자리를 잡는다 */
});

self.addEventListener('activate', function(e){
  e.waitUntil(self.clients.claim());
});

/* fetch 핸들러가 '있다'는 것 자체가 설치 조건이다.
   respondWith 를 부르지 않으므로 요청은 평소대로 네트워크로 간다. */
self.addEventListener('fetch', function(){});
