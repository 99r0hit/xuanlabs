import React, { useEffect, useRef, useState, useCallback } from "react";
import styles from "./styles";

/*
  CIE 1931 Chromaticity Comparator
  --------------------------------
  • Auto-zoom canvas with DPR support
  • Dominant wavelength detection
  • Debounced redraw
  • Password-protected UI
*/

/* ================= COLOR HELPERS ================= */

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

  return [compand(Math.max(0, r)), compand(Math.max(0, g)), compand(Math.max(0, b))];
}

/* ================= SPECTRAL LOCUS ================= */

const SPECTRAL_LOCUS = {
  380: [0.1741, 0.0050], 450: [0.1566, 0.0177], 500: [0.0082, 0.5384],
  550: [0.3016, 0.6923], 600: [0.6270, 0.3725], 650: [0.7260, 0.2740],
  700: [0.7347, 0.2653], 780: [0.7347, 0.2653]
};

function nearestSpectralPoint(x, y) {
  let best = { wl: null, dist: Infinity };
  Object.entries(SPECTRAL_LOCUS).forEach(([wl, [xl, yl]]) => {
    const d = Math.hypot(x - xl, y - yl);
    if (d < best.dist) best = { wl: Number(wl), dist: d };
  });
  return best;
}

function dominantWavelength(x, y) {
  const p = nearestSpectralPoint(x, y);
  return p.dist < 0.06 ? `${p.wl} nm` : "Purple";
}

/* ================= UTIL ================= */

function defaultPolygon(idx, n = 4) {
  return Array.from({ length: n }, (_, i) => [
    0.68 + idx * 0.01 + i * 0.005,
    0.30 - idx * 0.01 - i * 0.005
  ]);
}

/* ================= MAIN APP ================= */

export default function App() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const timerRef = useRef(null);

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [numSets, setNumSets] = useState(2);
  const [sets, setSets] = useState([
    { name: "LED Set 1", points: defaultPolygon(0) },
    { name: "LED Set 2", points: defaultPolygon(1) }
  ]);

  /* ---------- Canvas Resize ---------- */
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      const box = containerRef.current;
      if (!c || !box) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = box.clientWidth * dpr;
      c.height = box.clientHeight * dpr;
      c.style.width = "100%";
      c.style.height = "100%";
      c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* ---------- Sync LED sets ---------- */
  useEffect(() => {
    setSets((prev) => {
      const copy = [...prev];
      while (copy.length < numSets) copy.push({ name: `LED Set ${copy.length + 1}`, points: defaultPolygon(copy.length) });
      while (copy.length > numSets) copy.pop();
      return copy;
    });
  }, [numSets]);

  /* ---------- Draw ---------- */
  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);

    sets.forEach((set, idx) => {
      ctx.fillStyle = ["red", "blue", "green"][idx % 3];
      set.points.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x * c.width, (1 - y) * c.height, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }, [sets]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(draw, 60);
    return () => clearTimeout(timerRef.current);
  }, [draw]);

  /* ---------- Auth ---------- */
  const tryAuth = (e) => {
    e.preventDefault();
    if (password === (process.env.REACT_APP_CIE_APP_PASSWORD || "Rohit123")) {
      setAuthenticated(true);
    } else {
      alert("Wrong password");
    }
  };

  /* ---------- Render ---------- */
  return (
    <div style={styles.container}>
      <h2>CIE 1931 Chromaticity Comparator</h2>

      {!authenticated ? (
        <form onSubmit={tryAuth} style={styles.fieldset}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.smallInput}
          />
          <button style={styles.primaryButton}>Unlock</button>
        </form>
      ) : (
        <div style={styles.grid}>
          <div style={styles.leftCol}>
            <label>LED Sets</label>
            <input
              type="number"
              min={1}
              max={6}
              value={numSets}
              onChange={(e) => setNumSets(Number(e.target.value))}
              style={styles.smallInput}
            />
            {sets.map((s, i) => (
              <div key={i}>{s.name}</div>
            ))}
          </div>

          <div style={styles.rightCol}>
            <div style={styles.canvasWrapper} ref={containerRef}>
              <canvas ref={canvasRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
