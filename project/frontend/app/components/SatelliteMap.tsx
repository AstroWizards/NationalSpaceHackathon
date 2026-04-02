"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface SatellitePosition {
  name: string;
  lat: number;
  lon: number;
}

interface SatelliteMapProps {
  sat1: { name: string; lat: number; lon: number };
  sat2: { name: string; lat: number; lon: number };
  realTimePositions?: boolean;
}

// World map data (simplified continent outlines)
const LAND_MASSES = [
  // North America
  { points: [[-168, 45], [-140, 70], [-100, 70], [-80, 60], [-70, 45], [-80, 25], [-100, 25], [-120, 30], [-130, 35], [-168, 45]] },
  // South America
  { points: [[-80, 10], [-35, 0], [-35, -5], [-50, -20], [-70, -55], [-75, -55], [-80, -25], [-80, 10]] },
  // Europe
  { points: [[10, 70], [40, 70], [50, 60], [40, 50], [30, 45], [10, 50], [-10, 60], [10, 70]] },
  // Africa
  { points: [[15, 50], [40, 35], [50, 10], [35, -35], [15, -35], [-10, 0], [-10, 20], [15, 50]] },
  // Asia
  { points: [[50, 70], [180, 70], [180, 45], [140, 30], [120, 25], [100, 30], [80, 40], [60, 50], [50, 60], [50, 70]] },
  // Australia
  { points: [[115, -10], [155, -10], [155, -40], [130, -40], [115, -10]] },
  // India
  { points: [[65, 35], [75, 30], [80, 10], [70, 10], [65, 35]] },
  // Greenland
  { points: [[-45, 80], [-20, 80], [-20, 60], [-45, 60], [-45, 80]] },
];

function latLonToXY(lat: number, lon: number, width: number, height: number, zoom: number, offsetX: number, offsetY: number): { x: number; y: number } {
  const mapWidth = width * zoom;
  const mapHeight = height * zoom * 0.5;

  let normalizedLon = ((lon + 180) % 360) - 180;
  const x = (normalizedLon / 360) * mapWidth + width / 2 + offsetX;

  const latRad = (lat * Math.PI) / 180;
  const y = height / 2 - (Math.sin(latRad) * mapHeight) + offsetY;

  return { x, y };
}

