import React, { useEffect, useRef, useState } from "react";

/*
  XUANLABS — CIE 1931 Color Compliance & Comparison Tool
  Full Production Version
*/

/* ----------------------- COLOR CONVERSION ----------------------- */

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

  return [r, g, b].map((v) =>
    Math.min(255, Math.max(0, compand(Math.max(0, v)) * 255))
  );
}

/* ----------------------- SPECTRAL LOCUS ----------------------- */

const SPECTRAL_LOCUS = {
  380: [0.1741, 0.005], 400: [0.1733, 0.0048], 420: [0.1714, 0.0051],
  440: [0.1644, 0.0109], 460: [0.144, 0.0297], 480: [0.0913, 0.1327],
  500: [0.0082, 0.5384], 520: [0.0743, 0.8338], 540: [0.2296, 0.7543],
  560: [0.3731, 0.6245], 580: [0.5125, 0.4866], 600: [0.627, 0.3725],
  620: [0.6915, 0.3083], 640: [0.719, 0.2809], 660: [0.73, 0.27]
};

function dominantWavelength(x, y) {
  let best = { wl: "Purple", d: Infinity };
  Object.entries(SPECTRAL_LOCUS).forEach(([wl, [sx, sy]]) => {
    const d = Math.hypot(x - sx, y - sy);
    if (d < best.d) best = { wl, d };
  });
  return best.d < 0.06 ? `${best.wl} nm` : "Purple (Non-spectral)";
}

/* ----------------------- HELPERS ----------------------- */

const defaultPolygon = (i) =>
  Array.from({ length: 4 }, (_, k) => [0.65 + i * 0.02 + k * 0.005, 0.32 - k * 0.01]);

/* ----------------------- APP ----------------------- */

export default function App() {
  const canvasRef = useRef(null);
  const [authenticated, setAuth] = useState(false);
  const [password, setPassword] = useState("");

  const [numSets, setNumSets] = useState(2);
  const [sets, setSets] = useState([
    { name: "LED Batch A", points: defaultPolygon(0) },
    { name: "LED Batch B", points: defaultPolygon(1) }
  ]);

  const [showFill, setShowFill] = useState(true);
  const [showCentroids, setShowCentroids] = useState(true);

  /* ----------------------- AUTH ----------------------- */

  function login(e) {
    e.preventDefault();
    if (password === (process.env.REACT_APP_CIE_APP_PASSWORD || "Rohit123"))
      setAuth(true);
    else alert("Incorrect password");
  }

  /* ----------------------- AUTO SET UPDATE ----------------------- */

  useEffect(() => {
    setSets((prev) => {
      const c = [...prev];
      while (c.length < numSets)
        c.push({ name: `LED Batch ${c.length + 1}`, points: defaultPolygon(c.length) });
      return c.slice(0, numSets);
    });
  }, [numSets]);

  /* ----------------------- DRAW ----------------------- */

  useEffect(draw, [sets, showFill, showCentroids]);

  function draw() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width, H = c.height;

    ctx.clearRect(0, 0, W, H);

    // Background
    const img = ctx.createImageData(W, H);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const x = i / W * 0.8;
        const y = 1 - j / H;
        const [X, Y, Z] = xyY_to_XYZ([x, y, 1]);
        const [r, g, b] = XYZ_to_sRGB([X, Y, Z]);
        const idx = (j * W + i) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);

    const toCanvas = ([x, y]) => [x / 0.8 * W, H - y * H];
    const colors = ["red", "blue", "green", "orange", "purple"];

    sets.forEach((s, si) => {
      const pts = s.points.map(toCanvas);

      if (showFill) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = colors[si];
        ctx.beginPath();
        pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      pts.forEach(([x, y], pi) => {
        ctx.fillStyle = colors[si];
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(dominantWavelength(...s.points[pi]), x + 6, y - 6);
      });

      if (showCentroids) {
        const cx = s.points.reduce((a, p) => a + p[0], 0) / s.points.length;
        const cy = s.points.reduce((a, p) => a + p[1], 0) / s.points.length;
        const [x, y] = toCanvas([cx, cy]);
        ctx.strokeStyle = colors[si];
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
    a.download = "xuanlabs_cie_comparison.png";
    a.click();
  }

  /* ----------------------- UI ----------------------- */

  return (
    <div style={{ fontFamily: "Inter, sans-serif", padding: 20 }}>
      <h1>Xuanlabs · Color Compliance Tool</h1>

      {!authenticated ? (
        <>
          <p>
            Browser-based CIE 1931 chromaticity comparison tool for LED,
            display & optical engineers.
          </p>

          <form onSubmit={login} style={{ maxWidth: 360 }}>
            <input
              type="password"
              placeholder="Access password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
            <button style={{ marginTop: 10 }}>Unlock Tool</button>
          </form>
        </>
      ) : (
        <>
          <label>
            LED Sets:
            <input
              type="number"
              min={1}
              max={5}
              value={numSets}
              onChange={(e) => setNumSets(+e.target.value)}
            />
          </label>

          {sets.map((s, si) => (
            <fieldset key={si}>
              <legend>{s.name}</legend>
              {s.points.map((p, pi) => (
                <div key={pi}>
                  <input
                    type="number"
                    step="0.0001"
                    value={p[0]}
                    onChange={(e) => {
                      const c = [...sets];
                      c[si].points[pi][0] = +e.target.value;
                      setSets(c);
                    }}
                  />
                  <input
                    type="number"
                    step="0.0001"
                    value={p[1]}
                    onChange={(e) => {
                      const c = [...sets];
                      c[si].points[pi][1] = +e.target.value;
                      setSets(c);
                    }}
                  />
                </div>
              ))}
            </fieldset>
          ))}

          <button onClick={downloadPNG}>Download PNG</button>

          <canvas
            ref={canvasRef}
            width={900}
            height={650}
            style={{ marginTop: 20, border: "1px solid #ccc" }}
          />
        </>
      )}
    </div>
  );
}
