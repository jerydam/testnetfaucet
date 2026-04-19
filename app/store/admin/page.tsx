"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Truck, CheckCircle2, Clock, MapPin, ExternalLink,
  Mail, Copy, AlertCircle, RefreshCw, Search, Loader2,
  BarChart2, Send, ChevronDown, X, Link2, CalendarDays,
  MessageSquare, StickyNote,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from "@/hooks/use-wallet";
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme';
import { WalletConnectButton } from "@/components/wallet-connect";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const ADMIN_WALLET = "0x9fBC2A0de6e5C5Fd96e8D11541608f5F328C0785";
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app";

const CHAIN_EXPLORERS: Record<number, string> = {
  42220: "https://celoscan.io/tx/",
  8453:  "https://basescan.org/tx/",
  42161: "https://arbiscan.io/tx/",
  56:    "https://bscscan.com/tx/",
  1135:  "https://blockscout.lisk.com/tx/",
};

const CHAIN_NAMES: Record<number, string> = {
  42220: "Celo", 8453: "Base", 42161: "Arbitrum", 56: "BNB Chain", 1135: "Lisk",
};

// ─── TYPES ───────────────────────────────────────────────────────────────────

type OrderStatus = "processing" | "shipped" | "delivered";

interface Order {
  orderId: string;
  txHash: string;
  walletAddress: string;
  itemId: string;
  fullName: string;
  email: string;
  status: OrderStatus;
  createdAt: string;
  chainId?: number;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingNotes?: string;
  estimatedDelivery?: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

interface UpdatePayload {
  adminAddress: string;
  status: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingNotes?: string;
  estimatedDelivery?: string;
}

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────

const S = {
  processing: {
    label: "Processing",
    icon: Clock,
    cls: "text-amber-500 bg-amber-500/10 border-amber-500/25",
  },
  shipped: {
    label: "Shipped",
    icon: Truck,
    cls: "text-blue-500 bg-blue-500/10 border-blue-500/25",
  },
  delivered: {
    label: "Delivered",
    icon: CheckCircle2,
    cls: "text-primary bg-primary/10 border-primary/25",
  },
} satisfies Record<OrderStatus, { label: string; icon: React.ElementType; cls: string }>;

// ─── STATUS UPDATE MODAL ──────────────────────────────────────────────────────

function UpdateStatusModal({
  order,
  newStatus,
  adminAddress,
  onClose,
  onSuccess,
}: {
  order: Order;
  newStatus: OrderStatus;
  adminAddress: string;
  onClose: () => void;
  onSuccess: (updated: Partial<Order>) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    trackingNumber: order.trackingNumber ?? "",
    trackingUrl:    order.trackingUrl    ?? "",
    shippingNotes:  order.shippingNotes  ?? "",
    estimatedDelivery: order.estimatedDelivery
      ? order.estimatedDelivery.slice(0, 10)   // yyyy-mm-dd for <input type=date>
      : "",
  });

  const needsTracking = newStatus === "shipped";
  const cfg = S[newStatus];
  const StatusIcon = cfg.icon;

