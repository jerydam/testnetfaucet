"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Contract, parseEther, JsonRpcProvider } from "ethers";
import { REDEEM_ABI } from "@/lib/abis";
import {
  ShoppingBag, Droplets, X, CheckCircle2,
  AlertCircle, RefreshCw, ExternalLink, Loader2,
  ChevronDown, Plus, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from "@/hooks/use-wallet";
import Image from 'next/image';
import { WalletConnectButton } from "@/components/wallet-connect";
import { Header } from '@/components/header';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const PLATFORM_OWNER = "0x9fBC2A0de6e5C5Fd96e8D11541608f5F328C0785";

const POINTS_CONTRACT_ADDRESSES: Record<number, string> = {
  42220: "0xF8F6D74E61A0FC2dd2feCd41dE384ba2fbf91b9D",
  8453:  "0x42fcB7C4D4a36D772c430ee8C7d026f627365BcB",
  42161: "0xEcb026D22f9aA7FD9Aa83B509834dB8Fd66B27F6",
  56:    "0x4C603fe32fe590D8A47B7f23b027dc24C2c762B1",
  1135:  "0x28B9DAB4Fd2CD9bF1A4773dB858e03Ee178AE075",
};

const CHAIN_META: Record<number, { name: string; color: string; explorer: string }> = {
  42220: { name: "Celo",      color: "#FCFF52", explorer: "https://celoscan.io/tx/" },
  8453:  { name: "Base",      color: "#0052FF", explorer: "https://basescan.org/tx/" },
  42161: { name: "Arbitrum",  color: "#28A0F0", explorer: "https://arbiscan.io/tx/" },
  56:    { name: "BNB Chain", color: "#F0B90B", explorer: "https://bscscan.com/tx/" },
  1135:  { name: "Lisk",      color: "#4CAF50", explorer: "https://blockscout.lisk.com/tx/" },
};

const RPC_URLS: Record<number, string> = {
  42220: "https://forno.celo.org",
  8453:  "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
  56:    "https://bsc-dataseed.binance.org",
  1135:  "https://rpc.api.lisk.com",
};

const BALANCE_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
];

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app";

