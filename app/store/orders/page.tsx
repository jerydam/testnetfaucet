"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Truck, CheckCircle2, Clock,
  ChevronRight, RefreshCw, ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from "@/hooks/use-wallet";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/header';
import { WalletConnectButton } from "@/components/wallet-connect";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app";

const CHAIN_NAMES: Record<number, string> = {
  42220: "Celo", 8453: "Base", 42161: "Arbitrum", 56: "BNB Chain", 1135: "Lisk",
};

const CHAIN_COLORS: Record<number, string> = {
  42220: "#FCFF52", 8453: "#0052FF", 42161: "#28A0F0", 56: "#F0B90B", 1135: "#4CAF50",
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
  estimatedDelivery?: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

const STATUS_CONFIG: Record<OrderStatus, {
  label: string;
  icon: React.ElementType;
  bgCls: string;
  textCls: string;
  borderCls: string;
  step: number;
}> = {
  processing: {
    label: "Processing",
    icon: Clock,
    bgCls: "bg-amber-500/10",
    textCls: "text-amber-500",
    borderCls: "border-amber-500/25",
    step: 1,
  },
  shipped: {
    label: "Shipped",
    icon: Truck,
    bgCls: "bg-blue-500/10",
    textCls: "text-blue-500",
    borderCls: "border-blue-500/25",
    step: 2,
  },
  delivered: {
    label: "Delivered",
    icon: CheckCircle2,
    bgCls: "bg-primary/10",
    textCls: "text-primary",
    borderCls: "border-primary/25",
    step: 3,
  },
};
// Frontend (add to both orders/page.tsx and orders/track/page.tsx)
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
// ── Mini progress bar ─────────────────────────────────────────────────────────

function OrderProgress({ status }: { status: OrderStatus }) {
  const step = STATUS_CONFIG[status].step;
  return (
    <div className="flex items-center gap-1 mt-3">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={`h-1 flex-1 rounded-full transition-all duration-500
            ${s <= step ? "bg-primary" : "bg-border"}`}
        />
      ))}
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────

function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  const cfg = STATUS_CONFIG[order.status];
  const StatusIcon = cfg.icon;

  const friendlyItem = order.itemId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const chainName = order.chainId ? CHAIN_NAMES[order.chainId] : null;
  const chainColor = order.chainId ? CHAIN_COLORS[order.chainId] : null;

  const formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="bg-card border border-border rounded-2xl p-5 cursor-pointer
        hover:border-primary/40 transition-all group"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl border border-border overflow-hidden shrink-0">
  {ITEM_IMAGES[order.itemId] ? (
    <img
      src={ITEM_IMAGES[order.itemId]}
      alt={friendlyItem}
      className="w-full h-full object-cover"
    />
  ) : (
    <div className="w-full h-full bg-accent/40 flex items-center justify-center">
      <ShoppingBag size={20} className="text-muted-foreground" />
    </div>
  )}
