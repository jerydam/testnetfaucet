// app/api/verify/route.ts
// Self Protocol verification endpoint — called by Self's relayers after proof generation.
// No separate backend needed: everything runs inside Next.js.

import { NextRequest, NextResponse } from "next/server";
 import { createClient } from "@supabase/supabase-js";
import {
  SelfBackendVerifier,
  DefaultConfigStore,
  AllIds,
} from "@selfxyz/core";

// ─── Disclosure config ────────────────────────────────────────────────────────
// ⚠️  Must exactly match the frontend DISCLOSURE_CONFIG in SelfVerificationModal!
const configStore = new DefaultConfigStore({
  minimumAge: 15,
  excludedCountries: [],
  ofac: false,
});

// ─── Verifier singleton ───────────────────────────────────────────────────────
let _verifier: SelfBackendVerifier | null = null;

function getVerifier(): SelfBackendVerifier {
  if (!_verifier) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");

    console.log("[Self/verify] Initialising SelfBackendVerifier", {
      scope: "faucetdrop",
      endpoint: `${appUrl}/api/verify`,
      mockPassport: true,
    });

    _verifier = new SelfBackendVerifier(
      "faucetdrop",                       // scope — must match frontend
      `${appUrl}/api/verify`,             // endpoint — must match frontend
      true,                               // true = testnet/staging  |  false = mainnet
      AllIds,                             // accept all document types
      configStore,
      "hex"                               // userIdType — hex for EVM addresses
    );
  }
  return _verifier;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pretty-print anything for server logs */
function logSelfError(label: string, error: unknown, extra?: object) {
  console.error(`[Self/verify] ❌ ${label}`, {
    ...(extra ?? {}),
    errorName:    error instanceof Error ? error.name    : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack:   error instanceof Error ? error.stack   : undefined,
    // ConfigMismatchError ships an .issues array
    issues:       (error as any)?.issues ?? undefined,
    raw:          error,
  });
}

function logSelfInfo(label: string, data?: object) {
  console.log(`[Self/verify] ℹ️  ${label}`, data ?? "");
}

// ─── POST /api/verify ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  logSelfInfo("Incoming request", { url: req.url });

  let body: any;

  // 1. Parse body
  try {
    body = await req.json();
    logSelfInfo("Request body received", {
      hasAttestationId:   !!body?.attestationId,
      hasProof:           !!body?.proof,
      hasPublicSignals:   !!body?.publicSignals,
      hasUserContextData: !!body?.userContextData,
    });
  } catch (parseError) {
    logSelfError("Failed to parse request body", parseError);
    return NextResponse.json(
      { status: "error", result: false, reason: "Invalid JSON body" },
      { status: 200 }
    );
  }

  const { attestationId, proof, publicSignals, userContextData } = body ?? {};

  // 2. Validate required fields
  const missing = (
    ["attestationId", "proof", "publicSignals", "userContextData"] as const
  ).filter((k) => !body?.[k]);

  if (missing.length > 0) {
    logSelfInfo("Missing required fields", { missing });
    return NextResponse.json(
      {
        status: "error",
        result: false,
        reason: `Missing required fields: ${missing.join(", ")}`,
      },
      { status: 200 }
    );
  }

  // 3. Run verification
  let result: Awaited<ReturnType<SelfBackendVerifier["verify"]>>;
  try {
    logSelfInfo("Calling verifier.verify()", { attestationId });
    result = await getVerifier().verify(
      attestationId,
      proof,
      publicSignals,
      userContextData
    );
    logSelfInfo("verifier.verify() succeeded", {
      attestationId:     result.attestationId,
      isValid:           result.isValidDetails.isValid,
      isMinimumAgeValid: result.isValidDetails.isMinimumAgeValid,
      isOfacValid:       result.isValidDetails.isOfacValid,
      userIdentifier:    result.userData?.userIdentifier,
    });
  } catch (verifyError: unknown) {
    // ── ConfigMismatchError ───────────────────────────────────────────────────
    if ((verifyError as any)?.name === "ConfigMismatchError") {
      logSelfError("ConfigMismatchError — frontend/backend config drift", verifyError, {
        hint: "Check that DISCLOSURE_CONFIG in the modal exactly matches DefaultConfigStore here.",
      });
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: "Configuration mismatch between frontend and backend",
          issues: (verifyError as any).issues,
        },
        { status: 200 }
      );
    }

    // ── InvalidRoot / chain errors ────────────────────────────────────────────
    if (
      (verifyError as any)?.message?.toLowerCase().includes("root") ||
      (verifyError as any)?.message?.toLowerCase().includes("merkle")
    ) {
      logSelfError("Merkle root not found on-chain — is mockPassport correct?", verifyError);
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: "Proof root not found on chain. Ensure staging/mainnet mode matches.",
        },
        { status: 200 }
      );
    }

    // ── Generic verification error ────────────────────────────────────────────
    logSelfError("Unexpected error during verify()", verifyError);
    return NextResponse.json(
      {
        status: "error",
        result: false,
        reason: verifyError instanceof Error ? verifyError.message : "Unknown verification error",
      },
      { status: 200 }
    );
  }

  // 4. Check validity flags
  const { isValid, isMinimumAgeValid, isOfacValid } = result.isValidDetails;

  if (!isValid) {
    logSelfInfo("Proof invalid — cryptographic check failed");
    return NextResponse.json(
      { status: "error", result: false, reason: "Proof is cryptographically invalid" },
      { status: 200 }
    );
  }

  if (!isMinimumAgeValid) {
    logSelfInfo("Age requirement not met", { minimumAge: 15 });
    return NextResponse.json(
      { status: "error", result: false, reason: "Minimum age requirement not met (15+)" },
      { status: 200 }
    );
  }

  // isOfacValid === true means the user IS on the OFAC list — reject them
  if (isOfacValid) {
    logSelfInfo("User flagged by OFAC check");
    return NextResponse.json(
      { status: "error", result: false, reason: "Verification failed due to compliance check" },
      { status: 200 }
    );
  }

  // 5. ── Optional: persist to Supabase ─────────────────────────────────────────
  // Uncomment when you're ready to add DB persistence server-side.
  // The dashboard's handleVerificationSuccess already calls your FastAPI PATCH,
  // so this is only needed if you want a second write path from this route.
  //
 
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // ← service role key, never expose to client
  );
  const { error: dbError } = await supabase
    .from("user_profiles")
    .update({
      is_verified: true,
      verified_at: new Date().toISOString(),
    })
    .eq("wallet_address", result.userData.userIdentifier.toLowerCase());
  
  if (dbError) {
    logSelfError("Supabase update failed", dbError);
    // Don't fail the response — verification itself succeeded
  }

  // 6. Success
  logSelfInfo("Verification complete ✅", {
    userIdentifier: result.userData?.userIdentifier,
  });

  return NextResponse.json(
    {
      status: "success",
      result: true,
      disclosures: result.discloseOutput,
      userData: result.userData,
    },
    { status: 200 }
  );
}