const MERCH_ITEMS = [
  {
    id: "merch_tshirt_01",
    title: "Builder T-Shirt",
    description: "Premium 280g cotton, embroidered FaucetDrops logo. Ships worldwide.",
    cost: 100,
    stock: 200,
    tag: "POPULAR" as const,
  },
  {
    id: "merch_tshirt_02",
    title: "Builder T-Shirt",
    description: "Premium 280g cotton, embroidered FaucetDrops logo. Ships worldwide.",
    cost: 150,
    stock: 100,
    tag: "POPULAR" as const,
  },
  {
    id: "merch_hoodie_01",
    title: "Genesis Hoodie",
    description: "400g fleece, dark-mode inspired. Embroidered chest & back.",
    cost: 200,
    stock: 15,
    tag: "LIMITED" as const,
  },
  {
    id: "merch_cap_black_01",
    title: "Drop Points Cap",
    description: "Structured 6-panel cap with embroidered FaucetDrops logo. Adjustable strap. One size.",
    cost: 50,
    stock: 30,
    tag: null,
  },
  {
    id: "merch_cap_trucker_01",
    title: "FaucetDrops Trucker Cap",
    description: "Mesh-back trucker cap with bold FaucetDrops branding. Snapback closure. One size fits most.",
    cost: 40,
    stock: 25,
    tag: "NEW" as const,
  },
  {
    id: "merch_backpack_01",
    title: "Drop Backpack",
    description: "Premium tech backpack with all-over drop pattern, USB charging port, and embroidered FaucetDrops logo. Multiple compartments.",
    cost: 300,
    stock: 20,
    tag: "LIMITED" as const,
  },
  {
    id: "merch_bracelet_rope_01",
    title: "Builder Rope Bracelet",
    description: "Braided nylon cord bracelet with matte black magnetic clasp engraved with the FaucetDrops logo.",
    cost: 30,
    stock: 50,
    tag: "NEW" as const,
  },
  {
    id: "merch_bracelet_silicone_01",
    title: "Drop Silicone Band",
    description: "Silicone wristband with debossed FaucetDrops branding and drop pattern. Adjustable fit.",
    cost: 20,
    stock: 100,
    tag: null,
  },
  {
    id: "merch_jug_01",
    title: "FaucetDrops Jug",
    description: "64oz insulated steel jug with handle, straw lid, and all-over drop pattern. Keeps cold 24h. Navy finish.",
    cost: 120,
    stock: 25,
    tag: "NEW" as const,
  },
  {
    id: "merch_cup_01",
    title: "FaucetDrops Cup",
    description: "16oz double-walled stainless steel cup with spill-resistant lid. Features subtle drop pattern and embossed logo. Made in the USA.",
    cost: 50,
    stock: 25,
    tag: "NEW" as const,
  },
  {
    id: "merch_pen_01",
    title: "Tactical Drop Pen",
    description: "Matte black aluminium tactical pen with FaucetDrops branding and drop-pattern grip. Smooth gel ink.",
    cost: 25,
    stock: 75,
    tag: null,
  },
  {
    id: "merch_stickers_01",
    title: "Sticker Pack",
    description: "9-piece holographic sticker set — drop logos, 'Drip With Purpose' banner, FaucetDrops Tech patch, and the Drop mascot. Weatherproof vinyl.",
    cost: 15,
    stock: 200,
    tag: "POPULAR" as const,
  },
  {
    id: "merch_book_01",
    title: "FaucetDrops Book",
    description: "Comprehensive guide to FaucetDrops and its ecosystem. Perfect for developers and enthusiasts.",
    cost: 25,
    stock: 50,
    tag: "NEW" as const,
  },
  {
    id: "merch_writing_01",
    title: "FaucetDrops Writing Kit",
    description: "Complete writing kit with FaucetDrops branding. Includes pen, notebook, and tote bag.",
    cost: 50,
    stock: 10,
    tag: "NEW" as const,
  },
  {
    id: "merch_bottle_black_01",
    title: "Drop Bottle — Black",
    description: "750ml aluminium bottle with carabiner clip and FaucetDrops logo. BPA-free.",
    cost: 80,
    stock: 20,
    tag: null,
  },
  {
    id: "merch_bottle_white_01",
    title: "Drop Bottle — White",
    description: "750ml aluminium bottle with carabiner clip. Clean white finish with subtle drop pattern.",
    cost: 60,
    stock: 18,
    tag: "NEW" as const,
  },
];

// ─── TYPES ───────────────────────────────────────────────────────────────────

type MerchItem = typeof MERCH_ITEMS[0];
type ModalStep = "form" | "chain" | "confirm" | "processing" | "success";

const MERCH_IMAGES: Record<string, { front: string; back: string } | null> = {
  merch_tshirt_01:          { front: "/tshirt-front.jpg",  back: "/tshirt-back.jpg"  },
  merch_tshirt_02:          { front: "/merchB.jpg",        back: "/merchb.jpeg"        },
  merch_hoodie_01:          { front: "/hoodie-front.jpg",  back: "/hoodie-back.jpeg"  },
  merch_cap_black_01:       { front: "/capB.jpeg",         back: "/capB.jpeg"         },
  merch_backpack_01:        { front: "/bag.jpeg",          back: "/bag.jpeg"          },
  merch_bracelet_rope_01:   { front: "/bracelet.jpeg",     back: "/bracelet.jpeg"     },
  merch_bracelet_silicone_01:{ front: "/bracelet.jpeg",   back: "/bracelet.jpeg"     },
  merch_jug_01:             { front: "/jug.jpeg",          back: "/jug.jpeg"          },
  merch_cup_01:             { front: "/cup.jpeg",          back: "/cup.jpeg"          },
  merch_pen_01:             { front: "/pen.jpeg",          back: "/pen.jpeg"          },
  merch_stickers_01:        { front: "/sticker.jpeg",      back: "/sticker.jpeg"      },
  merch_cap_trucker_01:     { front: "/capw.jpeg",          back: "/capw.jpeg"          },
  merch_bottle_black_01:    { front: "/mugb.jpg",          back: "/mugb.jpeg"          },
  merch_bottle_white_01:    { front: "/mugw.jpg",          back: "/mugw.jpg"          },
  merch_writing_01:         { front: "/writing.jpeg",      back: "/writing.jpeg"      },
  merch_book_01:            { front: "/book.jpeg",         back: "/book.jpeg"         },
};

