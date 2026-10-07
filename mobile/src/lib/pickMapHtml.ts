import { INDIA_BOUNDARY } from "../constants/mapRegion";

// Leaflet page for choosing a location by tapping an India map (used by the
// location sheet). Same host protocol as lib/mapHtml.ts:
//   host -> page : { type: "marker", lat, lng }   (show/move the pin)
//   page -> host : { type: "ready" } | { type: "pick", lat, lng }
// The view is limited to India so a stray pan can't wander off the map.
export function buildPickMapHtml(opts: {
  dark: boolean;
  accent: string;
  initial: { lat: number; lng: number } | null;
}): string {
  const { northEast, southWest } = INDIA_BOUNDARY;
  const bounds = JSON.stringify([
    [southWest.latitude, southWest.longitude],
    [northEast.latitude, northEast.longitude],
  ]);
  const bg = opts.dark ? "#0a0a0a" : "#e8e8e8";
  const dark = opts.dark
    ? ".leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.8) contrast(.95) saturate(.35) sepia(.25)}.leaflet-control-attribution{background:rgba(10,10,10,.7)!important;color:#a8a09a!important}.leaflet-control-attribution a{color:#a8a09a!important}.leaflet-bar a{background:#141210;color:#faf6f1;border-color:#2a2623}"
    : "";
  const initial = opts.initial ? JSON.stringify([opts.initial.lat, opts.initial.lng]) : "null";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{height:100%;margin:0;padding:0;background:${bg};cursor:crosshair}
.pin{width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${opts.accent};border:3px solid #fff;box-sizing:border-box;box-shadow:0 0 14px ${opts.accent}}
.pin:after{content:"";position:absolute;width:10px;height:10px;border-radius:50%;background:#fff;top:7px;left:7px}
.leaflet-control-attribution{font-size:9px;opacity:.7}
${dark}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  function post(m){var s=JSON.stringify(m);
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s);}else if(window.parent!==window){window.parent.postMessage(s,'*');}}
  var india=${bounds};
  var map=L.map('map',{minZoom:4,maxZoom:18,maxBounds:[[2,60],[42,102]],maxBoundsViscosity:0.8});
  var start=${initial};
  if(start){map.setView(start,10);}else{map.fitBounds(india);}
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  var marker=null;
  var icon=L.divIcon({html:'<div class="pin"></div>',className:'',iconSize:[30,30],iconAnchor:[15,30]});
  function setMarker(lat,lng){
    if(marker){marker.setLatLng([lat,lng]);}else{marker=L.marker([lat,lng],{icon:icon}).addTo(map);}
  }
  if(start){setMarker(start[0],start[1]);}
  map.on('click',function(e){setMarker(e.latlng.lat,e.latlng.lng);post({type:'pick',lat:e.latlng.lat,lng:e.latlng.lng});});
  function onMsg(e){try{var d=typeof e.data==='string'?JSON.parse(e.data):e.data;if(d&&d.type==='marker'){setMarker(d.lat,d.lng);map.setView([d.lat,d.lng],Math.max(map.getZoom(),10));}}catch(_){}}
  window.addEventListener('message',onMsg);document.addEventListener('message',onMsg);
  var done=false;
  function fit(){map.invalidateSize();if(!done&&map.getSize().y>0){done=true;if(!start)map.fitBounds(india);}}
  window.addEventListener('resize',fit);setTimeout(fit,50);setTimeout(fit,400);
  post({type:'ready'});
})();
</script></body></html>`;
}
