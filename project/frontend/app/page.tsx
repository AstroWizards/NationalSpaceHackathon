"use client";

import { useState, FormEvent, useEffect } from "react";
import SatelliteMap from "./components/SatelliteMap";

interface DebrisPrediction {
  fragment_count: number;
  debris_spread_km: number;
}

interface Positions {
  satellite1: { lat: number; lon: number };
  satellite2: { lat: number; lon: number };
}

interface ConjunctionResult {
  satellite1: string;
  satellite2: string;
  tca: string;
  miss_distance_km: number;
  collision_probability: number;
  relative_velocity_km_s: number;
  debris_prediction: DebrisPrediction;
  positions?: Positions;
}

export default function ConjunctionPage() {
  const [sat1Name, setSat1Name] = useState("");
  const [sat1Line1, setSat1Line1] = useState("");
  const [sat1Line2, setSat1Line2] = useState("");
  const [sat2Name, setSat2Name] = useState("");
  const [sat2Line1, setSat2Line1] = useState("");
  const [sat2Line2, setSat2Line2] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConjunctionResult | null>(null);
  const [realTime, setRealTime] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Initialize sample data on client only
  useEffect(() => {
    setSat1Name("COSMOS 2542");
    setSat1Line1("1 44344U 19006A   23250.91271319  .00000000  00000-0  00000-0 0    01");
    setSat1Line2("2 44344  74.0045 352.6823 0058532 194.7987 285.7218 14.91828728751311");
    setSat2Name("STARLINK-1691");
    setSat2Line1("1 56349U 23053A   23250.87654321  .00000235  00000-0  00019-8 0    09");
    setSat2Line2("2 56349  53.2162 305.4517 0009823  42.1234 318.7654 15.09999999876543");
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setResult(null);

    try {
      const response = await fetch("http://localhost:8000/api/conjunction/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          satellite1: { name: sat1Name, line1: sat1Line1, line2: sat1Line2 },
          satellite2: { name: sat2Name, line1: sat2Line1, line2: sat2Line2 },
        }),
      });

      if (!response.ok) throw new Error("Analysis failed");

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="stars" />
      <div className="nebula" />

      <header className="header">
        <div className="logo-mark">◆</div>
        <h1 className="title">
          <span className="title-main">ORBITAL</span>
          <span className="title-sub">CONJUNCTION ANALYSIS</span>
        </h1>
        <div className="header-line" />
      </header>

      <form onSubmit={handleSubmit} className="form">
        <div className="satellite-grid">
          <div className="satellite-panel">
            <div className="panel-header">
              <span className="panel-number">01</span>
              <input
                type="text"
                value={sat1Name}
                onChange={(e) => setSat1Name(e.target.value)}
                className="sat-name-input"
                placeholder="SATELLITE NAME"
              />
            </div>
            <div className="tle-inputs">
              <div className="input-group">
                <label>TLE Line 1</label>
                <textarea
                  value={sat1Line1}
                  onChange={(e) => setSat1Line1(e.target.value)}
                  className="tle-textarea"
                  rows={1}
                  placeholder="1 00000U 00000A   00000.00000000  .00000000  00000-0  00000-0 0    01"
                />
              </div>
              <div className="input-group">
                <label>TLE Line 2</label>
                <textarea
                  value={sat1Line2}
                  onChange={(e) => setSat1Line2(e.target.value)}
                  className="tle-textarea"
                  rows={1}
                  placeholder="2 00000  00.0000 000.0000 0000000 00.0000 00.0000 00.00000000"
                />
              </div>
            </div>
          </div>

          <div className="conjunction-indicator">
            <span className="conjunction-icon">⚡</span>
          </div>

          <div className="satellite-panel">
            <div className="panel-header">
              <span className="panel-number">02</span>
              <input
                type="text"
                value={sat2Name}
                onChange={(e) => setSat2Name(e.target.value)}
                className="sat-name-input"
                placeholder="SATELLITE NAME"
              />
            </div>
            <div className="tle-inputs">
              <div className="input-group">
                <label>TLE Line 1</label>
                <textarea
                  value={sat2Line1}
                  onChange={(e) => setSat2Line1(e.target.value)}
                  className="tle-textarea"
                  rows={1}
                  placeholder="1 00000U 00000A   00000.00000000  .00000000  00000-0  00000-0 0    01"
                />
              </div>
              <div className="input-group">
                <label>TLE Line 2</label>
                <textarea
                  value={sat2Line2}
                  onChange={(e) => setSat2Line2(e.target.value)}
                  className="tle-textarea"
                  rows={1}
                  placeholder="2 00000  00.0000 000.0000 0000000 00.0000 00.0000 00.00000000"
                />
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="analyze-btn" disabled={loading}>
          {loading ? (
            <span className="loading">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </span>
          ) : (
            "◆ ANALYZE CONJUNCTION"
          )}
        </button>
      </form>

      {errorMsg && (
        <div className="error-panel">
          <span className="error-icon">!</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {result && (
        <div className="results">
          <div className="results-header">
            <span className="results-label">ANALYSIS RESULTS</span>
            <div className="header-controls">
              <button
                className={`toggle-btn ${realTime ? "active" : ""}`}
                onClick={() => setRealTime(!realTime)}
              >
                {realTime ? "◉ LIVE" : "○ LIVE"}
              </button>
              <span className="results-badge">
                {result.collision_probability > 0.1 ? "⚠ HIGH RISK" : result.collision_probability > 0.01 ? "◐ MODERATE" : "✓ LOW"}
              </span>
            </div>
          </div>

          <div className="results-grid">
            <div className="result-card primary">
              <span className="result-label">Time of Closest Approach</span>
              <span className="result-value">{result.tca}</span>
            </div>
            <div className="result-card primary">
              <span className="result-label">Miss Distance</span>
              <span className="result-value large">{result.miss_distance_km.toFixed(3)} <small>km</small></span>
            </div>
            <div className="result-card">
              <span className="result-label">Collision Probability</span>
              <span className="result-value">{result.collision_probability.toExponential(3)}</span>
            </div>
            <div className="result-card">
              <span className="result-label">Relative Velocity</span>
              <span className="result-value">{result.relative_velocity_km_s.toFixed(3)} <small>km/s</small></span>
            </div>
          </div>

          <div className="debris-section">
            <div className="debris-header">
              <span className="debris-icon">☄</span>
              <span>DEBRIS PREDICTION (Post-Collision)</span>
            </div>
            <div className="debris-grid">
              <div className="debris-card">
                <span className="debris-value">{result.debris_prediction.fragment_count}</span>
                <span className="debris-label">Fragment Count</span>
              </div>
              <div className="debris-card">
                <span className="debris-value">{result.debris_prediction.debris_spread_km.toFixed(2)}</span>
                <span className="debris-label">Spread (km)</span>
              </div>
            </div>
          </div>

          {result.positions && (
            <SatelliteMap
              sat1={{
                name: result.satellite1,
                lat: result.positions.satellite1.lat,
                lon: result.positions.satellite1.lon,
              }}
              sat2={{
                name: result.satellite2,
                lat: result.positions.satellite2.lat,
                lon: result.positions.satellite2.lon,
              }}
              realTimePositions={realTime}
            />
          )}
        </div>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #0a0a0f;
          color: #e8e8e8;
          font-family: "IBM Plex Mono", "SF Mono", monospace;
          padding: 2rem;
          position: relative;
          overflow: hidden;
        }

        .stars {
          position: fixed;
          inset: 0;
          background-image:
            radial-gradient(1px 1px at 20px 30px, #fff, transparent),
            radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 90px 40px, #fff, transparent),
            radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1.5px 1.5px at 160px 120px, #fff, transparent),
            radial-gradient(1px 1px at 200px 50px, #fff, transparent),
            radial-gradient(1px 1px at 250px 160px, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 300px 90px, #fff, transparent);
          background-size: 350px 200px;
          animation: twinkle 8s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        .nebula {
          position: fixed;
          top: -50%;
          right: -30%;
          width: 80%;
          height: 100%;
          background: radial-gradient(ellipse at center, rgba(120, 40, 160, 0.15) 0%, transparent 70%);
          pointer-events: none;
        }

        .header {
          text-align: center;
          margin-bottom: 3rem;
          position: relative;
        }

        .logo-mark {
          font-size: 2rem;
          color: #7c3aed;
          margin-bottom: 1rem;
          animation: pulse 3s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        .title {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .title-main {
          font-size: 2.5rem;
          font-weight: 300;
          letter-spacing: 0.5em;
          color: #fff;
        }

        .title-sub {
          font-size: 0.875rem;
          font-weight: 400;
          letter-spacing: 0.3em;
          color: #7c3aed;
          text-transform: uppercase;
        }

        .header-line {
          width: 100px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #7c3aed, transparent);
          margin: 1.5rem auto 0;
        }

        .form {
          max-width: 1000px;
          margin: 0 auto;
        }

        .satellite-grid {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 1.5rem;
          align-items: start;
        }

        .satellite-panel {
          background: rgba(20, 20, 30, 0.8);
          border: 1px solid rgba(124, 58, 237, 0.3);
          padding: 1.5rem;
          position: relative;
        }

        .satellite-panel::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #7c3aed, transparent);
        }

        .panel-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .panel-number {
          font-size: 0.75rem;
          color: #7c3aed;
          font-weight: 600;
        }

        .sat-name-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #fff;
          font-family: inherit;
          font-size: 1rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          outline: none;
        }

        .sat-name-input::placeholder {
          color: #555;
        }

        .tle-inputs {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .input-group label {
          font-size: 0.65rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.15em;
        }

        .tle-textarea {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #aaa;
          font-family: "IBM Plex Mono", "SF Mono", monospace;
          font-size: 0.7rem;
          padding: 0.75rem;
          resize: none;
          outline: none;
          transition: border-color 0.2s, color 0.2s;
          letter-spacing: 0.05em;
        }

        .tle-textarea:focus {
          border-color: #7c3aed;
          color: #e8e8e8;
        }

        .conjunction-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          padding-top: 4rem;
        }

        .conjunction-icon {
          font-size: 1.5rem;
          color: #fbbf24;
          animation: blink 1.5s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .analyze-btn {
          display: block;
          width: 100%;
          max-width: 400px;
          margin: 2.5rem auto 0;
          padding: 1rem 2rem;
          background: transparent;
          border: 1px solid #7c3aed;
          color: #7c3aed;
          font-family: inherit;
          font-size: 0.8rem;
          font-weight: 500;
          letter-spacing: 0.2em;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
        }

        .analyze-btn::before {
          content: "";
          position: absolute;
          inset: 0;
          background: #7c3aed;
          transform: translateX(-100%);
          transition: transform 0.3s;
          z-index: -1;
        }

        .analyze-btn:hover:not(:disabled) {
          color: #fff;
        }

        .analyze-btn:hover:not(:disabled)::before {
          transform: translateX(0);
        }

        .analyze-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading {
          display: flex;
          gap: 0.4rem;
          justify-content: center;
        }

        .loading .dot {
          width: 6px;
          height: 6px;
          background: #7c3aed;
          border-radius: 50%;
          animation: bounce 1.4s ease-in-out infinite;
        }

        .loading .dot:nth-child(2) { animation-delay: 0.2s; }
        .loading .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }

        .error-panel {
          max-width: 400px;
          margin: 2rem auto 0;
          padding: 1rem 1.5rem;
          background: rgba(220, 38, 38, 0.1);
          border: 1px solid rgba(220, 38, 38, 0.4);
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .error-icon {
          color: #dc2626;
          font-weight: bold;
        }

        .results {
          max-width: 1000px;
          margin: 3rem auto 0;
          animation: slideUp 0.5s ease-out;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .results-label {
          font-size: 0.7rem;
          color: #666;
          letter-spacing: 0.2em;
        }

        .header-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .toggle-btn {
          font-size: 0.7rem;
          padding: 0.4rem 0.8rem;
          background: transparent;
          border: 1px solid rgba(124, 58, 237, 0.4);
          color: #888;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .toggle-btn:hover {
          border-color: rgba(124, 58, 237, 0.7);
          color: #aaa;
        }

        .toggle-btn.active {
          background: rgba(220, 38, 38, 0.15);
          border-color: rgba(220, 38, 38, 0.5);
          color: #ef4444;
        }

        .results-badge {
          font-size: 0.7rem;
          padding: 0.4rem 0.8rem;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
          letter-spacing: 0.1em;
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .result-card {
          background: rgba(20, 20, 30, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .result-card.primary {
          border-color: rgba(124, 58, 237, 0.4);
        }

        .result-label {
          font-size: 0.65rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .result-value {
          font-size: 1.25rem;
          color: #fff;
          font-weight: 500;
        }

        .result-value large {
          font-size: 1.5rem;
        }

        .result-value small {
          font-size: 0.7rem;
          color: #666;
          font-weight: 400;
        }

        .debris-section {
          background: rgba(20, 20, 30, 0.8);
          border: 1px solid rgba(220, 38, 38, 0.3);
          padding: 1.5rem;
        }

        .debris-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.7rem;
          color: #dc2626;
          letter-spacing: 0.15em;
          margin-bottom: 1.25rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(220, 38, 38, 0.2);
        }

        .debris-icon {
          font-size: 1.25rem;
        }

        .debris-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .debris-card {
          background: rgba(0, 0, 0, 0.3);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .debris-value {
          font-size: 1.75rem;
          color: #dc2626;
          font-weight: 500;
        }

        .debris-label {
          font-size: 0.65rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        @media (max-width: 768px) {
          .page { padding: 1rem; }
          .title-main { font-size: 1.5rem; letter-spacing: 0.3em; }
          .satellite-grid { grid-template-columns: 1fr; }
          .conjunction-indicator { padding: 1rem 0; }
          .results-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&display=swap');
      `}</style>
    </main>
  );
}