interface ChainBalance {
  chainId: number;
  balance: number;
  loading: boolean;
  error: boolean;
}

interface ShippingForm {
  fullName: string; email: string; street: string;
  city: string; state: string; zip: string; country: string;
}

// ─── BALANCE BREAKDOWN PILL ───────────────────────────────────────────────────

function BalanceBreakdown({
  chainBalances,
  totalBalance,
  loading,
  onRefresh,
}: {
  chainBalances: ChainBalance[];
  totalBalance: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden min-w-[240px]">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
        className="w-full flex items-center gap-4 p-5 hover:bg-accent/20 transition-colors cursor-pointer"
      >
        <div className="w-11 h-11 relative shrink-0">
          <Image src="/drop-token.png" alt="DROP" fill className="object-contain" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            Total Balance
          </p>
          {loading ? (
            <div className="flex items-center gap-2 mt-1">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Checking chains…</span>
            </div>
          ) : (
            <p className="text-2xl font-black tabular-nums">
              {totalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <ChevronDown
            size={15}
            className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="px-5 py-3 space-y-2.5">
              {chainBalances.map((cb) => {
                const meta = CHAIN_META[cb.chainId];
                return (
                  <div key={cb.chainId} className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[7px] font-black shrink-0"
                      style={{
                        background: `${meta.color}18`,
                        border: `1px solid ${meta.color}35`,
                        color: meta.color,
                      }}
                    >
                      {meta.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs text-muted-foreground flex-1">{meta.name}</span>
                    {cb.loading ? (
                      <Loader2 size={11} className="animate-spin text-muted-foreground" />
                    ) : cb.error ? (
                      <span className="text-[10px] text-destructive/60">—</span>
                    ) : (
                      <span className={`text-xs font-black tabular-nums ${cb.balance > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                        {cb.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                );
              })}
              <div className="border-t border-border pt-2.5 flex items-center justify-between">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total</span>
                <span className="text-sm font-black text-primary tabular-nums">
                  {totalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} DROP
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MERCH CARD 3D ────────────────────────────────────────────────────────────

function MerchCard3D({ itemId }: { itemId: string }) {
  const [flipped, setFlipped] = useState(false);
  const images = MERCH_IMAGES[itemId];
  const hasTwoSides = images !== null && images?.front !== images?.back;

  if (!images) {
    return <ShoppingBag className="w-16 h-16 text-muted-foreground/25" />;
  }

  return (
    <div className="w-full h-full relative" style={{ perspective: "900px" }}>
      <div
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={() => hasTwoSides && setFlipped((f) => !f)}
        onMouseEnter={() => hasTwoSides && setFlipped(true)}
        onMouseLeave={() => hasTwoSides && setFlipped(false)}
      />
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 22 }}
        style={{ transformStyle: "preserve-3d", position: "relative", width: "100%", height: "100%" }}
      >
        <div style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0 }}>
          <Image src={images.front} alt="Front" fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
        </div>
        <div style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0, transform: "rotateY(180deg)" }}>
          <Image src={images.back} alt="Back" fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
        </div>
      </motion.div>
      {hasTwoSides && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: flipped ? 0 : 1 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        >
          <span className="text-[9px] font-bold bg-background/70 backdrop-blur px-2 py-0.5 rounded-full text-muted-foreground border border-border/40 whitespace-nowrap">
            tap to flip
          </span>
        </motion.div>
      )}
    </div>
  );
}

// ─── ADMIN STOCK BUTTON ───────────────────────────────────────────────────────

function StockIncreaseButton({
  itemId,
  adminAddress,
  currentStock,
  onStockUpdated,
}: {
  itemId: string;
  adminAddress: string;
  currentStock: number;
  onStockUpdated: (itemId: string, newStock: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(10);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAdd = async () => {
    if (qty < 1 || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/merch/stock/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminAddress, quantity: qty }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onStockUpdated(itemId, data.new_stock);
      toast.success(`Stock updated → ${data.new_stock} units`);
      setOpen(false);
      setQty(10);
    } catch (e: any) {
      toast.error(e.message || "Failed to update stock");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title="Add stock"
        className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center
          justify-center text-primary hover:bg-primary/20 transition-all active:scale-95 z-20"
      >
        <Plus size={13} strokeWidth={2.5} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 4 }}
            transition={{ duration: 0.14 }}
            className="absolute bottom-9 right-0 z-50 bg-card border border-border rounded-xl
              shadow-xl p-3 w-52"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
              Add stock — {itemId.replace("merch_", "").replace(/_/g, " ")}
            </p>

            <div className="flex items-center gap-2 mb-3">
              <div className="text-[10px] text-muted-foreground">Current:</div>
              <div className="text-xs font-black">{currentStock}</div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center
                  text-muted-foreground hover:text-foreground transition-colors text-sm font-bold"
              >−</button>
              <input
                type="number"
                min={1}
                max={10000}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))}
                className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5
                  text-center text-sm font-black outline-none focus:border-primary"
              />
              <button
                onClick={() => setQty((q) => Math.min(10000, q + 1))}
                className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center
                  text-muted-foreground hover:text-foreground transition-colors text-sm font-bold"
              >+</button>
            </div>

            {/* Quick presets */}
            <div className="flex gap-1.5 mb-3">
              {[5, 10, 25, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => setQty(n)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all
                    ${qty === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-muted-foreground hover:text-foreground"}`}
                >
                  +{n}
                </button>
              ))}
            </div>

            <button
              onClick={handleAdd}
              disabled={loading}
              className="w-full py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground
                hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <><Loader2 size={12} className="animate-spin" /> Saving…</>
              ) : (
                <><Check size={12} /> Add {qty} units</>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CHECKOUT MODAL ───────────────────────────────────────────────────────────

function Field({
  k, label, span2 = false, type = "text", value, onChange,
}: {
  k: keyof ShippingForm;
  label: string;
  span2?: boolean;
  type?: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
        {label}
      </label>
      <input
        required
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm
          outline-none focus:border-primary transition-colors"
      />
    </div>
  );
}

function CheckoutModal({
  item,
  address,
  signer,
  chainId,
  onClose,
  onSuccess,
}: {
  item: MerchItem;
  address: string;
  signer: any;
  chainId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<ModalStep>("form");
  const [selectedChainId, setSelectedChainId] = useState<number | null>(
    chainId && POINTS_CONTRACT_ADDRESSES[chainId] ? chainId : null
  );
  const [chainBalances, setChainBalances] = useState<Record<number, number>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [form, setForm] = useState<ShippingForm>({
    fullName: "", email: "", street: "",
    city: "", state: "", zip: "", country: "Nigeria",
  });

  const availableChains = Object.keys(POINTS_CONTRACT_ADDRESSES).map(Number);

  const fetchChainBalances = useCallback(async () => {
    if (!address) return;
    setLoadingBalances(true);
    const results: Record<number, number> = {};
    await Promise.all(
      availableChains.map(async (cid) => {
        try {
          const prov = new JsonRpcProvider(RPC_URLS[cid]);
          const contract = new Contract(POINTS_CONTRACT_ADDRESSES[cid], REDEEM_ABI, prov);
          const raw: bigint = await contract.balanceOf(address);
          results[cid] = Number(raw) / 1e18;
        } catch {
          results[cid] = 0;
        }
      })
    );
    setChainBalances(results);
    setLoadingBalances(false);
  }, [address]);

  useEffect(() => {
    if (step === "chain") fetchChainBalances();
  }, [step, fetchChainBalances]);

  const formValid =
    form.fullName && form.email && form.street &&
    form.city && form.state && form.zip && form.country;

  const handleRedeem = async () => {
    if (!selectedChainId || !signer || !address) return;
    const contractAddr = POINTS_CONTRACT_ADDRESSES[selectedChainId];
    if (!contractAddr) return;
    setStep("processing");
    const tid = "merch-redeem";
    try {
      if (chainId !== selectedChainId && (window as any).ethereum) {
        toast.loading("Switching network…", { id: tid });
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${selectedChainId.toString(16)}` }],
        });
      }
      const contract = new Contract(contractAddr, REDEEM_ABI, signer);
      toast.loading("Confirm in your wallet…", { id: tid });
      const tx = await contract.redeem(parseEther(item.cost.toString()), item.id);
      toast.loading("Burning points on-chain…", { id: tid });
      const receipt = await tx.wait();
      setTxHash(receipt.hash);
      toast.loading("Securing your order…", { id: tid });
      const res = await fetch(`${API_BASE}/api/droplist/verify-merch-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: receipt.hash,
          chainId: selectedChainId,
          walletAddress: address,
          itemId: item.id,
          shippingDetails: {
            fullName: form.fullName,
            email: form.email,
            address: {
              street: form.street, city: form.city,
              state: form.state, zip: form.zip, country: form.country,
            },
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Order placed! Check your email.", { id: tid });
      setStep("success");
    } catch (e: any) {
      toast.dismiss(tid);
      if (e.code === 4001 || e.code === "ACTION_REJECTED")
        toast.error("Transaction cancelled.");
      else
        toast.error(e.reason || e.message || "Checkout failed");
      setStep("confirm");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => step !== "processing" && onClose()}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="relative z-10 w-full sm:max-w-lg bg-card border border-border
          rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-accent/10">
          <div>
            <h2 className="font-bold text-xl">{item.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "form"       && "Enter your shipping details"}
              {step === "chain"      && "Choose which chain to burn from"}
              {step === "confirm"    && "Review & confirm your order"}
              {step === "processing" && "Processing transaction…"}
              {step === "success"    && "Order confirmed!"}
            </p>
          </div>
          {step !== "processing" && (
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-accent flex items-center justify-center
                text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 no-scrollbar">
          <AnimatePresence mode="wait">

            {step === "form" && (
              <motion.div key="form"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                className="grid grid-cols-2 gap-3">
                <Field k="fullName" label="Full Name"       span2  value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
                <Field k="email"    label="Email Address"   span2  type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <Field k="street"   label="Street Address"  span2  value={form.street}   onChange={(v) => setForm({ ...form, street: v })} />
                <Field k="city"     label="City"                   value={form.city}     onChange={(v) => setForm({ ...form, city: v })} />
                <Field k="state"    label="State / Province"       value={form.state}    onChange={(v) => setForm({ ...form, state: v })} />
                <Field k="country"  label="Country"                value={form.country}  onChange={(v) => setForm({ ...form, country: v })} />
                <Field k="zip"      label="ZIP / Postal Code"      value={form.zip}      onChange={(v) => setForm({ ...form, zip: v })} />
              </motion.div>
            )}

            {step === "chain" && (
              <motion.div key="chain"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                className="space-y-2">
                <p className="text-xs text-muted-foreground mb-4">
                  Select the chain to burn{" "}
                  <span className="text-primary font-bold">{item.cost.toLocaleString()} DROP</span>.
                  Balance must be sufficient on that chain.
                </p>
                {availableChains.map((cid) => {
                  const meta = CHAIN_META[cid];
                  const bal = chainBalances[cid] ?? null;
                  const ok = bal !== null && bal >= item.cost;
                  const sel = selectedChainId === cid;
                  return (
                    <button key={cid} onClick={() => ok && setSelectedChainId(cid)} disabled={!ok}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all
                        ${sel
                          ? "border-primary/50 bg-primary/5"
                          : ok
                            ? "border-border hover:border-border/60 bg-accent/20 hover:bg-accent/30"
                            : "border-border/30 bg-accent/5 opacity-40 cursor-not-allowed"}`}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[9px] font-black"
                        style={{
                          background: `${meta.color}15`,
                          border: `1px solid ${meta.color}30`,
                          color: meta.color,
                        }}>
                        {meta.name.slice(0, 4).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">{meta.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {loadingBalances
                            ? "Checking balance…"
                            : bal !== null
                              ? `${bal.toLocaleString(undefined, { maximumFractionDigits: 2 })} DROP available`
                              : "—"}
                        </p>
                      </div>
                      {sel && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}

            {step === "confirm" && (
              <motion.div key="confirm"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                className="space-y-3">
                <div className="bg-accent/30 border border-border rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Item</p>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{item.title}</span>
                    <div className="flex items-center gap-1.5">
                      <Droplets size={14} className="text-primary fill-primary/20" />
                      <span className="font-black">{item.cost.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                {selectedChainId && (
                  <div className="bg-accent/30 border border-border rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Burning from</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md text-[8px] font-black flex items-center justify-center"
                        style={{
                          background: `${CHAIN_META[selectedChainId].color}15`,
                          color: CHAIN_META[selectedChainId].color,
                        }}>
                        {CHAIN_META[selectedChainId].name.slice(0, 4).toUpperCase()}
                      </div>
                      <span className="font-bold">{CHAIN_META[selectedChainId].name}</span>
                    </div>
                  </div>
                )}
                <div className="bg-accent/30 border border-border rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Ship to</p>
                  <p className="font-bold text-sm">{form.fullName}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {form.street}<br />
                    {form.city}, {form.state} {form.zip}<br />
                    {form.country}
                  </p>
                  <p className="text-xs text-primary mt-2">{form.email}</p>
                </div>
                <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                  <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-500/80 leading-relaxed">
                    <strong>{item.cost.toLocaleString()} DROP points</strong> will be permanently
                    burned on{" "}
                    {selectedChainId ? CHAIN_META[selectedChainId].name : "the selected chain"}.
                    This is irreversible.
                  </p>
                </div>
              </motion.div>
            )}

            {step === "processing" && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-14 gap-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-border" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
                  <Droplets size={20} className="absolute inset-0 m-auto text-primary" />
                </div>
                <p className="font-bold">Processing your order…</p>
                <p className="text-xs text-muted-foreground text-center max-w-[220px]">
                  Confirm in your wallet and wait for block confirmation.
                </p>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div key="success"
                initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-10 gap-4 text-center">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, delay: 0.1 }}
                  className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <CheckCircle2 size={28} className="text-primary" />
                </motion.div>
                <div>
                  <h3 className="font-black text-xl">Order Placed!</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Confirmation sent to <span className="text-primary">{form.email}</span>
                  </p>
                </div>
                {txHash && selectedChainId && (
                  <a href={`${CHAIN_META[selectedChainId].explorer}${txHash}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors">
                    {txHash.slice(0, 14)}…{txHash.slice(-8)}
                    <ExternalLink size={10} />
                  </a>
                )}
                <button onClick={() => { onSuccess(); onClose(); }}
                  className="mt-2 px-8 py-3 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-all">
                  Done
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer CTA */}
        {step !== "processing" && step !== "success" && (
          <div className="px-6 py-5 border-t border-border bg-accent/10">
            {step === "form" && (
              <button
                onClick={() => formValid && setStep("chain")}
                disabled={!formValid}
                className="w-full py-4 rounded-xl font-bold text-sm transition-all
                  bg-primary text-primary-foreground hover:opacity-90
                  disabled:bg-accent disabled:text-muted-foreground disabled:cursor-not-allowed">
                Continue — Select Chain →
              </button>
            )}
            {step === "chain" && (
              <div className="flex gap-3">
                <button onClick={() => setStep("form")}
                  className="px-5 py-4 rounded-xl font-bold text-sm border border-border text-muted-foreground hover:text-foreground transition-colors">
                  ← Back
                </button>
                <button
                  onClick={() => selectedChainId && setStep("confirm")}
                  disabled={!selectedChainId}
                  className="flex-1 py-4 rounded-xl font-bold text-sm transition-all
                    bg-primary text-primary-foreground hover:opacity-90
                    disabled:bg-accent disabled:text-muted-foreground disabled:cursor-not-allowed">
                  Review Order →
                </button>
              </div>
            )}
            {step === "confirm" && (
              <div className="flex gap-3">
                <button onClick={() => setStep("chain")}
                  className="px-5 py-4 rounded-xl font-bold text-sm border border-border text-muted-foreground hover:text-foreground transition-colors">
                  ← Back
                </button>
                <button onClick={handleRedeem}
                  className="flex-1 py-4 rounded-xl font-bold text-sm transition-all
                    bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]
                    flex items-center justify-center gap-2">
                  <Droplets size={16} />
                  Burn &amp; Order
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function MerchandiseStore() {
  const { address, isConnected, signer, chainId } = useWallet();

  // ── Admin detection ───────────────────────────────────────────────────────
  const isAdmin = Boolean(
    address && address.toLowerCase() === PLATFORM_OWNER.toLowerCase()
  );

  // ── State ─────────────────────────────────────────────────────────────────
  const [chainBalances, setChainBalances] = useState<ChainBalance[]>(
    Object.keys(POINTS_CONTRACT_ADDRESSES).map((id) => ({
      chainId: Number(id),
      balance: 0,
      loading: false,
      error: false,
    }))
  );
  const [dropBalance, setDropBalance]   = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MerchItem | null>(null);

  // Live stock map: itemId → current stock count
  const [stockMap, setStockMap] = useState<Record<string, number>>(() =>
    Object.fromEntries(MERCH_ITEMS.map((m) => [m.id, m.stock]))
  );
  const [stockLoading, setStockLoading] = useState(false);

  // ── Fetch live stock from backend ─────────────────────────────────────────
  const fetchStock = useCallback(async () => {
    setStockLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/merch/stock`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.stock) {
          // Merge backend values over the local defaults
          setStockMap((prev) => ({ ...prev, ...data.stock }));
        }
      }
    } catch {
      // Silently ignore — fall back to hardcoded defaults
    } finally {
      setStockLoading(false);
    }
  }, []);

  // ── Fetch chain balances ──────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    if (!address) return;
    setBalanceLoading(true);
    setChainBalances((prev) => prev.map((cb) => ({ ...cb, loading: true, error: false })));

    const allChainIds = Object.keys(POINTS_CONTRACT_ADDRESSES).map(Number);
    const results = await Promise.allSettled(
      allChainIds.map(async (cid) => {
        const provider = new JsonRpcProvider(RPC_URLS[cid]);
        const contract = new Contract(POINTS_CONTRACT_ADDRESSES[cid], BALANCE_ABI, provider);
        const raw: bigint = await contract.balanceOf(address);
        return { cid, balance: Number(raw) / 1e18 };
      })
    );

    const updated: ChainBalance[] = allChainIds.map((cid, i) => {
      const result = results[i];
      if (result.status === "fulfilled") {
        return { chainId: cid, balance: result.value.balance, loading: false, error: false };
      }
      return { chainId: cid, balance: 0, loading: false, error: true };
    });

    setChainBalances(updated);
    setDropBalance(updated.reduce((sum, cb) => sum + cb.balance, 0));
    setBalanceLoading(false);
  }, [address]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);
  useEffect(() => { fetchStock(); },  [fetchStock]);

  // ── Admin: update local stock map after a successful API call ─────────────
  const handleStockUpdated = useCallback((itemId: string, newStock: number) => {
    setStockMap((prev) => ({ ...prev, [itemId]: newStock }));
  }, []);

  // ── After a successful order, decrement local stock ───────────────────────
  const handleOrderSuccess = useCallback((itemId: string) => {
    setStockMap((prev) => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] ?? 0) - 1),
    }));
    fetchBalance();
  }, [fetchBalance]);

  // ── Build display items (merge live stock in) ─────────────────────────────
  const displayItems = MERCH_ITEMS.map((item) => ({
    ...item,
    stock: stockMap[item.id] ?? item.stock,
  }));

  return (
    <div className="min-h-screen text-foreground bg-background selection:bg-primary/30 pb-20">

      <Header
        pageTitle="Merch Store"
        hideAction={true}
        onRefresh={fetchBalance}
        loading={balanceLoading}
      />

      <main className="pt-6 sm:pt-8 px-4 sm:px-6 max-w-[1400px] mx-auto">

        {/* ── Header row ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end
          gap-6 mb-10 border-b border-border pb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Merch Store</h1>
              {/* Admin badge */}
              {isAdmin && (
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full
                  bg-amber-500/15 border border-amber-500/30 text-amber-500 uppercase tracking-widest">
                  Admin
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 max-w-md text-sm leading-relaxed">
              Burn Drop Points for exclusive FaucetDrops gear.
              Redeem from any supported chain as long as your balance is sufficient.
              {isAdmin && (
                <span className="block mt-1 text-amber-500/80 text-xs">
                  Use the + button on any card to add stock units.
                </span>
              )}
            </p>
          </div>

          <BalanceBreakdown
            chainBalances={chainBalances}
            totalBalance={dropBalance ?? 0}
            loading={balanceLoading}
            onRefresh={fetchBalance}
          />
        </div>

        {/* ── Connect prompt ── */}
        {!isConnected && (
          <div className="mb-8 bg-primary/5 border border-primary/20 rounded-2xl p-5
            flex flex-wrap items-center gap-4">
            <AlertCircle size={18} className="text-primary shrink-0" />
            <p className="text-sm flex-1">Connect your wallet to see your balance and redeem items.</p>
            <WalletConnectButton />
          </div>
        )}

        {/* ── Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {displayItems.map((item, i) => {
            const canAfford = dropBalance !== null && dropBalance >= item.cost;
            const outOfStock = item.stock <= 0;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ y: -4 }}
                className={`bg-card border rounded-2xl overflow-hidden flex flex-col transition-colors
                  ${canAfford && !outOfStock
                    ? "border-border hover:border-primary/50"
                    : "border-border opacity-60"}`}
              >
                {/* ── Product image ── */}
                <div className="aspect-square bg-accent/30 relative flex items-center justify-center border-b border-border">
                  {/* Tag badge */}
                  {item.tag && (
                    <div className="absolute top-3 left-3 z-10">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full
                        ${item.tag === "LIMITED"
                          ? "bg-amber-500/15 border border-amber-500/30 text-amber-500"
                          : item.tag === "NEW"
                            ? "bg-green-500/15 border border-green-500/30 text-green-500"
                            : "bg-primary/15 border border-primary/30 text-primary"}`}>
                        {item.tag}
                      </span>
                    </div>
                  )}

                  {/* Price pill */}
                  <div className="absolute top-3 right-3 bg-background/90 backdrop-blur border border-border
                    px-2.5 py-1 rounded-full flex items-center gap-1.5 z-10">
                    <Droplets size={11} className="text-primary fill-primary/20" />
                    <span className="text-[11px] font-black">{item.cost.toLocaleString()}</span>
                  </div>

                  <MerchCard3D itemId={item.id} />
                </div>

                {/* ── Card body ── */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-base mb-1.5 leading-tight">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-3">
                    {item.description}
                  </p>

                  {/* Stock row — includes admin + button */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full
                        ${item.stock > 20 ? "bg-green-500" : item.stock > 5 ? "bg-amber-500" : "bg-red-500"}`} />
                      {item.stock} in stock
                    </div>

                    <div className="flex items-center gap-2">
                      {/* "Need X more" hint for regular users */}
                      {!isAdmin && isConnected && !canAfford && dropBalance !== null && (
                        <span className="text-destructive/70">
                          Need {(item.cost - dropBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })} more
                        </span>
                      )}

                      {/* Admin stock-increase button */}
                      {isAdmin && address && (
                        <StockIncreaseButton
                          itemId={item.id}
                          adminAddress={address}
                          currentStock={item.stock}
                          onStockUpdated={handleStockUpdated}
                        />
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => {
                      if (!isConnected) { toast.error("Connect your wallet first"); return; }
                      if (canAfford && !outOfStock) setSelectedItem(item);
                    }}
                    disabled={isConnected && (!canAfford || outOfStock)}
                    className={`w-full py-3 rounded-xl text-xs font-bold transition-all
                      ${canAfford && !outOfStock
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "bg-accent text-muted-foreground cursor-not-allowed"}`}
                  >
                    {outOfStock
                      ? "Out of Stock"
                      : !isConnected
                        ? "Connect to Redeem"
                        : !canAfford
                          ? "Insufficient Points"
                          : "Redeem"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── How it works ── */}
        <div className="mt-20 pt-12 border-t border-border">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-8">
            How it works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { n: "01", t: "Earn DROP Points", d: "Complete quests and daily check-ins on any supported chain." },
              { n: "02", t: "Burn to Redeem", d: "Pick an item, choose which chain to burn from, and confirm the on-chain transaction." },
              { n: "03", t: "We Ship to You", d: "Dispatched within 5–10 business days. Tracking confirmation goes to your email." },
            ].map((s) => (
              <div key={s.n} className="flex gap-5">
                <span className="text-4xl font-black text-border/60 leading-none">{s.n}</span>
                <div>
                  <p className="font-bold text-sm mb-1.5">{s.t}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Checkout modal */}
      <AnimatePresence>
        {selectedItem && signer && address && (
          <CheckoutModal
            item={selectedItem}
            address={address}
            signer={signer}
            chainId={chainId}
            onClose={() => setSelectedItem(null)}
            onSuccess={() => handleOrderSuccess(selectedItem.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}