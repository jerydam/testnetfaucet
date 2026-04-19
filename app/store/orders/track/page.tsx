"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Truck, CheckCircle2, Clock, Search,
  ExternalLink, Droplets, MapPin, Mail, Copy,
  ArrowRight, Loader2, ShoppingBag, PartyPopper, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/header';

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
    street: string; city: string;
    state: string; zip: string; country: string;
  };
}

const STEPS: { key: OrderStatus; label: string; desc: string; icon: React.ElementType }[] = [
  { key: "processing", label: "Order Placed",  desc: "Received and being processed.", icon: Clock        },
  { key: "shipped",    label: "Shipped",        desc: "Your package is on its way.",   icon: Truck        },
  { key: "delivered",  label: "Delivered",      desc: "Order has been delivered.",     icon: CheckCircle2 },
];

const ITEM_IMAGES: Record<string, string> = {
  merch_tshirt_01:             "/tshirt-front.jpg",
  merch_tshirt_02:             "/merchB.jpg",
  merch_hoodie_01:             "/hoodie-front.jpg",
  merch_cap_black_01:          "/capB.jpeg",
  merch_cap_trucker_01:        "/capw.jpeg",
  merch_bottle_black_01:       "/mugb.jpeg",
  merch_bottle_white_01:       "/mugw.jpg",
  merch_backpack_01:           "/bag.jpeg",
  merch_bracelet_rope_01:      "/bracelet.jpeg",
  merch_bracelet_silicone_01:  "/bracelet.jpeg",
  merch_jug_01:                "/jug.jpeg",
  merch_pen_01:                "/pen.jpeg",
  merch_stickers_01:           "/sticker.jpeg",
  merch_writing_01:            "/writing.jpeg",
  merch_book_01:               "/book.jpeg",
};

const STATUS_ORDER: OrderStatus[] = ["processing", "shipped", "delivered"];
function statusIndex(s: OrderStatus) { return STATUS_ORDER.indexOf(s); }

// ── Confirm delivery modal ────────────────────────────────────────────────────

