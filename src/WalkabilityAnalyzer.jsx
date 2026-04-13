import { useState, useRef, useCallback, useEffect } from "react";

// ── Tile math helpers ──
function lonToTile(lon, zoom) { return ((lon + 180) / 360) * Math.pow(2, zoom); }
function latToTile(lat, zoom) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, zoom);
}
function tileToLon(x, zoom) { return (x / Math.pow(2, zoom)) * 360 - 180; }
function tileToLat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function latlngToPixel(lat, lon, zoom, centerLat, centerLon, width, height) {
  const cx = lonToTile(centerLon, zoom);
  const cy = latToTile(centerLat, zoom);
  const px = lonToTile(lon, zoom);
  const py = latToTile(lat, zoom);
  return {
    x: width / 2 + (px - cx) * 256,
    y: height / 2 + (py - cy) * 256,
  };
}

function pixelToLatlng(x, y, zoom, centerLat, centerLon, width, height) {
  const cx = lonToTile(centerLon, zoom);
  const cy = latToTile(centerLat, zoom);
  const tileX = cx + (x - width / 2) / 256;
  const tileY = cy + (y - height / 2) / 256;
  return { lat: tileToLat(tileY, zoom), lon: tileToLon(tileX, zoom) };
}

// ── Generate isochrone approximation (concentric travel-time rings) ──
function generateIsochrone(lat, lon, minutes, mode) {
  // Approximate speeds in km/h
  const speeds = { walk: 4.5, bike: 15, drive: 35 };
  const speed = speeds[mode] || 4.5;
  const distKm = (speed * minutes) / 60;

  // Generate an irregular polygon to simulate network-based isochrone
  const points = 48;
  const coords = [];
  const seed = lat * 1000 + lon * 100 + minutes;

  for (let i = 0; i < points; i++) {
    const angle = (2 * Math.PI * i) / points;
    // Pseudo-random variation to make it look organic (seeded by position)
    const variation = 0.65 + 0.35 * Math.abs(Math.sin(seed + i * 2.7 + angle * 3.1));
    const d = distKm * variation;
    const dlat = (d / 111.32) * Math.cos(angle);
    const dlon = (d / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    coords.push({ lat: lat + dlat, lon: lon + dlon });
  }
  coords.push(coords[0]); // close polygon

  const areaSqKm = Math.PI * distKm * distKm * 0.72; // approximate with variation factor
  return { coords, areaSqKm };
}

// ── Generate sample POIs around a location ──
function generatePOIs(lat, lon, radiusKm) {
  const categories = [
    { key: "grocery", emoji: "🛒", label: "Grocery", color: "#3fb950", baseCount: 4 },
    { key: "park", emoji: "🌳", label: "Park", color: "#58a6ff", baseCount: 5 },
    { key: "school", emoji: "🏫", label: "School", color: "#d2a8ff", baseCount: 3 },
    { key: "health", emoji: "🏥", label: "Health", color: "#f85149", baseCount: 2 },
    { key: "cafe", emoji: "☕", label: "Café", color: "#e3b341", baseCount: 6 },
    { key: "transit", emoji: "🚏", label: "Transit", color: "#79c0ff", baseCount: 8 },
  ];

  // Pasadena-area real landmarks (approximate positions)
  const realPlaces = [
    { lat: 34.1478, lon: -118.1445, name: "Trader Joe's", key: "grocery" },
    { lat: 34.1435, lon: -118.1503, name: "Whole Foods", key: "grocery" },
    { lat: 34.1525, lon: -118.1565, name: "Ralph's", key: "grocery" },
    { lat: 34.1605, lon: -118.1318, name: "Vons", key: "grocery" },
    { lat: 34.1384, lon: -118.1321, name: "Central Park", key: "park" },
    { lat: 34.1555, lon: -118.1714, name: "Brookside Park", key: "park" },
    { lat: 34.1448, lon: -118.1530, name: "Memorial Park", key: "park" },
    { lat: 34.1620, lon: -118.1390, name: "Eaton Canyon", key: "park" },
    { lat: 34.1370, lon: -118.1250, name: "Victory Park", key: "park" },
    { lat: 34.1462, lon: -118.1400, name: "Pasadena High School", key: "school" },
    { lat: 34.1510, lon: -118.1560, name: "Blair High School", key: "school" },
    { lat: 34.1410, lon: -118.1290, name: "Marshall Fundamental", key: "school" },
    { lat: 34.1475, lon: -118.1445, name: "Huntington Hospital", key: "health" },
    { lat: 34.1390, lon: -118.1505, name: "Kaiser Permanente", key: "health" },
    { lat: 34.1458, lon: -118.1318, name: "Urgent Care Pasadena", key: "health" },
    { lat: 34.1460, lon: -118.1490, name: "Copa Vida", key: "cafe" },
    { lat: 34.1455, lon: -118.1438, name: "Intelligentsia Coffee", key: "cafe" },
    { lat: 34.1480, lon: -118.1470, name: "Jones Coffee Roasters", key: "cafe" },
    { lat: 34.1440, lon: -118.1510, name: "Philz Coffee", key: "cafe" },
    { lat: 34.1430, lon: -118.1395, name: "Café de Leche", key: "cafe" },
    { lat: 34.1495, lon: -118.1555, name: "Jameson Brown", key: "cafe" },
    { lat: 34.1419, lon: -118.1484, name: "Memorial Park Station", key: "transit" },
    { lat: 34.1458, lon: -118.1379, name: "Lake Ave Station", key: "transit" },
    { lat: 34.1478, lon: -118.1544, name: "Del Mar Station", key: "transit" },
    { lat: 34.1360, lon: -118.1233, name: "Allen Station", key: "transit" },
    { lat: 34.1499, lon: -118.1604, name: "Fillmore Station", key: "transit" },
    { lat: 34.1502, lon: -118.1420, name: "Bus Stop - Colorado Blvd", key: "transit" },
    { lat: 34.1430, lon: -118.1360, name: "Bus Stop - Lake & Del Mar", key: "transit" },
    { lat: 34.1390, lon: -118.1470, name: "Bus Stop - Fair Oaks", key: "transit" },
  ];

  // Filter to within radius
  const filtered = realPlaces.filter((p) => {
    const dlat = p.lat - lat;
    const dlon = (p.lon - lon) * Math.cos((lat * Math.PI) / 180);
    const dist = Math.sqrt(dlat * dlat + dlon * dlon) * 111.32;
    return dist <= radiusKm;
  });

  return { pois: filtered, categories };
}

// ── Compute access score ──
function computeScore(pois) {
  const weights = { grocery: 20, health: 20, park: 15, school: 15, transit: 20, cafe: 10 };
  const counts = {};
  pois.forEach((p) => { counts[p.key] = (counts[p.key] || 0) + 1; });
  let score = 0;
  Object.entries(weights).forEach(([k, w]) => {
    score += (Math.min(counts[k] || 0, 5) / 5) * w;
  });
  return Math.round(score);
}

// ── Color configs ──
const modeThemes = {
  walk:  { accent: "#3fb950", fill: "rgba(63,185,80,0.12)",  stroke: "rgba(63,185,80,0.5)" },
  bike:  { accent: "#58a6ff", fill: "rgba(88,166,255,0.12)", stroke: "rgba(88,166,255,0.5)" },
  drive: { accent: "#d2a8ff", fill: "rgba(210,168,255,0.12)", stroke: "rgba(210,168,255,0.5)" },
};

const categoryMeta = {
  grocery: { emoji: "🛒", label: "Grocery", color: "#3fb950" },
  park:    { emoji: "🌳", label: "Park",    color: "#58a6ff" },
  school:  { emoji: "🏫", label: "School",  color: "#d2a8ff" },
  health:  { emoji: "🏥", label: "Health",  color: "#f85149" },
  cafe:    { emoji: "☕", label: "Café",    color: "#e3b341" },
  transit: { emoji: "🚏", label: "Transit", color: "#79c0ff" },
};

// ── Main Component ──
export default function WalkabilityAnalyzer() {
  const [center, setCenter] = useState({ lat: 34.1478, lon: -118.1445 });
  const [zoom, setZoom] = useState(14);
  const [pin, setPin] = useState(null);
  const [mode, setMode] = useState("walk");
  const [time, setTime] = useState(10);
  const [iso, setIso] = useState(null);
  const [pois, setPois] = useState([]);
  const [stats, setStats] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [centerStart, setCenterStart] = useState(null);
  const [hoveredPoi, setHoveredPoi] = useState(null);
  const [showHint, setShowHint] = useState(true);

  const mapRef = useRef(null);
  const W = 900;
  const H = 600;

  // ── Tile rendering ──
  const getTiles = useCallback(() => {
    const tiles = [];
    const cx = lonToTile(center.lon, zoom);
    const cy = latToTile(center.lat, zoom);
    const halfW = Math.ceil(W / 256 / 2) + 1;
    const halfH = Math.ceil(H / 256 / 2) + 1;

    for (let dx = -halfW; dx <= halfW; dx++) {
      for (let dy = -halfH; dy <= halfH; dy++) {
        const tx = Math.floor(cx) + dx;
        const ty = Math.floor(cy) + dy;
        if (ty < 0 || ty >= Math.pow(2, zoom)) continue;
        const wrappedTx = ((tx % Math.pow(2, zoom)) + Math.pow(2, zoom)) % Math.pow(2, zoom);

        const px = W / 2 + (tx - cx) * 256;
        const py = H / 2 + (ty - cy) * 256;

        tiles.push({
          key: `${zoom}-${wrappedTx}-${ty}`,
          url: `https://a.basemaps.cartocdn.com/dark_all/${zoom}/${wrappedTx}/${ty}@2x.png`,
          x: px,
          y: py,
        });
      }
    }
    return tiles;
  }, [center, zoom]);

  const toPixel = useCallback((lat, lon) => latlngToPixel(lat, lon, zoom, center.lat, center.lon, W, H), [center, zoom]);
  const toLatLng = useCallback((x, y) => pixelToLatlng(x, y, zoom, center.lat, center.lon, W, H), [center, zoom]);

  // ── Map interactions ──
  const handleMouseDown = (e) => {
    const rect = mapRef.current.getBoundingClientRect();
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setCenterStart({ ...center });
  };

  const handleMouseMove = (e) => {
    if (!dragging || !dragStart || !centerStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const newCenter = pixelToLatlng(W / 2 - dx, H / 2 - dy, zoom, centerStart.lat, centerStart.lon, W, H);
    setCenter({ lat: newCenter.lat, lon: newCenter.lon });
  };

  const handleMouseUp = (e) => {
    if (dragging && dragStart) {
      const dx = Math.abs(e.clientX - dragStart.x);
      const dy = Math.abs(e.clientY - dragStart.y);
      if (dx < 4 && dy < 4) {
        // It's a click, not a drag
        const rect = mapRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ll = toLatLng(x, y);
        setPin({ lat: ll.lat, lon: ll.lon });
        setShowHint(false);
        setIso(null);
        setPois([]);
        setStats(null);
      }
    }
    setDragging(false);
    setDragStart(null);
    setCenterStart(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.max(11, Math.min(17, z + (e.deltaY < 0 ? 1 : -1))));
  };

  // ── Analyze ──
  const analyze = () => {
    if (!pin) return;
    const isoData = generateIsochrone(pin.lat, pin.lon, time, mode);
    setIso(isoData);

    const speeds = { walk: 4.5, bike: 15, drive: 35 };
    const radiusKm = (speeds[mode] * time) / 60;
    const { pois: foundPois } = generatePOIs(pin.lat, pin.lon, radiusKm);
    setPois(foundPois);

    const score = computeScore(foundPois);
    const counts = {};
    foundPois.forEach((p) => { counts[p.key] = (counts[p.key] || 0) + 1; });
    setStats({ area: isoData.areaSqKm.toFixed(1), total: foundPois.length, score, counts });
  };

  const theme = modeThemes[mode];
  const tiles = getTiles();

  // ── ISO polygon path ──
  let isoPath = "";
  if (iso) {
    isoPath = iso.coords
      .map((c, i) => {
        const p = toPixel(c.lat, c.lon);
        return `${i === 0 ? "M" : "L"}${p.x},${p.y}`;
      })
      .join(" ") + " Z";
  }

  return (
    <div style={{
      width: "100%", maxWidth: W, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif",
      background: "#0d1117", borderRadius: 12, overflow: "hidden", border: "1px solid #30363d",
      position: "relative",
    }}>
      {/* Map */}
      <div
        ref={mapRef}
        style={{ width: "100%", height: H, position: "relative", cursor: dragging ? "grabbing" : "grab", overflow: "hidden" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDragging(false); }}
        onWheel={handleWheel}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0 }}>
          {/* Tiles */}
          {tiles.map((t) => (
            <image key={t.key} href={t.url} x={t.x} y={t.y} width={256} height={256} style={{ imageRendering: "auto" }} />
          ))}

          {/* Isochrone polygon */}
          {iso && (
            <path d={isoPath} fill={theme.fill} stroke={theme.stroke} strokeWidth={2.5}
              style={{ filter: `drop-shadow(0 0 12px ${theme.stroke})` }} />
          )}

          {/* POI dots */}
          {pois.map((p, i) => {
            const px = toPixel(p.lat, p.lon);
            const cat = categoryMeta[p.key];
            const isHovered = hoveredPoi === i;
            return (
              <g key={i}
                onMouseEnter={() => setHoveredPoi(i)}
                onMouseLeave={() => setHoveredPoi(null)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={px.x} cy={px.y} r={isHovered ? 14 : 10} fill={cat.color} opacity={0.9}
                  stroke="#fff" strokeWidth={2} />
                <text x={px.x} y={px.y + 1} textAnchor="middle" dominantBaseline="central"
                  fontSize={isHovered ? 12 : 10} style={{ pointerEvents: "none" }}>
                  {cat.emoji}
                </text>
                {isHovered && (
                  <g>
                    <rect x={px.x - 60} y={px.y - 36} width={120} height={24} rx={6}
                      fill="#161b22" stroke="#30363d" strokeWidth={1} />
                    <text x={px.x} y={px.y - 22} textAnchor="middle" fontSize={11}
                      fill="#e6edf3" fontFamily="system-ui" style={{ pointerEvents: "none" }}>
                      {p.name}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Pin */}
          {pin && (() => {
            const pp = toPixel(pin.lat, pin.lon);
            return (
              <g>
                <circle cx={pp.x} cy={pp.y} r={18} fill="none" stroke="rgba(248,81,73,0.3)" strokeWidth={2}>
                  <animate attributeName="r" from="10" to="24" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="1" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={pp.x} cy={pp.y} r={8} fill="#f85149" stroke="#fff" strokeWidth={3}
                  style={{ filter: "drop-shadow(0 2px 6px rgba(248,81,73,0.5))" }} />
              </g>
            );
          })()}
        </svg>

        {/* Click hint */}
        {showHint && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            background: "#161b22ee", border: "1px solid #30363d", borderRadius: 10,
            padding: "16px 24px", textAlign: "center", pointerEvents: "none",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📍</div>
            <div style={{ fontSize: 13, color: "#8b949e" }}>
              <strong style={{ color: "#e6edf3" }}>Click anywhere</strong> to drop a pin
            </div>
          </div>
        )}

        {/* Zoom controls */}
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {["+", "−"].map((label, i) => (
            <button key={label} onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(11, Math.min(17, z + (i === 0 ? 1 : -1)))); }}
              style={{
                width: 32, height: 32, border: "1px solid #30363d", borderRadius: 6,
                background: "#161b22", color: "#e6edf3", fontSize: 18, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls panel */}
      <div style={{ padding: "16px 20px 20px", borderTop: "1px solid #30363d" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* Mode selector */}
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#8b949e", marginBottom: 6, fontWeight: 700 }}>
              Mode
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { key: "walk", emoji: "🚶", label: "Walk" },
                { key: "bike", emoji: "🚲", label: "Bike" },
                { key: "drive", emoji: "🚗", label: "Drive" },
              ].map((m) => (
                <button key={m.key} onClick={() => setMode(m.key)}
                  style={{
                    padding: "8px 14px", border: `1px solid ${mode === m.key ? modeThemes[m.key].accent : "#30363d"}`,
                    borderRadius: 8, background: mode === m.key ? modeThemes[m.key].fill : "transparent",
                    color: mode === m.key ? modeThemes[m.key].accent : "#8b949e",
                    cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "inherit",
                    transition: "all 0.15s ease",
                  }}>
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time selector */}
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#8b949e", marginBottom: 6, fontWeight: 700 }}>
              Range
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[5, 10, 15].map((t) => (
                <button key={t} onClick={() => setTime(t)}
                  style={{
                    padding: "8px 14px", border: `1px solid ${time === t ? theme.accent : "#30363d"}`,
                    borderRadius: 8, background: time === t ? theme.fill : "transparent",
                    color: time === t ? "#e6edf3" : "#8b949e",
                    cursor: "pointer", fontSize: 12, fontFamily: "'Space Mono', monospace",
                    transition: "all 0.15s ease",
                  }}>
                  {t}m
                </button>
              ))}
            </div>
          </div>

          {/* Analyze button */}
          <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
            <button onClick={analyze} disabled={!pin}
              style={{
                padding: "10px 24px", border: "none", borderRadius: 8,
                background: pin ? theme.accent : "#30363d",
                color: pin ? "#0d1117" : "#8b949e",
                fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700,
                cursor: pin ? "pointer" : "not-allowed", letterSpacing: 0.5,
                transition: "all 0.15s ease",
                transform: pin ? "none" : "none",
              }}
              onMouseEnter={(e) => { if (pin) e.target.style.filter = "brightness(1.15)"; }}
              onMouseLeave={(e) => { e.target.style.filter = "none"; }}
            >
              Analyze
            </button>
          </div>
        </div>

        {/* Pin coordinates */}
        {pin && (
          <div style={{ marginTop: 10, fontSize: 11, color: "#8b949e", fontFamily: "'Space Mono', monospace" }}>
            📍 {pin.lat.toFixed(4)}, {pin.lon.toFixed(4)}
          </div>
        )}

        {/* Stats + Legend */}
        {stats && (
          <div style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
            {/* Stats */}
            <div style={{
              display: "flex", gap: 20, padding: "14px 18px", background: "#161b22",
              border: "1px solid #30363d", borderRadius: 10,
            }}>
              {[
                { value: stats.area, label: "km²" },
                { value: stats.total, label: "places" },
                { value: `${stats.score}/100`, label: "score" },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: theme.accent }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#8b949e", marginTop: 2 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{
              display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
              padding: "10px 14px", background: "#161b22",
              border: "1px solid #30363d", borderRadius: 10, flex: 1, minWidth: 200,
            }}>
              {Object.entries(categoryMeta).map(([key, cat]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#e6edf3" }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", background: cat.color, display: "inline-block",
                  }} />
                  {cat.emoji} {stats.counts[key] || 0}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
