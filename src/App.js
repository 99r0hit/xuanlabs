import React, { useEffect, useRef, useState, useCallback } from "react";

/* ================= COLOR CONVERSION ================= */

function xyY_to_XYZ([x, y, Y]) {
  if (y === 0) return [0, 0, 0];
  return [(x * Y) / y, Y, ((1 - x - y) * Y) / y];
}

function XYZ_to_sRGB([X, Y, Z]) {
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;

  const compand = (c) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

  return [compand(r), compand(g), compand(b)];
}

/* ================= SPECTRAL LOCUS ================= */

const SPECTRAL_LOCUS = {
  380: [0.1741, 0.0050], 400: [0.1733, 0.0048], 420: [0.1714, 0.0051],
  440: [0.1644, 0.0109], 460: [0.1440, 0.0297], 480: [0.0913, 0.1327],
  500: [0.0082, 0.5384], 520: [0.0743, 0.8338], 540: [0.2296, 0.7543],
  560: [0.3731, 0.6245], 580: [0.5125, 0.4866], 600: [0.6270, 0.3725],
  620: [0.6915, 0.3083], 640: [0.7190, 0.2809], 660: [0.7300, 0.2700]
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
  const n = nearestSpectralPoint(x, y);
  return n.dist <= 0.06 ? n.wl : "Purple";
}

function calculatePurity(x, y, white = [0.3333, 0.3333]) {
  const wl = calculateDominantWavelength(x, y);
  if (wl === "Purple") return 1;
  const [sx, sy] = SPECTRAL_LOCUS[wl];
  const total = Math.hypot(sx - white[0], sy - white[1]);
  const sample = Math.hypot(x - white[0], y - white[1]);
  return total === 0 ? 0 : Math.min(1, sample / total);
}

/* ================= HELPERS ================= */

function defaultPolygon(idx, n = 4) {
  return Array.from({ length: n }, (_, i) => [
    0.68 + idx * 0.01 + i * 0.005,
    0.30 - idx * 0.01 - i * 0.005
  ]);
}

/* ================= APP ================= */

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

  /* ================= AUTO SETS ================= */

  useEffect(() => {
    setSets((prev) => {
      const c = [...prev];
      while (c.length < numSets)
        c.push({ name: `LED Set ${c.length + 1}`, points: defaultPolygon(c.length) });
      return c.slice(0, numSets);
    });
  }, [numSets]);

  /* ================= DRAW (ORIGINAL LOGIC) ================= */

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;

    const ctx = c.getContext("2d");
    const W = c.width;
    const H = c.height;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, W, H);

    const img = ctx.createImageData(W, H);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = (i / (W - 1)) * 0.8;
        const y = 1 - j / (H - 1);
        const [X, Y, Z] = xyY_to_XYZ([x, y, 1]);
        const [r, g, b] = XYZ_to_sRGB([X, Y, Z]);
        const idx = (j * W + i) * 4;
        img.data[idx] = r * 255;
        img.data[idx + 1] = g * 255;
        img.data[idx + 2] = b * 255;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    const toCanvas = ([x, y]) => [x / 0.8 * W, H - y * H];
    const colors = ["blue", "red", "green", "orange", "purple"];

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
        ctx.stroke();
      }

      if (showPoints) {
        pts.forEach(([x, y], pi) => {
          ctx.beginPath();
          ctx.fillStyle = colors[si % colors.length];
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();

          if (showWavelength) {
            const wl = calculateDominantWavelength(...s.points[pi]);
            ctx.fillStyle = "black";
            ctx.fillText(
              wl === "Purple" ? "Purple" : `${wl}nm`,
              x + 8,
              y
            );
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
  }, [sets, showFill, showPoints, showBorders, showCentroids, showWavelength]);

  useEffect(() => {
    draw();
  }, [draw]);

  /* ================= EXPORT ================= */

  function downloadPNG() {
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = "cie_chromaticity.png";
    a.click();
  }

  /* ================= UI ================= */

  return (
    <div style={{ fontFamily: "Inter, Arial", padding: 20 }}>
      <h1>CIE 1931 Chromaticity Comparator</h1>

      {!authenticated ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              password ===
              (process.env.REACT_APP_CIE_APP_PASSWORD || "Rohit123")
            )
              setAuthenticated(true);
            else alert("Incorrect password");
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <button>Unlock</button>
        </form>
      ) : (
        <>
          <label>
            LED Sets:
            <input
              type="number"
              min={1}
              max={6}
              value={numSets}
              onChange={(e) => setNumSets(+e.target.value)}
            />
          </label>

          <div style={{ marginTop: 10 }}>
            <button onClick={downloadPNG}>Download PNG</button>
          </div>

          <canvas
            ref={canvasRef}
            width={900}
            height={720}
            style={{ marginTop: 20, border: "1px solid #ccc" }}
          />
        </>
      )}
    </div>
  );
}
