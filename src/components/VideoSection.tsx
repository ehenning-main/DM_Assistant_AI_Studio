import React, { useState, useEffect, useRef } from "react";
import { Video, Sparkles, Loader2, Play, AlertCircle, RefreshCw, Film } from "lucide-react";

interface VideoSectionProps {
  sessionId: string;
  videoUrl?: string;
  videoStatus?: "idle" | "generating" | "done" | "error";
  videoOperationName?: string;
  highlights: { imageUrl: string; caption: string }[];
  onVideoUpdated: (fields: {
    videoUrl?: string;
    videoStatus?: "idle" | "generating" | "done" | "error";
    videoOperationName?: string;
  }) => void;
}

export function VideoSection({
  sessionId,
  videoUrl,
  videoStatus = "idle",
  videoOperationName,
  highlights,
  onVideoUpdated,
}: VideoSectionProps) {
  const [prompt, setPrompt] = useState("");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [polling, setPolling] = useState(false);

  // Auto-set reasonable default prompt based on highlights if possible
  useEffect(() => {
    if (!prompt && highlights.length > 0) {
      setPrompt(highlights[0].caption);
    }
  }, [highlights]);

  // Set up polling logic
  useEffect(() => {
    let intervalId: any;
    if (videoStatus === "generating" && videoOperationName) {
      setPolling(true);
      intervalId = setInterval(async () => {
        try {
          const res = await fetch("/api/video-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operationName: videoOperationName }),
          });

          if (!res.ok) throw new Error("Failed to scan video operation status.");
          const data = await res.json();

          if (data.done) {
            clearInterval(intervalId);
            setPolling(false);
            if (data.error) {
              throw new Error(data.error.message || "Veo Generation failed.");
            }
            // Transition to download phase
            onVideoUpdated({
              videoStatus: "done",
              videoUrl: `/api/video-download?op=${encodeURIComponent(videoOperationName)}`,
            });
            setErrorDetails(null);
          }
        } catch (err: any) {
          console.warn("Veo status check note:", err.message);
          // If we fail or keys are unconfigured, keep generating state but set error fallback
          clearInterval(intervalId);
          setPolling(false);
          setErrorDetails(
            "Genuine Veo server is pending (requires Paid API keys). Loading gorgeous Cinematic Scroll Simulation instead."
          );
          onVideoUpdated({ videoStatus: "error" });
        }
      }, 6000);
    } else {
      setPolling(false);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [videoStatus, videoOperationName]);

  // Fire Video Generation
  async function generateVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setErrorDetails(null);
    onVideoUpdated({ videoStatus: "generating", videoUrl: "" });

    try {
      const startImg = highlights.length > 0 ? highlights[0].imageUrl.split(",")[1] : undefined;
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptString: prompt,
          startImageBase64: startImg,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Payment tier or key allocation pending in Veo platform.");
      }

      const data = await res.json();
      onVideoUpdated({
        videoStatus: "generating",
        videoOperationName: data.operationName,
      });
    } catch (err: any) {
      console.warn("Direct Veo trigger bypass:", err);
      setErrorDetails(
        "Veo requires a Paid API Key (Settings > Secrets). Harnessing our interactive HTML5 Cinematic Scroll to dynamically render campaign visuals!"
      );
      // We set status to done and use a custom canvas player as the animated fallback video url
      onVideoUpdated({
        videoStatus: "done",
        videoUrl: "canvas_ambient_fallback",
      });
    }
  }

  // Interactive HTML5 Ambient Scroll Animation Engine
  useEffect(() => {
    if (videoUrl !== "canvas_ambient_fallback" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = 640);
    let height = (canvas.height = 360);

    // Load available segment illustrations to pan
    const loadedImages: HTMLImageElement[] = [];
    highlights.forEach((h) => {
      const img = new window.Image();
      img.src = h.imageUrl;
      img.referrerPolicy = "no-referrer";
      img.onload = () => loadedImages.push(img);
    });

    // Simulated particles and dice orbits
    let angle = 0;
    const particles: { x: number; y: number; size: number; speedY: number; opacity: number }[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        speedY: -(Math.random() * 1 + 0.3),
        opacity: Math.random() * 0.5 + 0.3,
      });
    }

    let scaleOffset = 1.0;
    let zoomDirection = 1;

    function renderLoop() {
      if (!ctx || !canvas) return;
      ctx.fillStyle = "#0c0c0e"; // Deep space background
      ctx.fillRect(0, 0, width, height);

      // 1. Draw sliding campaign illustrations
      if (loadedImages.length > 0) {
        const activeImgIdx = Math.floor(angle / 300) % loadedImages.length;
        const img = loadedImages[activeImgIdx];
        
        ctx.save();
        ctx.globalAlpha = 0.45;
        
        // Zoom-in pan effect
        scaleOffset += 0.0005 * zoomDirection;
        if (scaleOffset > 1.12 || scaleOffset < 1.0) zoomDirection *= -1;

        const w = width * scaleOffset;
        const h = height * scaleOffset;
        const x = (width - w) / 2;
        const y = (height - h) / 2;

        try {
          ctx.drawImage(img, x, y, w, h);
        } catch (e) {}
        ctx.restore();
      }

      // 2. Draw cinematic shadow frame vignette
      const gradient = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 320);
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.9)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 3. Render floating dust embers
      particles.forEach((p) => {
        p.y += p.speedY;
        if (p.y < 0) p.y = height;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 158, 11, ${p.opacity})`; // Golden embers
        ctx.fill();
      });

      // 4. Render rotating 3D metallic Polyhedral (d20) vector wireframe
      ctx.save();
      ctx.translate(width / 2, height / 2 - 20);
      ctx.rotate(angle * 0.015);
      
      ctx.strokeStyle = "rgba(245, 158, 11, 0.65)"; // Amber-500
      ctx.lineWidth = 1.5;
      
      // Node list for a 3D simulated d20 star wireframe
      const r = 45;
      const nodes: { x: number; y: number; z: number }[] = [];
      const t = (1 + Math.sqrt(5)) / 2; // Golden ratio
      
      // Icosahedron node vertices
      const vertices = [
        [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
        [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
        [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
      ];

      // Render wireframe vertices
      ctx.beginPath();
      vertices.forEach(([vx, vy, vz], i) => {
        // Simple perspective projection
        const d = 150;
        const factor = d / (d + vz * 20);
        const screenX = vx * r * factor;
        const screenY = vy * r * factor;
        
        ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
        
        // Draw links connecting adjacent vector nodes
        vertices.forEach(([ox, oy, oz], j) => {
          const dist = Math.pow(vx - ox, 2) + Math.pow(vy - oy, 2) + Math.pow(vz - oz, 2);
          if (dist > 3.9 && dist < 4.1) {
            const ofact = d / (d + oz * 20);
            ctx.moveTo(screenX, screenY);
            ctx.lineTo(ox * r * ofact, oy * r * ofact);
          }
        });
      });
      ctx.stroke();
      ctx.restore();

      // 5. Title banner overlay
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, height - 60, width, 60);

      ctx.fillStyle = "#ef4444"; // red-500
      ctx.font = "bold 14px 'Cinzel', serif";
      ctx.textAlign = "center";
      ctx.fillText(prompt.length > 55 ? prompt.substring(0, 55) + "..." : prompt, width / 2, height - 38);

      ctx.fillStyle = "#9ca3af"; // gray-400
      ctx.font = "italic 10px 'Inter', sans-serif";
      ctx.fillText("✨ Ambient Kinetic Forge Fallback • Looping Campaign Frame ✨", width / 2, height - 16);

      angle += 0.5;
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    }

    renderLoop();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [videoUrl, prompt, highlights]);

  return (
    <div className="space-y-4 p-5 bg-zinc-900 border border-zinc-800 rounded-lg parchment-glow" id="video-panel">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-red-500 animate-pulse" />
          <h3 className="font-fantasy font-semibold text-zinc-100 tracking-wider text-base">
            CAMPAIGN CINEMATIC SCROLLS (One Short Video)
          </h3>
        </div>
        <span className="font-mono text-[10px] bg-red-500/10 text-red-500 border border-red-500/30 px-2 py-0.5 rounded uppercase">
          Veo-3.1 Native
        </span>
      </div>

      <p className="text-zinc-400 text-xs leading-relaxed">
        Forge a cinematic video clip detailing a landmark event of this session. Select an illustration as the starting frame, describe the animation style, and witness the magic.
      </p>

      {errorDetails && (
        <div className="flex gap-2 items-start p-3.5 bg-red-500/5 border border-red-500/20 rounded text-red-300 text-xs font-sans">
          <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">Simulation Triggered</span>
            <p>{errorDetails}</p>
          </div>
        </div>
      )}

      {/* Video Generation Trigger Form */}
      {videoStatus === "idle" && (
        <form onSubmit={generateVideo} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wide">
              Animation Prompt Description
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the cinematic camera motion (e.g., 'The camera zooms in slowly on a dangerous lich raising its staff, surrounded by toxic green smoke'...)"
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-red-500 font-sans transition"
              id="video-prompt-input"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-sans text-zinc-500 italic">
              {highlights.length > 0
                ? "💡 Incorporates your first highlight illustration as the start frame!"
                : "💡 Recommended: Create a highlight image first to use as the starting frame."}
            </span>
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-sans font-medium text-xs md:text-sm rounded transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              id="btn-forge-video"
            >
              <Sparkles className="w-4 h-4 fill-zinc-950" /> Forge Campaign Video
            </button>
          </div>
        </form>
      )}

      {/* Generating State */}
      {videoStatus === "generating" && (
        <div className="flex flex-col items-center justify-center py-10 bg-zinc-950/60 border border-zinc-850 rounded">
          <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
          <h4 className="font-fantasy font-semibold text-zinc-200 text-sm tracking-wide">
            TRANSMUTING ESSENCE TO VIDEO
          </h4>
          <p className="text-zinc-500 text-[11px] font-sans mt-1 text-center max-w-[320px] leading-relaxed">
            Veo requires 1 to 2 minutes to compile realistic motion calculations. Please wait; our transcriptionists are weaving the timelines together...
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onVideoUpdated({ videoStatus: "idle" })}
              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition border border-zinc-700"
              id="btn-cancel-generation"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Done State */}
      {videoStatus === "done" && videoUrl === "canvas_ambient_fallback" && (
        <div className="space-y-3">
          <div className="relative aspect-video w-full rounded border border-zinc-800 overflow-hidden bg-black flex items-center justify-center">
            <canvas ref={canvasRef} className="object-cover w-full h-full" id="fallback-canvas" />
          </div>
          <div className="flex justify-between items-center bg-zinc-950/50 p-3 rounded border border-zinc-850 text-xs">
            <span className="text-zinc-400 font-sans italic">
              ✨ Animated Chronicle loop successfully prepared!
            </span>
            <button
              onClick={() => onVideoUpdated({ videoStatus: "idle" })}
              className="flex items-center gap-1 text-[11px] font-mono text-red-500 hover:text-red-400 font-semibold"
              id="btn-reforge-video"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reforge Video
            </button>
          </div>
        </div>
      )}

      {videoStatus === "done" && videoUrl && videoUrl !== "canvas_ambient_fallback" && (
        <div className="space-y-3">
          <div className="relative aspect-video w-full rounded border border-zinc-800 overflow-hidden bg-black">
            <video
              src={videoUrl}
              controls
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              id="real-video-player"
            />
          </div>
          <div className="flex justify-between items-center bg-zinc-950/50 p-3 rounded border border-zinc-850 text-xs">
            <span className="text-emerald-400 font-mono flex items-center gap-1">
              • Done (Downloaded from Server)
            </span>
            <button
              onClick={() => onVideoUpdated({ videoStatus: "idle" })}
              className="flex items-center gap-1 text-[11px] font-mono text-red-500 hover:text-red-400 font-semibold"
              id="btn-reforge-video-real"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reforge Video
            </button>
          </div>
        </div>
      )}

      {/* Error / Fallback State Trigger */}
      {videoStatus === "error" && (
        <div className="flex flex-col items-center justify-center py-6 bg-zinc-950/60 border border-zinc-850 rounded">
          <p className="text-zinc-400 text-xs mb-3 font-sans max-w-[340px] text-center leading-relaxed">
            The remote video server experienced a bottleneck (or lacks credential access). Let's unlock our custom visual simulator loop instantly!
          </p>
          <button
            onClick={() =>
              onVideoUpdated({
                videoStatus: "done",
                videoUrl: "canvas_ambient_fallback",
              })
            }
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-zinc-950 font-sans font-medium text-xs sm:text-sm rounded transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            id="btn-unlock-simulation"
          >
            <Film className="w-4 h-4 fill-zinc-950" /> Enable Motion Simulator
          </button>
        </div>
      )}
    </div>
  );
}
