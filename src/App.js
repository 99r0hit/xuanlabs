import React, { useEffect, useRef, useState } from "react";

/* ================= COLOR SCIENCE ================= */

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

/* ================= SPECTRAL LOCUS ================= */

const SPECTRAL_LOCUS = {
  380: [0.1741, 0.005],
  420: [0.1714, 0.0051],
  460: [0.144, 0.0297],
  500: [0.0082, 0.5384],
  540: [0.2296, 0.7543],
  580: [0.5125, 0.4866],
  620: [0.6915, 0.3083],
  660: [0.73, 0.27]
};

function dominantWavelength(x, y) {
  let best = { wl: "Purple", d: Infinity };
  Object.entries(SPECTRAL_LOCUS).forEach(([wl, [sx, sy]]) => {
    const d = Math.hypot(x - sx, y - sy);
    if (d < best.d) best = { wl, d };
  });
  return best.d < 0.06 ? best.wl : "Purple";
}

/* ================= HELPERS ================= */

function defaultPolygon(i) {
  return Array.from({ length: 4 }, (_, k) => [
    0.65 + i * 0.02 + k * 0.005,
    0.32 - k * 0.01
  ]);
}

/* ================= APP ================= */

export default function App() {
  const canvasRef = useRef(null);

  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState("");

  const [numSets, setNumSets] = useState(2);
  const [sets, setSets] = useState([
    { name: "LED Set 1", points: defaultPolygon(0) },
    { name: "LED Set 2", points: defaultPolygon(1) }
  ]);

  /* ===== AUTO UPDATE SETS ===== */

  useEffect(() => {
    setSets((prev) => {
      const copy = [...prev];
      while (copy.length < numSets)
        copy.push({
          name: `LED Set ${copy.length + 1}`,
          points: defaultPolygon(copy.length)
        });
      return copy.slice(0, numSets);
    });
  }, [numSets]);

  /* ===== DRAW (INLINE – CI SAFE) ===== */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background
    const img = ctx.createImageData(W, H);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = (i / W) * 0.8;
        const y = 1 - j / H;
        const [X, Y, Z] = xyY_to_XYZ([x, y, 1]);
        const [r, g, b] = XYZ_to_sRGB([X, Y, Z]);
        const k = (j * W + i) * 4;
        img.data[k] = r;
        img.data[k + 1] = g;
        img.data[k + 2] = b;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    const toCanvas = ([x, y]) => [x / 0.8 * W, H - y * H];
    const colors = ["red", "blue", "green", "orange", "purple"];

    sets.forEach((s, si) => {
      const pts = s.points.map(toCanvas);

      ctx.strokeStyle = colors[si % colors.length];
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();

      pts.forEach(([x, y], pi) => {
        ctx.fillStyle = colors[si % colors.length];
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        const wl = dominantWavelength(...s.points[pi]);
        ctx.fillStyle = "black";
        ctx.fillText(
          wl === "Purple" ? "Purple" : `${wl}nm`,
          x + 6,
          y - 4
        );
      });
    });
  }, [sets]);

  /* ===== EXPORT ===== */

  function downloadPNG() {
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = "cie_chromaticity.png";
    a.click();
  }

  /* ===== UI ===== */

  return (
    <div style={{ fontFamily: "Inter, Arial", padding: 20 }}>
      <h1>Xuanlabs · CIE 1931 Chromaticity Tool</h1>

      {!auth ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              password ===
              (process.env.REACT_APP_CIE_APP_PASSWORD || "Rohit123")
            )
              setAuth(true);
            else alert("Wrong password");
          }}
        >
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
            height={650}
            style={{ marginTop: 20, border: "1px solid #ccc" }}
          />
        </>
      )}
    </div>
  );
}
