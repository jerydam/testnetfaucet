"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useWallets } from '@privy-io/react-auth';
import { QuestEditPanel } from "@/components/quest/questedit";
import { QUEST_ABI } from "@/lib/abis";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Trophy,
  Shield,
  X,
  Upload,
  Lock,
  ImageIcon,
  UserCircle,
  Coins,
  Sparkles,
  Gift,
  ZoomIn,
  Copy,
  CalendarClock,
  Users,
  Zap,
  Rocket,
  MessageSquareText,
  ShieldCheck,
  ArrowLeft,
  Settings,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/hooks/use-wallet";
import { Contract, BrowserProvider, parseEther, ZeroAddress, formatUnits, parseUnits } from "ethers";
import { Header } from "@/components/header";
import { SubscriptionModal } from "@/components/subscribe";
import Loading from "@/app/loading";

const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app"; // <-- REPLACE WITH ACTUAL BACKEND URL
const SUPER_ADMIN_ADDRESS = "0x9fBC2A0de6e5C5Fd96e8D11541608f5F328C0785";
// ============= TYPES =============
export type VerificationType =
  | "auto_social"
  | "auto_tx"
  | "manual_link"
  | "manual_upload"
  | "manual_link_image" // <--- ADD THIS LINE
  | "system_referral"
  | "system_daily"
  | "system_x_share"
  | "none"
  | "onchain";

interface QuestTask {
  id: string;
  title: string;
  description: string;
  targetHandle?: string;
  points: number;
  category: string;
  targetContractAddress?: string;
  verificationType: VerificationType;
  url: string;
  stage: string;
  required: boolean;
  action: string;
  isSystem?: boolean;
  targetPlatform?: string;
  minAmount?: string | number;
  minTxCount?: string | number;
  minDays?: string | number;
  targetChainId?: string;
  startDate?: string;
  endDate?: string;
}

// ── UPDATED: StageMeta matches what backend now returns ──
interface StageMeta {
  stageTotal: number;        // total pts available in this stage (sum of all tasks)
  unlockThreshold: number;   // 70% of stageTotal — what user needs to advance
  userEarned: number;        // pts user has earned IN this stage
  isUnlocked: boolean;       // userEarned >= unlockThreshold → show badge, freeze bar
  isCurrent: boolean;        // this is the user's active stage right now
  stageIndex: number;
  isLastStage: boolean;
}

// ── UPDATED: UserProgress now includes new backend fields ──
interface UserProgress {
  totalPoints: number;
  stagePoints: Record<string, number>;
  completedTasks: string[];
  currentStage: string;
  submissions?: any[];

  // NEW fields from updated backend
  activeStages: string[];                      // only stages that have tasks, e.g. ["Beginner","Intermediate","Ultimate"]
  stageTotals: Record<string, number>;         // total pts available per stage
  stagesMeta: Record<string, StageMeta>;       // full per-stage breakdown
  currentStageEarned: number;
  currentStageTotal: number;
  currentStageThreshold: number;              // 70% of currentStageTotal
}

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  username: string | null;
  avatarUrl?: string | null;
  points: number;
  completedTasks: number;
  updatedAt?: string; // <--- ADD THIS
}