function ConfirmDeliveryModal({
  order,
  onClose,
  onConfirmed,
}: {
  order: Order;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const friendlyName = order.itemId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/droplist/order/${order.orderId}/confirm-delivery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: order.walletAddress }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to confirm delivery.");
      }
      toast.success("Delivery confirmed! Thanks for letting us know 🎉");
      onConfirmed();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Something went wrong. Please try again.");
    } finally {
      setConfirming(false);
    }
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
        className="relative z-10 w-full max-w-sm bg-card border border-border
          rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Card header */}
        <div className="px-6 py-5 border-b border-border bg-accent/20 flex flex-wrap
          items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl border border-border overflow-hidden shrink-0">
              {ITEM_IMAGES[order.itemId] ? (
                <img
                  src={ITEM_IMAGES[order.itemId]}
                  alt={friendlyName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-accent/40 flex items-center justify-center">
                  <ShoppingBag size={20} className="text-muted-foreground" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag size={14} className="text-primary" />
                <span className="text-xs font-bold text-primary">{friendlyName}</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                Order #{order.orderId.split("-")[0].toUpperCase()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Placed on</p>
            <p className="text-xs font-bold">
              {new Date(order.createdAt).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-2">
          <h3 className="font-black text-lg leading-tight mb-1">
            Got your package?
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Confirm you've received{" "}
            <span className="font-bold text-foreground">{friendlyName}</span>.
            This helps us keep fulfilment records accurate.
          </p>

          {/* Order summary pill */}
          <div className="mt-4 flex items-center gap-3 bg-accent/40 border border-border
            rounded-2xl px-4 py-3">
            <ShoppingBag size={14} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{friendlyName}</p>
              <p className="text-[10px] font-mono text-muted-foreground">
                #{order.orderId.split("-")[0].toUpperCase()}
              </p>
            </div>
            {order.trackingNumber && (
              <span className="ml-auto text-[10px] font-mono text-muted-foreground shrink-0">
                {order.trackingNumber}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 flex gap-3">
          <button onClick={onClose}
            className="px-5 py-3 rounded-xl font-bold text-sm border border-border
              text-muted-foreground hover:text-foreground transition-colors">
            Not yet
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-primary
              text-primary-foreground hover:opacity-90 transition-all
              disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {confirming
              ? <><Loader2 size={15} className="animate-spin" /> Confirming…</>
              : <><CheckCircle2 size={15} /> Yes, I got it!</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Order tracker card ────────────────────────────────────────────────────────

function OrderTrackerCard({ order: initialOrder }: { order: Order }) {
  const [order, setOrder] = useState(initialOrder);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const currentIdx = statusIndex(order.status);
  const explorer   = order.chainId ? CHAIN_EXPLORERS[order.chainId] : CHAIN_EXPLORERS[8453];
  const chainName  = order.chainId ? CHAIN_NAMES[order.chainId] : "Base";

  const friendlyName = order.itemId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const progressPct = (currentIdx / (STEPS.length - 1)) * 100;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-3xl overflow-hidden"
      >
        {/* Card header — with item image */}
        <div className="px-6 py-5 border-b border-border bg-accent/20 flex flex-wrap
          items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Item image thumbnail */}
            <div className="w-14 h-14 rounded-xl border border-border overflow-hidden shrink-0">
              {ITEM_IMAGES[order.itemId] ? (
                <img
                  src={ITEM_IMAGES[order.itemId]}
                  alt={friendlyName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-accent/40 flex items-center justify-center">
                  <ShoppingBag size={20} className="text-muted-foreground" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag size={14} className="text-primary" />
                <span className="text-xs font-bold text-primary">{friendlyName}</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                Order #{order.orderId.split("-")[0].toUpperCase()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Placed on</p>
            <p className="text-xs font-bold">
              {new Date(order.createdAt).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">

          {/* Progress stepper */}
          <div className="relative">
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-border z-0" />
            <div
              className="absolute top-5 left-5 h-0.5 bg-primary z-0 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
            <div className="relative z-10 flex justify-between">
              {STEPS.map((step, i) => {
                const done   = i <= currentIdx;
                const active = i === currentIdx;
                const Icon   = step.icon;
                return (
                  <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center
                      border-2 transition-all duration-500
                      ${done ? "bg-primary border-primary" : "bg-card border-border"}`}>
                      <Icon size={16}
                        className={done ? "text-primary-foreground" : "text-muted-foreground"} />
                    </div>
                    <div className="text-center px-1">
                      <p className={`text-[10px] font-black leading-tight
                        ${active
                          ? "text-foreground"
                          : done
                            ? "text-muted-foreground"
                            : "text-muted-foreground/40"}`}>
                        {step.label}
                      </p>
                      {active && (
                        <p className="text-[9px] text-primary mt-0.5 hidden sm:block">
                          {step.desc}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Confirm delivery CTA (only when shipped) ── */}
          {order.status === "shipped" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-primary/5 border border-primary/20 rounded-2xl p-4
                flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center
                  justify-center shrink-0 mt-0.5">
                  <Truck size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold">Has your order arrived?</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Let us know once you receive your package.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary
                  text-primary-foreground rounded-xl text-xs font-bold
                  hover:opacity-90 transition-all active:scale-95 shrink-0"
              >
                <CheckCircle2 size={13} />
                Confirm Delivery
              </button>
            </motion.div>
          )}

          {/* ── Delivered banner ── */}
          {order.status === "delivered" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-primary/5 border border-primary/20 rounded-2xl p-4
                flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center
                justify-center shrink-0">
                <PartyPopper size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-primary">Delivery Confirmed!</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Thanks for confirming. Enjoy your gear! 🎉
                </p>
              </div>
            </motion.div>
          )}

          {/* Tracking details */}
          {order.status !== "processing" && (
            <div className="bg-accent/30 border border-border rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Tracking Details
              </p>
              {order.trackingNumber ? (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Tracking Number</p>
                    <p className="font-mono font-bold text-sm">{order.trackingNumber}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(order.trackingNumber!);
                        toast.success("Copied!");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent
                        border border-border text-xs text-muted-foreground
                        hover:text-foreground transition-colors"
                    >
                      <Copy size={11} /> Copy
                    </button>
                    {order.trackingUrl && (
                      <a href={order.trackingUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                          bg-primary/10 border border-primary/25 text-xs text-primary
                          hover:bg-primary/20 transition-colors">
                        Track <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Tracking info will appear here once scanned by the carrier.
                </p>
              )}
              {order.estimatedDelivery && (
                <div className="pt-3 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground">Estimated Delivery</p>
                  <p className="font-bold text-sm">
                    {new Date(order.estimatedDelivery).toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric",
                    })}
                  </p>
                </div>
              )}
              {order.shippingNotes && (
                <div className="pt-3 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-1">Note from team</p>
                  <p className="text-xs leading-relaxed">{order.shippingNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Address + tx */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[160px]">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin size={12} className="text-muted-foreground" />
                <p className="text-[10px] font-black text-muted-foreground uppercase
                  tracking-widest">
                  Shipping to
                </p>
              </div>
              <p className="font-bold text-sm">{order.fullName}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {order.shippingAddress.street}<br />
                {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                {order.shippingAddress.zip}<br />
                {order.shippingAddress.country}
              </p>
            </div>
            <div className="flex-1 min-w-[160px]">
              <div className="flex items-center gap-1.5 mb-2">
                <Droplets size={12} className="text-muted-foreground" />
                <p className="text-[10px] font-black text-muted-foreground uppercase
                  tracking-widest">
                  Burn Transaction
                </p>
              </div>
              <a
                href={`${explorer}${order.txHash}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary
                  hover:underline font-mono"
              >
                {order.txHash.slice(0, 10)}…{order.txHash.slice(-8)}
                <ExternalLink size={10} />
              </a>
              <p className="text-[10px] text-muted-foreground mt-0.5">{chainName}</p>
            </div>
          </div>

          {/* Support */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground">
              Questions?{" "}
              <a href="mailto:support@faucetdrops.io"
                className="text-primary hover:underline">
                support@faucetdrops.io
              </a>
            </p>
            <a
              href={`mailto:support@faucetdrops.io?subject=Order%20${order.orderId.split("-")[0].toUpperCase()}`}
              className="flex items-center gap-1 text-[10px] text-muted-foreground
                hover:text-foreground transition-colors"
            >
              <Mail size={11} /> Contact
            </a>
          </div>
        </div>
      </motion.div>

      {/* Confirm delivery modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <ConfirmDeliveryModal
            order={order}
            onClose={() => setShowConfirmModal(false)}
            onConfirmed={() => setOrder((o) => ({ ...o, status: "delivered" }))}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Inner content + Page export ───────────────────────────────────────────────

function TrackingContent() {
  const searchParams = useSearchParams();
  const incomingId   = searchParams.get("id") ?? "";

  const [orders, setOrders]           = useState<Order[]>([]);
  const [loading, setLoading]         = useState(false);
  const [searched, setSearched]       = useState(false);
  const [manualInput, setManualInput] = useState(incomingId);
  const [lookupValue, setLookupValue] = useState("");

  const fetchOrders = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    try {
      const isWallet  = query.startsWith("0x") && query.length === 42;
      const endpoint  = isWallet
        ? `${API_BASE}/api/droplist/my-orders?wallet_address=${query}`
        : `${API_BASE}/api/droplist/order/${query}`;

      const res  = await fetch(endpoint);
      if (!res.ok) { setOrders([]); setSearched(true); return; }
      const data = await res.json();

      const list: Order[] = data.orders
        ? data.orders
        : data.order
          ? [data.order]
          : [];

      setOrders(list);
      setLookupValue(query);
    } catch {
      setOrders([]);
      toast.error("Could not fetch order. Please try again.");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  useEffect(() => {
    if (incomingId) {
      setManualInput(incomingId);
      setLookupValue(incomingId);
      fetchOrders(incomingId);
    }
  }, [incomingId, fetchOrders]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    fetchOrders(manualInput.trim());
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-20">
      <div className="mb-8">
        <h2 className="text-2xl font-black tracking-tight">Track Order</h2>
        <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
          Enter your wallet address or order ID to see the latest status.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <div className="flex-1 flex items-center gap-3 bg-card border border-border
          rounded-2xl px-5 py-3.5 focus-within:border-primary/50 transition-colors">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="0x wallet address or order ID…"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none
              placeholder:text-muted-foreground/40"
          />
          {manualInput && (
            <button type="button" onClick={() => setManualInput("")}
              className="text-muted-foreground hover:text-foreground transition-colors text-xs">
              ✕
            </button>
          )}
        </div>
        <button type="submit" disabled={loading || !manualInput.trim()}
          className="px-5 py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold
            text-sm hover:opacity-90 transition-all disabled:opacity-40
            disabled:cursor-not-allowed flex items-center gap-2 shrink-0">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          <span className="hidden sm:inline">Search</span>
        </button>
      </form>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-border" />
            <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Looking up your order…</p>
        </div>
      )}

      {!loading && searched && (
        <AnimatePresence mode="wait">
          {orders.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent border border-border
                flex items-center justify-center mb-5">
                <Package size={28} className="text-muted-foreground/50" />
              </div>
              <p className="font-bold text-lg mb-1">No order found</p>
              <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">
                No order found for{" "}
                <span className="font-mono text-foreground">
                  {lookupValue.length > 20
                    ? `${lookupValue.slice(0, 10)}…${lookupValue.slice(-8)}`
                    : lookupValue}
                </span>.
              </p>
              <Link href="/store/orders"
                className="mt-6 flex items-center gap-2 text-xs text-primary hover:underline">
                ← Back to my orders
              </Link>
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {orders.length} order{orders.length !== 1 ? "s" : ""} found
                </p>
                <Link href="/store/orders"
                  className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
                  ← All orders
                </Link>
              </div>
              {orders.map((order) => (
                <OrderTrackerCard key={order.orderId} order={order} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {!loading && !searched && (
        <div className="border border-dashed border-border rounded-3xl p-12
          flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent border border-border
            flex items-center justify-center">
            <Truck size={24} className="text-muted-foreground/50" />
          </div>
          <div>
            <p className="font-bold mb-1">Enter an address or order ID above</p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Your order ID is in the confirmation email you received after
              redeeming your Drop Points.
            </p>
          </div>
          <Link href="/store/orders"
            className="text-xs text-primary hover:underline flex items-center gap-1">
            ← View all my orders
          </Link>
        </div>
      )}
    </main>
  );
}

export default function OrderTrackingPage() {
  return (
    <div className="min-h-screen text-foreground bg-background">
      <Header pageTitle="Track Order" hideAction />
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      }>
        <TrackingContent />
      </Suspense>
    </div>
  );
}