export default function SatelliteMap({ sat1, sat2, realTimePositions = false }: SatelliteMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [satPositions, setSatPositions] = useState({ sat1, sat2 });
  const [animationFrame, setAnimationFrame] = useState(0);

  // Update positions when props change
  useEffect(() => {
    setSatPositions({ sat1, sat2 });
  }, [sat1, sat2]);

  // Real-time animation
  useEffect(() => {
    if (!realTimePositions) return;

    const interval = setInterval(() => {
      setAnimationFrame((f) => f + 1);
      // Simulate orbital motion (simplified)
      setSatPositions((prev) => ({
        sat1: {
          ...prev.sat1,
          lat: prev.sat1.lat + 0.5,
          lon: (prev.sat1.lon + 1) % 360,
        },
        sat2: {
          ...prev.sat2,
          lat: prev.sat2.lat - 0.3,
          lon: (prev.sat2.lon + 0.8) % 360,
        },
      }));
    }, 100);

    return () => clearInterval(interval);
  }, [realTimePositions]);

  // Resize handler
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: Math.min(containerRef.current.clientWidth / 2, 400),
        });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = dimensions;

    // High DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = "#020205";
    ctx.fillRect(0, 0, width, height);

    // Background grid
    ctx.strokeStyle = "rgba(124, 58, 237, 0.12)";
    ctx.lineWidth = 1;

    const mapWidth = width * zoom;
    const mapHeight = height * zoom * 0.5;

    // Latitude lines
    for (let lat of [90, 60, 30, 0, -30, -60, -90]) {
      const pos = latLonToXY(lat, 0, width, height, zoom, offset.x, offset.y);
      ctx.beginPath();
      ctx.moveTo(0, pos.y);
      ctx.lineTo(width, pos.y);
      ctx.stroke();
    }

    // Longitude lines
    for (let lon of [-150, -90, -30, 30, 90, 150]) {
      const pos = latLonToXY(0, lon, width, height, zoom, offset.x, offset.y);
      ctx.beginPath();
      ctx.moveTo(pos.x, 0);
      ctx.lineTo(pos.x, height);
      ctx.stroke();
    }

    // Equator (highlighted)
    ctx.strokeStyle = "rgba(124, 58, 237, 0.35)";
    const eq = latLonToXY(0, 0, width, height, zoom, offset.x, offset.y);
    ctx.beginPath();
    ctx.moveTo(0, eq.y);
    ctx.lineTo(width, eq.y);
    ctx.stroke();

    // Prime meridian
    const pm = latLonToXY(0, 0, width, height, zoom, offset.x, offset.y);
    ctx.beginPath();
    ctx.moveTo(pm.x, 0);
    ctx.lineTo(pm.x, height);
    ctx.stroke();

    // Draw land masses
    ctx.fillStyle = "rgba(40, 35, 50, 0.8)";
    ctx.strokeStyle = "rgba(100, 90, 120, 0.4)";
    ctx.lineWidth = 1;

    LAND_MASSES.forEach((land) => {
      if (land.points.length < 2) return;
      const first = latLonToXY(land.points[0][1], land.points[0][0], width, height, zoom, offset.x, offset.y);
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      land.points.slice(1).forEach(([lon, lat]) => {
        const pos = latLonToXY(lat, lon, width, height, zoom, offset.x, offset.y);
        ctx.lineTo(pos.x, pos.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // Draw satellites
    const satellites = [
      { data: satPositions.sat1, color: "#a855f7" },
      { data: satPositions.sat2, color: "#fbbf24" },
    ];

    satellites.forEach(({ data, color }, index) => {
      const pos = latLonToXY(data.lat, data.lon, width, height, zoom, offset.x, offset.y);

      // Fade if outside bounds
      const outsideBounds = pos.x < -20 || pos.x > width + 20 || pos.y < -20 || pos.y > height + 20;
      ctx.globalAlpha = outsideBounds ? 0.2 : 1;

      // Glow
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 30);
      gradient.addColorStop(0, color + "80");
      gradient.addColorStop(0.5, color + "20");
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 30, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing ring
      ctx.strokeStyle = color + "60";
      ctx.lineWidth = 2;
      const pulse = (animationFrame * 0.05 + index * 1) % 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();

      // Label
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#e8e8e8";
      ctx.font = "bold 11px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(data.name, pos.x, pos.y - 18);

      // Coordinates
      ctx.fillStyle = "#888";
      ctx.font = "9px IBM Plex Mono, monospace";
      ctx.fillText(`${data.lat.toFixed(1)}°, ${data.lon.toFixed(1)}°`, pos.x, pos.y - 6);
    });

    // Draw line between satellites
    const pos1 = latLonToXY(satPositions.sat1.lat, satPositions.sat1.lon, width, height, zoom, offset.x, offset.y);
    const pos2 = latLonToXY(satPositions.sat2.lat, satPositions.sat2.lon, width, height, zoom, offset.x, offset.y);
    ctx.strokeStyle = "rgba(255, 80, 80, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pos1.x, pos1.y);
    ctx.lineTo(pos2.x, pos2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance label
    const midX = (pos1.x + pos2.x) / 2;
    const midY = (pos1.y + pos2.y) / 2;
    ctx.fillStyle = "rgba(255, 100, 100, 0.9)";
    ctx.font = "bold 10px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    // Calculate distance (simplified)
    ctx.fillText("CONJUNCTION", midX, midY);

    // Labels
    ctx.fillStyle = "rgba(120, 120, 150, 0.5)";
    ctx.font = "9px IBM Plex Mono, monospace";

    // Lon labels
    for (let lon of [-120, -60, 0, 60, 120]) {
      const pos = latLonToXY(-82, lon, width, height, zoom, offset.x, offset.y);
      ctx.textAlign = "center";
      ctx.fillText(`${lon}°E`, pos.x, height - 12);
    }

    // Lat labels
    for (let lat of [60, 30, 0, -30]) {
      const pos = latLonToXY(lat, 178, width, height, zoom, offset.x, offset.y);
      ctx.textAlign = "left";
      ctx.fillText(`${lat}°`, width - 28, pos.y + 3);
    }
  }, [dimensions, zoom, offset, satPositions, animationFrame]);

  // Draw on changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.5, Math.min(4, z * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="map-wrapper">
      <div className="map-header">
        <div className="map-title">
          <span>ORBITAL PROJECTION</span>
          {realTimePositions && <span className="live-badge">LIVE</span>}
        </div>
        <div className="controls">
          <button onClick={() => setZoom((z) => Math.min(4, z * 1.3))} className="ctrl-btn">+</button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.max(0.5, z * 0.7))} className="ctrl-btn">−</button>
          <button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} className="ctrl-btn reset">⟲</button>
        </div>
      </div>

      <div className="map-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="map-canvas"
        />
      </div>

      <div className="legend">
        <div className="legend-item">
          <span className="dot sat1" />
          <span>{satPositions.sat1.name}</span>
          <span className="coords">({satPositions.sat1.lat.toFixed(1)}°, {satPositions.sat1.lon.toFixed(1)}°)</span>
        </div>
        <div className="legend-item">
          <span className="dot sat2" />
          <span>{satPositions.sat2.name}</span>
          <span className="coords">({satPositions.sat2.lat.toFixed(1)}°, {satPositions.sat2.lon.toFixed(1)}°)</span>
        </div>
      </div>

      <style jsx>{`
        .map-wrapper {
          background: rgba(15, 15, 25, 0.95);
          border: 1px solid rgba(124, 58, 237, 0.25);
          border-radius: 8px;
          overflow: hidden;
        }

        .map-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.3);
          border-bottom: 1px solid rgba(124, 58, 237, 0.15);
        }

        .map-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 11px;
          color: #666;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .live-badge {
          background: #dc2626;
          color: #fff;
          padding: 2px 6px;
          font-size: 9px;
          border-radius: 3px;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ctrl-btn {
          width: 28px;
          height: 28px;
          background: rgba(40, 40, 55, 0.8);
          border: 1px solid rgba(124, 58, 237, 0.3);
          color: #aaa;
          font-size: 14px;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .ctrl-btn:hover {
          background: rgba(60, 50, 80, 0.8);
          border-color: rgba(124, 58, 237, 0.6);
          color: #fff;
        }

        .zoom-level {
          font-size: 11px;
          color: #888;
          min-width: 45px;
          text-align: center;
        }

        .map-container {
          width: 100%;
          aspect-ratio: 2 / 1;
          cursor: grab;
          position: relative;
        }

        .map-container:active {
          cursor: grabbing;
        }

        .map-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .legend {
          display: flex;
          justify-content: center;
          gap: 32px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.3);
          border-top: 1px solid rgba(124, 58, 237, 0.15);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: #aaa;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .dot.sat1 {
          background: #a855f7;
          box-shadow: 0 0 8px rgba(168, 85, 247, 0.6);
        }

        .dot.sat2 {
          background: #fbbf24;
          box-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
        }

        .coords {
          color: #666;
          font-size: 10px;
        }
      `}</style>
    </div>
  );
}