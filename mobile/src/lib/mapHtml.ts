import { ENABLED_REGIONS } from "../constants/mapRegion";

// Single Leaflet page used by both the native (WebView) and web (iframe)
// Discover map, so the map looks and behaves identically everywhere and
// doesn't depend on Google/Apple native map SDKs (which render blank in some
// Expo Go / Android setups). Talks to the host through postMessage:
//   host -> page : { type: "items", items: MapItem[] }
//   page -> host : { type: "ready" } | { type: "select", id: string }
// Uses stored coordinates only (no geocoding here). Every event/community is
// its own pin (no clustering, so zoomed-out views still show each one);
// posts sharing a venue are fanned out slightly so they stay individually
// visible and tappable once you zoom in.
export function buildMapHtml(opts: { dark: boolean; colors: { event: string; community: string } }): string {
  const regions = Object.values(ENABLED_REGIONS);
  const bounds = [
    [Math.min(...regions.map((r) => r.minLat)), Math.min(...regions.map((r) => r.minLng))],
    [Math.max(...regions.map((r) => r.maxLat)), Math.max(...regions.map((r) => r.maxLng))],
  ];
  // OSM tiles (no key needed); dark mode is a CSS filter over the tile pane.
  const tiles = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const bg = opts.dark ? "#16142A" : "#EFEBE4";
  const b = JSON.stringify(bounds);
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{height:100%;margin:0;padding:0;background:${bg}}
.leaflet-container{font-family:-apple-system,Segoe UI,Roboto,sans-serif}
.pin{position:relative;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
.pin svg{display:block;width:100%;height:100%;overflow:visible}
.leaflet-control-attribution{font-size:9px;opacity:.7}
${opts.dark ? ".leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.8) contrast(.95) saturate(.35) sepia(.1) hue-rotate(10deg)}.leaflet-control-attribution{background:rgba(22,20,42,.75)!important;color:#B3AFC4!important}.leaflet-control-attribution a{color:#B3AFC4!important}.leaflet-bar a{background:#1E1B36;color:#F5F3EF;border-color:#34304F}" : ""}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  function post(m){var s=JSON.stringify(m);
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s);}else if(window.parent!==window){window.parent.postMessage(s,'*');}}
  var map=L.map('map',{zoomControl:true,minZoom:5,maxZoom:18,attributionControl:true});
  map.fitBounds(${b},{padding:[24,24]});
  L.tileLayer(${JSON.stringify(tiles)},{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  var COLORS=${JSON.stringify(opts.colors)};
  var layer=L.layerGroup().addTo(map);
  var markers=[];
  // Pin size follows zoom: small enough to tell pins apart when zoomed out,
  // full size when zoomed in.
  function pinW(){var z=map.getZoom();return z<=7?20:z<=10?26:z<=13?32:38;}
  var sel=null;
  function pinIcon(type,big){
    var w=Math.round(pinW()*(big?1.35:1)),h=Math.round(w*1.3),c=COLORS[type]||'#7565F5';
    var inner=type==='event'?'<rect x="8.2" y="8" width="7.6" height="7.6" rx="1.6" fill="#fff"/>':'<circle cx="12" cy="11.8" r="4" fill="#fff"/>';
    var svg='<svg viewBox="0 0 24 31" xmlns="http://www.w3.org/2000/svg"><path d="M12 30C12 30 2 19.5 2 11.5a10 10 0 0 1 20 0C22 19.5 12 30 12 30z" fill="'+c+'" stroke="#fff" stroke-width="2"/>'+inner+'</svg>';
    return L.divIcon({html:'<div class="pin" style="width:'+w+'px;height:'+h+'px">'+svg+'</div>',className:'',iconSize:[w,h],iconAnchor:[w/2,h]});
  }
  map.on('zoomend',function(){markers.forEach(function(m){m.setIcon(pinIcon(m._type,m===sel));});});
  map.on('click',function(){if(sel){sel.setIcon(pinIcon(sel._type,false));sel.setZIndexOffset(0);sel=null;}});
  function setItems(items){
    layer.clearLayers();markers=[];sel=null;
    // Posts at the same venue get fanned out on a ~35 m ring so none hides another.
    var groups={};
    (items||[]).forEach(function(it){var k=it.latitude.toFixed(5)+','+it.longitude.toFixed(5);(groups[k]=groups[k]||[]).push(it);});
    Object.keys(groups).forEach(function(k){
      var g=groups[k],n=g.length;
      g.forEach(function(it,i){
        var lat=it.latitude,lng=it.longitude;
        if(n>1){var a=2*Math.PI*i/n,r=0.00032;lat+=r*Math.sin(a);lng+=r*Math.cos(a)/Math.cos(lat*Math.PI/180);}
        var m=L.marker([lat,lng],{icon:pinIcon(it.type),riseOnHover:true});
        m._type=it.type;
        m.on('click',function(){if(sel&&sel!==m){sel.setIcon(pinIcon(sel._type,false));sel.setZIndexOffset(0);}sel=m;m.setIcon(pinIcon(m._type,true));m.setZIndexOffset(1000);post({type:'select',id:it.id});});
        layer.addLayer(m);markers.push(m);
      });
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
