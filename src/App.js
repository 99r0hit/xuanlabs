import React, { useEffect, useRef, useState } from "react";

/*
  XUANLABS — CIE 1931 Chromaticity Comparator
  FULL, FIXED, PRODUCTION VERSION
*/

/* ----------------------- COLOR CONVERSION HELPERS ----------------------- */

function xyY_to_XYZ([x, y, Y]) {
  if (y === 0) return [0, 0, 0];
  const X = (x * Y) / y;
  const Z = ((1 - x - y) * Y) / y;
  return [X, Y, Z];
}

function XYZ_to_sRGB([X, Y, Z]) {
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;

  const compand = (c) => {
    c = Math.max(0, c);
    if (c <= 0.0031308) return 12.92 * c;
    return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  return [compand(r), compand(g), compand(b)];
}

/* ----------------------- SPECTRAL LOCUS ----------------------- */

const SPECTRAL_LOCUS = {
  380: [0.1741, 0.005], 400: [0.1733, 0.0048], 420: [0.1714, 0.0051],
  440: [0.1644, 0.0109], 460: [0.144, 0.0297], 480: [0.0913, 0.1327],
  500: [0.0082, 0.5384], 520: [0.0743, 0.8338], 540: [0.2296, 0.7543],
  560: [0.3731, 0.6245], 580: [0.5125, 0.4866], 600: [0.627, 0.3725],
  620: [0.6915, 0.3083], 640: [0.719, 0.2809], 660: [0.73, 0.27]
};

function nearestSpectralPoint(x, y) {
  let best = { wl: null, dist: Infinity, x: 0, y: 0 };
  Object.entries(SPECTRAL_LOCUS).forEach(([wl, [sx, sy]]) => {
    const d = Math.hypot(x - sx, y - sy);
    if (d < best.dist) best = { wl: Number(wl), dist: d, x: sx, y: sy };
  });
  return best;
}

function calculateDominantWavelength(x, y) {
  const nearest = nearestSpectralPoint(x, y);
  if (nearest.dist <= 0.06) return nearest.wl;
  return "Purple";
}

function calculatePurity(x, y, white = [0.3333, 0.3333]) {
  const dom = calculateDominantWavelength(x, y);
  if (dom === "Purple") return 1;
  const ref = SPECTRAL_LOCUS[dom];
  const dTotal = Math.hypot(ref[0] - white[0], ref[1] - white[1]);
  const dSample = Math.hypot(x - white[0], y - white[1]);
  return dTotal === 0 ? 0 : Math.min(1, dSample / dTotal);
}

/* ----------------------- DEFAULT POLYGON ----------------------- */

function defaultPolygon(idx, n = 4) {
  return Array.from({ length: n }, (_, i) => [
    0.68 + idx * 0.01 + i * 0.005,
    0.30 - idx * 0.01 - i * 0.005
  ]);
}

/* ----------------------- APP ----------------------- */

export default function App() {
  const canvasRef = useRef(null);

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  const [numSets, setNumSets] = useState(2);
  const [sets, setSets] = useState([
    { name: "LED Set 1", points: defaultPolygon(0) },
    { name: "LED Set 2", points: defaultPolygon(1) }
  ]);

  const [showFill, setShowFill] = useState(false);
  const [showPoints, setShowPoints] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [showCentroids, setShowCentroids] = useState(true);
  const [showWavelength, setShowWavelength] = useState(true);

  /* ----------------------- AUTH ----------------------- */

  function login(e) {
    e.preventDefault();
    if (password === (process.env.REACT_APP_CIE_APP_PASSWORD || "Rohit123"))
      setAuthenticated(true);
    else alert("Incorrect password");
  }

  /* ----------------------- AUTO SET UPDATE ----------------------- */

  useEffect(() => {
    setSets((prev) => {
      const copy = [...prev];
      while (copy.length < numSets)
        copy.push({ name: `LED Set ${copy.length + 1}`, points: defaultPolygon(copy.length) });
      return copy.slice(0, numSets);
    });
  }, [numSets]);

  /* ----------------------- DRAW ----------------------- */

  useEffect(draw, [sets, showFill, showPoints, showBorders, showCentroids, showWavelength]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cx = (x / W) * 0.8;
        const cy = 1 - y / H;
        const [X, Y, Z] = xyY_to_XYZ([cx, cy, 1]);
        const [r, g, b] = XYZ_to_sRGB([X, Y, Z]);
        const i = (y * W + x) * 4;
        img.data[i] = r * 255;
        img.data[i + 1] = g * 255;
        img.data[i + 2] = b * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    const toCanvas = ([x, y]) => [x / 0.8 * W, H - y * H];
    const colors = ["red", "blue", "green", "orange", "purple"];

    sets.forEach((s, si) => {
      const pts = s.points.map(toCanvas);

      if (showFill) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = colors[si % colors.length];
        ctx.beginPath();
        pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (showBorders) {
        ctx.strokeStyle = colors[si % colors.length];
        ctx.beginPath();
        pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath();
        ctx.stroke();
      }

      if (showPoints) {
        pts.forEach(([x, y], pi) => {
          ctx.beginPath();
          ctx.fillStyle = colors[si % colors.length];
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
          if (showWavelength) {
            const wl = calculateDominantWavelength(...s.points[pi]);
            ctx.fillText(wl === "Purple" ? "Purple" : `${wl}nm`, x + 6, y);
          }
        });
      }

      if (showCentroids) {
        const cx = s.points.reduce((a, p) => a + p[0], 0) / s.points.length;
        const cy = s.points.reduce((a, p) => a + p[1], 0) / s.points.length;
        const [x, y] = toCanvas([cx, cy]);
        ctx.strokeStyle = "black";
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 8);
        ctx.lineTo(x + 8, y + 8);
        ctx.moveTo(x + 8, y - 8);
        ctx.lineTo(x - 8, y + 8);
        ctx.stroke();
      }
    });
  }

  /* ----------------------- EXPORT ----------------------- */

  function downloadPNG() {
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = "cie_chromaticity.png";
    a.click();
  }

  function downloadCSV() {
    let csv = "Set,Point,x,y,Wavelength,Purity\n";
    sets.forEach((s) =>
      s.points.forEach((p, i) => {
        const wl = calculateDominantWavelength(p[0], p[1]);
        csv += `${s.name},P${i + 1},${p[0]},${p[1]},${wl},${calculatePurity(p[0], p[1])}\n`;
      })
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cie_data.csv";
    a.click();
  }

  /* ----------------------- UI ----------------------- */

  return (
    <div style={{ fontFamily: "Inter, Arial", padding: 20 }}>
      <h1>Xuanlabs · CIE 1931 Chromaticity Comparator</h1>

      {!authenticated ? (
        <form onSubmit={login}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button>Unlock</button>
        </form>
      ) : (
        <>
          <label>
            LED Sets:
            <input type="number" min={1} max={6} value={numSets}
              onChange={(e) => setNumSets(+e.target.value)} />
          </label>

          <div>
            <button onClick={downloadPNG}>PNG</button>
            <button onClick={downloadCSV}>CSV</button>
          </div>

          <canvas ref={canvasRef} width={900} height={650}
            style={{ border: "1px solid #ccc", marginTop: 20 }} />
        </>
      )}
    </div>
  );
}