</div>

        <div className="flex-1 min-w-0">
          {/* Name + status */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-bold text-sm leading-tight">{friendlyItem}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                #{order.orderId.split("-")[0].toUpperCase()}
              </p>
            </div>
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px]
              font-black uppercase tracking-widest border shrink-0
              ${cfg.bgCls} ${cfg.textCls} ${cfg.borderCls}`}>
              <StatusIcon size={9} />
              {cfg.label}
            </span>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            <span className="text-[10px] text-muted-foreground">{formattedDate}</span>

            {chainName && chainColor && (
              <span className="flex items-center gap-1 text-[10px] font-bold"
                style={{ color: chainColor }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: chainColor }} />
                {chainName}
              </span>
            )}

            {order.trackingNumber && (
              <span className="text-[10px] font-mono text-muted-foreground">
                🚚 {order.trackingNumber}
              </span>
            )}

            {order.estimatedDelivery && order.status === "shipped" && (
              <span className="text-[10px] text-muted-foreground">
                Est.{" "}
                {new Date(order.estimatedDelivery).toLocaleDateString("en-US", {
                  month: "short", day: "numeric",
                })}
              </span>
            )}
          </div>

          <OrderProgress status={order.status} />
        </div>

        <ChevronRight
          size={16}
          className="text-muted-foreground/40 group-hover:text-primary
            group-hover:translate-x-0.5 transition-all mt-1 shrink-0"
        />
      </div>
    </motion.div>
  );
}

// ── Filter tab ────────────────────────────────────────────────────────────────

function FilterTab({
  label, active, count, onClick,
}: {
  label: string; active: boolean; count: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-black
        capitalize transition-all
        ${active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
      {count > 0 && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full
          ${active
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-border text-muted-foreground"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyOrdersPage() {
  const { address, isConnected } = useWallet();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");

  const fetchOrders = useCallback(async (silent = false) => {
    if (!address) return;
    if (silent) setRefreshing(true); else setLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/api/droplist/my-orders?wallet_address=${address}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      toast.error("Could not load orders. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) fetchOrders();
  }, [address, fetchOrders]);

  const handleRefresh = useCallback(() => fetchOrders(true), [fetchOrders]);

  const filtered = filter === "all"
    ? orders
    : orders.filter((o) => o.status === filter);

  const counts = {
    all:        orders.length,
    processing: orders.filter((o) => o.status === "processing").length,
    shipped:    orders.filter((o) => o.status === "shipped").length,
    delivered:  orders.filter((o) => o.status === "delivered").length,
  };

  const handleOrderClick = (order: Order) => {
    router.push(`/store/orders/track?id=${order.orderId}`);
  };

  return (
    <div className="min-h-screen text-foreground bg-background pb-20">

      <Header
        pageTitle="My Orders"
        hideAction
        onRefresh={handleRefresh}
        loading={refreshing}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8">

        {/* ── Not connected ── */}
        {!isConnected && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-accent border border-border
              flex items-center justify-center">
              <Package size={26} className="text-muted-foreground/50" />
            </div>
            <div>
              <h2 className="font-black text-xl mb-1">Connect your wallet</h2>
              <p className="text-muted-foreground text-sm">
                Connect to view your order history.
              </p>
            </div>
            <WalletConnectButton />
          </div>
        )}

        {isConnected && (
          <>
            {/* ── Title ── */}
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Order History</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {loading
                    ? "Loading…"
                    : orders.length > 0
                      ? `${orders.length} order${orders.length !== 1 ? "s" : ""} · tap any to track`
                      : "Your merchandise orders appear here"}
                </p>
              </div>
              {/* Wallet pill */}
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground
                bg-card border border-border rounded-xl px-3 py-2 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </div>
            </div>

            {/* ── Filter tabs ── */}
            {orders.length > 0 && (
              <div className="flex bg-card border border-border rounded-xl p-1 gap-1 mb-5
                overflow-x-auto no-scrollbar">
                {(["all", "processing", "shipped", "delivered"] as const).map((f) => (
                  <FilterTab
                    key={f}
                    label={f}
                    active={filter === f}
                    count={counts[f]}
                    onClick={() => setFilter(f)}
                  />
                ))}
              </div>
            )}

            {/* ── Loading ── */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-border" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
                  <Package size={16} className="absolute inset-0 m-auto text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Loading your orders…</p>
              </div>
            )}

            {/* ── Empty ── */}
            {!loading && orders.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-24 text-center"
              >
                <div className="w-20 h-20 rounded-2xl bg-accent border border-border
                  flex items-center justify-center mb-6">
                  <Package size={32} className="text-muted-foreground/40" />
                </div>
                <h3 className="font-bold text-lg mb-2">No orders yet</h3>
                <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed mb-6">
                  When you redeem Drop Points for merchandise, your orders will appear here.
                </p>
                <Link
                  href="/store"
                  className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground
                    rounded-xl text-xs font-bold hover:opacity-90 transition-all"
                >
                  <ShoppingBag size={14} />
                  Browse the Store
                </Link>
              </motion.div>
            )}

            {/* ── Filtered empty ── */}
            {!loading && orders.length > 0 && filtered.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <Package size={28} className="text-muted-foreground/30 mb-3" />
                <p className="font-bold text-sm text-muted-foreground">
                  No {filter} orders
                </p>
              </motion.div>
            )}

            {/* ── Order list ── */}
            {!loading && filtered.length > 0 && (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {filtered.map((order, i) => (
                    <motion.div
                      key={order.orderId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <OrderCard
                        order={order}
                        onClick={() => handleOrderClick(order)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                <p className="text-[10px] text-muted-foreground/40 text-center pt-4">
                  Showing {filtered.length} of {orders.length} orders
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}