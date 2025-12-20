import React, { useEffect, useRef, useState } from "react";

/*
  App.jsx - Optimized CIE 1931 Chromaticity Comparator
  ---------------------------------------------------
  • Auto-zoom canvas with DPR support
  • Dominant wavelength detection (spectral locus)
  • Debounced redraw for performance
  • Responsive UI with auth + navigation
  • Single-file, no external dependencies
*/

/* ============================================================
   COLOR CONVERSION HELPERS (xyY → XYZ → sRGB)
============================================================ */

function xyY_to_XYZ([x, y, Y]) {
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
    return c <= 0.0031308
      ? 12.92 * c
      : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  return [compand(r), compand(g), compand(b)];
}

/* ============================================================
   SPECTRAL LOCUS & WAVELENGTH CALCULATION
============================================================ */

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
  650: [0.7260, 0.2740], 655: [0.7283, 0.2717], 660: [0.7300, 0.2700],
  665: [0.7311, 0.2689], 670: [0.7320, 0.2680], 675: [0.7327, 0.2673],
  680: [0.7334, 0.2666], 685: [0.7340, 0.2660], 690: [0.7344, 0.2656],
  695: [0.7346, 0.2654], 700: [0.7347, 0.2653], 705: [0.7347, 0.2653],
  710: [0.7347, 0.2653], 715: [0.7347, 0.2653], 720: [0.7347, 0.2653],
  725: [0.7347, 0.2653], 730: [0.7347, 0.2653], 735: [0.7347, 0.2653],
  740: [0.7347, 0.2653], 745: [0.7347, 0.2653], 750: [0.7347, 0.2653],
  755: [0.7347, 0.2653], 760: [0.7347, 0.2653], 765: [0.7347, 0.2653],
  770: [0.7347, 0.2653], 775: [0.7347, 0.2653], 780: [0.7347, 0.2653]
};

