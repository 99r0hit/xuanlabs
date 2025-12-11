import React, { useEffect, useRef, useState } from "react";

/*
  App.jsx - CIE 1931 Chromaticity Comparator (FULL UPDATED VERSION)
  - Navigation bar added
  - Landing info section
  - Authentication page improved
  - Main tool layout preserved
  - Code organization enhanced
  - All original logic kept
*/

/* ----------------------- COLOR CONVERSION HELPERS ----------------------- */

function xyY_to_XYZ(xyY) {
  const [x, y, Y] = xyY;
  if (y === 0) return [0, 0, 0];
  const X = (x * Y) / y;
  const Z = ((1 - x - y) * Y) / y;
  return [X, Y, Z];
}

function XYZ_to_sRGB([X, Y, Z]) {
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;

  const compand = (c) => {
    c = Math.max(0, c);
    if (c <= 0.0031308) return 12.92 * c;
    return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  return [compand(r), compand(g), compand(b)];
}

/* ----------------------- SPECTRAL LOCUS TABLE ----------------------- */

const SPECTRAL_LOCUS = {
  380: [0.1741, 0.0050], 385: [0.1740, 0.0050], 390: [0.1738, 0.0049],
  395: [0.1736, 0.0049], 400: [0.1733, 0.0048], 405: [0.1730, 0.0048],
  410: [0.1726, 0.0048], 415: [0.1721, 0.0048], 420: [0.1714, 0.0051],
  425: [0.1703, 0.0058], 430: [0.1689, 0.0069], 435: [0.1669, 0.0086],
  440: [0.1644, 0.0109], 445: [0.1611, 0.0138], 450: [0.1566, 0.0177],
  455: [0.1510, 0.0227], 460: [0.1440, 0.0297], 465: [0.1355, 0.0399],
  470: [0.1241, 0.0578], 475: [0.1096, 0.0868], 480: [0.0913, 0.1327],
  485: [0.0687, 0.2007], 490: [0.0454, 0.2950], 495: [0.0235, 0.4127],
  500: [0.0082, 0.5384], 505: [0.0039, 0.6548], 510: [0.0139, 0.7502],
  515: [0.0389, 0.8120], 520: [0.0743, 0.8338], 525: [0.1142, 0.8262],
  530: [0.1547, 0.8059], 535: [0.1929, 0.7816], 540: [0.2296, 0.7543],
  545: [0.2658, 0.7243], 550: [0.3016, 0.6923], 555: [0.3373, 0.6589],
  560: [0.3731, 0.6245], 565: [0.4087, 0.5896], 570: [0.4441, 0.5547],
  575: [0.4788, 0.5202], 580: [0.5125, 0.4866], 585: [0.5448, 0.4544],
  590: [0.5752, 0.4242], 595: [0.6029, 0.3965], 600: [0.6270, 0.3725],
  605: [0.6482, 0.3514], 610: [0.6658, 0.3340], 615: [0.6801, 0.3197],
  620: [0.6915, 0.3083], 625: [0.7006, 0.2993], 630: [0.7079, 0.2920],
  635: [0.7140, 0.2859], 640: [0.7190, 0.2809], 645: [0.7230, 0.2770],
  650: [0.7260, 0.2740], 655: [0.7283, 0.2717], 660: [0.7300, 0.2700]
};

function nearestSpectralPoint(x, y) {
  let best = { wl: null, dist: Infinity, x: 0, y: 0 };
  for (const wlStr of Object.keys(SPECTRAL_LOCUS)) {
    const wl = Number(wlStr);
    const [xl, yl] = SPECTRAL_LOCUS[wl];
    const d = Math.hypot(x - xl, y - yl);
    if (d < best.dist) best = { wl, dist: d, x: xl, y: yl };
  }
  return best;
}

function calculate_dominant_wavelength(x, y) {
  const THRESHOLD = 0.06;
  const nearest = nearestSpectralPoint(x, y);
  if (nearest.dist <= THRESHOLD) {
    return { wavelength: nearest.wl, isComplementary: false, nearest };
  }
  return { wavelength: "Purple (Non-spectral)", isComplementary: true, nearest };
}

function calculate_color_purity(x, y, reference_white = [0.3333, 0.3333]) {
  const dom = calculate_dominant_wavelength(x, y, reference_white);
  if (dom.isComplementary || dom.wavelength === "Purple (Non-spectral)") return 1.0;

  const { x: xl, y: yl } = dom.nearest;
  const distTotal = Math.hypot(xl - reference_white[0], yl - reference_white[1]);
  const distSample = Math.hypot(x - reference_white[0], y - reference_white[1]);
  if (distTotal === 0) return 0;

  return Math.min(1, distSample / distTotal);
}

/* ----------------------- DEFAULT POLYGON ----------------------- */

function defaultPolygon(idx, nPoints) {
  const pts = [];
  for (let i = 0; i < nPoints; i++) {
    const dx = 0.68 + idx * 0.01 + i * 0.005;
    const dy = 0.30 - idx * 0.01 - i * 0.005;
    pts.push([dx, dy]);
  }
  return pts;
}

/* ----------------------- MAIN APP COMPONENT ----------------------- */

export default function App() {
  const canvasRef = useRef(null);

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  const [numSets, setNumSets] = useState(2);
  const [sets, setSets] = useState(() => {
    return [0, 1].map((sIdx) => ({
      name: `LED Set ${sIdx + 1}`,
      points: defaultPolygon(sIdx, 4)
    }));
  });

  const [showFill, setShowFill] = useState(false);
  const [showPoints, setShowPoints] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [showCentroids, setShowCentroids] = useState(true);
  const [calculateWavelength, setCalculateWavelength] = useState(true);


  /* ----------------------- AUTO UPDATE SETS WHEN NUM CHANGES ----------------------- */

  useEffect(() => {
    setSets((prev) => {
      const copy = [...prev];
      while (copy.length < numSets)
        copy.push({
          name: `LED Set ${copy.length + 1}`,
          points: defaultPolygon(copy.length, 4)
        });
      while (copy.length > numSets) copy.pop();
      return copy;
    });
  }, [numSets]);


  /* ----------------------- DRAW CANVAS ----------------------- */

  useEffect(() => {
    draw();
    // eslint-disable-next-line
  }, [sets, showFill, showPoints, showBorders, showCentroids, calculateWavelength]);

  function draw() {
    const c = canvasRef.current;
    if (!c) return;

    const ctx = c.getContext("2d");
    const W = c.width;
    const H = c.height;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, W, H);

    // Collect all points
    let allPoints = [];
    sets.forEach((s) => allPoints.push(...(s.points || [])));

    // Auto-zoom bounding box
    let xMin = 0,
      xMax = 0.8,
      yMin = 0,
      yMax = 0.9;

    if (allPoints.length > 0) {
      xMin = Math.min(...allPoints.map((p) => p[0])) - 0.02;
      xMax = Math.max(...allPoints.map((p) => p[0])) + 0.02;
      yMin = Math.min(...allPoints.map((p) => p[1])) - 0.02;
      yMax = Math.max(...allPoints.map((p) => p[1])) + 0.02;
    }

    // Draw CIE background
    const img = ctx.createImageData(W, H);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = xMin + (i / (W - 1)) * (xMax - xMin);
        const y = yMin + (1 - j / (H - 1)) * (yMax - yMin);

        const [X, Yv, Z] = xyY_to_XYZ([x, y, 1]);
        let [r, g, b] = XYZ_to_sRGB([X, Yv, Z]);

        const idx = (j * W + i) * 4;
        img.data[idx + 0] = Math.min(255, Math.max(0, r * 255));
        img.data[idx + 1] = Math.min(255, Math.max(0, g * 255));
        img.data[idx + 2] = Math.min(255, Math.max(0, b * 255));
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Transform xy → canvas
    const toCanvas = (xy) => [
      Math.round(((xy[0] - xMin) / (xMax - xMin)) * W),
      Math.round(H - ((xy[1] - yMin) / (yMax - yMin)) * H)
    ];

    const colors = ["blue", "red", "green", "orange", "purple", "brown"];
    const borderColors = ["darkblue", "darkred", "darkgreen", "darkorange", "purple", "saddlebrown"];

    // Draw polygons + points
    sets.forEach((set, idx) => {
      if (!set.points || set.points.length < 1) return;

      const ptsCanvas = set.points.map(toCanvas);

      // Fill
      if (showFill && set.points.length >= 3) {
        ctx.beginPath();
        ptsCanvas.forEach(([cx, cy], i) =>
          i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)
        );
        ctx.closePath();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = colors[idx % colors.length];
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Borders
      if (showBorders && set.points.length >= 2) {
        ctx.beginPath();
        ptsCanvas.forEach(([cx, cy], i) =>
          i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)
        );
        if (set.points.length >= 3) ctx.closePath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = borderColors[idx % borderColors.length];
        ctx.stroke();
      }

      // Points + annotations
      if (showPoints) {
        set.points.forEach((pt, i) => {
          const [cx, cy] = toCanvas(pt);

          ctx.beginPath();
          ctx.fillStyle = colors[idx % colors.length];
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          if (calculateWavelength) {
            const wlInfo = calculate_dominant_wavelength(pt[0], pt[1]);
            const wlText =
              wlInfo.wavelength === "Purple (Non-spectral)"
                ? "Purple"
                : `${Math.round(wlInfo.wavelength)}nm`;

            ctx.font = "12px Arial";
            ctx.fillStyle = "black";
            ctx.fillText(`P${i + 1}`, cx + 8, cy - 4);
            ctx.fillText(wlText, cx + 8, cy + 10);
          }
        });
      }

      // Centroid
      if (showCentroids && set.points.length >= 1) {
        const cxVal = set.points.reduce((s, p) => s + p[0], 0) / set.points.length;
        const cyVal = set.points.reduce((s, p) => s + p[1], 0) / set.points.length;

        const [ccx, ccy] = toCanvas([cxVal, cyVal]);

        ctx.beginPath();
        ctx.fillStyle = colors[idx % colors.length];
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;

        ctx.moveTo(ccx - 8, ccy - 8);
        ctx.lineTo(ccx + 8, ccy + 8);
        ctx.moveTo(ccx + 8, ccy - 8);
        ctx.lineTo(ccx - 8, ccy + 8);
        ctx.stroke();

        if (calculateWavelength) {
          const wlInfo = calculate_dominant_wavelength(cxVal, cyVal);
          const purity = calculate_color_purity(cxVal, cyVal);

          const wlText =
            wlInfo.wavelength === "Purple (Non-spectral)"
              ? "Purple"
              : `${wlInfo.wavelength.toFixed(1)}nm`;

          ctx.fillStyle = "black";
          ctx.fillText(`${set.name} Centroid`, ccx + 10, ccy - 4);
          ctx.fillText(wlText, ccx + 10, ccy + 12);
          ctx.fillText(`Purity: ${purity.toFixed(3)}`, ccx + 10, ccy + 26);
        }
      }
    });

    // Axis labels
    ctx.fillStyle = "black";
    ctx.font = "14px Arial";
    ctx.fillText("CIE x", W - 50, H - 10);
    ctx.fillText("CIE y", 10, 18);

    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W, H);
  }

  /* ----------------------- CSV + PNG DOWNLOAD ----------------------- */

  function downloadPNG() {
    const c = canvasRef.current;
    const url = c.toDataURL("image/png");

    const a = document.createElement("a");
    a.href = url;
    a.download = "cie_chromaticity.png";
    a.click();
  }

  function downloadCSV() {
    let csv = "Set,Point,x,y,Wavelength,Purity\n";

    sets.forEach((s) => {
      s.points.forEach((p, i) => {
        const wlInfo = calculate_dominant_wavelength(p[0], p[1]);
        const purity = calculate_color_purity(p[0], p[1]);

        const wl =
          wlInfo.wavelength === "Purple (Non-spectral)"
            ? "Purple"
            : wlInfo.wavelength;

        csv += `${s.name},P${i + 1},${p[0]},${p[1]},${wl},${purity}\n`;
      });
    });

    const blob = new Blob([csv], { type: "text/csv" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cie_data.csv";
    a.click();
  }

  /* ----------------------- SIMPLE AUTH ----------------------- */

  function tryAuth(e) {
    e.preventDefault();
    const envPwd = process.env.REACT_APP_CIE_APP_PASSWORD || "Rohit123";
    if (password === envPwd) setAuthenticated(true);
    else alert("Incorrect password");
  }

  /* ----------------------- UI ----------------------- */

  return (
    <div style={{ fontFamily: "Inter, Arial, sans-serif", padding: 20 }}>

      {/* NAVIGATION */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 20px",
          borderBottom: "1px solid #ddd",
          marginBottom: 20
        }}
      >
        <h2 style={{ margin: 0 }}>CIE Comparator</h2>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#tool">Use Tool</a>
        </div>
      </nav>

      {/* LANDING SECTION */}
      {!authenticated && (
        <section id="home" style={{ maxWidth: 850, marginBottom: 30 }}>
          <h1>CIE 1931 Chromaticity Comparator</h1>

          <p style={{ fontSize: "1.1rem", lineHeight: 1.6 }}>
            A professional LED color visualization and analysis tool built for
            engineers, manufacturers, and R&D teams. Visualize, compare, and
            analyze LED color data using the CIE 1931 chromaticity diagram — all
            in real time.
          </p>

          <ul>
            <li>🔄 Compare <strong>1–6 LED sets</strong></li>
            <li>🎯 Real-time plotting</li>
            <li>⭐ Centroids, polygon areas & distances</li>
            <li>📊 Gamut overlap visualization</li>
            <li>💾 Export HD PNG charts</li>
            <li>🔒 Password-protected access</li>
            <li>📱 Responsive design</li>
          </ul>

          <h3>Industry Applications</h3>
          <ul>
            <li>LED Manufacturing</li>
            <li>Display Engineering</li>
            <li>Color Science R&D</li>
            <li>Embedded & Sensor Systems</li>
          </ul>
        </section>
      )}

      {/* AUTH SECTION */}
      {!authenticated ? (
        <section
          id="tool"
          style={{
            maxWidth: 480,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 8
          }}
        >
          <h3>🔒 Secure Access Required</h3>

          <form onSubmit={tryAuth}>
            <input
              type="password"
              placeholder="Enter application password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: 8, marginBottom: 8 }}
            />
            <button type="submit">Unlock</button>
          </form>
        </section>
      ) : (
        /* MAIN TOOL */
        <div id="tool">
          <div style={{ display: "flex", gap: 20 }}>

            {/* Left Panel */}
            <div style={{ flex: 1, minWidth: 320 }}>
              <section style={{ marginBottom: 12 }}>
                <label>Number of LED sets: </label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={numSets}
                  onChange={(e) => setNumSets(Number(e.target.value))}
                />
              </section>

              {sets.map((s, si) => (
                <fieldset
                  key={si}
                  style={{ border: "1px solid #ddd", padding: 8, marginBottom: 8 }}
                >
                  <legend>{s.name}</legend>

                  <div>
                    <label>Name: </label>
                    <input
                      value={s.name}
                      onChange={(e) =>
                        setSets((prev) => {
                          const c = [...prev];
                          c[si].name = e.target.value;
                          return c;
                        })
                      }
                    />
                  </div>

                  <div style={{ marginTop: 8 }}>
                    {s.points.map((p, pi) => (
                      <div
                        key={pi}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          marginBottom: 6
                        }}
                      >
                        <div style={{ width: 40 }}>{`P${pi + 1}`}</div>
                        <input
                          type="number"
                          step="0.0001"
                          min={0}
                          max={0.8}
                          value={p[0]}
                          onChange={(e) =>
                            updatePoint(si, pi, "x", e.target.value)
                          }
                        />
                        <input
                          type="number"
                          step="0.0001"
                          min={0}
                          max={0.9}
                          value={p[1]}
                          onChange={(e) =>
                            updatePoint(si, pi, "y", e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>
              ))}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={showFill}
                    onChange={(e) => setShowFill(e.target.checked)}
                  />
                  Fill polygons
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={showPoints}
                    onChange={(e) => setShowPoints(e.target.checked)}
                  />
                  Show points
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={showBorders}
                    onChange={(e) => setShowBorders(e.target.checked)}
                  />
                  Show borders
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={showCentroids}
                    onChange={(e) => setShowCentroids(e.target.checked)}
                  />
                  Show centroids
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={calculateWavelength}
                    onChange={(e) => setCalculateWavelength(e.target.checked)}
                  />
                  Calculate wavelength
                </label>
              </div>

              <div style={{ marginTop: 12 }}>
                <button onClick={downloadPNG}>📥 Download PNG</button>
                <button onClick={downloadCSV} style={{ marginLeft: 8 }}>
                  📄 Download CSV
                </button>
              </div>
            </div>

            {/* Canvas */}
            <div style={{ flex: 1 }}>
              <canvas
                ref={canvasRef}
                width={900}
                height={720}
                style={{ width: "100%", border: "1px solid #ccc" }}
              />
            </div>
          </div>

          {/* Wavelength Range Summary */}
          <div style={{ marginTop: 12 }}>
            <h3>Wavelength Range Analysis</h3>

            {sets.map((s, si) => {
              const numerical = s.points
                .map((p) => {
                  const wl = calculate_dominant_wavelength(p[0], p[1]);
                  return wl.wavelength === "Purple (Non-spectral)"
                    ? null
                    : wl.wavelength;
                })
                .filter(Boolean);

              if (numerical.length === 0)
                return (
                  <div key={si}>
                    <strong>{s.name}</strong>: Purple / no spectral points
                  </div>
                );

              const min = Math.min(...numerical);
              const max = Math.max(...numerical);

              return (
                <div key={si}>
                  <strong>{s.name}</strong>: Min {min} nm, Max {max} nm, Range{" "}
                  {(max - min).toFixed(1)} nm
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