  const handleSubmit = async () => {
    if (needsTracking && !form.trackingNumber.trim()) {
      toast.error("Please enter a tracking number before marking as shipped.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: UpdatePayload = {
        adminAddress,
        status: newStatus,
        trackingNumber:    form.trackingNumber.trim() || undefined,
        trackingUrl:       form.trackingUrl.trim()    || undefined,
        shippingNotes:     form.shippingNotes.trim()  || undefined,
        estimatedDelivery: form.estimatedDelivery     || undefined,
      };
      const res = await fetch(
        `${API_BASE}/api/admin/merch-orders/${order.orderId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success(`Order marked as ${newStatus}!`);
      onSuccess({
        status:            newStatus,
        trackingNumber:    payload.trackingNumber,
        trackingUrl:       payload.trackingUrl,
        shippingNotes:     payload.shippingNotes,
        estimatedDelivery: payload.estimatedDelivery,
      });
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  const inp = (
    label: string,
    key: keyof typeof form,
    placeholder: string,
    icon: React.ElementType,
    type = "text",
    hint?: string,
  ) => {
    const Icon = icon;
    return (
      <div>
        <label className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground
          uppercase tracking-widest mb-1.5">
          <Icon size={11} /> {label}
        </label>
        <input
          type={type}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm
            outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/40"
        />
        {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="relative z-10 w-full max-w-md bg-card border border-border rounded-3xl
          overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border
          bg-accent/10">
          <div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
              text-[10px] font-black uppercase tracking-widest border mb-2 ${cfg.cls}`}>
              <StatusIcon size={10} /> {cfg.label}
            </div>
            <h3 className="font-bold text-base leading-tight">
              Update Delivery Status
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
              Order #{order.orderId.split("-")[0].toUpperCase()} · {order.fullName}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-accent flex items-center justify-center
              text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-4">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {inp("Tracking Number",
            "trackingNumber",
            "e.g. DHL1234567890",
            Package,
            "text",
            needsTracking ? "Required when marking as shipped." : undefined,
          )}
          {inp("Carrier Tracking URL",
            "trackingUrl",
            "https://track.dhl.com/…",
            Link2,
            "url",
            "Optional — customers can click to track directly.",
          )}
          {inp("Estimated Delivery Date",
            "estimatedDelivery",
            "",
            CalendarDays,
            "date",
          )}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground
              uppercase tracking-widest mb-1.5">
              <StickyNote size={11} /> Note to Customer
            </label>
            <textarea
              value={form.shippingNotes}
              onChange={(e) => setForm({ ...form, shippingNotes: e.target.value })}
              placeholder="e.g. Left with neighbour, customs delay, etc."
              rows={3}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm
                outline-none focus:border-primary transition-colors resize-none
                placeholder:text-muted-foreground/40"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Visible to the customer on their tracking page.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-border bg-accent/10 flex gap-3">
          <button onClick={onClose}
            className="px-5 py-3 rounded-xl font-bold text-sm border border-border
              text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground
              hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : <><StatusIcon size={15} /> Confirm — Mark as {cfg.label}</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon }: {
  label: string; value: number; icon: React.ElementType;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
          {label}
        </p>
        <Icon size={15} className="text-muted-foreground" />
      </div>
      <p className="text-3xl font-black tabular-nums">{value}</p>
    </div>
  );
}

