import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Volume2,
  Play,
  Trash2,
  Sliders,
  ShieldCheck,
  Radio,
  Eye,
  MessageSquare,
  RotateCcw,
  Sparkles,
  MousePointerClick
} from 'lucide-react';
import { SIMULATED_SOUND_PRESETS, SimulatedSoundPreset } from '../data/addonFiles';

export interface ActiveChunkHighlight {
  key: string;
  chunkX: number;
  chunkZ: number;
  soundX: number;
  soundY: number;
  soundZ: number;
  shortSoundName: string;
  packetType: string;
  distance: number;
  timestampMs: number;
}

export interface ChatLogEntry {
  id: string;
  time: string;
  soundName: string;
  chunkX: number;
  chunkZ: number;
  distance: number;
  ignored?: boolean;
  reason?: string;
}

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const SoundDebugSimulator: React.FC = () => {
  // Module state (mirrors SoundDebug.java settings)
  const [moduleActive, setModuleActive] = useState<boolean>(true);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(true);

  const [range, setRange] = useState<number>(256.0);
  const [tall, setTall] = useState<number>(150);
  const [displayDuration, setDisplayDuration] = useState<number>(5);
  const [testFlash, setTestFlash] = useState<boolean>(false);
  const [chatFeedback, setChatFeedback] = useState<boolean>(true);
  const [catchGlobalEvents, setCatchGlobalEvents] = useState<boolean>(true);

  const [shapeMode, setShapeMode] = useState<'Both' | 'Lines' | 'Sides'>('Both');
  const [fillColor, setFillColor] = useState<RGBA>({ r: 0, g: 255, b: 0, a: 75 });
  const [lineColor, setLineColor] = useState<RGBA>({ r: 0, g: 255, b: 0, a: 255 });
  const [fadeOut, setFadeOut] = useState<boolean>(true);
  const [renderInnerBeam, setRenderInnerBeam] = useState<boolean>(true);
  const [renderNametag, setRenderNametag] = useState<boolean>(true);
  const [nametagScale, setNametagScale] = useState<number>(1.15);

  // Camera orbit state for 3D preview canvas
  const [cameraYaw, setCameraYaw] = useState<number>(0.68);
  const [cameraPitch, setCameraPitch] = useState<number>(0.48);
  const [cameraZoom, setCameraZoom] = useState<number>(1.0);
  const isDraggingRef = useRef<boolean>(false);
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Active highlights & chat logs
  const [highlights, setHighlights] = useState<ActiveChunkHighlight[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLogEntry[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const pushChatLog = useCallback(
    (entry: Omit<ChatLogEntry, 'id' | 'time'>) => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      setChatLogs((prev) => [
        {
          ...entry,
          id: `${Date.now()}-${Math.random()}`,
          time: timeStr
        },
        ...prev.slice(0, 14)
      ]);
    },
    []
  );

  const triggerDetectedSound = useCallback(
    (
      soundId: string,
      packetType: string,
      worldX: number,
      worldY: number,
      worldZ: number,
      distance: number
    ) => {
      if (!moduleActive) return;

      const shortName = soundId.startsWith('minecraft:')
        ? soundId.slice('minecraft:'.length)
        : soundId;
      const chunkX = Math.floor(worldX) >> 4;
      const chunkZ = Math.floor(worldZ) >> 4;

      if (packetType === 'WorldEventS2CPacket' && !catchGlobalEvents) {
        pushChatLog({
          soundName: shortName,
          chunkX,
          chunkZ,
          distance,
          ignored: true,
          reason: 'Filtered (catch-global-events = false)'
        });
        return;
      }

      if (distance > range) {
        pushChatLog({
          soundName: shortName,
          chunkX,
          chunkZ,
          distance,
          ignored: true,
          reason: `Out of range (${distance.toFixed(1)}m > ${range.toFixed(1)}m)`
        });
        return;
      }

      const key = `${chunkX},${chunkZ}`;
      const newHighlight: ActiveChunkHighlight = {
        key,
        chunkX,
        chunkZ,
        soundX: worldX,
        soundY: worldY,
        soundZ: worldZ,
        shortSoundName: shortName,
        packetType,
        distance,
        timestampMs: performance.now()
      };

      setHighlights((prev) => {
        const filtered = prev.filter((h) => h.key !== key);
        return [...filtered, newHighlight];
      });

      if (chatFeedback) {
        pushChatLog({
          soundName: shortName,
          chunkX,
          chunkZ,
          distance
        });
      }
    },
    [moduleActive, catchGlobalEvents, range, chatFeedback, pushChatLog]
  );

  // Trigger test sound directly underneath the player (Chunk [0, 0], dist 0.0m)
  const triggerTestUnderPlayer = useCallback(() => {
    setTestFlash(true);
    triggerDetectedSound(
      'minecraft:block.note_block.pling (TEST)',
      'PlaySoundS2CPacket',
      8.0,
      64.0,
      8.0,
      0.0
    );
    setTimeout(() => {
      setTestFlash(false);
    }, 260);
  }, [triggerDetectedSound]);

  // Spawn an initial demo highlight on mount so the user immediately sees the 3D chunk & tall pillar
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerTestUnderPlayer();
      triggerDetectedSound(
        'minecraft:block.ender_chest.open',
        'PlaySoundS2CPacket',
        40.0,
        64.0,
        -22.0,
        45.6
      );
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inject a preset S2C sound packet
  const handleInjectPreset = (preset: SimulatedSoundPreset) => {
    // Pick a deterministic-feeling random angle around the player
    const angle = Math.random() * Math.PI * 2;
    const dist = preset.defaultDistance;
    // Map long distances into visible chunk ring on the 3D stage while preserving real distance math
    const visualRadius = Math.min(dist, 92);
    const wx = 8 + Math.cos(angle) * visualRadius;
    const wz = 8 + Math.sin(angle) * visualRadius;
    triggerDetectedSound(preset.soundId, preset.packetType, wx, 64.0, wz, dist);
  };

  // Animation loop for 3D Viewport Canvas
  useEffect(() => {
    let animationFrameId: number;

    const renderFrame = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const width = rect.width;
      const height = rect.height;

      // Sky / Night World Gradient Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#070b14');
      bgGrad.addColorStop(0.55, '#0d1526');
      bgGrad.addColorStop(1, '#09101d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 3D to 2D isometric/perspective projection helper centered around player at (8, 64, 8)
      const centerX = width * 0.5;
      const centerY = height * 0.68;
      const scale = 3.1 * cameraZoom;
      const cosYaw = Math.cos(cameraYaw);
      const sinYaw = Math.sin(cameraYaw);
      const cosPitch = Math.cos(cameraPitch);
      const sinPitch = Math.sin(cameraPitch);

      const project3D = (wx: number, wy: number, wz: number) => {
        // Relative to player center (8, 64, 8)
        const rx = wx - 8;
        const ry = wy - 64;
        const rz = wz - 8;

        const rotX = rx * cosYaw - rz * sinYaw;
        const rotZ = rx * sinYaw + rz * cosYaw;

        const screenX = centerX + rotX * scale;
        const screenY = centerY + (rotZ * sinPitch - ry * cosPitch) * scale;
        const depth = rotZ * cosPitch + ry * sinPitch;
        return { x: screenX, y: screenY, depth };
      };

      // Draw surrounding 16x16 chunk grid (-4 to +4 chunks)
      ctx.lineWidth = 1;
      for (let cx = -4; cx <= 4; cx++) {
        for (let cz = -4; cz <= 4; cz++) {
          const x0 = cx * 16;
          const z0 = cz * 16;
          const x1 = x0 + 16;
          const z1 = z0 + 16;

          const p0 = project3D(x0, 64, z0);
          const p1 = project3D(x1, 64, z0);
          const p2 = project3D(x1, 64, z1);
          const p3 = project3D(x0, 64, z1);

          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();

          if (cx === 0 && cz === 0) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          } else {
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
          }
          ctx.stroke();
        }
      }

      // Draw Player Marker at (8, 64, 8) inside Chunk [0, 0]
      const playerBase = project3D(8, 64, 8);
      const playerHead = project3D(8, 66.2, 8);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(playerBase.x, playerBase.y);
      ctx.lineTo(playerHead.x, playerHead.y);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(playerHead.x, playerHead.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#7dd3fc';
      ctx.textAlign = 'center';
      ctx.fillText('mc.player [Chunk 0, 0]', playerHead.x, playerHead.y - 9);

      // Filter and render active SoundDebug chunk highlights
      const maxAgeMs = displayDuration * 1000;
      const validHighlights: ActiveChunkHighlight[] = [];

      if (moduleActive) {
        for (const entry of highlights) {
          const age = now - entry.timestampMs;
          if (age >= maxAgeMs) continue;
          validHighlights.push(entry);

          const lifeFactor = fadeOut
            ? Math.max(0.06, Math.min(1.0, 1.0 - age / maxAgeMs))
            : 1.0;

          const fillAlpha = ((fillColor.a / 255) * lifeFactor).toFixed(3);
          const lineAlpha = ((lineColor.a / 255) * lifeFactor).toFixed(3);

          const fillRgba = `rgba(${fillColor.r}, ${fillColor.g}, ${fillColor.b}, ${fillAlpha})`;
          const lineRgba = `rgba(${lineColor.r}, ${lineColor.g}, ${lineColor.b}, ${lineAlpha})`;

          const minX = entry.chunkX * 16;
          const minZ = entry.chunkZ * 16;
          const maxX = minX + 16;
          const maxZ = minZ + 16;
          const baseY = entry.soundY;
          // Scale visual height smoothly while accurately reflecting the `tall` setting (10..320)
          const visualTall = tall * 0.45;
          const topY = baseY + visualTall;

          // 8 corners of the 16x16 tall chunk box
          const b0 = project3D(minX, baseY, minZ);
          const b1 = project3D(maxX, baseY, minZ);
          const b2 = project3D(maxX, baseY, maxZ);
          const b3 = project3D(minX, baseY, maxZ);

          const t0 = project3D(minX, topY, minZ);
          const t1 = project3D(maxX, topY, minZ);
          const t2 = project3D(maxX, topY, maxZ);
          const t3 = project3D(minX, topY, maxZ);

          // Draw Sides if ShapeMode is Both or Sides
          if (shapeMode === 'Both' || shapeMode === 'Sides') {
            // Base pad (brighter fill so 16x16 chunk footprint stands out)
            ctx.fillStyle = `rgba(${fillColor.r}, ${fillColor.g}, ${fillColor.b}, ${(
              Math.min(1, (fillColor.a / 255) * 1.45) * lifeFactor
            ).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(b0.x, b0.y);
            ctx.lineTo(b1.x, b1.y);
            ctx.lineTo(b2.x, b2.y);
            ctx.lineTo(b3.x, b3.y);
            ctx.closePath();
            ctx.fill();

            // Vertical faces of the 16x16 pillar
            const faces = [
              [b0, b1, t1, t0],
              [b1, b2, t2, t1],
              [b2, b3, t3, t2],
              [b3, b0, t0, t3],
              [t0, t1, t2, t3]
            ];
            ctx.fillStyle = fillRgba;
            for (const face of faces) {
              ctx.beginPath();
              ctx.moveTo(face[0].x, face[0].y);
              ctx.lineTo(face[1].x, face[1].y);
              ctx.lineTo(face[2].x, face[2].y);
              ctx.lineTo(face[3].x, face[3].y);
              ctx.closePath();
              ctx.fill();
            }
          }

          // Draw Outline edges if ShapeMode is Both or Lines
          if (shapeMode === 'Both' || shapeMode === 'Lines') {
            ctx.strokeStyle = lineRgba;
            ctx.lineWidth = 1.8;

            // Bottom 16x16 outline
            ctx.beginPath();
            ctx.moveTo(b0.x, b0.y);
            ctx.lineTo(b1.x, b1.y);
            ctx.lineTo(b2.x, b2.y);
            ctx.lineTo(b3.x, b3.y);
            ctx.closePath();
            ctx.stroke();

            // Top 16x16 outline
            ctx.beginPath();
            ctx.moveTo(t0.x, t0.y);
            ctx.lineTo(t1.x, t1.y);
            ctx.lineTo(t2.x, t2.y);
            ctx.lineTo(t3.x, t3.y);
            ctx.closePath();
            ctx.stroke();

            // 4 Vertical pillar edges
            ctx.beginPath();
            ctx.moveTo(b0.x, b0.y);
            ctx.lineTo(t0.x, t0.y);
            ctx.moveTo(b1.x, b1.y);
            ctx.lineTo(t1.x, t1.y);
            ctx.moveTo(b2.x, b2.y);
            ctx.lineTo(t2.x, t2.y);
            ctx.moveTo(b3.x, b3.y);
            ctx.lineTo(t3.x, t3.y);
            ctx.stroke();
          }

          // Optional inner concentrated sound beam
          if (renderInnerBeam) {
            const sbBot = project3D(entry.soundX, baseY, entry.soundZ);
            const sbTop = project3D(entry.soundX, topY, entry.soundZ);

            ctx.strokeStyle = lineRgba;
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.moveTo(sbBot.x, sbBot.y);
            ctx.lineTo(sbTop.x, sbTop.y);
            ctx.stroke();

            ctx.fillStyle = lineRgba;
            ctx.beginPath();
            ctx.arc(sbBot.x, sbBot.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Floating 3D Nametag ("Sound Detected [sound_name] (distance)")
          if (renderNametag) {
            const labelPos = project3D(
              minX + 8,
              baseY + Math.min(visualTall * 0.65, 42),
              minZ + 8
            );

            const headerText = 'Sound Detected ';
            const detailText = `[${entry.shortSoundName}] (${entry.distance.toFixed(1)}m)`;
            const fontSize = Math.round(11 * nametagScale);
            ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;

            const headerWidth = ctx.measureText(headerText).width;
            const detailWidth = ctx.measureText(detailText).width;
            const totalW = headerWidth + detailWidth;
            const boxPadX = 8;
            const boxH = fontSize + 10;

            const boxX = labelPos.x - totalW / 2 - boxPadX;
            const boxY = labelPos.y - boxH / 2;

            ctx.fillStyle = `rgba(8, 12, 20, ${(0.82 * lifeFactor).toFixed(2)})`;
            ctx.strokeStyle = lineRgba;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, totalW + boxPadX * 2, boxH, 4);
            ctx.fill();
            ctx.stroke();

            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = `rgba(85, 255, 85, ${lifeFactor.toFixed(2)})`;
            ctx.fillText(headerText, labelPos.x - totalW / 2, labelPos.y);

            ctx.fillStyle = `rgba(235, 240, 245, ${lifeFactor.toFixed(2)})`;
            ctx.fillText(detailText, labelPos.x - totalW / 2 + headerWidth, labelPos.y);
          }
        }
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(renderFrame);
    };

    animationFrameId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    highlights,
    moduleActive,
    displayDuration,
    tall,
    fadeOut,
    fillColor,
    lineColor,
    shapeMode,
    renderInnerBeam,
    renderNametag,
    nametagScale,
    cameraYaw,
    cameraPitch,
    cameraZoom
  ]);

  // Prune expired highlights from React state periodically for accurate badge count
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now();
      const maxAgeMs = displayDuration * 1000;
      setHighlights((prev) => {
        const next = prev.filter((h) => now - h.timestampMs < maxAgeMs);
        return next.length === prev.length ? prev : next;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [displayDuration]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Left 7 Cols: 3D World Render3DEvent Preview + S2C Sound Packet Injector + Client Chat */}
      <div className="xl:col-span-7 flex flex-col gap-4">
        <div className="relative rounded-xl border border-emerald-500/30 bg-slate-950 overflow-hidden shadow-2xl">
          {/* Top HUD Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-semibold">
                <Eye className="w-3.5 h-3.5" />
                Render3DEvent + NametagUtils
              </span>
              <span className="text-slate-400 font-mono">
                Active Chunks: <strong className="text-emerald-400">{moduleActive ? highlights.length : 0}</strong>
              </span>
              <span className="hidden sm:inline text-slate-500">|</span>
              <span className="hidden sm:inline text-slate-400 font-mono">
                Tall: <strong className="text-slate-200">{tall} blocks</strong>
              </span>
              <span className="hidden sm:inline text-slate-500">|</span>
              <span className="hidden sm:inline text-slate-400 font-mono">
                Range: <strong className="text-slate-200">{range.toFixed(0)}m</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={triggerTestUnderPlayer}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold transition cursor-pointer"
                title="Trigger a simulated sound on the 16x16 chunk directly underneath mc.player"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Test Under Player
              </button>
              <button
                onClick={() => setHighlights([])}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                title="Clear all active chunk highlights"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>

          {/* 3D Interactive Canvas */}
          <div className="relative h-[390px] w-full select-none">
            <canvas
              ref={canvasRef}
              onMouseDown={(e) => {
                isDraggingRef.current = true;
                lastMouseRef.current = { x: e.clientX, y: e.clientY };
              }}
              onMouseMove={(e) => {
                if (!isDraggingRef.current) return;
                const dx = e.clientX - lastMouseRef.current.x;
                const dy = e.clientY - lastMouseRef.current.y;
                lastMouseRef.current = { x: e.clientX, y: e.clientY };
                setCameraYaw((prev) => prev + dx * 0.01);
                setCameraPitch((prev) => Math.max(0.18, Math.min(1.2, prev + dy * 0.008)));
              }}
              onMouseUp={() => {
                isDraggingRef.current = false;
              }}
              onMouseLeave={() => {
                isDraggingRef.current = false;
              }}
              onWheel={(e) => {
                e.preventDefault();
                setCameraZoom((prev) => Math.max(0.55, Math.min(2.2, prev - e.deltaY * 0.001)));
              }}
              className="w-full h-full cursor-grab active:cursor-grabbing block"
            />

            {/* Overlay Controls Hint */}
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              <div className="px-2.5 py-1 rounded bg-slate-950/80 border border-slate-800/90 text-[11px] text-slate-400 font-mono">
                Drag to orbit 3D camera • Scroll to zoom • 16×16 Chunk Grid
              </div>
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  onClick={() => {
                    setCameraYaw(0.68);
                    setCameraPitch(0.48);
                    setCameraZoom(1.0);
                  }}
                  className="px-2 py-1 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 font-mono flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Reset View
                </button>
              </div>
            </div>
          </div>

          {/* Client-Side Chat Feedback Overlay */}
          <div className="border-t border-slate-800 bg-slate-950/95 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                Client-Side Chat Output (ChatUtils.info — Never Sent to Server)
              </span>
              <button
                onClick={() => setChatLogs([])}
                className="text-[11px] text-slate-500 hover:text-slate-300 font-mono cursor-pointer"
              >
                Clear Chat
              </button>
            </div>
            <div className="h-28 overflow-y-auto rounded bg-black/60 border border-slate-800/80 p-2 font-mono text-xs space-y-1">
              {chatLogs.length === 0 ? (
                <div className="text-slate-600 italic">
                  Waiting for incoming S2C sound packets or Test button click...
                </div>
              ) : (
                chatLogs.map((log) => (
                  <div key={log.id} className="leading-relaxed">
                    <span className="text-slate-500">[{log.time}] </span>
                    <span className="text-purple-400 font-semibold">[Meteor] </span>
                    <span className="text-sky-400">[sound-debug] </span>
                    {log.ignored ? (
                      <span className="text-amber-400/90">
                        Ignored <span className="text-slate-300">{log.soundName}</span> — {log.reason}
                      </span>
                    ) : (
                      <span className="text-slate-300">
                        Sound Detected:{' '}
                        <span className="text-emerald-400 font-semibold">{log.soundName}</span> at Chunk [
                        {log.chunkX}, {log.chunkZ}] (
                        <span className="text-cyan-300">{log.distance.toFixed(1)}m</span>)
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Incoming Vanilla S2C Sound Packet Simulator */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                Simulate Incoming Vanilla S2C Sound Packets (PacketEvent.Receive)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any vanilla sound packet below to test how <code className="text-emerald-300">SoundDebug</code> filters by <code className="text-emerald-300">range</code> ({range.toFixed(0)}m) and highlights the 16×16 chunk.
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 0 Outgoing Packets (Anti-Cheat Safe)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SIMULATED_SOUND_PRESETS.map((preset) => {
              const withinRange = preset.defaultDistance <= range;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleInjectPreset(preset)}
                  className="group text-left p-2.5 rounded-lg border border-slate-800 hover:border-emerald-500/50 bg-slate-950/70 hover:bg-slate-900 transition flex items-start justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-100 group-hover:text-emerald-300 truncate">
                        {preset.label}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                      {preset.soundId}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {preset.packetType}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          withinRange
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {preset.defaultDistance}m {withinRange ? '✓ In Range' : '✕ > Range'}
                      </span>
                    </div>
                  </div>
                  <span className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition shrink-0">
                    <Play className="w-3.5 h-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right 5 Cols: Authentic Meteor Client ClickGUI Replica */}
      <div className="xl:col-span-5 flex flex-col gap-4">
        <div className="rounded-xl border border-purple-500/30 bg-[#13151c] overflow-hidden shadow-2xl">
          {/* Meteor ClickGUI Category Header */}
          <div className="px-4 py-3 bg-[#1f222e] border-b border-purple-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold tracking-wider uppercase text-white">
                Meteor ClickGUI • Category: Render
              </span>
            </div>
            <span className="text-[11px] font-mono text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30">
              Right-Click Module for Settings
            </span>
          </div>

          {/* Module List Item inside Render Category */}
          <div className="p-3 bg-[#171a24] border-b border-slate-800/80">
            <div
              onClick={() => setModuleActive((prev) => !prev)}
              onContextMenu={(e) => {
                e.preventDefault();
                setSettingsOpen((prev) => !prev);
              }}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border transition select-none cursor-pointer ${
                moduleActive
                  ? 'bg-purple-600/25 border-purple-500/60 text-white'
                  : 'bg-[#1e2230] border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    moduleActive ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'
                  }`}
                />
                <div>
                  <div className="text-sm font-bold tracking-tight flex items-center gap-2">
                    sound-debug
                    {moduleActive && highlights.length > 0 && (
                      <span className="text-xs font-mono text-emerald-400">[{highlights.length}]</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Left-Click: Toggle ({moduleActive ? 'ON' : 'OFF'}) • Right-Click: Settings
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSettingsOpen((prev) => !prev);
                }}
                className="px-2.5 py-1 rounded bg-slate-900/80 hover:bg-slate-800 text-xs font-mono text-purple-300 border border-purple-500/30 flex items-center gap-1 cursor-pointer"
              >
                <MousePointerClick className="w-3.5 h-3.5" />
                {settingsOpen ? 'Hide Settings' : 'Open Settings'}
              </button>
            </div>
          </div>

          {/* Module Settings Window (Opened on Right-Click) */}
          {settingsOpen && (
            <div className="p-4 space-y-5 text-xs">
              {/* SettingGroup: General */}
              <div className="space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-wider text-purple-300 font-semibold border-b border-slate-800 pb-1">
                  SettingGroup: General (sgGeneral)
                </div>

                {/* range (DoubleSetting) */}
                <div className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-200 font-semibold">range (DoubleSetting)</span>
                    <span className="text-emerald-400 font-bold">{range.toFixed(1)} blocks</span>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={2048}
                    step={8}
                    value={range}
                    onChange={(e) => setRange(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Min: 16.0</span>
                    <span>Default: 256.0</span>
                    <span>Slider Max: 2048.0</span>
                  </div>
                </div>

                {/* tall (IntSetting) */}
                <div className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-200 font-semibold">tall (IntSetting)</span>
                    <span className="text-emerald-400 font-bold">{tall} blocks</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={320}
                    step={5}
                    value={tall}
                    onChange={(e) => setTall(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Min: 10</span>
                    <span>Default: 150</span>
                    <span>Max: 320</span>
                  </div>
                </div>

                {/* display-duration (IntSetting) */}
                <div className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-200 font-semibold">display-duration (IntSetting)</span>
                    <span className="text-emerald-400 font-bold">{displayDuration}s</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    step={1}
                    value={displayDuration}
                    onChange={(e) => setDisplayDuration(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>

                {/* test (BoolSetting with auto-reset) */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="font-mono text-slate-200 font-semibold">test (BoolSetting)</div>
                    <div className="text-[11px] text-slate-400">
                      Spawns test chunk pillar under player &amp; auto-resets to false
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={testFlash}
                    onChange={() => triggerTestUnderPlayer()}
                    className="w-4 h-4 accent-emerald-400 cursor-pointer"
                  />
                </div>

                {/* chat-feedback (BoolSetting) */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-slate-200 font-semibold">chat-feedback</div>
                    <div className="text-[11px] text-slate-400">
                      Prints sound name, chunk &amp; distance to client chat
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatFeedback}
                    onChange={(e) => setChatFeedback(e.target.checked)}
                    className="w-4 h-4 accent-emerald-400 cursor-pointer"
                  />
                </div>

                {/* catch-global-events (BoolSetting) */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-slate-200 font-semibold">catch-global-events</div>
                    <div className="text-[11px] text-slate-400">
                      Include WorldEventS2CPacket (Wither / End Portal)
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={catchGlobalEvents}
                    onChange={(e) => setCatchGlobalEvents(e.target.checked)}
                    className="w-4 h-4 accent-emerald-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* SettingGroup: Render */}
              <div className="space-y-3 pt-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-purple-300 font-semibold border-b border-slate-800 pb-1">
                  SettingGroup: Render (sgRender)
                </div>

                {/* shape-mode */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-200 font-semibold">shape-mode</span>
                  <div className="flex gap-1">
                    {(['Both', 'Lines', 'Sides'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setShapeMode(mode)}
                        className={`px-2 py-0.5 rounded font-mono text-[11px] cursor-pointer ${
                          shapeMode === mode
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Presets (Green default + custom) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-200 font-semibold">
                      fill-color &amp; line-color
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400">
                      RGBA({fillColor.r}, {fillColor.g}, {fillColor.b}, {fillColor.a})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setFillColor({ r: 0, g: 255, b: 0, a: 75 });
                        setLineColor({ r: 0, g: 255, b: 0, a: 255 });
                      }}
                      className="flex-1 py-1 px-2 rounded bg-emerald-500/20 border border-emerald-500 text-emerald-300 font-mono text-[11px] cursor-pointer"
                    >
                      Bright Green (0,255,0)
                    </button>
                    <button
                      onClick={() => {
                        setFillColor({ r: 0, g: 220, b: 255, a: 75 });
                        setLineColor({ r: 0, g: 220, b: 255, a: 255 });
                      }}
                      className="flex-1 py-1 px-2 rounded bg-cyan-500/20 border border-cyan-500/60 text-cyan-300 font-mono text-[11px] cursor-pointer"
                    >
                      Cyan (0,220,255)
                    </button>
                    <button
                      onClick={() => {
                        setFillColor({ r: 255, g: 60, b: 180, a: 75 });
                        setLineColor({ r: 255, g: 60, b: 180, a: 255 });
                      }}
                      className="flex-1 py-1 px-2 rounded bg-pink-500/20 border border-pink-500/60 text-pink-300 font-mono text-[11px] cursor-pointer"
                    >
                      Magenta
                    </button>
                  </div>
                </div>

                {/* fade-out, render-inner-beam, render-nametag */}
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-mono text-slate-200">fade-out</span>
                    <input
                      type="checkbox"
                      checked={fadeOut}
                      onChange={(e) => setFadeOut(e.target.checked)}
                      className="w-4 h-4 accent-emerald-400"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-mono text-slate-200">render-inner-beam</span>
                    <input
                      type="checkbox"
                      checked={renderInnerBeam}
                      onChange={(e) => setRenderInnerBeam(e.target.checked)}
                      className="w-4 h-4 accent-emerald-400"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-mono text-slate-200">render-nametag ("Sound Detected")</span>
                    <input
                      type="checkbox"
                      checked={renderNametag}
                      onChange={(e) => setRenderNametag(e.target.checked)}
                      className="w-4 h-4 accent-emerald-400"
                    />
                  </label>
                </div>

                {renderNametag && (
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono">
                      <span className="text-slate-300">nametag-scale</span>
                      <span className="text-emerald-400">{nametagScale.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={2.0}
                      step={0.05}
                      value={nametagScale}
                      onChange={(e) => setNametagScale(parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* WButton Widget Section (getWidget(GuiTheme theme)) */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  WWidget getWidget(GuiTheme theme) Action Buttons
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={triggerTestUnderPlayer}
                    className="py-2 px-3 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Test Chunk Under Player
                  </button>
                  <button
                    onClick={() => setHighlights([])}
                    className="py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Highlights
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