function nearestSpectralPoint(x, y) {
  let best = { wl: null, dist: Infinity, x: 0, y: 0 };

  Object.entries(SPECTRAL_LOCUS).forEach(([wl, [xl, yl]]) => {
    const d = Math.hypot(x - xl, y - yl);
    if (d < best.dist) best = { wl: Number(wl), dist: d, x: xl, y: yl };
  });

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

function calculate_color_purity(x, y, white = [0.3333, 0.3333]) {
  const dom = calculate_dominant_wavelength(x, y);
  if (dom.isComplementary) return 1.0;

  const { x: xl, y: yl } = dom.nearest;
  const total = Math.hypot(xl - white[0], yl - white[1]);
  const sample = Math.hypot(x - white[0], y - white[1]);

  return total === 0 ? 0 : Math.min(1, sample / total);
}

/* ============================================================
   UTILITY HELPERS
============================================================ */

function defaultPolygon(idx, n) {
  return Array.from({ length: n }, (_, i) => [
    0.68 + idx * 0.01 + i * 0.005,
    0.30 - idx * 0.01 - i * 0.005
  ]);
}
/* -----------------------
   Main App component
   ----------------------- */
export default function App() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const drawTimerRef = useRef(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [numSets, setNumSets] = useState(2);
  const [sets, setSets] = useState(() =>
    [0, 1].map((sIdx) => ({ name: `LED Set ${sIdx + 1}`, points: defaultPolygon(sIdx, 4), collapsed: false }))
  );

  // UI toggles
  const [showFill, setShowFill] = useState(false);
  const [showPoints, setShowPoints] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [showCentroids, setShowCentroids] = useState(true);
  const [calculateWavelength, setCalculateWavelength] = useState(true);
  const [autoZoom, setAutoZoom] = useState(true);

  /* Resize canvas for DPR and container size */
  useEffect(() => {
    function resizeCanvas() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${Math.round(rect.width)}px`;
      canvas.style.height = `${Math.round(rect.height)}px`;
      const ctx = canvas.getContext("2d");
      // Important: set transform so drawing coordinates are in CSS pixels
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();
    const ro = new ResizeObserver(() => {
      resizeCanvas();
      debouncedDraw();
    });
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", resizeCanvas);
    return () => {
      try { ro.disconnect(); } catch (e) {}
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  /* Keep sets array in sync with numSets */
  useEffect(() => {
    setSets((prev) => {
      const copy = [...prev];
      while (copy.length < numSets) copy.push({ name: `LED Set ${copy.length + 1}`, points: defaultPolygon(copy.length, 4), collapsed: false });
      while (copy.length > numSets) copy.pop();
      return copy;
    });
  }, [numSets]);

  /* Debounced draw */
  function debouncedDraw(delay = 80) {
    if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
    drawTimerRef.current = setTimeout(() => {
      draw();
      drawTimerRef.current = null;
    }, delay);
  }
  useEffect(() => {
    debouncedDraw();
    return () => {
      if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, showFill, showPoints, showBorders, showCentroids, calculateWavelength, autoZoom]);

  /* Draw function (auto-zoom, background generation, plotting) */
    function draw() {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    // clear
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    // gather points
    let allPoints = [];
    sets.forEach((s) => allPoints.push(...(s.points || [])));

    // compute zoom window
    let xMin = 0, xMax = 0.8, yMin = 0, yMax = 0.9;
    if (autoZoom && allPoints.length > 0) {
      xMin = Math.min(...allPoints.map((p) => p[0]));
      xMax = Math.max(...allPoints.map((p) => p[0]));
      yMin = Math.min(...allPoints.map((p) => p[1]));
      yMax = Math.max(...allPoints.map((p) => p[1]));
      const padX = 0.02, padY = 0.02;
      xMin = Math.max(0, xMin - padX);
      xMax = Math.min(0.8, xMax + padX);
      yMin = Math.max(0, yMin - padY);
      yMax = Math.min(0.9, yMax + padY);
      if (Math.abs(xMax - xMin) < 1e-6) { xMin = Math.max(0, xMin - 0.01); xMax = Math.min(0.8, xMax + 0.01); }
      if (Math.abs(yMax - yMin) < 1e-6) { yMin = Math.max(0, yMin - 0.01); yMax = Math.min(0.9, yMax + 0.01); }
    } else {
      xMin = 0; xMax = 0.8; yMin = 0; yMax = 0.9;
    }

    // background generation (expensive) - pixel-sampled image
    const img = ctx.createImageData(W, H);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = xMin + (i / (W - 1)) * (xMax - xMin);
        const y = yMin + (1 - j / (H - 1)) * (yMax - yMin); // flip
        const [X, Yv, Z] = xyY_to_XYZ([x, y, 1]);
        let [r, g, b] = XYZ_to_sRGB([X, Yv, Z]);
        r = Math.max(0, Math.min(1, r));
        g = Math.max(0, Math.min(1, g));
        b = Math.max(0, Math.min(1, b));
        const idx = (j * W + i) * 4;
        img.data[idx + 0] = Math.round(r * 255);
        img.data[idx + 1] = Math.round(g * 255);
        img.data[idx + 2] = Math.round(b * 255);
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // mapping function from cie -> canvas
    const toCanvas = (xy) => [
      ((xy[0] - xMin) / (xMax - xMin)) * W,
      H - ((xy[1] - yMin) / (yMax - yMin)) * H
    ];

    const colors = ["#2563eb", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#a16207"];
    const borderColors = ["#1e40af", "#991b1b", "#047857", "#b45309", "#6d28d9", "#5a3810"];

    // draw sets
    sets.forEach((set, idx) => {
      if (!set.points || set.points.length === 0) return;
      const ptsCanvas = set.points.map(toCanvas);

      // fill polygon if requested
      if (showFill && set.points.length >= 3) {
        ctx.beginPath();
        ptsCanvas.forEach(([cx, cy], i) => (i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)));
        ctx.closePath();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = colors[idx % colors.length];
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // borders
      if (showBorders && set.points.length >= 2) {
        ctx.beginPath();
        ptsCanvas.forEach(([cx, cy], i) => (i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)));
        if (set.points.length >= 3) ctx.closePath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = borderColors[idx % borderColors.length];
        ctx.stroke();
      }

      // points
      if (showPoints) {
        set.points.forEach((pt, i) => {
          const [cx, cy] = toCanvas(pt);
          ctx.beginPath();
          ctx.fillStyle = colors[idx % colors.length];
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          if (calculateWavelength) {
            const wlInfo = calculate_dominant_wavelength(pt[0], pt[1]);
            const wlText = wlInfo.wavelength === "Purple (Non-spectral)" ? "Purple" : `${Math.round(wlInfo.wavelength)}nm`;
            ctx.font = "12px Inter, Arial";
            ctx.fillStyle = "#111";
            ctx.fillText(`P${i + 1}`, cx + 8, cy - 6);
            ctx.fillText(wlText, cx + 8, cy + 10);
          }
        });
      }

      // centroid
      if (showCentroids) {
        const cxVal = set.points.reduce((s, p) => s + p[0], 0) / set.points.length;
        const cyVal = set.points.reduce((s, p) => s + p[1], 0) / set.points.length;
        const [ccx, ccy] = toCanvas([cxVal, cyVal]);
        ctx.beginPath();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.moveTo(ccx - 8, ccy - 8);
        ctx.lineTo(ccx + 8, ccy + 8);
        ctx.moveTo(ccx + 8, ccy - 8);
        ctx.lineTo(ccx - 8, ccy + 8);
        ctx.stroke();

        if (calculateWavelength) {
          const wlInfo = calculate_dominant_wavelength(cxVal, cyVal);
          const purity = calculate_color_purity(cxVal, cyVal);
          const wlText = wlInfo.wavelength === "Purple (Non-spectral)" ? "Purple" : `${(wlInfo.wavelength).toFixed(1)}nm`;
          ctx.fillStyle = "#111";
          ctx.fillText(`${set.name} Centroid`, ccx + 10, ccy - 6);
          ctx.fillText(wlText, ccx + 10, ccy + 12);
          ctx.fillText(`Purity: ${purity.toFixed(3)}`, ccx + 10, ccy + 28);
        }
      }
    });

    // labels & border
    ctx.fillStyle = "#111";
    ctx.font = "14px Inter, Arial";
    ctx.fillText("CIE x", W - 50, H - 10);
    ctx.fillText("CIE y", 10, 18);
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W, H);
  }

  /* -----------------------
     UI helpers
     ----------------------- */
  function updatePoint(setIdx, ptIdx, axis, value) {
    setSets((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[setIdx].points[ptIdx][axis === "x" ? 0 : 1] = Number(value);
      return copy;
    });
  }
  function toggleCollapse(idx) {
    setSets((prev) => {
      const copy = [...prev];
      copy[idx].collapsed = !copy[idx].collapsed;
      return copy;
    });
  }
  function addPoint(setIdx) {
    setSets((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const last = copy[setIdx].points[copy[setIdx].points.length - 1];
      copy[setIdx].points.push([last[0] + 0.002, Math.max(0, last[1] - 0.002)]);
      return copy;
    });
  }
  function downloadPNG() {
    const c = canvasRef.current;
    if (!c) return;
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "cie_chromaticity.png";
    a.click();
  }
  function downloadCSV() {
    let csv = "Set,Point,x,y,Wavelength,Purity\n";
    sets.forEach((s, si) => {
      s.points.forEach((p, pi) => {
        const wlInfo = calculate_dominant_wavelength(p[0], p[1]);
        const purity = calculate_color_purity(p[0], p[1]);
        const wl = wlInfo.wavelength === "Purple (Non-spectral)" ? "Purple" : wlInfo.wavelength;
        csv += `${s.name},P${pi + 1},${p[0]},${p[1]},${wl},${purity}\n`;
      });
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cie_data.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* -----------------------
     Auth & navigation
     ----------------------- */
  function tryAuth(e) {
    e.preventDefault();
    const pwd = password || "";
    const envPwd = process.env.REACT_APP_CIE_APP_PASSWORD || "Rohit123";
    if (pwd === envPwd) setAuthenticated(true);
    else alert("Incorrect password");
  }
  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* -----------------------
     Render
     ----------------------- */
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h2 style={{ margin: 0 }}>CIE 1931 Chromaticity Comparator</h2>
          <div style={{ color: "#6b7280", fontSize: 13 }}>A professional LED color visualization and analysis tool</div>
        </div>

        <nav style={styles.nav} aria-label="Main navigation">
          <button style={styles.navLink} onClick={() => scrollToId("about")}>About</button>
          <button style={styles.navLink} onClick={() => scrollToId("features")}>Features</button>
          <button style={styles.navLink} onClick={() => scrollToId("app")}>App</button>
        </nav>
      </header>

      {/* Info Section (visible before auth and available after) */}
      <section id="about" style={styles.infoCard}>
  <h3 style={{ marginTop: 0 }}>
    Xuanlabs · Color Accuracy Validation Platform
  </h3>

  <p style={{ marginTop: 6, marginBottom: 10, color: "#374151", fontSize: 15 }}>
    <strong>
      Xuanlabs helps hardware teams visually validate and communicate color accuracy —
      in minutes, not hours.
    </strong>
  </p>

  <p style={{ marginBottom: 10, color: "#374151" }}>
    This tool is built for engineers who work with LEDs, displays, sensors, and optical
    systems and need a fast, visual way to compare chromaticity data, identify deviations,
    and explain results clearly to teams, customers, and management.
  </p>

  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
    <div>⚡ Validate LED & display color points instantly</div>
    <div>📐 Compare multiple bins, batches, or suppliers</div>
    <div>🎯 Identify wavelength spread & purity at a glance</div>
    <div>🧠 Replace manual spreadsheets & static plots</div>
    <div>📊 Generate visuals ready for reports & reviews</div>
  </div>

  <div style={{ marginBottom: 10 }}>
    <strong>Who is this for?</strong>
    <ul style={{ color: "#374151", marginTop: 6 }}>
      <li>LED & lighting manufacturers</li>
      <li>Display and optical system engineers</li>
      <li>Color science & validation teams</li>
      <li>R&D, quality, and application engineering teams</li>
    </ul>
  </div>

  <div style={{ color: "#374151" }}>
    <strong>Why teams use Xuanlabs:</strong>
    <ul style={{ marginTop: 6 }}>
      <li>Reduce color validation time from hours to minutes</li>
      <li>Make chromaticity data understandable to non-experts</li>
      <li>Spot issues early before production or shipment</li>
      <li>Create a single visual source of truth for color decisions</li>
    </ul>
  </div>
</section>


      {/* App / Auth */}
      <section id="app">
        {!authenticated ? (
          <div style={styles.fieldset}>
            <h3 style={{ marginTop: 0 }}>🔒 Secure Access Required</h3>
            <p style={{ margin: "6px 0 12px 0", color: "#374151" }}>
              Enter password to unlock the CIE Comparator. Contact your administrator if you need access.
            </p>

            <form onSubmit={tryAuth} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                placeholder="Enter application password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ padding: 8, borderRadius: 6, border: "1px solid #d1d5db", minWidth: 200 }}
                type="password"
              />
              <button type="submit" style={styles.primaryButton}>Unlock</button>
              <button type="button" style={styles.secondaryButton} onClick={() => { setPassword("Rohit123"); alert("Test password filled (dev)"); }}>
                Quick-fill (dev)
              </button>
            </form>

            <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>
              Tip: Set REACT_APP_CIE_APP_PASSWORD in your host environment for production.
            </div>
          </div>
        ) : (
          <div style={styles.grid}>
            {/* left controls */}
            <div style={styles.leftCol}>
              <div style={styles.fieldset}>
                <label style={{ display: "block", marginBottom: 8 }}><strong>General</strong></label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <label><input style={styles.checkbox} type="checkbox" checked={autoZoom} onChange={(e) => setAutoZoom(e.target.checked)} /> Auto-zoom</label>
                  <label><input style={styles.checkbox} type="checkbox" checked={showFill} onChange={(e) => setShowFill(e.target.checked)} /> Fill</label>
                  <label><input style={styles.checkbox} type="checkbox" checked={showPoints} onChange={(e) => setShowPoints(e.target.checked)} /> Points</label>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label>Number of LED sets:&nbsp;</label>
                  <input type="number" min={1} max={6} value={numSets} onChange={(e) => setNumSets(Number(e.target.value))} style={styles.smallInput} />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button style={styles.primaryButton} onClick={downloadPNG} type="button">📥 Download PNG</button>
                  <button style={styles.secondaryButton} onClick={downloadCSV} type="button">📄 Download CSV</button>
                </div>
              </div>

              {/* LED sets */}
              {sets.map((s, si) => (
                <fieldset key={si} style={styles.fieldset}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <legend style={{ fontSize: 14 }}>{s.name}</legend>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={styles.secondaryButton} onClick={() => toggleCollapse(si)}>{s.collapsed ? "Expand" : "Collapse"}</button>
                    </div>
                  </div>

                  {!s.collapsed && (
                    <>
                      <div style={{ marginTop: 6 }}>
                        <label style={{ display: "block", marginBottom: 6 }}>Name:</label>
                        <input
                          value={s.name}
                          onChange={(e) => setSets((prev) => {
                            const c = [...prev]; c[si].name = e.target.value; return c;
                          })}
                          style={{ padding: 8, borderRadius: 6, border: "1px solid #d1d5db", width: "100%" }}
                        />
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <label style={{ display: "block", marginBottom: 6 }}><strong>Points</strong></label>
                        {s.points.map((p, pi) => (
                          <div key={pi} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                            <div style={{ width: 42 }}>{`P${pi + 1}`}</div>
                            <input type="number" step="0.0001" min={0} max={0.8} value={p[0]} onChange={(e) => updatePoint(si, pi, "x", e.target.value)} style={styles.smallInput} />
                            <input type="number" step="0.0001" min={0} max={0.9} value={p[1]} onChange={(e) => updatePoint(si, pi, "y", e.target.value)} style={styles.smallInput} />
                          </div>
                        ))}
                        <div style={{ marginTop: 6 }}>
                          <button type="button" style={styles.secondaryButton} onClick={() => addPoint(si)}>Add point</button>
                        </div>
                      </div>
                    </>
                  )}
                </fieldset>
              ))}

              <div style={styles.fieldset}>
                <h4 style={{ marginTop: 0 }}>Quick tips</h4>
                <ul style={{ color: "#374151", marginTop: 6 }}>
                  <li>Toggle Points/Fill to declutter the view.</li>
                  <li>Use Auto-zoom to focus on the region of interest.</li>
                  <li>Download PNG for reports or CSV for analysis.</li>
                </ul>
              </div>
            </div>

            {/* right: canvas + analysis */}
            <div style={styles.rightCol}>
              <div style={styles.canvasWrapper} ref={containerRef}>
                <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
              </div>

              <div style={styles.footerNote}>
                <strong>Wavelength Range Analysis</strong>
                <div>
                  {sets.map((s, si) => {
                    const numerical = s.points.map((p) => {
                      const wl = calculate_dominant_wavelength(p[0], p[1]);
                      return wl.wavelength === "Purple (Non-spectral)" ? null : wl.wavelength;
                    }).filter(Boolean);
                    if (numerical.length === 0) return <div key={si}><strong>{s.name}</strong>: Purple / non-spectral</div>;
                    const min = Math.min(...numerical);
                    const max = Math.max(...numerical);
                    return <div key={si}><strong>{s.name}</strong>: Min {min} nm, Max {max} nm, Range {(max - min).toFixed(1)} nm</div>;
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
