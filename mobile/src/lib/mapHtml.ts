import { ENABLED_REGIONS } from "../constants/mapRegion";

// Single Leaflet page used by both the native (WebView) and web (iframe)
// Discover map, so the map looks and behaves identically everywhere and
// doesn't depend on Google/Apple native map SDKs (which render blank in some
// Expo Go / Android setups). Talks to the host through postMessage:
//   host -> page : { type: "items", items: MapItem[] }
//   page -> host : { type: "ready" } | { type: "select", id: string }
// Uses stored coordinates only (no geocoding here).
export function buildMapHtml(opts: { dark: boolean; colors: { event: string; community: string } }): string {
  const regions = Object.values(ENABLED_REGIONS);
  const bounds = [
    [Math.min(...regions.map((r) => r.minLat)), Math.min(...regions.map((r) => r.minLng))],
    [Math.max(...regions.map((r) => r.maxLat)), Math.max(...regions.map((r) => r.maxLng))],
  ];
  // OSM tiles (no key needed); dark mode is a CSS filter over the tile pane.
  const tiles = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const bg = opts.dark ? "#10131a" : "#e8e8e8";
  const b = JSON.stringify(bounds);
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{height:100%;margin:0;padding:0;background:${bg}}
.leaflet-container{font-family:-apple-system,Segoe UI,Roboto,sans-serif}
.pin{width:26px;height:26px;border:3px solid #fff;box-sizing:border-box}
.pin.event{border-radius:8px;background:${opts.colors.event};box-shadow:0 0 14px ${opts.colors.event}}
.pin.community{border-radius:50%;background:${opts.colors.community};box-shadow:0 0 14px ${opts.colors.community}}
.cl{background:#7C5CFF;color:#fff;border:3px solid rgba(255,255,255,.9);border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;box-shadow:0 0 16px rgba(124,92,255,.6);box-sizing:border-box}
.leaflet-control-attribution{font-size:9px;opacity:.7}
${opts.dark ? ".leaflet-tile-pane{filter:invert(1) hue-rotate(200deg) brightness(.85) contrast(.95) saturate(.7)}.leaflet-control-attribution{background:rgba(8,9,13,.7)!important;color:#9CA3AF!important}.leaflet-control-attribution a{color:#9CA3AF!important}.leaflet-bar a{background:#13161D;color:#F4F5F8;border-color:#242832}" : ""}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<script>
(function(){
  function post(m){var s=JSON.stringify(m);
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s);}else if(window.parent!==window){window.parent.postMessage(s,'*');}}
  var map=L.map('map',{zoomControl:true,minZoom:5,maxZoom:18,attributionControl:true});
  map.fitBounds(${b},{padding:[24,24]});
  L.tileLayer(${JSON.stringify(tiles)},{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  var cluster=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:50,
    iconCreateFunction:function(c){return L.divIcon({html:'<div class="cl">'+c.getChildCount()+'</div>',className:'',iconSize:[38,38]});}});
  map.addLayer(cluster);
  function setItems(items){
    cluster.clearLayers();
    (items||[]).forEach(function(it){
      var icon=L.divIcon({html:'<div class="pin '+it.type+'"></div>',className:'',iconSize:[26,26]});
      var m=L.marker([it.latitude,it.longitude],{icon:icon});
      m.on('click',function(){post({type:'select',id:it.id});});
      cluster.addLayer(m);
    });
  }
  window.setItems=setItems;
  function onMsg(e){try{var d=typeof e.data==='string'?JSON.parse(e.data):e.data;if(d&&d.type==='items')setItems(d.items);}catch(_){}}
  window.addEventListener('message',onMsg);document.addEventListener('message',onMsg);
  var done=false;
  function fit(){map.invalidateSize();if(!done&&map.getSize().y>0){done=true;map.fitBounds(${b},{padding:[24,24]});}}
  window.addEventListener('resize',fit);setTimeout(fit,50);setTimeout(fit,400);
  post({type:'ready'});
})();
</script></body></html>`;
}
