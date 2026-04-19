"use client";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Plus, Trash2, Play, RotateCcw, Trophy, Users,
  ChevronRight, ArrowLeft, Sparkles, X, Crown,
  Share2, Copy, Shuffle, Volume2, VolumeX
} from "lucide-react";
import { toast } from "sonner";

// ── TYPES ──
interface SpinRoom {
  id: string;
  name: string;
  description: string;
  participants: string[];
  createdAt: Date;
  winners: string[];
}

// ── PALETTE ── vivid, distinct, never repeating adjacent
const PALETTE = [
  "#FF3B5C", "#FF8C00", "#FFD700", "#00C896", "#00B4FF",
  "#7C5CFC", "#FF5FA0", "#FF6B35", "#2ECC71", "#3498DB",
  "#9B59B6", "#E74C3C", "#F39C12", "#1ABC9C", "#2980B9",
  "#8E44AD", "#E67E22", "#27AE60", "#16A085", "#D35400",
];

const getColor = (i: number) => PALETTE[i % PALETTE.length];

// ── WHEEL CANVAS ──
function SpinWheel({
  names,
  spinning,
  rotation,
  winner,
}: {
  names: string[];
  spinning: boolean;
  rotation: number;
  winner: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const n = names.length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || n === 0) return;
    const ctx = canvas.getContext("2d")!;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 8;
    const arc = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, size, size);

    // Outer glow ring
    const glowGrad = ctx.createRadialGradient(cx, cy, r - 12, cx, cy, r + 8);
    glowGrad.addColorStop(0, "rgba(255,255,255,0.08)");
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, 2 * Math.PI);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    for (let i = 0; i < n; i++) {
      const startAngle = arc * i + (rotation * Math.PI) / 180;
      const endAngle = startAngle + arc;
      const color = getColor(i);

      // Slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Slice border
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Slice shimmer
      const shimmerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      shimmerGrad.addColorStop(0, "rgba(255,255,255,0.18)");
      shimmerGrad.addColorStop(0.5, "rgba(255,255,255,0.04)");
      shimmerGrad.addColorStop(1, "rgba(0,0,0,0.12)");
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = shimmerGrad;
      ctx.fill();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + arc / 2);
      ctx.textAlign = "right";
      const fontSize = Math.max(9, Math.min(15, 200 / n));
      ctx.font = `bold ${fontSize}px 'DM Sans', sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      const label = names[i].length > 14 ? names[i].slice(0, 13) + "…" : names[i];
      ctx.fillText(label, r - 12, fontSize / 3);
      ctx.restore();
    }

    // Center hub
    const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
    hubGrad.addColorStop(0, "#ffffff");
    hubGrad.addColorStop(0.4, "#f0f0f0");
    hubGrad.addColorStop(1, "#cccccc");
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, 2 * Math.PI);
    ctx.fillStyle = "#1a1a2e";
    ctx.fill();
  }, [names, rotation, n]);

  return (
    <div className="relative flex items-center justify-center">
      {/* Pointer */}
      <div
        className="absolute right-0 translate-x-1/2 z-10"
        style={{ top: "50%", transform: "translateY(-50%) translateX(8px)" }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "16px solid transparent",
            borderBottom: "16px solid transparent",
            borderRight: "36px solid #FFD700",
            filter: "drop-shadow(-2px 0 6px rgba(0,0,0,0.5))",
          }}
        />
      </div>
      <div
        className={`rounded-full shadow-2xl ${spinning ? "drop-shadow-[0_0_32px_rgba(255,215,0,0.6)]" : ""}`}
        style={{ transition: "filter 0.3s" }}
      >
        <canvas
          ref={canvasRef}
          width={440}
          height={440}
          className="rounded-full"
          style={{ maxWidth: "100%", height: "auto" }}
        />
      </div>
    </div>
  );
}

// ── ROOM CARD ──
function RoomCard({ room, onEnter, onDelete }: {
  room: SpinRoom;
  onEnter: () => void;
  onDelete: () => void;
}) {
  const colors = room.participants.slice(0, 5).map((_, i) => getColor(i));
  return (
    <Card
      className="group relative overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:-translate-y-1"
      onClick={onEnter}
    >
      {/* Color strip */}
      <div className="h-1.5 w-full flex">
        {colors.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
        {room.participants.length > 5 && (
          <div className="flex-1 bg-slate-300 dark:bg-slate-700" />
        )}
      </div>

      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
              {room.name}
            </h3>
            {room.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                {room.description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-all"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {room.participants.slice(0, 4).map((_, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-950"
                  style={{ background: getColor(i) }}
                />
              ))}
              {room.participants.length > 4 && (
                <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-950 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300">
                  +{room.participants.length - 4}
                </div>
              )}
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {room.participants.length} slots
            </span>
          </div>
          {room.winners.length > 0 && (
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs flex items-center gap-1">
              <Trophy className="h-3 w-3" /> {room.winners.length} spun
            </Badge>
          )}
        </div>

        <Button className="w-full mt-4 font-semibold" size="sm" onClick={onEnter}>
          Enter Room <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ── MAIN PAGE ──
export default function SpinPlatform() {
  const [rooms, setRooms] = useState<SpinRoom[]>([
    {
      id: "demo",
      name: "Demo Room",
      description: "A sample spin room to get you started",
      participants: ["Alice", "Bob", "Carol", "David", "Eve", "Frank"],
      createdAt: new Date(),
      winners: [],
    },
  ]);

  const [view, setView] = useState<"home" | "create" | "room">("home");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Create form
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [namesInput, setNamesInput] = useState("");
  const [singleName, setSingleName] = useState("");

  // Spin state
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const [sound, setSound] = useState(true);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const startRotRef = useRef<number>(0);
  const targetRotRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) ?? null,
    [rooms, activeRoomId]
  );

  // Parse names from textarea
  const parsedNames = useMemo(() => {
    return namesInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [namesInput]);

  const handleCreate = () => {
    if (!roomName.trim()) { toast.error("Room name is required"); return; }
    if (parsedNames.length < 2) { toast.error("Add at least 2 participants"); return; }
    const newRoom: SpinRoom = {
      id: Date.now().toString(),
      name: roomName.trim(),
      description: roomDesc.trim(),
      participants: parsedNames,
      createdAt: new Date(),
      winners: [],
    };
    setRooms((p) => [newRoom, ...p]);
    setActiveRoomId(newRoom.id);
    setRoomName(""); setRoomDesc(""); setNamesInput("");
    setView("room");
    toast.success("Room created! Time to spin 🎉");
  };

  const addSingleName = () => {
    if (!singleName.trim()) return;
    const existing = namesInput.trim();
    setNamesInput(existing ? existing + "\n" + singleName.trim() : singleName.trim());
    setSingleName("");
  };

  const removeParsedName = (name: string) => {
    const updated = parsedNames.filter((n) => n !== name);
    setNamesInput(updated.join("\n"));
  };

  const handleDeleteRoom = (id: string) => {
    setRooms((p) => p.filter((r) => r.id !== id));
    toast.success("Room deleted");
  };

  const handleRemoveParticipant = (name: string) => {
    if (!activeRoom) return;
    setRooms((p) =>
      p.map((r) =>
        r.id === activeRoom.id
          ? { ...r, participants: r.participants.filter((n) => n !== name) }
          : r
      )
    );
  };

  const handleAddParticipant = (name: string) => {
    if (!activeRoom || !name.trim()) return;
    setRooms((p) =>
      p.map((r) =>
        r.id === activeRoom.id
          ? { ...r, participants: [...r.participants, name.trim()] }
          : r
      )
    );
  };

  // Easing
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

  const spin = useCallback(() => {
    if (!activeRoom || spinning || activeRoom.participants.length < 2) return;
    setShowWinner(false);
    setWinner(null);

    const extraSpins = 6 + Math.random() * 6; // 6–12 full rotations
    const n = activeRoom.participants.length;
    const arc = 360 / n;

    // Pick a random winning index
    const winIdx = Math.floor(Math.random() * n);
    // The pointer is at the right (0°). Slot i starts at i*arc degrees from top (-90°).
    // We want the middle of winIdx slot to land at 0° (right side, pointer position).
    // Middle of slot winIdx is at: winIdx * arc + arc/2 degrees (from 0° = top, going clockwise)
    // In canvas rotation space (rotation added to each slice start), we need:
    // rotation + winIdx * arc + arc/2 ≡ 0° (mod 360°)  (pointer at right = 0° offset from start)
    // So: rotation = -(winIdx * arc + arc/2) mod 360
    const slotCenter = winIdx * arc + arc / 2;
    const finalRot = (startRotRef.current % 360) + extraSpins * 360 + (360 - (startRotRef.current % 360) - slotCenter + 360) % 360;

    startRotRef.current = rotation;
    targetRotRef.current = rotation + (finalRot - (rotation % 360) + extraSpins * 360);
    durationRef.current = 4500 + Math.random() * 1500;
    startTimeRef.current = performance.now();

    setSpinning(true);

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(elapsed / durationRef.current, 1);
      const easedT = easeOut(t);
      const currentRot = startRotRef.current + (targetRotRef.current - startRotRef.current) * easedT;
      setRotation(currentRot);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setRotation(targetRotRef.current);
        startRotRef.current = targetRotRef.current;
        setSpinning(false);
        setWinner(activeRoom.participants[winIdx]);
        setRooms((p) =>
          p.map((r) =>
            r.id === activeRoom.id
              ? { ...r, winners: [activeRoom.participants[winIdx], ...r.winners] }
              : r
          )
        );
        setTimeout(() => setShowWinner(true), 200);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [activeRoom, spinning, rotation]);

  useEffect(() => () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); }, []);

  const shuffleParticipants = () => {
    if (!activeRoom) return;
    const shuffled = [...activeRoom.participants].sort(() => Math.random() - 0.5);
    setRooms((p) => p.map((r) => r.id === activeRoom.id ? { ...r, participants: shuffled } : r));
    toast.success("Shuffled!");
  };

  const [addingName, setAddingName] = useState("");

  // ── HOME VIEW ──
  if (view === "home") {
    return (
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <div className="relative overflow-hidden bg-slate-950 border-b border-slate-800">
          <div className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, #7C5CFC 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, #FF3B5C 0%, transparent 40%),
                radial-gradient(circle at 60% 80%, #00C896 0%, transparent 40%)`
            }}
          />
          <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-20 flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold mb-4">
                <Sparkles className="h-3 w-3 text-yellow-400" /> Spin to Decide
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-4">
                The Fairest<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">
                  Spin Platform
                </span>
              </h1>
              <p className="text-slate-300 text-lg mb-8 max-w-lg">
                Create a spin room, add your participants, and let the wheel decide — random, fair, and unforgettable.
              </p>
              <Button
                size="lg"
                className="font-bold text-base px-8 bg-gradient-to-r from-yellow-400 to-pink-500 text-slate-950 hover:opacity-90 shadow-lg shadow-pink-500/25"
                onClick={() => setView("create")}
              >
                <Plus className="mr-2 h-5 w-5" /> Create Spin Room
              </Button>
            </div>

            {/* Mini preview wheel */}
            <div className="shrink-0 opacity-90 hidden md:block">
              <SpinWheel
                names={["Alice", "Bob", "Carol", "David", "Eve", "Frank"]}
                spinning={false}
                rotation={15}
                winner={null}
              />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Your Spin Rooms</h2>
              <p className="text-muted-foreground text-sm mt-0.5">{rooms.length} room{rooms.length !== 1 ? "s" : ""} created</p>
            </div>
            <Button onClick={() => setView("create")} className="font-semibold">
              <Plus className="mr-2 h-4 w-4" /> New Room
            </Button>
          </div>

          {rooms.length === 0 ? (
            <Card className="py-20 text-center border-dashed">
              <p className="text-muted-foreground text-lg">No rooms yet. Create your first!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onEnter={() => { setActiveRoomId(room.id); setView("room"); setWinner(null); setShowWinner(false); }}
                  onDelete={() => handleDeleteRoom(room.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── CREATE VIEW ──
  if (view === "create") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setView("home")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Create Spin Room</h1>
              <p className="text-sm text-muted-foreground">Set up your wheel and add participants</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Form */}
            <div className="space-y-5">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Room Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Room Name <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="e.g. Weekly Giveaway"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input
                      placeholder="What's this spin for?"
                      value={roomDesc}
                      onChange={(e) => setRoomDesc(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Add Participants</CardTitle>
                  <CardDescription>One name per line, or comma-separated</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quick add */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a name..."
                      value={singleName}
                      onChange={(e) => setSingleName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSingleName()}
                    />
                    <Button variant="outline" size="icon" onClick={addSingleName}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <Textarea
                    placeholder={"Alice\nBob\nCarol\nDavid"}
                    value={namesInput}
                    onChange={(e) => setNamesInput(e.target.value)}
                    className="min-h-[120px] font-mono text-sm resize-none"
                  />

                  {parsedNames.length > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <strong className="text-foreground">{parsedNames.length}</strong> participants → <strong className="text-foreground">{parsedNames.length}</strong> wheel slots
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button
                className="w-full font-bold h-12 text-base bg-gradient-to-r from-yellow-400 to-pink-500 text-slate-950 hover:opacity-90"
                onClick={handleCreate}
                disabled={!roomName.trim() || parsedNames.length < 2}
              >
                <Sparkles className="mr-2 h-5 w-5" /> Create & Spin!
              </Button>
            </div>

            {/* Right: Live preview */}
            <div className="space-y-4">
              <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
                <CardHeader className="pb-2 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-800">
                  <CardTitle className="text-sm text-muted-foreground font-medium">Live Preview</CardTitle>
                </CardHeader>
                <CardContent className="p-6 flex items-center justify-center bg-slate-950">
                  {parsedNames.length >= 2 ? (
                    <SpinWheel names={parsedNames} spinning={false} rotation={0} winner={null} />
                  ) : (
                    <div className="text-center text-slate-500 py-16">
                      <div className="w-32 h-32 rounded-full border-4 border-dashed border-slate-700 flex items-center justify-center mx-auto mb-3">
                        <Users className="h-10 w-10 text-slate-600" />
                      </div>
                      <p className="text-sm">Add 2+ names to preview</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Parsed name tags */}
              {parsedNames.length > 0 && (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                  {parsedNames.map((name, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full text-xs font-semibold text-white"
                      style={{ background: getColor(i) }}
                    >
                      {name}
                      <button
                        onClick={() => removeParsedName(name)}
                        className="w-4 h-4 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center transition-colors"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ROOM / SPIN VIEW ──
  if (view === "room" && activeRoom) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => { setView("home"); setWinner(null); setShowWinner(false); }}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{activeRoom.name}</h1>
                {activeRoom.description && (
                  <p className="text-sm text-muted-foreground">{activeRoom.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setSound((s) => !s)} title={sound ? "Mute" : "Unmute"}>
                {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={shuffleParticipants}>
                <Shuffle className="h-4 w-4 mr-2" /> Shuffle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); }}
              >
                <Share2 className="h-4 w-4 mr-2" /> Share
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Wheel column */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="bg-slate-950 p-6 md:p-10 flex flex-col items-center gap-6">
                  {/* Winner banner */}
                  {showWinner && winner && (
                    <div className="w-full animate-in zoom-in-95 duration-300">
                      <div className="relative overflow-hidden rounded-xl border-2 border-yellow-400/50 bg-gradient-to-r from-yellow-950/50 to-amber-950/50 p-4 text-center">
                        <div className="absolute inset-0 opacity-10"
                          style={{ backgroundImage: "radial-gradient(circle at 50% 50%, #FFD700 0%, transparent 70%)" }}
                        />
                        <div className="relative z-10">
                          <Crown className="h-6 w-6 text-yellow-400 mx-auto mb-1" />
                          <p className="text-yellow-300 text-xs font-semibold uppercase tracking-widest mb-1">Winner!</p>
                          <p className="text-2xl font-black text-white">{winner}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <SpinWheel
                    names={activeRoom.participants}
                    spinning={spinning}
                    rotation={rotation}
                    winner={winner}
                  />

                  <div className="flex gap-3 w-full max-w-xs">
                    <Button
                      className="flex-1 h-12 font-bold text-base bg-gradient-to-r from-yellow-400 to-pink-500 text-slate-950 hover:opacity-90 shadow-lg shadow-pink-500/20"
                      onClick={spin}
                      disabled={spinning || activeRoom.participants.length < 2}
                    >
                      {spinning ? (
                        <><RotateCcw className="mr-2 h-5 w-5 animate-spin" /> Spinning...</>
                      ) : (
                        <><Play className="mr-2 h-5 w-5" /> Spin!</>
                      )}
                    </Button>
                    {winner && !spinning && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 border-slate-700"
                        onClick={() => { setWinner(null); setShowWinner(false); }}
                        title="Reset"
                      >
                        <RotateCcw className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Right panel */}
            <div className="space-y-4">
              {/* Participants */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3 border-b dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Participants
                      <Badge variant="secondary" className="font-mono">{activeRoom.participants.length}</Badge>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  {/* Add participant */}
                  <div className="flex gap-2 mb-3">
                    <Input
                      placeholder="Add name..."
                      value={addingName}
                      className="h-8 text-sm"
                      onChange={(e) => setAddingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddParticipant(addingName);
                          setAddingName("");
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => { handleAddParticipant(addingName); setAddingName(""); }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {activeRoom.participants.map((name, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 group/item rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: getColor(i) }}
                        />
                        <span className="text-sm flex-1 truncate font-medium">{name}</span>
                        <button
                          className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                          onClick={() => handleRemoveParticipant(name)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Spin history */}
              {activeRoom.winners.length > 0 && (
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-3 border-b dark:border-slate-800">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      Spin History
                      <Badge variant="secondary" className="font-mono">{activeRoom.winners.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {activeRoom.winners.map((w, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/30"
                        >
                          {i === 0 ? (
                            <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                          ) : (
                            <Trophy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          )}
                          <span className="text-sm font-semibold flex-1 truncate">{w}</span>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">#{activeRoom.winners.length - i}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}