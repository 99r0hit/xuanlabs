/* ============================================================
   INLINE STYLES (used throughout JSX)
============================================================ */

const styles = {
  container: {
    fontFamily: "Inter, Arial, sans-serif",
    padding: 16,
    maxWidth: 1200,
    margin: "0 auto"
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap"
  },

  nav: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap"
  },

  navLink: {
    cursor: "pointer",
    padding: "6px 10px",
    borderRadius: 6,
    color: "#111",
    background: "transparent",
    border: "1px solid transparent"
  },

  infoCard: {
    background: "#ffffff",
    borderRadius: 8,
    padding: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    marginBottom: 12
  },

  grid: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap"
  },

  leftCol: {
    flex: "0 0 380px",
    minWidth: 280
  },

  rightCol: {
    flex: 1,
    minWidth: 300
  },

  fieldset: {
    border: "1px solid #e5e7eb",
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    background: "#ffffff"
  },

  smallInput: {
    width: 110,
    padding: 6,
    borderRadius: 6,
    border: "1px solid #d1d5db"
  },

  checkbox: {
    marginRight: 6
  },

  primaryButton: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer"
  },

  secondaryButton: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    cursor: "pointer"
  },

  canvasWrapper: {
    width: "100%",
    height: "60vh",
    borderRadius: 8,
    overflow: "hidden",
    background: "#ffffff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    border: "1px solid #e5e7eb"
  },

  footerNote: {
    marginTop: 12,
    color: "#374151"
  }
};