interface UserProfile {
  wallet_address: string;
  username: string | null;
  bio?: string;
  avatar_url?: string;
  twitter_handle?: string;
  is_quest_subscribed?: boolean;             // <--- ADD THIS
  quest_subscription_expires_at?: string;    // <--- ADD THIS
}
interface ParticipantData {
  referral_id: string;
  referral_count: number;
  last_checkin_at: string | null;
  points: number;
  updated_at?: string; // <--- ADD THIS
  joined_at?: string;  // <--- ADD THIS
}
const useCountdown = (targetDate: string | null) => {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!targetDate) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const diff = target - now;
      if (diff <= 0) { setTimeLeft("00:00:00"); clearInterval(interval); return; }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
};
// ============= PARTICIPANT PROFILE MODAL =============
function ParticipantProfileModal({
  entry,
  progress,
  isLoading,
  questTasks,
  onClose,
}: {
  entry: LeaderboardEntry;
  progress: UserProgress | null;
  isLoading: boolean;
  questTasks: QuestTask[];
  onClose: () => void;
}) {
  const completedIds = new Set(progress?.completedTasks || []);
  const completedCount = completedIds.size;
  const totalTasks = questTasks.filter(t => !t.isSystem).length;

  const rankDisplay =
    entry.rank === 1 ? "🥇" :
    entry.rank === 2 ? "🥈" :
    entry.rank === 3 ? "🥉" :
    `#${entry.rank}`;

  const initials = entry.username
    ? entry.username.slice(0, 2).toUpperCase()
    : entry.walletAddress.slice(2, 4).toUpperCase();

  const shortAddress = `${entry.walletAddress.slice(0, 6)}...${entry.walletAddress.slice(-4)}`;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-900/50 px-5 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 border-2 border-slate-200 dark:border-slate-700">
              <AvatarImage src={entry.avatarUrl || undefined} alt={entry.username || ""} className="object-cover" />
              <AvatarFallback className="bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-bold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-base text-slate-900 dark:text-slate-100 leading-none">
                {entry.username || shortAddress}
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-1">{shortAddress}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 p-4">
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">Rank</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{rankDisplay}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">Points</div>
            <div className="text-2xl font-bold text-primary">{entry.points.toLocaleString()}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">Stage</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
              {progress?.currentStage || "—"}
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="px-4 pb-5">
          <div className="flex items-center justify-between mb-3">
  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Tasks completed</span>
  {isLoading ? (
    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  ) : (
    <Badge variant="outline" className="text-xs font-mono">
      {completedCount} / {totalTasks}
    </Badge>
  )}
</div>

{isLoading ? (
  <div className="flex flex-col gap-2">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
    ))}
  </div>
) : completedCount === 0 ? (
  <div className="text-center py-8 text-muted-foreground text-sm">
    No tasks completed yet.
  </div>
) : (
  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
    {questTasks
      .filter(t => !t.isSystem && completedIds.has(t.id))
      .map(task => (
        <div
          key={task.id}
          className="flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
            <span className="truncate text-green-800 dark:text-green-300">{task.title}</span>
          </div>
          <span className="text-xs font-medium shrink-0 ml-2 text-green-700 dark:text-green-400">
            +{task.points} pts
          </span>
        </div>
      ))}
  </div>
)}

        </div>
      </div>
    </div>
  );
}
// ============= COMPONENT =============
export default function QuestDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");
  const { address: userWalletAddress, provider: walletProvider } = useWallet();
  // Add this hook inside both files (or extract to a shared hooks file)
  const [leaderboardLimit, setLeaderboardLimit] = useState(50);
  const rawSlug = (params.addresss || params.faucetAddress) as string | undefined;

  const refreshAllStats = async () => {
    if (!faucetAddress || !userWalletAddress) return;
    try {
      const progRes = await fetch(
        `${API_BASE_URL}/api/quests/${faucetAddress}/progress/${userWalletAddress}?t=${Date.now()}`,
        { cache: "no-store" }
      );
      const progJson = await progRes.json();
      if (progJson.success) {
        setUserProgress(progJson.progress);
        setParticipantData(prev => prev ? { ...prev, points: progJson.progress.totalPoints } : prev);
      }

      const lbRes = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/leaderboard`);
      const lbJson = await lbRes.json();
      if (lbJson.success) setLeaderboard(lbJson.leaderboard);
    } catch (e) {
      console.error("refreshAllStats failed", e);
    }
  };

  // ============= STATE =============
  const [questData, setQuestData] = useState<any | null>(null);
  const [creatorSubscribed, setCreatorSubscribed] = useState<boolean>(true);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [questAdmins, setQuestAdmins] = useState<any[]>([]);
  const [newAdminAddress, setNewAdminAddress] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [removingAdmin, setRemovingAdmin] = useState<string | null>(null);

  // ── NEW: FETCH CREATOR'S SUBSCRIPTION STATUS ──
  useEffect(() => {
    if (!questData?.creatorAddress) return;
    const fetchCreatorStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/profile/${questData.creatorAddress}`);
        const data = await res.json();
        if (data.success && data.profile) {
          const expiresAt = data.profile.quest_subscription_expires_at;
          const isSubbed = data.profile.is_quest_subscribed && expiresAt && new Date(expiresAt) > new Date();
          setCreatorSubscribed(!!isSubbed);
        } else {
          setCreatorSubscribed(false);
        }
      } catch (e) {
        console.error("Failed to check creator subscription", e);
        setCreatorSubscribed(false);
      }
    };
    fetchCreatorStatus();
  }, [questData?.creatorAddress]);
  const [rejectingSubId, setRejectingSubId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [faucetAddress, setFaucetAddress] = useState<string | undefined>(undefined);
  const [isRefreshingUser, setIsRefreshingUser] = useState(false);
  const [claimState, setClaimState] = useState({
    isChecking: false,
    isWinnerOnChain: false,
    hasClaimed: false,
    canClaimOnChain: false,
    isExpiredOnChain: false,
    fundsWithdrawnOnChain: false, // <-- ADD THIS
  });
  const refreshParticipantData = async () => {
    setIsRefreshingUser(true);
    try {
      // Re-fetch the user's progress
      await loadUserProgress();

      // Optionally re-fetch the leaderboard if you have a standalone function for it
      // await fetchLeaderboard(); 

      toast.success("Progress & Leaderboard updated!");
    } catch (error) {
      toast.error("Failed to refresh data.");
    } finally {
      setIsRefreshingUser(false);
    }
  };
  // ── UPDATED default state includes new fields ──
  const [userProgress, setUserProgress] = useState<UserProgress>({
    totalPoints: 0,
    stagePoints: {},
    completedTasks: [],
    currentStage: "Beginner",
    submissions: [],
    activeStages: [],
    stageTotals: {},
    stagesMeta: {},
    currentStageEarned: 0,
    currentStageTotal: 0,
    currentStageThreshold: 0,
  });
   const isDemoQuest = faucetAddress?.startsWith("draft-") || faucetAddress?.startsWith("demo-")
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [hasOpenedLink, setHasOpenedLink] = useState<Record<string, boolean>>({});
  const [participantData, setParticipantData] = useState<ParticipantData | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [processingSubmission, setProcessingSubmission] = useState<{ id: string, action: string } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [hasUsername, setHasUsername] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const tokenSymbol = questData?.tokenSymbol || "Tokens";
  const rewardPoolAmount = parseFloat(questData?.rewardPool || "0");
  const platformFeePercentage = 0.01;
  const requiredFee = rewardPoolAmount * platformFeePercentage;
  const totalRequired = rewardPoolAmount + requiredFee;
  const now = new Date();
  const endDate = new Date(questData?.rawEndDate || Date.now());
  const isQuestEnded = now > endDate;
  const [selectedParticipant, setSelectedParticipant] = useState<LeaderboardEntry | null>(null);
  const [participantTaskDetails, setParticipantTaskDetails] = useState<any>(null);
  const [isLoadingParticipantDetails, setIsLoadingParticipantDetails] = useState(false);
  const claimWindowHours = questData?.claimWindowHours || 24;
  const claimWindowEnd = new Date(endDate.getTime() + (claimWindowHours * 60 * 60 * 1000));
  const isClaimWindowClosed = now > claimWindowEnd;
  const [isQuestAdmin, setIsQuestAdmin] = useState(false);



  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<QuestTask | null>(null);
  const [submissionData, setSubmissionData] = useState({
    proofUrl: "",
    notes: "",
    file: null as File | null,
  });
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);

  const [showFundModal, setShowFundModal] = useState(false);
  const [fundAmount, setFundAmount] = useState<string>("");
  const { wallets } = useWallets();
  const activeWallet = wallets[0];
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    rewardPool: "",
    imageUrl: "",
    isActive: true,
  });


  const isCreator =
  userWalletAddress &&
  questData &&
  (
    questData.creatorAddress.toLowerCase() === userWalletAddress.toLowerCase() ||
    userWalletAddress.toLowerCase() === SUPER_ADMIN_ADDRESS.toLowerCase()
  );

  const startCountdown = useCountdown(questData?.rawStartDate ?? null);
  const endCountdown = useCountdown(questData?.rawEndDate ?? null);

  // ── UPDATED: use activeStages from backend instead of hardcoded list ──
  // Fall back to the full list only when progress hasn't loaded yet
  const ALL_STAGES = ["Beginner", "Intermediate", "Advance", "Legend", "Ultimate"];
  const activeStages = userProgress.activeStages?.length > 0
    ? userProgress.activeStages
    : ALL_STAGES;


    useEffect(() => {
  if (!faucetAddress || !userWalletAddress || isCreator) return;
  const checkIfAdmin = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/admins`);
      const json = await res.json();
      if (json.success) {
        const found = json.admins.some(
          (a: any) => a.admin_address.toLowerCase() === userWalletAddress.toLowerCase()
        );
        setIsQuestAdmin(found);
      }
    } catch (e) {}
  };
  checkIfAdmin();
}, [faucetAddress, userWalletAddress, isCreator]);


const canManageQuest = isCreator || isQuestAdmin;
  useEffect(() => {
    if (!faucetAddress || !userWalletAddress || !hasUsername) return;
    const checkParticipant = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/participant/${userWalletAddress}`);
        const json = await res.json();
        if (json.success && json.participant) {
          setParticipantData(json.participant);
        }
      } catch (e) {
        console.error("Participant lookup failed", e);
      }
    };
    checkParticipant();
  }, [faucetAddress, userWalletAddress, hasUsername]);

  useEffect(() => {
    const slug = params.slug as string;
    if (!slug) return;

    const loadQuestBySlug = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/quests/by-slug/${slug}?t=${Date.now()}`, { cache: "no-store" });
        const json = await response.json();

        if (json.success && json.quest) {
          const fetchedQuest = json.quest;

          // 1. Preserve the raw UTC ISO string for accurate countdowns & displays
          fetchedQuest.rawStartDate = fetchedQuest.startDate;
          fetchedQuest.rawEndDate = fetchedQuest.endDate;

          // 2. Unpack into LOCAL time for the Edit Form inputs
          const pad = (n: number) => String(n).padStart(2, '0');

          if (fetchedQuest.startDate && fetchedQuest.startDate.includes("T")) {
            const localStart = new Date(fetchedQuest.startDate);
            fetchedQuest.startDate = `${localStart.getFullYear()}-${pad(localStart.getMonth() + 1)}-${pad(localStart.getDate())}`;
            fetchedQuest.startTime = `${pad(localStart.getHours())}:${pad(localStart.getMinutes())}`;
          }

          if (fetchedQuest.endDate && fetchedQuest.endDate.includes("T")) {
            const localEnd = new Date(fetchedQuest.endDate);
            fetchedQuest.endDate = `${localEnd.getFullYear()}-${pad(localEnd.getMonth() + 1)}-${pad(localEnd.getDate())}`;
            fetchedQuest.endTime = `${pad(localEnd.getHours())}:${pad(localEnd.getMinutes())}`;
          }

          setQuestData(fetchedQuest);
          setFaucetAddress(fetchedQuest.faucetAddress);
          setEditForm({
            title: fetchedQuest.title,
            description: fetchedQuest.description,
            rewardPool: fetchedQuest.rewardPool,
            imageUrl: fetchedQuest.imageUrl || "",
            isActive: fetchedQuest.isActive,
          });
        } else {
          toast.error("Quest not found");
        }
      } catch (error) {
        console.error("Fetch error:", error);
        toast.error("Failed to load quest details");
      } finally {
        setIsLoading(false);
      }
    };

    loadQuestBySlug();
  }, [params.slug]);

  useEffect(() => {
    if (!faucetAddress) return;
    const loadLiveStats = async () => {
      try {
        const lbRes = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/leaderboard`);
        const lbJson = await lbRes.json();
        if (lbJson.success) setLeaderboard(lbJson.leaderboard);
      } catch (e) {
        console.error("Leaderboard fetch failed", e);
      }
    };
    loadLiveStats();
  }, [faucetAddress]);

  useEffect(() => {
    if (!faucetAddress || !userWalletAddress || !hasUsername) return;
    const fetchUserSpecifics = async () => {
      try {
        const progRes = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/progress/${userWalletAddress}`);
        const progJson = await progRes.json();
        if (progJson.success) setUserProgress(progJson.progress);

        if (isCreator) {
          const pendingRes = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/submissions/pending`);
          const pendingJson = await pendingRes.json();
        }
      } catch (e) {
        console.error("Progress fetch failed", e);
      }
    };
    fetchUserSpecifics();
  }, [faucetAddress, userWalletAddress, hasUsername, isCreator]);

  // ── ON-CHAIN CLAIM STATUS CHECK ──
  useEffect(() => {
    const checkClaimStatus = async () => {
      // Use activeWallet instead of walletProvider
      if (!faucetAddress || !userWalletAddress || !activeWallet) return;

      try {
        setClaimState(prev => ({ ...prev, isChecking: true }));

        // 1. Extract the raw EIP-1193 provider from Privy (Just like you did in handleAdminWithdraw!)
        const privyProvider = await activeWallet.getEthereumProvider();

        // 2. Wrap it in ethers.js
        const ethersProvider = new BrowserProvider(privyProvider);

        // 3. Connect to your specific smart contract
        const contract = new Contract(faucetAddress, QUEST_ABI, ethersProvider);

        console.log(`🔍 Fetching on-chain claim status for Wallet: ${userWalletAddress}`);
        console.log(`📄 Target Contract Address: ${faucetAddress}`);

        // 4. Fetch the data directly from the contract
        const status = await contract.getClaimStatus(userWalletAddress);
        const isWithdrawn = await contract.fundsWithdrawn();
        const claimed = status[0];
        const hasReward = status[1];
        const rewardAmount = status[2];
        const canClaim = status[3];
        const timeUntilStart = status[4];
        const timeRemaining = status[5];

        console.log("✅ Contract Return Data:", {
          claimed: claimed,
          hasRewardAmount: hasReward,
          rewardAmountWei: rewardAmount.toString(),
          canClaim: canClaim,
          timeUntilStartSeconds: timeUntilStart.toString(),
          timeRemainingSeconds: timeRemaining.toString()
        });

        // 5. Update our UI state based on the blockchain's response
        setClaimState({
          isChecking: false,
          isWinnerOnChain: hasReward,
          hasClaimed: claimed,
          canClaimOnChain: canClaim,
          isExpiredOnChain: !canClaim && timeRemaining === 0n && timeUntilStart === 0n,
          fundsWithdrawnOnChain: isWithdrawn,
        });

      } catch (error) {
        console.error("❌ Error fetching on-chain claim status:", error);
        setClaimState(prev => ({ ...prev, isChecking: false }));
      }
    };

    // Only run this check if the quest has officially ended
    if (isQuestEnded) {
      checkClaimStatus();
    }
  }, [faucetAddress, userWalletAddress, activeWallet, isQuestEnded]); // Make sure activeWallet is in the dependency array

  const claimStatus = useMemo(() => {
    if (!questData?.rawEndDate) return { isActive: false, message: "Not started" };

    const endDate = new Date(questData.rawEndDate);
    // Add 24 hours for the Review Period
    const reviewEndDate = new Date(endDate.getTime() + (24 * 60 * 60 * 1000));
    const claimWindowEnd = new Date(
      reviewEndDate.getTime() + (questData.claimWindowHours || 168) * 60 * 60 * 1000
    );
    const now = new Date();

    if (now < endDate) return { isActive: false, message: "Quest active" };
    if (now >= endDate && now < reviewEndDate) return { isActive: false, message: "Reviewing (24h)" };
    if (now > claimWindowEnd) return { isActive: false, message: "Claim ended" };
    return { isActive: true, message: "Claim Live" };
  }, [questData?.rawEndDate, questData?.claimWindowHours]);

  const questTiming = useMemo(() => {
  if (!questData?.rawStartDate || !questData?.rawEndDate) {
    return { isLive: false, notStartedYet: true, isEnded: false, isReviewing: false, isCreatorUnsubscribed: false };
  }
  const now = new Date();
  const start = new Date(questData.rawStartDate);
  const end = new Date(questData.rawEndDate);
  const reviewEnd = new Date(end.getTime() + (24 * 60 * 60 * 1000));
  return {
    isLive: now >= start && now <= end && questData.isActive && (creatorSubscribed || isDemoQuest), // <- changed
    notStartedYet: now < start,
    isEnded: now > end,
    isReviewing: now > end && now <= reviewEnd,
    isPaused: !questData.isActive,
    isCreatorUnsubscribed: !creatorSubscribed && !isDemoQuest, // <- also fix this so the "locked" banner doesn't show on demo
  };
}, [questData?.rawStartDate, questData?.rawEndDate, questData?.isActive, creatorSubscribed, isDemoQuest]);
  const allParticipants = leaderboard.filter(
    (entry) => entry.walletAddress.toLowerCase() !== questData?.creatorAddress.toLowerCase()
  );

  const totalPoints = participantData?.points || 0;

  const loadUserProgress = async () => {
    if (!faucetAddress || !userWalletAddress) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/quests/${faucetAddress}/progress/${userWalletAddress}?t=${Date.now()}`,
        { cache: "no-store", credentials: "include" }
      );
      const json = await res.json();
      if (json.success) {
        setUserProgress(json.progress);
      }
    } catch (e) {
      console.error("Reload failed", e);
    }
  };
  const [isRefreshingAdmin, setIsRefreshingAdmin] = useState(false);

  const refreshAdminData = async () => {
    if (!faucetAddress) return;
    setIsRefreshingAdmin(true);
    try {
      // 1. Refresh Pending Submissions
      const pendingRes = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/submissions/pending?t=${Date.now()}`, { cache: "no-store" });
      const pendingJson = await pendingRes.json();

      if (pendingJson.success) {
        const rawSubmissions = pendingJson.submissions;
        const enrichedSubmissions = await Promise.all(
          rawSubmissions.map(async (sub: any) => {
            const relatedTask = questData?.tasks?.find((t: any) => t.id === sub.taskId);
            const taskPoints = relatedTask ? relatedTask.points : 0;
            try {
              const profileRes = await fetch(`${API_BASE_URL}/api/profile/${sub.walletAddress}?t=${Date.now()}`, { cache: "no-store" });
              const profileJson = await profileRes.json();
              return {
                ...sub,
                taskPoints,
                username: profileJson.success && profileJson.profile ? profileJson.profile.username : "Unknown User",
                avatarUrl: profileJson.success && profileJson.profile ? profileJson.profile.avatar_url : null,
              };
            } catch {
              return { ...sub, taskPoints, username: "Unknown User", avatarUrl: null };
            }
          })
        );
        setPendingSubmissions(enrichedSubmissions);
      }

      // 2. Refresh Leaderboard (Updates Total Participants stat)
      const lbRes = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/leaderboard?t=${Date.now()}`, { cache: "no-store" });
      const lbJson = await lbRes.json();
      if (lbJson.success) setLeaderboard(lbJson.leaderboard);

      toast.success("Dashboard refreshed!");
    } catch (error) {
      toast.error("Failed to refresh data.");
    } finally {
      setIsRefreshingAdmin(false);
    }
  };
  // ============= HANDLERS =============
  const handleXShareAction = (task: QuestTask) => {
    // If the admin set a specific handle in the task, use it, otherwise default to @FaucetDrops
    const targetHandle = task.targetHandle ? `@${task.targetHandle.replace('@', '')}` : "@FaucetDrops";

    // Fallback safely just in case they don't have a referral ID
    const refParam = participantData?.referral_id ? `?ref=${participantData.referral_id}` : "";
    const referralLink = `${window.location.origin}${window.location.pathname}${refParam}`;

    const message = `I am participating in a quest on ${targetHandle}. Join me and earn rewards here: ${referralLink}`;
    const xIntentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(message)}`;

    window.open(xIntentUrl, "_blank");
  };

  const handleParticipantClick = async (entry: LeaderboardEntry) => {
  setSelectedParticipant(entry);
  setIsLoadingParticipantDetails(true);
  try {
    const res = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/progress/${entry.walletAddress}`);
    const json = await res.json();
    if (json.success) setParticipantTaskDetails(json.progress);
  } catch (e) {
    console.error("Failed to load participant details", e);
  } finally {
    setIsLoadingParticipantDetails(false);
  }
};

  const handleJoin = async () => {
    if (!userWalletAddress || !faucetAddress) return;
    setIsJoining(true);
    try {
      const payload = { walletAddress: userWalletAddress, referralCode: refCode || null };
      const res = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        if (json.participant) {
          setParticipantData(json.participant);
        } else if (json.referralId) {
          setParticipantData((prev) =>
            prev
              ? { ...prev, referral_id: json.referralId }
              : { referral_id: json.referralId, referral_count: 0, last_checkin_at: null, points: 0 }
          );
        }
        toast.success("Successfully joined the Quest!");
        if (refCode) toast.success("Referral Bonus applied if code was valid.");
        await loadUserProgress();
      } else {
        toast.error(json.message || "Join failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Join failed");
    } finally {
      setIsJoining(false);
    }
  };

  const handleDailyCheckin = async () => {
    if (!userWalletAddress || !faucetAddress || isCreator) return;
    setIsCheckingIn(true);
    try {
      const payload = { walletAddress: userWalletAddress };
      const res = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Check-in successful! +50 points awarded.");
        if (json.participant) {
          setParticipantData(json.participant);
        } else {
          setParticipantData((prev) =>
            prev
              ? { ...prev, last_checkin_at: new Date().toISOString(), points: (prev.points || 0) + 50 }
              : null
          );
        }
        await loadUserProgress();
      } else {
        toast.error(json.message || "Cannot check in yet");
      }
    } catch (e: any) {
      toast.error("Check-in failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const [isAdminEditing, setIsAdminEditing] = useState(false);

  const getCheckinStatus = () => {
  if (!participantData?.last_checkin_at) return { canCheckin: true, message: "Check in now for +50 points!" };
  
  // ── FIX: ensure the string is parsed as UTC, not local time ──
  const rawCheckin = participantData.last_checkin_at;
  const normalizedCheckin = rawCheckin.endsWith("Z") || rawCheckin.includes("+")
    ? rawCheckin
    : rawCheckin + "Z";
  
  const last = new Date(normalizedCheckin);
  const next = new Date(last.getTime() + 24 * 60 * 60 * 1000);
  const now = new Date();
  
  if (now >= next) return { canCheckin: true, message: "Available now!" };
  
  const remainingMs = next.getTime() - now.getTime();
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
return { canCheckin: false, message: `Next check-in in ${hours}h ${minutes}m ${seconds}s` };
};
const [, forceUpdate] = useState(0);

useEffect(() => {
  const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
  return () => clearInterval(interval);
}, []);

  useEffect(() => {
    if (!userWalletAddress) { setIsProfileLoading(false); return; }
    const checkProfile = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/profile/${userWalletAddress}`);
        const data = await res.json();
        if (data.success && data.profile) {
          setUserProfile(data.profile);
          setHasUsername(!!data.profile.username);
        } else {
          setUserProfile(null);
          setHasUsername(false);
        }
      } catch (error) {
        console.error("Profile check failed", error);
      } finally {
        setIsProfileLoading(false);
      }
    };
    checkProfile();
  }, [userWalletAddress]);

  useEffect(() => {
    if (!faucetAddress) return;
    const loadGlobalData = async () => {
      setIsLoading(true);
      try {
        const questRes = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}?t=${Date.now()}`, { cache: "no-store" });
        const questJson = await questRes.json();
        
        if (questJson.success) {
          setQuestData((prev: any) => ({
            ...questJson.quest,
            rawStartDate: prev?.rawStartDate ?? questJson.quest.startDate,
            rawEndDate: prev?.rawEndDate ?? questJson.quest.endDate,
          }));
        }
        
        const lbRes = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/leaderboard`);
        const lbJson = await lbRes.json();
        if (lbJson.success) setLeaderboard(lbJson.leaderboard);
      } catch (error) {
        console.error("Leaderboard fetch failed", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadGlobalData();
  }, [faucetAddress]);

  // 2. ✅ Fetch Admins (Separated into its own top-level hook!)
  useEffect(() => {
    if (!faucetAddress || !isCreator) return;
    
    const fetchAdmins = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/admins`);
        const json = await res.json();
        if (json.success) {
          setQuestAdmins(json.admins);
        }
      } catch (e) {
        console.error("Failed to fetch quest admins", e);
      }
    };
    
    fetchAdmins();
  }, [faucetAddress, isCreator]);

  const displayLeaderboard = useMemo(() => {
    let list = [...leaderboard];

    if (userWalletAddress && participantData && !isCreator) {
      const myWalletLower = userWalletAddress.toLowerCase();

      // FIX: Find if the user is already in the backend's leaderboard list
      const existingEntry = list.find(e => e.walletAddress.toLowerCase() === myWalletLower);

      // FIX: Use the backend's known time for this user, OR participantData, before falling back to NOW.
      // This prevents the current user from constantly losing tie-breakers on re-renders.
      const actualUpdateTime = existingEntry?.updatedAt
        || participantData?.updated_at
        || participantData?.joined_at
        || new Date().toISOString();

      const myLatestEntry = {
        rank: 0,
        walletAddress: userWalletAddress,
        username: userProfile?.username || "You",
        avatarUrl: userProfile?.avatar_url || null,
        points: participantData.points || 0,
        completedTasks: userProgress?.completedTasks?.length || 0,
        updatedAt: actualUpdateTime
      };

      if (existingEntry) {
        // Update the existing entry with live local progress
        Object.assign(existingEntry, myLatestEntry);
      } else {
        // Only push a new entry if they aren't in the list at all yet
        list.push(myLatestEntry);
      }
    }

    return list
      .filter(entry => {
        const entryWallet = entry.walletAddress.toLowerCase();
        const creatorWallet = questData?.creatorAddress?.toLowerCase();
        return entryWallet !== creatorWallet;
      })
      .sort((a, b) => {
        // Primary Sort: Points (Descending - highest points first)
        if (b.points !== a.points) {
          return b.points - a.points;
        }

        // Secondary Sort (TIE BREAKER): Time achieved (Ascending - oldest time first)
        // If Player A got 50 points yesterday, and Player B got 50 points today, Player A wins.
        // Fallback to Date.now() to ensure safe sorting if a date is somehow completely missing
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : Date.now();
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : Date.now();

        return timeA - timeB;
      })
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }, [leaderboard, participantData, userProgress, userWalletAddress, userProfile, questData, isCreator]);
  
  useEffect(() => {
  if (!faucetAddress || !userWalletAddress || !hasUsername) return;
  const fetchUserSpecifics2 = async () => {
    try {
      const progRes = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/progress/${userWalletAddress}`);
      const progJson = await progRes.json();
      if (progJson.success) setUserProgress(progJson.progress);
      
      if (canManageQuest) {
        const pendingRes = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/submissions/pending`);
        const pendingJson = await pendingRes.json();
        if (pendingJson.success) {
          const rawSubmissions = pendingJson.submissions;
          const enrichedSubmissions = await Promise.all(
            rawSubmissions.map(async (sub: any) => {
              const relatedTask = questData?.tasks?.find((t: any) => t.id === sub.taskId);
              const taskPoints = relatedTask ? relatedTask.points : 0;
              try {
                const profileRes = await fetch(`${API_BASE_URL}/api/profile/${sub.walletAddress}`);
                const profileJson = await profileRes.json();
                return {
                  ...sub,
                  taskPoints,
                  username: profileJson.success && profileJson.profile ? profileJson.profile.username : "Unknown User",
                  avatarUrl: profileJson.success && profileJson.profile ? profileJson.profile.avatar_url : null,
                };
              } catch {
                return { ...sub, taskPoints, username: "Unknown User", avatarUrl: null };
              }
            })
          );
          setPendingSubmissions(enrichedSubmissions);
        }
      }
    } catch (error) {
      console.error("Failed to load user specific data", error);
    }
  };
  fetchUserSpecifics2();
}, [faucetAddress, userWalletAddress, isCreator, canManageQuest, hasUsername, questData]);
  const handleSaveDetails = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const result = await response.json();
      if (result.success) {
        setQuestData((prev: any) => ({ ...prev, ...editForm }));
        setIsEditing(false);
        toast.success("Quest details updated.");
      }
    } catch (error) {
      toast.error("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };
  const handleAddAdmin = async () => {
  if (!newAdminAddress.trim() || !userWalletAddress || !faucetAddress) return;
  setIsAddingAdmin(true);
  try {
    const res = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creator_address: userWalletAddress,
        admin_address: newAdminAddress.trim(),
      }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Admin added successfully!");
      setQuestAdmins(prev => [...prev, json.admin]);
      setNewAdminAddress("");
    } else {
      toast.error(json.detail || "Failed to add admin");
    }
  } catch (e) {
    toast.error("Failed to add admin");
  } finally {
    setIsAddingAdmin(false);
  }
};

const handleRemoveAdmin = async (adminAddress: string) => {
  if (!userWalletAddress || !faucetAddress) return;
  setRemovingAdmin(adminAddress);
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/quests/${faucetAddress}/admins/${adminAddress}?creator_address=${userWalletAddress}`,
      { method: "DELETE" }
    );
    const json = await res.json();
    if (json.success) {
      toast.success("Admin removed");
      setQuestAdmins(prev => prev.filter(a => a.admin_address !== adminAddress));
    } else {
      toast.error(json.detail || "Failed to remove admin");
    }
  } catch (e) {
    toast.error("Failed to remove admin");
  } finally {
    setRemovingAdmin(null);
  }
};

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File size exceeds 5MB limit."); e.target.value = ""; return; }
    setSubmissionData((prev) => ({ ...prev, file }));
  };

  const handleSubmitTask = async () => {
    if (!selectedTask || !userWalletAddress) return;

    // ✅ CHECK & COMPARE ONLY FOR "NONE" TASKS
    if (selectedTask.verificationType === "none" && selectedTask.url) {
      const clickTimestamp = sessionStorage.getItem(`task_click_${selectedTask.id}`);
      
      // Check 1: Did they click the link?
      if (!clickTimestamp) {
        toast.error("Please click the button the action button to perform the Task!");
        return; // Stop submission
      }

      // Check 2: Has it been 15 seconds?
      const elapsedSeconds = (Date.now() - parseInt(clickTimestamp)) / 1000;
      if (elapsedSeconds < 15) {
        const remaining = Math.ceil(15 - elapsedSeconds);
        toast.error(`Please spend atleast 30seconds.`);
        return; // Stop submission
      }

      // ✅ REMOVE the timestamp since they passed the check
      sessionStorage.removeItem(`task_click_${selectedTask.id}`);
    }

    setSubmittingTaskId(selectedTask.id);

    const cancelSubmission = async (submissionId: string) => {
      try {
        await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/submissions/${submissionId}`, {
          method: "DELETE",
        });
      } catch { }
      await loadUserProgress();
    };

    try {
      const formData = new FormData();
      formData.append("walletAddress", userWalletAddress);
      formData.append("taskId", selectedTask.id);

      let actualSubmissionType = selectedTask.verificationType;
      const isUnsupportedAuto =
        actualSubmissionType === "auto_social" &&
        !["Twitter", "Discord", "Telegram"].includes(selectedTask.targetPlatform || "");

      if (isUnsupportedAuto) {
        actualSubmissionType = "manual_link_image";
      }

      formData.append("submissionType", actualSubmissionType);

      let finalProofUrl = "";
      const requiresLinkInput =
        ["manual_link", "manual_link_image", "system_x_share", "auto_tx"].includes(actualSubmissionType) ||
        (selectedTask.category === "trading" &&
          !["onchain", "none", "manual_upload"].includes(actualSubmissionType)) ||
        (actualSubmissionType === "auto_social" &&
          ["quote", "comment"].includes(selectedTask.action));

      if (requiresLinkInput) {
        finalProofUrl = submissionData.proofUrl.trim();
      }

      formData.append("submittedData", finalProofUrl);
      formData.append("notes", submissionData.notes.trim());

      if (submissionData.file) {
        formData.append("file", submissionData.file);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/quests/${faucetAddress}/submissions`,
        { method: "POST", body: formData }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.message || "Failed to submit task");

      const submissionId = result.submissionId;

      // ─────────────────────────────────────────────────────────────────────────
      // TELEGRAM — never falls to pending, always cancels on failure so user can retry
      // ─────────────────────────────────────────────────────────────────────────
      if (
        selectedTask.verificationType === "auto_social" &&
        selectedTask.targetPlatform === "Telegram"
      ) {
        let verifyRes: Response;
        let verifyJson: any;

        try {
          if (selectedTask.action === "message_count") {
            const chatId = selectedTask.url?.trim();
            const requiredCount = Number(selectedTask.minTxCount ?? 1);

            if (!chatId) {
              await cancelSubmission(submissionId);
              toast.error("❌ Task is missing a Telegram chat ID. Contact the quest creator.");
              return;
            }

            // 1. NEW: Trigger the backfill API to update the message count
            try {
              await fetch(`${API_BASE_URL}/api/telegram/backfill-updates`, {
                method: "POST",
              });
            } catch (backfillErr) {
              console.warn("Telegram backfill failed, continuing with existing DB counts:", backfillErr);
            }

            // 2. Proceed with the actual verification check
            verifyRes = await fetch(
              `${API_BASE_URL}/api/quests/verify/telegram-message-count`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  submission_id: submissionId,
                  faucet_address: faucetAddress,
                  wallet_address: userWalletAddress,
                  chat_id: chatId,
                  required_count: requiredCount,
                }),
              }
            );
          } else {
            // join / membership check
            verifyRes = await fetch(`${API_BASE_URL}/api/bot/verify-telegram`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                submissionId,
                faucetAddress,
                walletAddress: userWalletAddress,
                taskUrl: selectedTask.url,
                taskAction: selectedTask.action,
              }),
            });
          }

          verifyJson = await verifyRes.json();
        } catch (networkErr: any) {
          await cancelSubmission(submissionId);
          toast.error("❌ Network error during Telegram verification. Please try again.");
          return;
        }

        if (verifyJson.verified) {
          const count = verifyJson.current_count;
          const req = verifyJson.required_count;
          toast.success(
            count != null
              ? `✅ Verified! ${count}/${req} messages confirmed. Points awarded.`
              : "✅ Telegram verified! Points awarded."
          );
          await refreshAllStats();
          setShowSubmitModal(false);
          setSubmissionData({ proofUrl: "", notes: "", file: null });
        } else {
          // Always cancel so task stays available for retry
          await cancelSubmission(submissionId);

          const reason = verifyJson.reason;

          if (reason === "profile_not_found") {
            toast.error("❌ No profile found for this wallet. Contact support.");
          } else if (reason === "telegram_not_linked") {
            toast.error("⚠️ Connect your Telegram in Profile Settings first.", {
              action: {
                label: "Open Profile",
                onClick: () => router.push(`/dashboard/${userWalletAddress}`),
              },
            });
          } else if (reason === "not_in_group") {
            toast.error("❌ You are not a member of this group. Join first then try again.");
          } else if (reason === "chat_not_found") {
            toast.error("❌ Group not found. Make sure the bot is admin in the group.");
          } else if (reason === "insufficient_messages") {
            const current = verifyJson.current_count ?? 0;
            const needed = verifyJson.required_count ?? 0;
            toast.error(
              `❌ Only ${current}/${needed} messages tracked. Keep chatting and try again!`
            );
          } else if (reason === "not_member") {
            toast.error("❌ You are not a member of this channel yet. Join first then try again.");
          } else if (reason === "bot_not_admin") {
            toast.error("❌ Bot verification unavailable for this channel. Contact the quest creator.");
          } else {
            toast.error("❌ " + (verifyJson.message || "Verification failed. Please try again."));
          }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // DISCORD
        // ─────────────────────────────────────────────────────────────────────────
      } else if (
        selectedTask.verificationType === "auto_social" &&
        selectedTask.targetPlatform === "Discord"
      ) {
        const verifyRes = await fetch(`${API_BASE_URL}/api/bot/verify-discord`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId,
            faucetAddress,
            walletAddress: userWalletAddress,
            taskId: selectedTask.id,
            taskUrl: selectedTask.url,
            taskAction: selectedTask.action,
          }),
        });
        const verifyJson = await verifyRes.json();

        if (verifyJson.verified) {
          toast.success(verifyJson.message || "✅ Discord task verified! Points awarded.");
          await refreshAllStats();
          setShowSubmitModal(false);
          setSubmissionData({ proofUrl: "", notes: "", file: null });
        } else {
          await cancelSubmission(submissionId);
          if (verifyJson.reason === "discord_not_linked") {
            toast.error("⚠️ Connect your Discord in Profile Settings first.", {
              action: {
                label: "Open Profile",
                onClick: () => router.push(`/dashboard/${userWalletAddress}`),
              },
            });
          } else if (verifyJson.reason === "missing_role") {
            toast.error(verifyJson.message || "❌ You do not have the required role yet.");
          } else if (verifyJson.reason === "not_member") {
            toast.error("❌ You have not joined this Discord server yet.");
          } else if (verifyJson.reason === "bot_not_in_server") {
            toast.error("❌ The FaucetDrops Bot is not in this server. Contact the creator.");
          } else {
            toast.error("❌ " + (verifyJson.message || "Verification failed. Please try again."));
          }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // X SHARE
        // ─────────────────────────────────────────────────────────────────────────
      } else if (selectedTask.verificationType === "system_x_share") {
        const verifyRes = await fetch(`${API_BASE_URL}/api/tasks/verify-x-share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId,
            walletAddress: userWalletAddress,
            taskId: selectedTask.id,
            proofUrl: finalProofUrl,
            requiredTag: "@FaucetDrops",
          }),
        });
        const verifyJson = await verifyRes.json();

        if (verifyJson.verified) {
          toast.success(verifyJson.message || "✅ Share verified! Points added.");
          await refreshAllStats();
          setShowSubmitModal(false);
          setSubmissionData({ proofUrl: "", notes: "", file: null });
        } else {
          await cancelSubmission(submissionId);
          toast.error(
            "❌ " +
            (verifyJson.message ||
              "Verification failed. Ensure you do the task and try again.")
          );
        }

        // ─────────────────────────────────────────────────────────────────────────
        // TWITTER
        // ─────────────────────────────────────────────────────────────────────────
      } else if (
        selectedTask.verificationType === "auto_social" &&
        selectedTask.targetPlatform === "Twitter"
      ) {
        let endpoint = "";
        let payload: any = {
          walletAddress: userWalletAddress,
          taskId: selectedTask.id,
          submissionId,
        };

        if (selectedTask.action === "quote") {
          endpoint = "/api/tasks/verify-x-quote";
          payload.proofUrl = finalProofUrl;
          payload.requiredTag = selectedTask.targetHandle || "";
        } else if (selectedTask.action === "comment") {
          endpoint = "/api/tasks/verify-x-comment";
          payload.proofUrl = finalProofUrl;
        } else {
          endpoint = "/api/tasks/verify-x";
          payload.submittedHandle =
            userProfile?.twitter_handle || userProfile?.username || "";
        }

        const verifyRes = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const verifyJson = await verifyRes.json();

        if (verifyJson.verified) {
          toast.success(verifyJson.message || "✅ Task verified! Points added.");
          await refreshAllStats();
          setShowSubmitModal(false);
          setSubmissionData({ proofUrl: "", notes: "", file: null });
        } else {
          await cancelSubmission(submissionId);
          toast.error(
            "❌ " +
            (verifyJson.message ||
              "Verification failed. Please complete the action and try again.")
          );
        }

        // ─────────────────────────────────────────────────────────────────────────
        // OTHER AUTO_SOCIAL
        // ─────────────────────────────────────────────────────────────────────────
      } else if (selectedTask.verificationType === "auto_social") {
        const verifyRes = await fetch(`${API_BASE_URL}/api/bot/verify-social`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId,
            faucetAddress,
            walletAddress: userWalletAddress,
            handle: userProfile?.twitter_handle || userProfile?.username || "",
            proofUrl: finalProofUrl,
            taskType: selectedTask.action,
          }),
        });
        const verifyJson = await verifyRes.json();

        if (verifyJson.verified) {
          toast.success("✅ Task verified! Points added.");
          await refreshAllStats();
          setShowSubmitModal(false);
          setSubmissionData({ proofUrl: "", notes: "", file: null });
        } else {
          await cancelSubmission(submissionId);
          toast.error(
            "❌ " +
            (verifyJson.message || "Verification failed. Complete the action then try again.")
          );
        }

        // ─────────────────────────────────────────────────────────────────────────
        // NONE
        // ─────────────────────────────────────────────────────────────────────────
      } else if (selectedTask.verificationType === "none") {
        toast.success("✅ Task completed! Points added.");
        
        // ── NEW: Clear the timestamp after success ──
        sessionStorage.removeItem(`task_click_${selectedTask.id}`);
        
        await refreshAllStats();
        setShowSubmitModal(false);
        setSubmissionData({ proofUrl: "", notes: "", file: null });

        // ─────────────────────────────────────────────────────────────────────────
        // ONCHAIN
        // ─────────────────────────────────────────────────────────────────────────
      } else if (selectedTask.verificationType === "onchain") {
        toast.success("✅ Wallet verified on-chain! Points added.");
        await refreshAllStats();
        setShowSubmitModal(false);
        setSubmissionData({ proofUrl: "", notes: "", file: null });

        // ─────────────────────────────────────────────────────────────────────────
        // MANUAL (link / upload / link_image)
        // ─────────────────────────────────────────────────────────────────────────
      } else {
        toast.info("📋 Task submitted for manual review.");
        await refreshAllStats();
        setShowSubmitModal(false);
        setSubmissionData({ proofUrl: "", notes: "", file: null });
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred. Please try again.");
    } finally {
      setSubmittingTaskId(null);
    }
  };

  const handleReviewSubmission = async (submissionId: string, status: "approved" | "rejected", notes?: string) => {
  setProcessingSubmission({ id: submissionId, action: status });
  try {
    const payload: any = { status };
    if (notes) payload.notes = notes;

    // 👇 ADD `?adminAddress=${userWalletAddress}` TO THE URL 👇
    const response = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/submissions/${submissionId}?adminAddress=${userWalletAddress}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();

    if (result.success) {
      setPendingSubmissions((prev) => prev.filter((s) => s.submissionId !== submissionId));
      toast.success(`Submission ${status}`);
      setRejectingSubId(null);
      setRejectionNote("");
      await loadUserProgress();
    } else {
      toast.error(result.message || "Action failed.");
    }
  } catch (error) {
    toast.error("Network error. Action failed.");
  } finally {
    setProcessingSubmission(null);
  }
};

  // Import parseUnits if you haven't already

const handleFundQuest = async () => {
    if (!walletProvider || !faucetAddress) { toast.error("Wallet not connected."); return; }
    setIsFunding(true);

    try {
      const provider = walletProvider as BrowserProvider;
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      const tokenAddress = questData.tokenAddress;
      const ERC20_ABI = [
        "function approve(address s, uint256 a) public returns (bool)",
        "function balanceOf(address a) public view returns (uint256)",
        "function allowance(address o, address s) public view returns (uint256)",
        "function decimals() public view returns (uint8)",
      ];

      const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);

      // 👇 Fetch decimals first, use them for all amount calculations
      const decimals = await tokenContract.decimals();

      const baseAmountWei = parseUnits(rewardPoolAmount.toString(), decimals);
      const totalAmountWei = baseAmountWei + (baseAmountWei * 1n) / 100n;

      const balance = await tokenContract.balanceOf(userAddress);

      if (balance < totalAmountWei) throw new Error("Insufficient token balance for prize + fees.");

      const currentAllowance = await tokenContract.allowance(userAddress, faucetAddress);
      if (currentAllowance < totalAmountWei) {
        toast.info("Approving tokens...");
        const appTx = await tokenContract.approve(faucetAddress, totalAmountWei);
        await appTx.wait();
      }

      const questContract = new Contract(faucetAddress, QUEST_ABI, signer);
      const tx = await questContract.fund(totalAmountWei);

      toast.info("Funding transaction sent...");
      await tx.wait();

      await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/set-funded`, { method: 'POST' });
      toast.success("Quest funded and activated!");
      setQuestData((prev: any) => ({ ...prev, isFunded: true }));
      setShowFundModal(false);

    } catch (error: any) {
      console.error(error);
      toast.error(error.reason || error.message || "Funding failed");
    } finally {
      setIsFunding(false);
    }
  };

  const handleSubscribe = async () => {
    if (!walletProvider || !userWalletAddress || !activeWallet) {
      toast.error("Wallet not connected.");
      return;
    }

    setIsFunding(true); // Reusing the funding loading state

    try {
      const privyProvider = await activeWallet.getEthereumProvider();
      const ethersProvider = new BrowserProvider(privyProvider);
      const signer = await ethersProvider.getSigner();
      const userAddress = await signer.getAddress();

      // ⚠️ YOUR COMPANY WALLET RECEIVER
      const COMPANY_WALLET = "0x97841b00B8Ad031FB30495eCeF2B2DbB6FCaCE30";

      // Identify the current chain
      const currentChainId = parseInt(activeWallet.chainId.split(':')[1]);

      // Smart routing: Always charge in USDT/USDC regardless of the quest reward token
      const STABLECOINS: Record<number, { address: string, decimals: number }> = {
        42220: { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 }, // Celo USDT
        1135: { address: "0x05D032ac25d322df992303dCa074EE7392C117b9", decimals: 6 }, // Lisk USDT
        42161: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 }, // Arb USDT
        8453: { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 }, // Base USDC
        56: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 }, // BNB USDT (18 decimals)
      };

      const stablecoin = STABLECOINS[currentChainId];
      if (!stablecoin) throw new Error("Stablecoin payments not configured for this network.");

      // Calculate $100 based on the token's decimals
      const subscriptionCost = 100;
      const amountWei = parseEther(subscriptionCost.toString()) / BigInt(10 ** (18 - stablecoin.decimals));

      const ERC20_ABI = [
        "function transfer(address to, uint256 amount) public returns (bool)",
        "function balanceOf(address account) public view returns (uint256)"
      ];

      const tokenContract = new Contract(stablecoin.address, ERC20_ABI, signer);

      // 1. Check Balance
      const balance = await tokenContract.balanceOf(userAddress);
      if (balance < amountWei) {
        throw new Error("Insufficient stablecoin balance for $100 subscription.");
      }

      // 2. Execute Payment Transfer
      toast.info("Please confirm the $100 subscription payment...");
      const tx = await tokenContract.transfer(COMPANY_WALLET, amountWei);

      toast.info("Processing payment on the blockchain...");
      await tx.wait();

      // 3. Notify Backend to Activate Subscription
      toast.info("Activating your subscription...");
      const res = await fetch(`${API_BASE_URL}/api/profile/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: userWalletAddress,
          tx_hash: tx.hash
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Subscription Activated! You can now manage your quest.");

        // Update local state instantly to unblock the UI
        setUserProfile(prev => prev ? {
          ...prev,
          is_quest_subscribed: true,
          quest_subscription_expires_at: data.expires_at
        } : null);

      } else {
        throw new Error("Backend failed to activate subscription.");
      }

    } catch (error: any) {
      console.error(error);
      const errorMsg = error.reason || error.shortMessage || error.message || "Payment failed";
      toast.error("Subscription failed: " + errorMsg);
    } finally {
      setIsFunding(false);
    }
  };
  const isValidFundingAmount = useMemo(() => {
    const input = parseFloat(fundAmount || "0");
    return Math.abs(input - totalRequired) < 0.0001;
  }, [fundAmount, totalRequired]);
  // --- PARTICIPANT: CLAIM REWARD (VIA BACKEND) ---
  const handleClaimReward = async () => {
    if (!activeWallet) return toast.error("Wallet not connected");
    setIsClaiming(true);

    try {
      // Parse the chainId from Privy (e.g., "eip155:42220" -> 42220)
      const currentChainId = parseInt(activeWallet.chainId.split(':')[1]);

      const res = await fetch(`${API_BASE_URL}/claim-on-quest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: activeWallet.address,
          faucetAddress: faucetAddress,
          chainId: currentChainId,
          shouldWhitelist: false
        })
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Reward Claimed Successfully! Tx: " + data.txHash);
      } else {
        toast.error(data.detail || "Claim failed.");
      }
    } catch (e: any) {
      toast.error("Network error during claim.");
    } finally {
      setIsClaiming(false);
    }
  };
  // --- ADMIN: WITHDRAW FUNDS (DIRECT CONTRACT INTERACTION) ---
  const handleAdminWithdraw = async () => {
    if (!activeWallet) return toast.error("Wallet not connected");
    setIsWithdrawing(true);

    try {
      // 1. Ask Privy for the raw provider
      const privyProvider = await activeWallet.getEthereumProvider();

      // 2. Wrap it in ethers so we can use standard contract methods
      const ethersProvider = new BrowserProvider(privyProvider);
      const signer = await ethersProvider.getSigner();

      const questContract = new Contract(faucetAddress!, QUEST_ABI, signer);

      let amountToWithdraw;

      // Figure out how much is left inside the contract
      if (questData.rewardTokenType === 'native' || questData.tokenAddress === ZeroAddress) {
        amountToWithdraw = await ethersProvider.getBalance(faucetAddress!);
      } else {
        // Fetch ERC20 balance
        const erc20Abi = ["function balanceOf(address account) view returns (uint256)"];
        const tokenContract = new Contract(questData.tokenAddress, erc20Abi, signer);
        amountToWithdraw = await tokenContract.balanceOf(faucetAddress!);
      }

      if (amountToWithdraw === 0n) {
        throw new Error("No funds left to withdraw.");
      }

      toast.info("Please confirm the withdrawal in your wallet...");
      const tx = await questContract.withdraw(amountToWithdraw);

      toast.info("Withdrawing funds. Waiting for confirmation...");
      await tx.wait();
      toast.success("Funds successfully withdrawn to your wallet!");

    } catch (e: any) {
      console.error(e);
      const errorMsg = e.reason || e.shortMessage || e.message || "Transaction failed";
      toast.error("Withdrawal failed: " + errorMsg);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const questStatusGuard = useMemo(() => {
    const now = new Date();
    const start = questData?.startDate ? new Date(questData.startDate) : null;
    if (!questData?.isFunded) return { blocked: true, title: "Quest Unfunded", desc: "The creator has not funded the reward pool yet." };
    if (start && now < start) return { blocked: true, title: "Coming Soon", desc: `This quest starts on ${start.toLocaleDateString()} at ${start.toLocaleTimeString()}.` };
    return { blocked: false };
  }, [questData, startCountdown]); // <--- ADD START COUNTDOWN HERE

  // ── UPDATED getTaskStatus: uses activeStages + stagesMeta from backend ──
  const getTaskStatus = (task: QuestTask): "completed" | "pending" | "rejected" | "available" | "locked" => {
    if (canManageQuest) return "available";
    if (!creatorSubscribed) return "locked";
    if (!participantData) return "locked";

    const currentTaskId = task.id || (task as any)._id;
    if (!currentTaskId) return "available";

    if (userProgress.completedTasks.includes(currentTaskId)) return "completed";

    // --- NEW: Check submission history for pending or rejected states ---
    const taskSubmissions = userProgress.submissions?.filter((s: any) => String(s.taskId || s.task_id) === String(currentTaskId)) || [];
    if (taskSubmissions.length > 0) {
      // Sort to get the most recent submission
      taskSubmissions.sort((a: any, b: any) => new Date(b.submittedAt || b.submitted_at || 0).getTime() - new Date(a.submittedAt || a.submitted_at || 0).getTime());
      const latestSub = taskSubmissions[0];

      if (["pending", "auto_verifying"].includes(latestSub.status)) return "pending";
      if (latestSub.status === "rejected") return "rejected";
    }
    // ---------------------------------------------------------------------

    // If this task's stage is not in activeStages, it doesn't exist for this quest
    const taskStage = task.stage;
    const questActiveStages = userProgress.activeStages || [];

    if (questActiveStages.length > 0 && !questActiveStages.includes(taskStage)) {
      return "locked"; // stage has no tasks in this quest
    }

    // Use stagesMeta if available (new backend), otherwise fall back to old index logic
    if (userProgress.stagesMeta && Object.keys(userProgress.stagesMeta).length > 0) {
      const taskStageMeta = userProgress.stagesMeta[taskStage];
      if (!taskStageMeta) return "locked";

      // Task is accessible if its stage is current or already unlocked
      if (taskStageMeta.isCurrent || taskStageMeta.isUnlocked) return "available";

      // Future stage: only accessible if the previous active stage is unlocked
      const stageIdx = questActiveStages.indexOf(taskStage);
      if (stageIdx <= 0) return "available"; // first active stage always accessible
      const prevStage = questActiveStages[stageIdx - 1];
      const prevMeta = userProgress.stagesMeta[prevStage];
      if (prevMeta?.isUnlocked) return "available"; // can see next stage's tasks

      return "locked";
    }

    // ── FALLBACK: old index-based logic (before backend update) ──
    const taskStageIndex = ALL_STAGES.indexOf(task.stage);
    const userStageIndex = ALL_STAGES.indexOf(userProgress.currentStage);
    if (taskStageIndex > userStageIndex) return "locked";
    return "available";
  };
  const currentStage = userProgress.currentStage || "Beginner";
  const currentStageMeta = userProgress.stagesMeta?.[currentStage];
  const hasNewBackendData = currentStageMeta !== undefined;

  const stagesToRender = hasNewBackendData
    ? userProgress.activeStages   // only stages with tasks, from backend
    : ALL_STAGES;                 // fallback: all stages (filter by task count happens below)

  // 👇 PASTE IT RIGHT HERE 👇
  const hasActiveSubscription = useMemo(() => {
    if (!userProfile?.is_quest_subscribed) return false;
    if (!userProfile?.quest_subscription_expires_at) return false;

    const expiresAt = new Date(userProfile.quest_subscription_expires_at);
    const now = new Date();

    return expiresAt > now;
  }, [userProfile]);

  // ============= RENDER STATES =============
  if (isLoading || isProfileLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header pageTitle="Loading..." />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loading/>
        </div>
      </div>
    );
  }

  if (!userWalletAddress) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header pageTitle={questData?.title || "Quest Details"} />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 relative overflow-hidden text-center">
            <CardHeader className="pb-2 pt-8">
              <div className="mx-auto bg-slate-100 dark:bg-slate-900 p-4 rounded-full mb-4 w-fit ring-1 ring-slate-200 dark:ring-slate-800">
                <Rocket className="h-10 w-10 text-slate-600 dark:text-slate-400" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Ready to Start?</CardTitle>
              <CardDescription className="text-base mt-2 mx-auto leading-relaxed">Sign in or create an account to view this Quest and participate.</CardDescription>
            </CardHeader>
            <CardFooter className="pt-4 flex justify-center pb-8">
              <p className="text-sm text-muted-foreground">Click the "Get Started" button in the header.</p>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  

  if (!questData) return (<div className="flex flex-col min-h-screen"><Header pageTitle="Not Found" /><div className="p-10 text-center">Quest not found.</div></div>);


  // ── BLOCKAGE UI FOR CREATORS ──
 
  if (isCreator && !hasActiveSubscription && !isDemoQuest && userWalletAddress?.toLowerCase() !== SUPER_ADMIN_ADDRESS.toLowerCase()) {
  
    return (
      <div className="flex flex-col min-h-screen">
        <Header pageTitle={questData.title || "Subscription Required"} />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-blue-200 dark:border-blue-900/50 bg-white dark:bg-slate-950 relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
            <CardHeader className="pb-2 pt-8">
              <div className="mx-auto bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full mb-4 w-fit ring-1 ring-blue-100 dark:ring-blue-800">
                <ShieldCheck className="h-10 w-10 text-blue-600 dark:text-blue-500" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Creator Subscription Required</CardTitle>
              <CardDescription className="text-base mt-2 mx-auto leading-relaxed">
                To host live quests and access the admin dashboard, you need an active Creator Subscription.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">30 Days Access</span>
                <span className="text-xl font-black text-primary">$100 USD</span>
              </div>
              <p className="text-xs text-muted-foreground">Payment is processed securely in USDT/USDC.</p>
            </CardContent>
            <CardFooter className="pt-2 flex justify-center pb-8">
              <Button size="lg" onClick={handleSubscribe} disabled={isFunding} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12">
                {isFunding ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {isFunding ? "Processing Payment..." : "Subscribe Now"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }


  const pointsEarnedInCurrentStage = hasNewBackendData
    ? currentStageMeta.userEarned
    : (userProgress.stagePoints?.[currentStage] ?? 0);

  const unlockThreshold = hasNewBackendData
    ? currentStageMeta.unlockThreshold   // 70% of stage total
    : (questData?.stagePassRequirements?.[currentStage] ?? 0);

  const stageTotal = hasNewBackendData
    ? currentStageMeta.stageTotal        // 100% of stage tasks
    : unlockThreshold;

  const isCurrentStageUnlocked = hasNewBackendData
    ? currentStageMeta.isUnlocked
    : (unlockThreshold > 0 ? pointsEarnedInCurrentStage >= unlockThreshold : true);

  const isLastActiveStage = hasNewBackendData
    ? currentStageMeta.isLastStage
    : false;

  const pointsRemaining = Math.max(0, unlockThreshold - pointsEarnedInCurrentStage);

  // Progress bar: counts toward 70% threshold. Freezes at 100% once unlocked.
  const progressPercent = isCurrentStageUnlocked
    ? 100
    : unlockThreshold > 0
      ? Math.min(Math.round((pointsEarnedInCurrentStage / unlockThreshold) * 100), 99)
      : 100;

  const filteredLeaderboard = leaderboard.filter(
    (entry) => entry.walletAddress.toLowerCase() !== questData.creatorAddress.toLowerCase() && entry.points > 0
  );


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header pageTitle={questData.title} />
      
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-8 pb-20 relative">
        {/* ============= HERO SECTION ============= */}
        {isCreator && isDemoQuest && (
        <div className="w-full overflow-hidden border bg-violet-50 border-b dark:bg-violet-950/20 py-2 dark:border-violet-700/50 border-violet-300">
                <div className="flex whitespace-nowrap animate-marquee">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <span key={i} className="inline-flex items-center gap-2 px-8 text-xs font-semibold text-white">
                            <Coins className="h-3.5 w-3.5 shrink-0" />
                            Subscribe today to go live, fund your reward pool, accept real participants, and unlock all quest features.
                            <span className="text-white">·</span>
                        </span>
                    ))}
                </div>
            </div>
      )}

        {isCreator && !questData.isFunded && !isDemoQuest &&  (
         <div className="w-full overflow-hidden bg-yellow-500/10 border-b border-yellow-500/30 py-2">
                <div className="flex whitespace-nowrap animate-marquee">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <span key={i} className="inline-flex items-center gap-2 px-8 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                            <Coins className="h-3.5 w-3.5 shrink-0" />
                            Fund your quest so participants can receive their rewards automatically.
                            <span className="text-yellow-500">·</span>
                        </span>
                    ))}
                </div>
            </div>
        )}
        
        <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl min-h-[160px] md:min-h-[300px]">
          {/* Background Layer */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-slate-900/50 via-slate-900/50 to-transparent z-10" />
            {editForm.imageUrl || questData.imageUrl ? (
              <img
                src={editForm.imageUrl || questData.imageUrl}
                alt="Background"

                className="w-full h-full object-cover opacity-50 blur-[2px] origin-center md:origin-top scale-100 md:scale-105"
              />
            ) : null}
          </div>

          {/* Main Content */}
          <div className="relative z-20 p-4 md:p-10 flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start h-full">

            {/* Cover Image */}
            <div className="w-28 h-28 sm:w-40 sm:h-40 md:w-64 md:h-64 shrink-0 rounded-lg overflow-hidden border-2 border-slate-700/50 shadow-xl bg-slate-950 flex items-center justify-center group relative">
              {isEditing ? (
                <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center p-4">
                  <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400 mb-2" />
                  <Input
                    className="bg-black/50 border-slate-600 text-white h-8 text-xs w-full text-center"
                    value={editForm.imageUrl}
                    placeholder="Image URL..."
                    onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                  />
                </div>
              ) : (
                <img
                  src={questData.imageUrl}
                  alt="Quest Cover"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              )}
            </div>

            {/* Text & Data Container */}
            <div className="flex-1 w-full space-y-5 md:space-y-8 flex flex-col items-center md:items-start text-center md:text-left">

              {/* Top Header: Title, Description & Admin Action */}
              <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-4 w-full">
                <div className="space-y-3 w-full max-w-2xl">
                  <div className="flex flex-col gap-3">
                    {isEditing ? (
                      <div className="flex flex-col md:flex-row items-center gap-4 w-full">
                        <Input
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="text-2xl md:text-3xl font-bold bg-white/10 border-white/20 text-white h-auto py-2 text-center md:text-left"
                        />
                        <div className="flex items-center justify-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-white/10 w-full md:w-auto">
                          <Label className="text-white whitespace-nowrap">Active</Label>
                          <Switch
                            checked={editForm.isActive}
                            onCheckedChange={(c) => setEditForm({ ...editForm, isActive: c })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row items-center md:items-start gap-3 flex-wrap justify-center md:justify-start">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">{questData.title}</h1>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          
                          <Badge variant={questData.isActive ? "default" : "destructive"} className="h-6 px-3">
                            {questData.isActive ? "Live" : "Paused"}
                          </Badge>
                          {isCreator && questData.isFunded && (
                            <Badge className="bg-green-500 hover:bg-green-600 h-6 px-3">Funded</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="bg-white/10 border-white/20 text-slate-200 min-h-[100px] text-center md:text-left"
                    />
                  ) : (
                    <p className="text-slate-300 text-sm md:text-lg leading-relaxed">{questData.description}</p>
                  )}
                </div>

                {/* Admin Fund Button */}
               {isCreator && (isDemoQuest || !questData.isFunded) && (
  <div className="w-full md:w-auto shrink-0 mt-2 md:mt-0">
  {isDemoQuest ? (
    <Button
      size="lg"
      onClick={() => setShowSubscribeModal(true)}
      disabled={isFunding}
      className="w-full bg-transparent hover:to-indigo-700 text-white shadow-lg font-bold"
    >
      {isFunding ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
      {isFunding ? "Processing..." : "Subscribe to Go Live — $100"}
    </Button>
  ) : hasActiveSubscription ? (
    <Button
      size="lg"
      onClick={() => { setFundAmount(""); setShowFundModal(true); }}
      className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
    >
      <Coins className="mr-2 h-5 w-5" /> Fund Quest
    </Button>
  ) : (
    <Button
      size="lg"
      onClick={() => setShowSubscribeModal(true)}
      disabled={isFunding}
      className="w-full bg-transparent hover:to-indigo-700 text-white shadow-lg font-bold"
    >
      {isFunding ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
      {isFunding ? "Processing..." : "Subscribe Now — $100"}
    </Button>
  )}
</div>
)}
              </div>

              {/* ── Stats Area ── */}
              <div className="w-full flex flex-col gap-4 pt-2">

                {/* 2-Column Grid for Standard Stats */}
                <div className="grid grid-cols-2 gap-3 md:gap-4 w-full">

                  {/* Stat 1: Reward Pool */}
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-3 md:p-4 flex items-center justify-start gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-full text-yellow-400 shrink-0">
                      <Trophy className="h-4 w-4 md:h-6 md:w-6" />
                    </div>
                    <div className="text-left overflow-hidden">
                      <div className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold tracking-wider truncate">Reward Pool</div>
                      {isEditing ? (
                        <Input
                          value={editForm.rewardPool}
                          onChange={(e) => setEditForm({ ...editForm, rewardPool: e.target.value })}
                          className="h-6 bg-transparent border-b border-white/30 rounded-none text-white font-bold p-0 focus-visible:ring-0 focus-visible:border-white text-base md:text-lg w-full"
                        />
                      ) : (
                        <div className="text-base md:text-xl font-bold text-white truncate">{questData.rewardPool} {tokenSymbol}</div>
                      )}
                    </div>
                  </div>

                  {/* Stat 2: Participants */}
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-3 md:p-4 flex items-center justify-start gap-3">
                    <div className="p-2 bg-green-500/20 rounded-full text-green-400 shrink-0">
                      <Users className="h-4 w-4 md:h-6 md:w-6" />
                    </div>
                    <div className="text-left overflow-hidden">
                      <div className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold tracking-wider truncate">Participants</div>
                      <div className="text-base md:text-xl font-bold text-white">{allParticipants.length}</div>
                    </div>
                  </div>
                </div>

                {/* CHANGED: Centralized, Larger Stage/Role Banner */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-5 md:p-6 flex flex-col items-center justify-center gap-2 w-full mt-1 shadow-lg">
                  <div className="p-3 bg-blue-500/20 rounded-full text-blue-400 shrink-0 mb-1">
                    <Shield className="h-6 w-6 md:h-8 md:w-8" />
                  </div>
                  <div className="text-center overflow-hidden">
                    <div className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-widest truncate mb-1">
                      {canManageQuest ? "Your Role" : "Your Stage"}
                    </div>
                    <div className="text-2xl md:text-4xl font-black text-white truncate">
                      {canManageQuest ? "Admin" : participantData ? userProgress.currentStage : "Not Joined"}
                    </div>
                  </div>
                </div>

                {/* ── Actions Area ── */}
                {/* CHANGED: Hide entirely if the user is a participant */}
                {(!participantData || canManageQuest) && (
                  <div className="flex flex-row gap-2 w-full justify-center md:justify-start [&>button]:flex-1 md:[&>button]:flex-none mt-2">

                    {/* Copy Link is now hidden for participants */}
                    <Button
                      variant="outline"
                      className="bg-white/5 border-white/10 text-white hover:bg-white/10 h-11 md:h-12 px-2 md:px-6 text-xs md:text-sm"
                      onClick={() => {
                        const link = window.location.href.split("?")[0];
                        navigator.clipboard.writeText(link);
                        toast.success("Quest link copied to clipboard!");
                      }}
                    >
                      <Copy className="mr-1.5 md:mr-2 h-4 w-4 md:h-5 md:w-5 shrink-0" />
                      <span className="truncate">Copy Link</span>
                    </Button>

                    {!canManageQuest && (
                      <Button
                        onClick={handleJoin}
                        disabled={isJoining || questTiming.notStartedYet || questTiming.isEnded || !creatorSubscribed}
                        className="h-11 md:h-12 px-2 md:px-6 text-xs md:text-sm"
                      >
                        {isJoining ? <Loader2 className="mr-1.5 md:mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin shrink-0" /> : null}
                        <span className="truncate">
                          {isJoining
                            ? "Joining..."
                            : !creatorSubscribed
                              ? "Locked"
                              : questTiming.notStartedYet
                                ? `Starts in ${startCountdown}`
                                : questTiming.isEnded
                                  ? "Ended"
                                  : "Join Quest"}
                        </span>
                      </Button>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
        {/* ============= COUNTDOWN BANNERS ============= */}
        {questTiming.notStartedYet && questData?.startDate && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-full text-blue-600 dark:text-blue-400">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm">Quest Not Started Yet</p>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Starts on {new Date(questData.startDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
            <div className="text-2xl font-black text-blue-700 dark:text-blue-300 font-mono tracking-tight">
              {startCountdown}
            </div>
          </div>
        )}
        
        {questTiming.isLive && questData?.endDate && (
          <div className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-full text-green-600 dark:text-green-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-green-900 dark:text-green-200 text-sm">Quest Is Live!</p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  Ends on {new Date(questData.endDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
            <div className="text-2xl font-black text-green-700 dark:text-green-300 font-mono tracking-tight">
              {endCountdown}
            </div>
          </div>
        )}

        {questTiming.isEnded && !questTiming.isReviewing && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Quest Has Ended</p>
              <p className="text-xs text-slate-500">
                Ended on {new Date(questData.endDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        )}

        {questTiming.isReviewing && (
          <div className="rounded-xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-900/20 px-6 py-4 flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-full text-yellow-600 dark:text-yellow-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-200 text-sm">Admin Review Period (24 Hours)</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                The quest has ended. The creator is currently reviewing pending tasks. Claims will open once verification is complete.
              </p>
            </div>
          </div>
        )}

        {/* ============= PROGRESS BAR (UPDATED) ============= */}
        {!canManageQuest && participantData && (
          <Card className="border-none bg-slate-50 dark:bg-slate-900/50 shadow-sm overflow-hidden">
            {/* Slightly reduced padding on mobile (p-4 to sm:p-6) */}
            <CardContent className="p-4 sm:p-6">

              {/* Changed to stack vertically on mobile, row on tablet/desktop */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-5 sm:gap-4 mb-4 sm:mb-5">

                <div className="flex-1 order-2 sm:order-1">
                  {/* Added flex-wrap so badges stack neatly if the screen is super narrow */}
                  <h3 className="font-bold text-lg flex flex-wrap items-center gap-2">
                    Your Progress
                    <Badge variant="outline" className="text-primary border-primary bg-primary/5">
                      {currentStage}
                    </Badge>

                    {isCurrentStageUnlocked && !isLastActiveStage && (
                      <Badge className="bg-green-500 text-white border-0 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Stage Unlocked!
                      </Badge>
                    )}

                    {isCurrentStageUnlocked && isLastActiveStage && (
                      <Badge className="bg-yellow-500 text-black border-0 flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> Quest Complete!
                      </Badge>
                    )}
                  </h3>

                  {/* Added leading-relaxed for better readability on mobile */}
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {isCurrentStageUnlocked && !isLastActiveStage ? (
                      <span className="text-green-600 font-medium">
                        ✓ You unlocked {activeStages[activeStages.indexOf(currentStage) + 1]}! Start completing tasks there to continue.
                      </span>
                    ) : isCurrentStageUnlocked && isLastActiveStage ? (
                      <span className="text-yellow-600 font-medium">
                        🏆 You have completed all stages of this quest!
                      </span>
                    ) : unlockThreshold === 0 ? (
                      <span className="text-green-600 font-medium">✓ No requirement — next stage available!</span>
                    ) : (
                      <>
                        Earn <strong>{pointsRemaining}</strong> more points in <strong>{currentStage}</strong> to unlock {
                          activeStages[activeStages.indexOf(currentStage) + 1]
                            ? <strong>{activeStages[activeStages.indexOf(currentStage) + 1]}</strong>
                            : "the next stage"
                        }.{" "}
                        <span className="inline-block text-muted-foreground mt-0.5">
                          ({pointsEarnedInCurrentStage} / {unlockThreshold} pts — 70% of {stageTotal} total)
                        </span>
                      </>
                    )}
                  </p>
                </div>

                {/* Highlighted the points on mobile by giving it a distinct layout, while keeping it minimal on desktop */}
                <div className="order-1 sm:order-2  sm:bg-transparent rounded-lg p-3 sm:p-0 shadow-sm sm:shadow-none border border-slate-100 dark:border-slate-800 sm:border-none flex sm:block items-center justify-between sm:text-right w-full sm:w-auto self-start">
                  <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider order-2 sm:order-none">
                    Total Points
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-primary order-1 sm:order-none leading-none">
                    {totalPoints}
                  </div>
                </div>
              </div>

              {/* Made the progress bar slightly thinner on mobile */}
              <Progress
                value={progressPercent}
                className={`h-3 sm:h-4 rounded-full ${isCurrentStageUnlocked ? "opacity-60" : ""}`}
              />

              {/* Allowed bottom text to stack on mobile if it gets too long */}
              {hasNewBackendData && !isCurrentStageUnlocked && (
                <div className="flex flex-col sm:flex-row sm:justify-between text-xs text-muted-foreground mt-3 sm:mt-2 gap-1.5 sm:gap-0">
                  <span className="font-medium">{pointsEarnedInCurrentStage} pts earned</span>
                  
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============= TABS ============= */}
        <div className="relative">

          <Tabs defaultValue="tasks" className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b mb-8 gap-4 pb-2 sm:pb-0">
              {/* ── TABS NAVIGATION ── */}
              <TabsList className="bg-transparent h-auto p-0 gap-6 sm:gap-8 w-full justify-start overflow-x-auto no-scrollbar">
                <TabsTrigger value="tasks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary pb-3 px-1 text-base font-medium whitespace-nowrap">
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="leaderboard" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary pb-3 px-1 text-base font-medium whitespace-nowrap">
                  Leaderboard
                </TabsTrigger>
                {canManageQuest && (
                  <TabsTrigger value="admin" className="rounded-none border-b-2 border-transparent data-[state=active]:border-yellow-500 data-[state=active]:text-yellow-600 pb-3 px-1 text-base font-medium flex items-center gap-2 whitespace-nowrap">
                    <Shield className="h-4 w-4" /> Admin
                    {pendingSubmissions.length > 0 && (
                      <Badge className="bg-yellow-500 text-black h-5 w-5 p-0 flex items-center justify-center rounded-full text-xs">
                        {pendingSubmissions.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              {!canManageQuest && (
                <div className="flex shrink-0 w-full sm:w-auto animate-in fade-in duration-300 sm:pb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setIsRefreshingUser(true);
                      try {
                        await refreshAllStats();
                        // Also re-fetch participant data
                        if (faucetAddress && userWalletAddress) {
                          const res = await fetch(
                            `${API_BASE_URL}/api/quests/${faucetAddress}/participant/${userWalletAddress}`
                          );
                          const json = await res.json();
                          if (json.success && json.participant) {
                            setParticipantData(json.participant);
                          }
                        }
                      } finally {
                        setIsRefreshingUser(false);
                      }
                    }}
                    disabled={isRefreshingUser}
                    className="w-full sm:w-auto shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <RefreshCcw className={`mr-2 h-3.5 w-3.5 text-primary ${isRefreshingUser ? "animate-spin" : ""}`} />
                    {isRefreshingUser ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>
              )}
            </div>

            {/* ── TASKS TAB ── */}
            <TabsContent value="tasks" className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="relative">
                {!participantData && !canManageQuest && (
                  <div className="absolute inset-0 z-40 pointer-events-auto cursor-not-allowed" />
                )}
                {stagesToRender.map((stage) => {
                  // Only render stages that have tasks
                  const stageTasks = questData.tasks.filter((t: any) => t.stage === stage) || [];
                  if (stageTasks.length === 0) return null;
                  const isQuestNotStarted = questTiming.notStartedYet;
                  // ── UPDATED: use stagesMeta for lock state ──
                  const stageMeta = userProgress.stagesMeta?.[stage];
                  let isLockedStage: boolean;

                  if (stageMeta) {
                    // New logic: stage is locked if it's not current AND not unlocked AND
                    // the previous active stage hasn't been unlocked yet
                    const stageIdxInActive = userProgress.activeStages.indexOf(stage);
                    if (stageIdxInActive <= 0 || stageMeta.isCurrent || stageMeta.isUnlocked) {
                      isLockedStage = false;
                    } else {
                      const prevStage = userProgress.activeStages[stageIdxInActive - 1];
                      const prevMeta = userProgress.stagesMeta[prevStage];
                      isLockedStage = !(prevMeta?.isUnlocked ?? false);
                    }
                  } else {
                    // Fallback: old index-based logic
                    const stageIdx = ALL_STAGES.indexOf(stage);
                    const userStageIdx = ALL_STAGES.indexOf(userProgress.currentStage);
                    isLockedStage = stageIdx > userStageIdx;
                  }

                  // Lock everything if quest hasn't started
                  if (canManageQuest) isLockedStage = false;

                  // ── Per-stage progress info (shown in stage header) ──
                  const stageProgressLabel = stageMeta
                    ? stageMeta.isUnlocked
                      ? `✓ Unlocked (${stageMeta.userEarned}/${stageMeta.unlockThreshold} pts)`
                      : stageMeta.isCurrent
                        ? `${stageMeta.userEarned}/${stageMeta.unlockThreshold} pts to unlock`
                        : "Locked"
                    : null;

                  return (
                    <div key={stage} className={`space-y-4 ${(isLockedStage || !participantData || isQuestNotStarted) && !canManageQuest ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant="outline"
                          className={`px-4 py-1 text-sm font-bold uppercase tracking-wide ${isLockedStage || !participantData
                            ? "border-slate-300 text-slate-400"
                            : stageMeta?.isUnlocked
                              ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-950/20"
                              : "border-primary/50 text-primary bg-primary/5"
                            }`}
                        >
                          {stage}
                        </Badge>

                        {/* ── NEW: per-stage unlock badge ── */}
                        {stageMeta?.isUnlocked && (
                          <Badge className="bg-green-500 text-white border-0 text-xs flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Unlocked
                          </Badge>
                        )}

                        {/* ── NEW: per-stage progress label ── */}
                        {stageProgressLabel && !stageMeta?.isUnlocked && stageMeta?.isCurrent && (
                          <span className="text-xs text-muted-foreground">{stageProgressLabel}</span>
                        )}

                        <div className="h-px bg-border flex-1" />
                        {(isLockedStage || !participantData || isQuestNotStarted) && <Lock className="h-4 w-4 text-muted-foreground" />}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {stageTasks.map((task: any) => {
                          if (task.id === "sys_daily") {
                            const checkinStatus = getCheckinStatus();
                            return (
                              <Card key={task.id} className={`group relative overflow-hidden transition-all duration-300 h-full flex flex-col ${!participantData ? "opacity-50" : ""}`}>
                                <CardContent className="p-5 flex flex-col h-full">
                                  <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary"><CalendarClock className="h-5 w-5" /></div>
                                    <Badge variant="secondary">+50 PTS</Badge>
                                  </div>
                                  <h3 className="font-bold text-lg mb-2">{task.title}</h3>
                                  <p className="text-sm text-muted-foreground flex-1">{task.description}</p>
                                  <div className="mt-4 pt-4 border-t">
                                    {participantData && !canManageQuest ? (
                                      checkinStatus.canCheckin ? (
                                        <Button
                                          onClick={handleDailyCheckin}
                                          // Add !creatorSubscribed to disabled conditions
                                          disabled={isCheckingIn || !checkinStatus.canCheckin || !questTiming.isLive || !creatorSubscribed}
                                          className="w-full"
                                        >
                                          {isCheckingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                          {/* Update Text */}
                                          {!creatorSubscribed ? "Quest Locked" : questTiming.notStartedYet ? "Check-in Locked" : "Check In Now +50 pts"}
                                        </Button>
                                      ) : (
                                        <div className="text-center space-y-2">
                                          <p className="text-sm font-medium text-green-600">✓ Checked in today!</p>
                                          <p className="text-xs text-muted-foreground">{checkinStatus.message}</p>
                                        </div>
                                      )
                                    ) : (
                                      <div className="text-center text-muted-foreground">{canManageQuest ? "Creators cannot check in" : "Join quest to check in"}</div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          }

                            if (task.id === "sys_referral") {
                                    if (!participantData) return null;
                                    const refCount = participantData.referral_count || 0;
                                    const referralLink = `${window.location.origin}${window.location.pathname}?ref=${participantData.referral_id}`;
                                    
                                    // ── NEW: find the required referee task ──
                                    const requiredRefereeTaskId = task.requiredRefereeTaskId;
                                    const requiredRefereeTask = requiredRefereeTaskId && requiredRefereeTaskId !== "none"
                                      ? questData.tasks?.find((t: any) => t.id === requiredRefereeTaskId)
                                      : null;

                                    return (
                                      <Card key={task.id} className="group relative overflow-hidden transition-all duration-300 h-full flex flex-col">
                                        <CardContent className="p-5 flex flex-col h-full">
                                          <div className="flex justify-between items-start mb-4">
                                            <div className="p-2 rounded-lg bg-primary/10 text-primary"><Users className="h-5 w-5" /></div>
                                            <Badge variant="secondary">+200 PTS each</Badge>
                                          </div>
                                          <h3 className="font-bold text-lg mb-2">{task.title}</h3>
                                          <p className="text-sm text-muted-foreground flex-1">{task.description}</p>

                                          {/* ── NEW: Referee requirement notice ── */}
                                          {requiredRefereeTask ? (
                                            <div className="mt-3 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 flex items-start gap-2">
                                              <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                              <div className="text-xs text-blue-800 dark:text-blue-300">
                                                <span className="font-semibold block mb-0.5">To earn referral points, your friends must complete the task:</span>
                                                <span className="font-bold">{requiredRefereeTask.title} Task</span>
                                                {requiredRefereeTask.description && (
                                                  <span className="block text-blue-700 dark:text-blue-400 mt-0.5 opacity-80">
                                                    {requiredRefereeTask.description}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="mt-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-start gap-2">
                                              <Users className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Your referral just needs to <span className="font-semibold">join the quest</span> for you to earn points.
                                              </p>
                                            </div>
                                          )}

                                          <div className="mt-4 space-y-4">
                                            <div>
                                              <Label className="text-xs">Your Referral Link</Label>
                                              <div className="flex gap-2 mt-1">
                                                <Input value={referralLink} readOnly className="font-mono text-xs" />
                                                <Button size="sm" onClick={() => { navigator.clipboard.writeText(referralLink); toast.success("Referral link copied to clipboard"); }}>
                                                  <Copy className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </div>
                                            <p className="text-sm font-medium">
                                              You have <span className="text-primary font-bold">{refCount}</span> successful referrals (+
                                              <span className="text-primary font-bold">{refCount * 200}</span> points)
                                            </p>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    );
                          }

                          const status: "completed" | "pending" | "rejected" | "available" | "locked" = getTaskStatus(task as QuestTask);
                          const isLocked = status === "locked";
                          if (status === "completed") return null;

                          const taskSubmissions = userProgress.submissions?.filter((s: any) => String(s.taskId || s.task_id) === String(task.id)) || [];
                          taskSubmissions.sort((a: any, b: any) => new Date(b.submittedAt || b.submitted_at || 0).getTime() - new Date(a.submittedAt || a.submitted_at || 0).getTime());
                          const latestSub = taskSubmissions[0];

                          return (
                            <Card key={task.id} 
          className={`group relative overflow-hidden transition-all duration-300 h-full flex flex-col 
                      ${isLocked || !participantData ? "opacity-50" : "hover:shadow-lg hover:-translate-y-1 bg-white dark:bg-slate-950"}
                      ${status === "pending" ? "border-orange-500/30 bg-orange-50/20" : ""}
                      ${status === "rejected" ? "border-red-500/50 bg-red-50/30 dark:bg-red-950/20" : ""}`}>
      <CardContent className="p-5 flex flex-col h-full">
                                <div className="flex justify-between items-start mb-4">
                                <div className={`p-2 rounded-lg ${isLocked || !participantData ? "bg-slate-200 dark:bg-slate-800" : status === "rejected" ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400" : "bg-primary/10 text-primary"}`}>
                                  {isLocked || !participantData ? <Lock className="h-5 w-5" /> : status === "rejected" ? <X className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {/* ADD THIS LINE */}
                                  <Badge variant="secondary">+{task.points} pts</Badge>
                                  {status === "rejected" && <Badge variant="destructive" className="text-[10px] h-4 px-1 py-0">Rejected</Badge>}
                                </div>
                              </div>
                                <div className="mb-6 flex-1">
                                  <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">{task.title}</h3>
                                  <p className="text-sm text-muted-foreground line-clamp-3">{task.description}</p>

                                  {/* Show Rejection Reason if it exists */}
                                  {status === "rejected" && latestSub?.notes && (
                                    <div className="mt-3 p-2.5 bg-red-100/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-md text-xs text-red-800 dark:text-red-300">
                                      <strong className="block mb-0.5 uppercase tracking-wider text-[10px]">Rejection Note:</strong>
                                      {latestSub.notes}
                                    </div>
                                  )}
                                </div>
                                <div className="mt-auto pt-4 border-t flex items-center justify-between">
                                  <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
                                    {task.verificationType === "auto_social" && <Sparkles className="h-3 w-3 text-blue-500" />}
                                    {task.verificationType === "auto_tx" && <Shield className="h-3 w-3 text-green-500" />}
                                    {task.verificationType === "onchain" && <Zap className="h-3 w-3 text-blue-500" />}
                                    {task.verificationType === "manual_link" && <ExternalLink className="h-3 w-3" />}
                                    {task.verificationType.replace("manual_", "").replace("auto_", "")}
                                  </div>
                                  {status === "pending" ? (
            <div className="flex items-center text-orange-600 text-sm font-bold">
              <Clock className="h-4 w-4 mr-1" /> Reviewing
            </div>
          ) : isLocked || (!participantData && !canManageQuest) ? (
            <span className="text-sm text-muted-foreground">
              {!participantData ? "Join Required" : "Locked"}
            </span>
          ) : !canManageQuest ? (
            <Button
              size="sm"
              onClick={() => { setSelectedTask(task); setShowSubmitModal(true); }}
              disabled={!participantData || !questTiming.isLive || (status !== "available" && status !== "rejected")}
              className={status === "rejected" ? "bg-red-600 text-white hover:bg-red-700" : "bg-slate-900 text-white hover:bg-primary dark:bg-slate-100 dark:text-black"}
            >
              {questTiming.notStartedYet 
                ? "Starts Soon" 
                : status === "rejected" 
                  ? "Try Again" 
                  : "Open Task"}
            </Button>
          ) : (
            <Button
            size="sm"
                variant="outline"
                onClick={() => { setSelectedTask(task); setShowSubmitModal(true); }}
                className="text-xs text-muted-foreground"
              >
                Preview Task
            </Button>
            )}
        </div>
      </CardContent>

      {(!isLocked && (status === "available" || status === "rejected") && participantData) && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-primary transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
      )}
    </Card>
                          );

                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>


            {/* ── LEADERBOARD TAB ── */}
            <TabsContent value="leaderboard">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="flex justify-between items-center text-lg sm:text-xl">
                    Top Contributors
                    {questTiming.isReviewing ? (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-xs">
                        Reviewing Results (24h)
                      </Badge>
                    ) : (claimState.isExpiredOnChain || isClaimWindowClosed) ? (
                      <Badge variant="outline" className="text-red-500 border-red-500 bg-red-50 dark:bg-red-950/20 text-xs">
                        Claim Window Closed
                      </Badge>
                    ) : claimStatus.isActive ? (
                      <Badge className="bg-green-600 animate-pulse text-xs">  
                        <Gift className="h-3 w-3 mr-1" /> Claim Active
                      </Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription>Ranked by total points earned in this quest</CardDescription>
                </CardHeader>

                {/* Reduced horizontal padding on mobile to maximize space */}
                <CardContent className="px-2 sm:px-6">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[45px] sm:w-[80px] px-1 sm:px-4 text-center sm:text-left">Rank</TableHead>
                      <TableHead className="px-2 sm:px-4">Participant</TableHead>
                      <TableHead className="text-right w-[60px] sm:w-[100px] px-1 sm:px-4">Points</TableHead>
                      {claimStatus.isActive && <TableHead className="text-right w-[75px] sm:w-[120px] px-1 sm:px-4">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeaderboard.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={claimStatus.isActive ? 4 : 3} className="text-center py-10 text-muted-foreground">
                          No participants yet. Be the first to join!
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {/* Always show current user's row if they exist but are outside the visible limit */}
                        {(() => {
                          const visibleEntries = displayLeaderboard.slice(0, leaderboardLimit);
                          const currentUserInVisible = visibleEntries.some(e => e.walletAddress === userWalletAddress);
                          const currentUserEntry = !currentUserInVisible
                            ? displayLeaderboard.find(e => e.walletAddress === userWalletAddress)
                            : null;

                          return (
                            <>
                            {/* Sticky "Your Rank" row if user is outside visible range */}
                              {currentUserEntry && (
                                <>
                                  
                                  <TableRow className="bg-primary/5 hover:bg-primary/10 border border-primary/20">
                                    <TableCell className="font-medium text-sm sm:text-lg px-1 sm:px-4 text-center sm:text-left">
                                      <span className="text-muted-foreground">#{currentUserEntry.rank}</span>
                                    </TableCell>
                                    <TableCell className="px-2 sm:px-4 overflow-hidden">
                                      <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                                        <Avatar className="h-6 w-6 sm:h-9 sm:w-9 border border-primary/30 shrink-0">
                                          <AvatarImage src={currentUserEntry.avatarUrl || undefined} className="object-cover" />
                                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px] sm:text-xs">
                                            {currentUserEntry.username ? currentUserEntry.username.substring(0, 2).toUpperCase() : currentUserEntry.walletAddress.slice(0, 4)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0">
                                          <span className="font-semibold text-xs sm:text-sm flex items-center gap-1 sm:gap-2 truncate">
                                            <span className="truncate">
                                              {currentUserEntry.username || currentUserEntry.walletAddress.slice(0, 6) + "..." + currentUserEntry.walletAddress.slice(-4)}
                                            </span>
                                            <Badge variant="outline" className="text-[9px] sm:text-[10px] h-3 sm:h-4 px-1 py-0 border-primary text-primary shrink-0">
                                              You
                                            </Badge>
                                          </span>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-primary text-sm sm:text-lg px-1 sm:px-4">
                                      {currentUserEntry.points}
                                    </TableCell>
                                    {claimStatus.isActive && <TableCell />}
                                  </TableRow>
                                </>
                              )}
                              {visibleEntries.map((entry) => (
                                <TableRow
                                  key={entry.walletAddress}
                                  className={entry.walletAddress === userWalletAddress ? "bg-primary/5 hover:bg-primary/10" : ""}
                                >
                                  <TableCell className="font-medium text-sm sm:text-lg px-1 sm:px-4 text-center sm:text-left">
                                    {entry.rank === 1 && "🥇"}
                                    {entry.rank === 2 && "🥈"}
                                    {entry.rank === 3 && "🥉"}
                                    {entry.rank > 3 && <span className="text-muted-foreground">#{entry.rank}</span>}
                                  </TableCell>
                                  <TableCell className="px-2 sm:px-4 overflow-hidden">
                                    <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                                      <Avatar
                                        className="h-6 w-6 sm:h-9 sm:w-9 border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                        onClick={() => handleParticipantClick(entry)}
                                      >
                                        <AvatarImage src={entry.avatarUrl || undefined} alt={entry.username || ""} className="object-cover" />
                                        <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px] sm:text-xs">
                                          {entry.username ? entry.username.substring(0, 2).toUpperCase() : entry.walletAddress.slice(0, 4)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex flex-col min-w-0">
                                        <span
                                          className="font-semibold text-xs sm:text-sm flex items-center gap-1 sm:gap-2 truncate cursor-pointer hover:text-primary transition-colors"
                                          onClick={() => handleParticipantClick(entry)}
                                        >
                                          <span className="truncate">
                                            {entry.username || entry.walletAddress.slice(0, 6) + "..." + entry.walletAddress.slice(-4)}
                                          </span>
                                          {entry.walletAddress === userWalletAddress && (
                                            <Badge variant="outline" className="text-[9px] sm:text-[10px] h-3 sm:h-4 px-1 py-0 border-primary text-primary shrink-0">
                                              You
                                            </Badge>
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-primary text-sm sm:text-lg px-1 sm:px-4 truncate">
                                    {entry.points}
                                  </TableCell>
                                  {claimStatus.isActive && (
                                    <TableCell className="text-right px-1 sm:px-4">
                                      {entry.walletAddress.toLowerCase() === userWalletAddress?.toLowerCase() && (
                                        entry.rank <= (questData.distributionConfig?.totalWinners || 100) ? (
                                          claimState.hasClaimed ? (
                                            <Badge className="bg-green-500 text-white border-0 text-[10px] sm:text-xs px-1 sm:px-2">Claimed ✅</Badge>
                                          ) : (claimState.isExpiredOnChain || isClaimWindowClosed) ? (
                                            <Badge variant="outline" className="text-red-500 border-red-500 bg-red-50 dark:bg-red-950/20 text-[10px] sm:text-xs">
                                              Expired
                                            </Badge>
                                          ) : (
                                            <Button
                                              size="sm"
                                              onClick={handleClaimReward}
                                              disabled={isClaiming || claimState.isChecking}
                                              className="h-7 px-2 sm:h-9 sm:px-3 text-[10px] sm:text-sm w-full sm:w-auto font-bold shadow-sm transition-all duration-300 flex items-center justify-center bg-primary/10 backdrop-blur-md border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-lg hover:shadow-primary/25"
                                            >
                                              {isClaiming || claimState.isChecking ? <Loader2 className="h-3 w-3 animate-spin mr-1 sm:mr-2 shrink-0" /> : null}
                                              <span className="truncate">{isClaiming ? "Claiming..." : claimState.isChecking ? "Checking..." : "Claim"}</span>
                                            </Button>
                                          )
                                        ) : (
                                          <span className="text-[9px] sm:text-xs text-muted-foreground font-medium bg-slate-100 dark:bg-slate-800 px-1 sm:px-2 py-1 rounded whitespace-nowrap">
                                            Not Eligible
                                          </span>
                                        )
                                      )}
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}

                              
                            </>
                          );
                        })()}
                      </>
                    )}
                  </TableBody>
                </Table>

                {/* ── Show More / Row Count Controls ── */}
                {displayLeaderboard.length > 50 && (
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-muted-foreground">
                      Showing <span className="font-semibold text-foreground">{Math.min(leaderboardLimit, displayLeaderboard.length)}</span> of{" "}
                      <span className="font-semibold text-foreground">{displayLeaderboard.length}</span> participants
                    </p>
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      {/* Row count selector — only show increments that make sense */}
                      {[50, 100, 150, 200].filter(n => n <= displayLeaderboard.length + 49).map(n => (
                        <button
                          key={n}
                          onClick={() => setLeaderboardLimit(n)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            leaderboardLimit === n
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:text-primary"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      {leaderboardLimit < displayLeaderboard.length && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLeaderboardLimit(prev => prev + 50)}
                          className="h-8 text-xs font-semibold"
                        >
                          Show More +50
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
              </Card>
            </TabsContent>


            {/* ── ADMIN TAB ── */}
            {canManageQuest && (
              <TabsContent value="admin" className="space-y-6">
                {/* ── ADMIN HEADER & TOGGLE ── */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Quest Management</h2>
                    <p className="text-muted-foreground text-sm">Review submissions and manage your quest parameters.</p>
                  </div>

                  <div className="flex w-full sm:w-auto items-center gap-2">
                    {!isAdminEditing && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={refreshAdminData}
                        disabled={isRefreshingAdmin}
                        className="shrink-0 shadow-sm"
                        title="Refresh Submissions"
                      >
                        <RefreshCcw className={`h-4 w-4 text-slate-600 dark:text-slate-400 ${isRefreshingAdmin ? "animate-spin" : ""}`} />
                      </Button>
                    )}

                    {(hasActiveSubscription || isDemoQuest) && (
                      <Button
                        variant={isAdminEditing ? "outline" : "default"}
                        onClick={() => setIsAdminEditing(!isAdminEditing)}
                        className="w-full sm:w-auto shadow-sm"
                      >
                        {isAdminEditing ? (
                          <><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</>
                        ) : (
                          <><Settings className="mr-2 h-4 w-4" /> Edit Quest & Tasks</>
                        )}
                      </Button>
                    )}

                  </div>
                </div>

                {!isAdminEditing ? (
                  <>
                    {/* ── QUICK STATS ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Review</CardTitle></CardHeader>
                        <CardContent><div className="text-3xl font-bold text-orange-500">{pendingSubmissions.length}</div></CardContent>
                      </Card>
                      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Participants</CardTitle></CardHeader>
                        <CardContent><div className="text-3xl font-bold">{allParticipants.length}</div></CardContent>
                      </Card>
                      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</CardTitle></CardHeader>
                        <CardContent className="flex items-center gap-2">
                          <Badge variant={questData.isActive ? "default" : "destructive"}>{questData.isActive ? "Active" : "Paused"}</Badge>
                          {isCreator && questData.isFunded && <Badge className="bg-emerald-500 text-white border-0">Funded</Badge>}
                        </CardContent>
                      </Card>
                    </div>

                    {/* ── ADMIN MANAGEMENT ── */}
{isCreator && !isAdminEditing && (
  <Card className="border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b dark:border-slate-800">
      <div className="flex items-center justify-between">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" /> Quest Admins
        </CardTitle>
        <Badge variant="outline" className="font-mono">{questAdmins.length} added</Badge>
      </div>
      <CardDescription>
        Admins can approve and reject task submissions. They cannot participate in the quest.
      </CardDescription>
    </CardHeader>
    <CardContent className="p-6 space-y-5 bg-white dark:bg-slate-950">

      {/* Add Admin Input */}
      <div className="flex gap-2">
        <Input
          placeholder="0x... wallet address"
          value={newAdminAddress}
          onChange={e => setNewAdminAddress(e.target.value)}
          className="font-mono text-sm"
        />
        <Button
          onClick={handleAddAdmin}
          disabled={isAddingAdmin || !newAdminAddress.trim()}
          className="shrink-0"
        >
          {isAddingAdmin ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Add Admin
        </Button>
      </div>

      {/* Admin List */}
      {questAdmins.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No admins added yet. Add a wallet address above to delegate review access.
        </div>
      ) : (
        <div className="space-y-3">
          {questAdmins.map((admin) => (
            <div
              key={admin.admin_address}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-700 shrink-0">
                  <AvatarImage src={admin.avatar_url || undefined} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-bold">
                    {admin.username ? admin.username.slice(0, 2).toUpperCase() : admin.admin_address.slice(2, 4).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold leading-none">
                    {admin.username || `${admin.admin_address.slice(0, 6)}...${admin.admin_address.slice(-4)}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">
                    {admin.admin_address.slice(0, 10)}...{admin.admin_address.slice(-6)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => handleRemoveAdmin(admin.admin_address)}
                disabled={removingAdmin === admin.admin_address}
              >
                {removingAdmin === admin.admin_address
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <X className="h-4 w-4" />
                }
              </Button>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
)}
                    {/* ── POST-QUEST MANAGEMENT (Only shows if quest is over) ── */}
                    {isQuestEnded && !isAdminEditing && (
                      <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-900/50">
                        <CardHeader className="pb-3 border-b dark:border-slate-800">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-indigo-500" /> Post-Quest Actions
                          </CardTitle>
                          <CardDescription>
                            {questTiming.isReviewing
                              ? "Quest ended. You have a 24-hour window to review pending submissions before winners are automatically finalized."
                              : "Winners have been automatically processed by the system."}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                              <h4 className="font-semibold text-sm">Withdraw Unclaimed Funds</h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                {/* Use the on-chain expiration state here */}
                                {claimState.isExpiredOnChain
                                  ? "The claim window has closed. You can safely withdraw the remaining pool."
                                  : `Withdrawals are locked. The claim window closes on: ${claimWindowEnd.toLocaleString()}`}
                              </p>
                            </div>
                            <Button
                              onClick={handleAdminWithdraw}
                              /* Disable if withdrawing, checking chain, not expired, OR already withdrawn */
                              disabled={isWithdrawing || !claimState.isExpiredOnChain || claimState.isChecking || claimState.fundsWithdrawnOnChain}
                              variant={claimState.fundsWithdrawnOnChain ? "outline" : claimState.isExpiredOnChain ? "default" : "outline"}
                              className={`w-full sm:w-auto ${claimState.fundsWithdrawnOnChain ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20" : ""}`}
                            >
                              {isWithdrawing || claimState.isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              {claimState.isChecking
                                ? "Checking Chain..."
                                : claimState.fundsWithdrawnOnChain
                                  ? "Funds Withdrawn ✅"  // <-- Show success state
                                  : claimState.isExpiredOnChain
                                    ? "Withdraw Funds"
                                    : "Locked"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {/* ── SUBMISSION REVIEW QUEUE ── */}
                    <Card className="border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
                      <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-orange-500" /> Review Queue
                          </CardTitle>
                          <Badge variant="outline" className="font-mono">{pendingSubmissions.length} Tasks Left</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 bg-white dark:bg-slate-950">


                        {pendingSubmissions.length === 0 ? (
                          <div className="text-center py-20 flex flex-col items-center">
                            <div className="h-20 w-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                              <CheckCircle2 className="h-10 w-10 text-green-500" />
                            </div>
                            <h3 className="text-lg font-medium">Inbox Zero!</h3>
                            <p className="text-muted-foreground text-sm max-w-xs">There are currently no submissions waiting for your approval.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {pendingSubmissions.map((sub: any) => {

                              const isImage = sub.submittedData?.match(/\.(jpeg|jpg|gif|png)$/i) || sub.submittedData?.includes("supabase");

                              let userLink = "";
                              let userNotes = sub.notes || "";

                              if (sub.notes && sub.notes.includes("User Proof Link:")) {
                                const parts = sub.notes.split("User Notes:");
                                userLink = parts[0].replace("User Proof Link:", "").trim();
                                if (parts.length > 1) {
                                  userNotes = parts[1].trim();
                                } else {
                                  userNotes = "";
                                }
                              }

                              const isProcessing = processingSubmission === sub.submissionId;
                              const displayLink = isImage ? userLink : sub.submittedData;

                              return (
                                <Card key={sub.submissionId} className="flex flex-col border-slate-200 dark:border-slate-800 overflow-hidden hover:border-orange-200 transition-colors">
                                  {/* Header */}
                                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between border-b dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-8 w-8 border-2 border-white dark:border-slate-800 shadow-sm">
                                        <AvatarImage src={sub.avatarUrl} />
                                        <AvatarFallback className="bg-orange-100 text-orange-700 text-xs">
                                          {sub.username?.substring(0, 2).toUpperCase() || "??"}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="text-sm font-bold leading-none">{sub.username}</p>
                                        <p className="text-[10px] text-muted-foreground font-mono mt-1">{sub.taskTitle}</p>
                                      </div>
                                    </div>
                                    <Badge className="bg-blue-500 text-white border-0 font-bold">{sub.taskPoints} pts</Badge>
                                  </div>

                                  {/* Content Body: Proof Data */}
                                  <div className="p-4 space-y-4 flex-1">

                                    {/* Image Preview & URL */}
                                    {isImage && (
                                      <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex justify-between items-center">
                                          <span>Submitted Image</span>
                                          <a href={sub.submittedData} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 normal-case tracking-normal">
                                            <ExternalLink size={12} /> View Raw URL
                                          </a>
                                        </Label>
                                        <div className="relative group cursor-zoom-in" onClick={() => setPreviewImage(sub.submittedData)}>
                                          <img
                                            src={sub.submittedData}
                                            alt="Proof"
                                            className="w-full h-48 object-cover rounded-lg border border-slate-200 dark:border-slate-800 shadow-inner"
                                          />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                            <span className="text-white text-xs font-medium flex items-center gap-2">
                                              <ZoomIn size={16} /> Click to enlarge
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Text / Link / TxHash Data */}
                                    {displayLink && displayLink !== "No proof attached" && (
                                      <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                                          {displayLink.startsWith("0x") ? "Submitted TxHash" : "Submitted Link / Response"}
                                        </Label>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-md border border-slate-100 dark:border-slate-800 text-sm overflow-hidden">
                                          {displayLink.startsWith("http") ? (
                                            <div className="flex items-center justify-between gap-2">
                                              <a href={displayLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-2 break-all font-mono">
                                                {displayLink} <ExternalLink size={14} className="shrink-0" />
                                              </a>
                                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 text-slate-400 hover:text-primary" onClick={() => { navigator.clipboard.writeText(displayLink); toast.success("Link copied!"); }}>
                                                <Copy size={14} />
                                              </Button>
                                            </div>
                                          ) : displayLink.startsWith("0x") ? (
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="font-mono text-primary break-all">{displayLink}</span>
                                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 text-slate-400 hover:text-primary" onClick={() => { navigator.clipboard.writeText(displayLink); toast.success("TxHash copied!"); }}>
                                                <Copy size={14} />
                                              </Button>
                                            </div>
                                          ) : (
                                            <p className="whitespace-pre-wrap leading-relaxed">{displayLink}</p>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Participant Notes */}
                                    {userNotes && (
                                      <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Notes</Label>
                                        <div className="flex gap-2 p-3 bg-orange-50/50 dark:bg-orange-950/20 rounded-md border border-orange-100 dark:border-orange-900/30">
                                          <MessageSquareText size={16} className="text-orange-500 shrink-0 mt-0.5" />
                                          <p className="text-xs italic text-orange-900 dark:text-orange-200">"{userNotes}"</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Actions */}
                                  {rejectingSubId === sub.submissionId ? (
                                    <div className="flex flex-col gap-3 p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t dark:border-slate-800">
                                      <Textarea
                                        placeholder="Why is this being rejected? (The user will see this note)"
                                        value={rejectionNote}
                                        onChange={(e) => setRejectionNote(e.target.value)}
                                        className="resize-none text-sm min-h-[80px] bg-white dark:bg-slate-950 border-red-200 dark:border-red-900/50 focus-visible:ring-red-500"
                                      />
                                      <div className="flex gap-3">
                                        <Button
                                          variant="outline"
                                          className="flex-1"
                                          onClick={() => { setRejectingSubId(null); setRejectionNote(""); }}
                                          disabled={processingSubmission?.id === sub.submissionId}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                                          onClick={() => handleReviewSubmission(sub.submissionId, "rejected", rejectionNote)}
                                          disabled={processingSubmission?.id === sub.submissionId || !rejectionNote.trim()}
                                        >
                                          {processingSubmission?.id === sub.submissionId && processingSubmission?.action === "rejected"
                                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            : <X className="mr-2 h-4 w-4" />}
                                          Confirm Reject
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t dark:border-slate-800 flex gap-3">
                                      <Button
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10"
                                        onClick={() => handleReviewSubmission(sub.submissionId, "approved")}
                                        disabled={processingSubmission?.id === sub.submissionId}
                                      >
                                        {processingSubmission?.id === sub.submissionId && processingSubmission?.action === "approved"
                                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                        Approve
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        className="flex-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 font-bold h-10"
                                        onClick={() => { setRejectingSubId(sub.submissionId); setRejectionNote(""); }}
                                        disabled={processingSubmission?.id === sub.submissionId}
                                      >
                                        <X className="mr-2 h-4 w-4" />
                                        Reject
                                      </Button>
                                    </div>
                                  )}
                                </Card>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  /* ── EDITOR PANEL ── */
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <QuestEditPanel
                      questData={questData}
                      faucetAddress={faucetAddress!}
                      creatorAddress={userWalletAddress!}
                      onQuestUpdated={(updated) => setQuestData((p: any) => ({ ...p, ...updated }))}
                    />
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* ============= IMAGE PREVIEW MODAL ============= */}
        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
              <Button className="absolute -top-12 right-0 rounded-full bg-white/10 hover:bg-white/20 text-white border-0 h-10 w-10 p-0" onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}><X className="h-6 w-6" /></Button>
              <img src={previewImage} alt="Full Proof Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
            </div>
          </div>
        )}

        {/* ============= SUBMISSION MODAL ============= */}
        {showSubmitModal && selectedTask && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 overflow-y-auto">
            <Card className="w-full max-w-lg shadow-2xl border-0 dark:bg-slate-900 animate-in zoom-in-95 duration-200 my-8 max-h-[90vh] flex flex-col">
              <CardHeader className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 pb-5 relative flex-shrink-0">
                <Button variant="ghost" size="icon" className="absolute right-4 top-4 h-8 w-8 rounded-full" onClick={() => setShowSubmitModal(false)}><X className="h-5 w-5" /></Button>
                <CardTitle className="text-xl pr-10">{selectedTask.title}</CardTitle>
                <CardDescription className="text-base font-medium mt-1">{selectedTask.description}</CardDescription>
              </CardHeader>

              <CardContent className="pt-6 space-y-6 overflow-y-auto flex-1">
              {canManageQuest && (
              <div className="flex items-center gap-2 p-3 mb-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs text-yellow-800 dark:text-yellow-300">
                <Shield className="h-4 w-4 shrink-0 text-yellow-500" />
                <span><strong>Admin Preview</strong> — You can only view this task.</span>
              </div>
            )}

                {/* ── CUSTOM TASK BLOCK ── */}
                {(() => {
                  const isCustomTask = selectedTask.action !== 'follow' &&
                    selectedTask.action !== 'join' &&
                    selectedTask.action !== 'subscribe' &&
                    selectedTask.action !== 'like & retweet' &&
                    selectedTask.action !== 'quote' &&
                    selectedTask.action !== 'comment' &&
                    selectedTask.action !== 'visit' &&
                    selectedTask.verificationType === 'manual_link_image' &&
                    selectedTask.category !== 'social';

                  if (!isCustomTask) return null;

                  return (
                    <div className="space-y-5">
                      {/* Step 1: Visit link if provided */}
                      {selectedTask.url && (
                        <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-background">Step 1</Badge>
                            <h4 className="font-semibold text-sm">Perform the Action</h4>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Visit the link below and complete the required task.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full gap-2 font-bold"
                            onClick={() => window.open(selectedTask.url, "_blank")}
                          >
                            {selectedTask.action.replace(/_/g, ' ').toUpperCase()}
                            <ExternalLink className="h-4 w-4 opacity-50" />
                          </Button>
                        </div>
                      )}

                      {/* Step 2: Submit proof link */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {selectedTask.url && <Badge variant="outline" className="bg-background">Step 2</Badge>}
                          <Label className="font-semibold text-sm">Submit Proof Link <span className="text-red-500">*</span></Label>
                        </div>
                        <Input
                          placeholder="https://... (link proving you completed the task)"
                          value={submissionData.proofUrl}
                          onChange={(e) => setSubmissionData(prev => ({ ...prev, proofUrl: e.target.value }))}
                          className="h-11 font-mono text-sm focus-visible:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground">
                          e.g. a tweet link, transaction link, profile link, or any URL as proof.
                        </p>
                      </div>

                      {/* Step 3: Upload screenshot */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {selectedTask.url && <Badge variant="outline" className="bg-background">Step 3</Badge>}
                          <Label className="font-semibold text-sm">Upload Screenshot <span className="text-red-500">*</span></Label>
                        </div>
                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center relative bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                          <Input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
                            onChange={handleFileSelect}
                          />
                          <Upload className="h-8 w-8 text-slate-400 mb-2" />
                          <p className="text-sm font-semibold">Click or drag screenshot here</p>
                          <p className="text-xs text-muted-foreground mt-1">Max 5MB · Any resolution · PNG, JPG, GIF`</p>
                          {submissionData.file && (
                            <Badge className="mt-3 bg-green-500 text-white">{submissionData.file.name}</Badge>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase text-muted-foreground">Notes (Optional)</Label>
                        <Textarea
                          placeholder="Any extra context for the reviewer..."
                          value={submissionData.notes}
                          onChange={(e) => setSubmissionData({ ...submissionData, notes: e.target.value })}
                          className="resize-none dark:bg-slate-950 min-h-[70px] text-sm"
                        />
                      </div>

                      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                        <span>Your proof link and screenshot will be reviewed manually by the quest admin before points are awarded.</span>
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const isCustomTask = selectedTask.verificationType === 'manual_link_image' &&
                    selectedTask.category !== 'social';
                  const isXShareTask = selectedTask.verificationType === 'system_x_share' || selectedTask.action === 'share_quest';
                  const showStep1 = (selectedTask.url || isXShareTask) &&
                    selectedTask.verificationType !== 'onchain' &&
                    !isCustomTask; // ← ADD THIS

                  if (!showStep1) return null;

                  return (
                    <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                      <div>
                        <h4 className="font-semibold text-base">Step 1: Perform Action</h4>
                        <p className="text-xs text-muted-foreground">
                          {isXShareTask
                            ? "Click below to generate your pre-filled tweet and share it."
                            : "Click below to visit the target page and complete the task."}
                        </p>
                      </div>
                     <Button
                        size="sm"
                        className="w-full max-w-xs gap-2 font-bold uppercase tracking-wider"
                        variant={isXShareTask ? "default" : "outline"}
                        onClick={() => {
                          if (isXShareTask) {
                            handleXShareAction(selectedTask);
                          } else {
                            // ✅ ONLY track the click time if it is a "none" verification task
                            if (selectedTask.verificationType === "none") {
                              sessionStorage.setItem(`task_click_${selectedTask.id}`, Date.now().toString());
                            }
                            
                            window.open(selectedTask.url, "_blank");
                          }
                        }}
                      >
                        {isXShareTask ? "Post on X" : `${selectedTask.action.replace('_', ' ')} NOW`}
                        <ExternalLink className="h-4 w-4 opacity-50" />
                      </Button>
                    </div>
                  );
                })()}

                {/* 2. DYNAMIC INPUT: Links & TxHashes (Step 2) */}
                {(
                  ['manual_link', 'manual_link_image', 'system_x_share', 'auto_tx'].includes(selectedTask.verificationType) ||
                  (selectedTask.category === 'trading' && !['onchain', 'none', 'manual_upload'].includes(selectedTask.verificationType)) ||
                  (selectedTask.verificationType === 'auto_social' && ['quote', 'comment'].includes(selectedTask.action))
                ) && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-2">
                        {selectedTask.url && <Badge variant="outline" className="bg-background">Step 2</Badge>}
                        <Label className="font-semibold text-sm">
                          {selectedTask.category === 'trading' || selectedTask.verificationType === 'auto_tx'
                            ? "Submit Transaction Hash (Required)"
                            : "Submit Proof URL (Required)"}
                        </Label>
                      </div>
                      <Input
                        placeholder={selectedTask.category === 'trading' || selectedTask.verificationType === 'auto_tx' ? "0x..." : "https://..."}
                        value={submissionData.proofUrl}
                        onChange={(e) => setSubmissionData(prev => ({ ...prev, proofUrl: e.target.value }))}
                        className="h-11 font-mono text-sm focus-visible:ring-primary"
                      />
                    </div>
                  )}

                {/* 3. DYNAMIC INPUT: Image Uploads */}
                {(
                  ['manual_upload', 'manual_link_image'].includes(selectedTask.verificationType) ||
                  (selectedTask.verificationType === 'auto_social' && !['Twitter', 'Discord', 'Telegram'].includes(selectedTask.targetPlatform || ''))
                ) && selectedTask.category === 'social' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-2">
                        {selectedTask.url && <Badge variant="outline" className="bg-background">Step {selectedTask.verificationType === 'manual_link_image' ? '3' : '2'}</Badge>}
                        <Label className="font-semibold text-sm">Upload Proof Image (Required)</Label>
                      </div>
                      <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center relative bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer h-full w-full" onChange={handleFileSelect} />
                        <Upload className="h-8 w-8 text-slate-400 mb-2" />
                        <p className="text-sm font-semibold">Click or drag screenshot here</p>
                        {submissionData.file && <Badge className="mt-2 bg-green-500">{submissionData.file.name}</Badge>}
                      </div>
                    </div>
                  )}

                {/* 4. DYNAMIC INPUT: On-Chain Engine (Timebound & Hold) */}
                {selectedTask.verificationType === "onchain" && (
                  <div className="space-y-6">
                    {selectedTask.action === 'timebound_interaction' && (
                      <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-4 animate-in slide-in-from-top-2">
                        <div className="h-12 w-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm text-2xl">
                          <ExternalLink className="h-6 w-6 text-slate-500" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-base">Step 1: Interact on Platform</h4>
                          <p className="text-sm text-muted-foreground mt-1">Visit the link below and interact with the required smart contract.</p>
                        </div>

                        {(selectedTask.startDate || selectedTask.endDate) && (
                          <div className="flex flex-col gap-1.5 w-full bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 text-left">
                            <span className="font-semibold flex items-center gap-1.5 text-foreground">
                              <CalendarClock className="h-4 w-4 text-primary" /> Valid Time Window (Local Time)
                            </span>
                            {selectedTask.startDate && (
                              <span className="flex items-center gap-2 mt-1">
                                <span className="w-10 text-muted-foreground">Starts:</span>
                                <strong className="font-medium">{new Date(selectedTask.startDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                              </span>
                            )}
                            {selectedTask.endDate && (
                              <span className="flex items-center gap-2">
                                <span className="w-10 text-muted-foreground">Ends:</span>
                                <strong className="font-medium">{new Date(selectedTask.endDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                              </span>
                            )}
                          </div>
                        )}

                        <Button size="sm" className="w-full max-w-xs gap-2 font-bold uppercase tracking-wider" variant="outline" onClick={() => window.open(selectedTask.url, "_blank")}>
                          Visit dApp <ExternalLink className="h-4 w-4 opacity-50" />
                        </Button>
                      </div>
                    )}

                    <div className="text-center space-y-4 p-5">
                      <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center shadow-sm">
                        <Zap className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold">
                          {selectedTask.action === 'timebound_interaction' ? 'Step 2: Verify On-Chain' : 'Wallet Check Required'}
                        </h4>
                        <p className="text-muted-foreground text-sm mt-1">We will scan your connected wallet on the blockchain to verify this task.</p>
                      </div>
                    </div>
                  </div>
                )}
                {/* 5. Optional Notes (for manual review tasks) */}
                {['manual_link', 'manual_upload', 'manual_link_image'].includes(selectedTask.verificationType) && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase text-muted-foreground">Notes (Optional)</Label>
                    <Textarea
                      placeholder="Add any extra details or context for the admin..."
                      value={submissionData.notes}
                      onChange={(e) => setSubmissionData({ ...submissionData, notes: e.target.value })}
                      className="resize-none dark:bg-slate-950 min-h-[80px] text-sm"
                    />
                  </div>
                )}
              </CardContent>

              <CardFooter className="justify-between border-t p-5 dark:border-slate-800 flex-shrink-0 bg-slate-50/50 dark:bg-slate-950/50">
                <Button variant="outline" onClick={() => setShowSubmitModal(false)}>Cancel</Button>

                {/* Intelligent Disable Logic */}
                <Button
                  onClick={handleSubmitTask}
                  disabled={canManageQuest || (() => {
                    if (submittingTaskId === selectedTask.id) return true;
                    const vType = selectedTask.verificationType;

                    if (vType === "manual_link" || vType === "system_x_share" || vType === "auto_tx" || (selectedTask.category === 'trading' && vType !== 'onchain' && vType !== 'manual_upload')) {
                      return !submissionData.proofUrl.trim();
                    }
                    if (vType === "manual_upload") {
                      return !submissionData.file;
                    }
                    if (vType === "manual_link_image") {
                      return !submissionData.proofUrl.trim() || !submissionData.file;
                    }
                    if (vType === "auto_social" && ['quote', 'comment'].includes(selectedTask.action)) {
                      return !submissionData.proofUrl.trim();
                    }
                    return false;
                  })()}
                  className="bg-primary hover:bg-primary/90 min-w-[160px]"
                >
                  {submittingTaskId === selectedTask.id ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                  ) : (
                    ['auto_social', 'system_x_share', 'onchain', 'auto_tx'].includes(selectedTask.verificationType)
                      ? "Verify Task"
                      : "Submit Task"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
        <SubscriptionModal
          open={showSubscribeModal}
          onOpenChange={setShowSubscribeModal}
          onSuccess={() => {
            setShowSubscribeModal(false);
            setUserProfile(prev => prev ? { ...prev, is_quest_subscribed: true } : null);
          }}
        />
        {/* ============= FUNDING MODAL ============= */}
        {showFundModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md shadow-2xl">
              <CardHeader>
                <CardTitle>Fund Reward Pool</CardTitle>
                <CardDescription>Deposit tokens to activate this quest.<br />Includes <strong>1% Platform Fee</strong>.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between"><span>Reward Pool Goal:</span><span className="font-bold">{rewardPoolAmount}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Platform Fee (1%):</span><span>+ {requiredFee.toFixed(4)}</span></div>
                  <div className="border-t pt-2 mt-2 flex justify-between text-lg font-bold text-primary"><span>Total Required:</span><span>{totalRequired.toFixed(4)}</span></div>
                </div>
                <div className="space-y-2">
                  <Label>Deposit Amount</Label>
                  {/* Changed to readOnly since the exact amount is required */}
                  <Input
                    type="number"
                    value={totalRequired.toFixed(4)}
                    readOnly
                    className="bg-slate-50 dark:bg-slate-900/50 text-muted-foreground cursor-not-allowed font-medium"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowFundModal(false)} disabled={isFunding}>Cancel</Button>

                {/* Removed !isValidFundingAmount so it is always active */}
                <Button onClick={handleFundQuest} disabled={isFunding} className="bg-green-600 hover:bg-green-700 text-white">
                  {isFunding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isFunding ? "Processing..." : "Confirm & Deposit"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
      {selectedParticipant && (
  <ParticipantProfileModal
    entry={selectedParticipant}
    progress={participantTaskDetails}
    isLoading={isLoadingParticipantDetails}
    questTasks={questData?.tasks || []}
    onClose={() => { setSelectedParticipant(null); setParticipantTaskDetails(null); }}
  />
)}
    </div>
  );
}