// ─── ORDER ROW ────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  onOpenUpdate,
}: {
  order: Order;
  onOpenUpdate: (order: Order, next: OrderStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = S[order.status];
  const StatusIcon = cfg.icon;
  const explorer = order.chainId ? CHAIN_EXPLORERS[order.chainId] : CHAIN_EXPLORERS[8453];
  const chainName = order.chainId ? CHAIN_NAMES[order.chainId] : "Base";

  const friendlyItem = order.itemId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const copyAddress = () => {
    const text = [
      order.fullName,
      order.shippingAddress.street,
      `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zip}`,
      order.shippingAddress.country,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Address copied!");
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      {/* ── Collapsed row ── */}
      <div
        className="flex flex-wrap items-center gap-4 px-6 py-4 cursor-pointer
          hover:bg-accent/20 transition-colors select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px]
          font-black uppercase tracking-widest border shrink-0 ${cfg.cls}`}>
          <StatusIcon size={10} />
          {cfg.label}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{friendlyItem}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className="text-[10px] font-mono text-muted-foreground">
              {order.walletAddress.slice(0, 8)}…{order.walletAddress.slice(-6)}
            </span>
            <span className="text-border">·</span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(order.createdAt).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })}
            </span>
            <span className="text-border">·</span>
            <a href={`${explorer}${order.txHash}`} target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-primary/60 hover:text-primary flex items-center
                gap-0.5 transition-colors">
              Tx {chainName} <ExternalLink size={9} />
            </a>
            {order.trackingNumber && (
              <>
                <span className="text-border">·</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  🚚 {order.trackingNumber}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground/40 hidden sm:block">
            #{order.orderId.split("-")[0].toUpperCase()}
          </span>
          <ChevronDown
            size={16}
            className={`text-muted-foreground transition-transform duration-200
              ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* ── Expanded ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="px-6 py-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Shipping address */}
              <div className="bg-accent/20 border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-muted-foreground" />
                    <p className="text-[10px] font-black text-muted-foreground uppercase
                      tracking-widest">
                      Destination
                    </p>
                  </div>
                  <button onClick={copyAddress}
                    className="text-muted-foreground hover:text-primary transition-colors">
                    <Copy size={13} />
                  </button>
                </div>
                <p className="font-bold text-sm">{order.fullName}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  {order.shippingAddress.street}<br />
                  {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                  {order.shippingAddress.zip}<br />
                  {order.shippingAddress.country}
                </p>
                <a href={`mailto:${order.email}`}
                  className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
                  <Mail size={12} className="text-muted-foreground" />
                  <span className="text-xs text-primary hover:underline truncate">{order.email}</span>
                </a>
              </div>

              {/* Tracking info (if any) */}
              <div className="bg-accent/20 border border-border rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Truck size={12} className="text-muted-foreground" />
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Tracking
                  </p>
                </div>
                {order.trackingNumber ? (
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Number</p>
                      <p className="font-mono font-bold text-sm">{order.trackingNumber}</p>
                    </div>
                    {order.trackingUrl && (
                      <a href={order.trackingUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline">
                        Carrier page <ExternalLink size={10} />
                      </a>
                    )}
                    {order.estimatedDelivery && (
                      <div>
                        <p className="text-[10px] text-muted-foreground">Est. delivery</p>
                        <p className="text-xs font-bold">
                          {new Date(order.estimatedDelivery).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/50 italic">
                    No tracking info added yet.
                  </p>
                )}
                {order.shippingNotes && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-1">Note</p>
                    <p className="text-xs leading-relaxed">{order.shippingNotes}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {order.status === "processing" && (
                  <button
                    onClick={() => onOpenUpdate(order, "shipped")}
                    className="w-full py-3 rounded-xl text-xs font-bold flex items-center
                      justify-center gap-2 bg-blue-500/10 border border-blue-500/25 text-blue-500
                      hover:bg-blue-500/20 transition-all"
                  >
                    <Truck size={13} /> Mark as Shipped
                  </button>
                )}
                
                {/* Edit / re-open update for any status */}
                {(order.status === "shipped" || order.status === "delivered") && (
                  <button
                    onClick={() => onOpenUpdate(order, order.status)}
                    className="w-full py-3 rounded-xl text-xs font-bold flex items-center
                      justify-center gap-2 bg-accent border border-border
                      text-muted-foreground hover:text-foreground transition-all"
                  >
                    <StickyNote size={13} /> Edit Tracking / Notes
                  </button>
                )}
                {order.status === "delivered" && (
                  <div className="w-full py-3 rounded-xl text-xs font-bold flex items-center
                    justify-center gap-2 bg-primary/5 border border-primary/15
                    text-primary/40 cursor-default">
                    <CheckCircle2 size={13} /> Fulfilled
                  </div>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(order.email);
                    toast.success("Email copied!");
                  }}
                  className="w-full py-3 rounded-xl text-xs font-bold flex items-center
                    justify-center gap-2 bg-accent border border-border
                    text-muted-foreground hover:text-foreground transition-all"
                >
                  <Mail size={13} /> Copy Customer Email
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AdminOrderDashboard() {
  const { address, isConnected } = useWallet();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [pendingUpdate, setPendingUpdate] = useState<{
    order: Order;
    next: OrderStatus;
  } | null>(null);

  const isAdmin = address?.toLowerCase() === ADMIN_WALLET.toLowerCase();

  const fetchOrders = useCallback(async (silent = false) => {
    if (!address) return;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/merch-orders?admin_address=${address}`
      );
      if (res.status === 403) { toast.error("Unauthorized."); return; }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [address]);

  useEffect(() => { if (isAdmin) fetchOrders(); else setLoading(false); }, [isAdmin, fetchOrders]);

  // After modal confirms, patch the order locally
  const handleUpdateSuccess = (orderId: string, updates: Partial<Order>) => {
    setOrders((prev) =>
      prev.map((o) => o.orderId === orderId ? { ...o, ...updates } : o)
    );
  };

  const stats = {
    total:      orders.length,
    processing: orders.filter((o) => o.status === "processing").length,
    shipped:    orders.filter((o) => o.status === "shipped").length,
    delivered:  orders.filter((o) => o.status === "delivered").length,
  };

  const filtered = orders.filter((o) => {
    const matchStatus = filter === "all" || o.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || o.fullName.toLowerCase().includes(q)
      || o.email.toLowerCase().includes(q)
      || o.orderId.toLowerCase().includes(q)
      || o.itemId.toLowerCase().includes(q)
      || o.walletAddress.toLowerCase().includes(q)
      || (o.trackingNumber ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // ── Auth gates ────────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="min-h-screen text-foreground bg-background">
        <nav className="border-b border-border">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/drop-token.png" alt="FaucetDrops" width={28} height={28}
                className="rounded-lg" />
              <span className="font-black text-sm hidden sm:block">FaucetDrops</span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <WalletConnectButton />
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="text-center space-y-4">
            <Package size={40} className="text-muted-foreground mx-auto" />
            <h2 className="font-black text-xl">Admin Portal</h2>
            <p className="text-muted-foreground text-sm">Connect your admin wallet to continue.</p>
            <WalletConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen text-foreground bg-background flex flex-col
        items-center justify-center gap-3">
        <AlertCircle size={40} className="text-destructive" />
        <h2 className="font-black text-xl">Access Denied</h2>
        <p className="text-muted-foreground text-xs font-mono">
          {address?.slice(0, 12)}…{address?.slice(-8)}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground bg-background pb-20">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 mr-4 shrink-0">
            <Image src="/drop-token.png" alt="FaucetDrops" width={28} height={28}
              className="rounded-lg" />
            <span className="font-black text-sm hidden sm:block">FaucetDrops</span>
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/admin" className="hover:text-foreground transition-colors">Admin</Link>
            <span className="text-border">/</span>
            <span className="text-foreground font-bold">Orders</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
           
            <button
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
              className="p-2 rounded-xl border border-border bg-card text-muted-foreground
                hover:text-foreground transition-colors"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
            <ThemeToggle />
            <WalletConnectButton />
          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-10">

        {/* ── Title ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Merchandise Logistics</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage shipping, tracking numbers and delivery status for all orders.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card
            border border-border rounded-xl px-4 py-2 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {address?.slice(0, 8)}…{address?.slice(-6)}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total Orders"  value={stats.total}      icon={BarChart2}    />
          <StatCard label="Processing"    value={stats.processing} icon={Clock}        />
          <StatCard label="Shipped"       value={stats.shipped}    icon={Send}         />
          <StatCard label="Delivered"     value={stats.delivered}  icon={CheckCircle2} />
        </div>

        {/* ── Filters + search ── */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
            {(["all", "processing", "shipped", "delivered"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black capitalize
                  transition-all
                  ${filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"}`}>
                {f}
                {f !== "all" && (
                  <span className="ml-1.5 opacity-60">({stats[f]})</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-card border
            border-border rounded-xl px-4 py-2 focus-within:border-primary/50 transition-colors">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input type="text"
              placeholder="Name, email, wallet, tracking number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs outline-none
                placeholder:text-muted-foreground/40" />
          </div>
        </div>

        {/* ── Order list ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-card border border-border rounded-2xl animate-pulse"
                style={{ opacity: 1 - i * 0.18 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Package size={36} className="text-muted-foreground/30 mb-4" />
            <p className="font-bold text-muted-foreground">
              {search ? "No matching orders" : "No orders yet"}
            </p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              {search ? "Try a different search" : "Orders appear here once customers redeem items"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {filtered.map((order) => (
                <OrderRow
                  key={order.orderId}
                  order={order}
                  onOpenUpdate={(o, next) => setPendingUpdate({ order: o, next })}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p className="text-[10px] text-muted-foreground/40 text-center mt-8">
            Showing {filtered.length} of {orders.length} orders
          </p>
        )}
      </main>

      {/* ── Status update modal ── */}
      <AnimatePresence>
        {pendingUpdate && (
          <UpdateStatusModal
            order={pendingUpdate.order}
            newStatus={pendingUpdate.next}
            adminAddress={address!}
            onClose={() => setPendingUpdate(null)}
            onSuccess={(updates) => {
              handleUpdateSuccess(pendingUpdate.order.orderId, updates);
              setPendingUpdate(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}