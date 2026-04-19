import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import FaucetDropsIDL from './faucet_drops_idl.json';

// ─── Program & Platform Constants ────────────────────────────────────────────

export const SOLANA_PROGRAM_ID = new PublicKey('YOUR_SOLANA_PROGRAM_ID_HERE');

const BACKEND_SIGNER_PUBKEY = new PublicKey('YOUR_BACKEND_PUBKEY_HERE');
const PLATFORM_FEE_VAULT = new PublicKey('YOUR_FEE_VAULT_PUBKEY_HERE');

// ─── Typed program alias ──────────────────────────────────────────────────────
// Using Program<Idl> (not Program<any>) avoids the "type instantiation is
// excessively deep" TS2589 error that Anchor triggers with the `any` generic.
// Account fetches are done via the escape-hatch helper `fetchAccount` below.
type FaucetProgram = Program<Idl>;

// ─── Program Initializer ──────────────────────────────────────────────────────

export function getSolanaProgram(connection: Connection, wallet: any): FaucetProgram {
  const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
  const idl = {
    ...FaucetDropsIDL,
    address: SOLANA_PROGRAM_ID.toBase58(),
  } as unknown as Idl;
  return new Program<Idl>(idl, provider);
}

// ─── Typed account fetch helper ───────────────────────────────────────────────
// `program.account` is typed against the generic parameter. When the generic is
// `Idl` (the base interface) the namespace keys are unknown at compile time, so
// we cast once here rather than sprinkling `as any` everywhere.
/** Access account fetch namespace without triggering TS2339/TS2589 */
function accounts(
  program: FaucetProgram
): Record<string, { fetch: (addr: PublicKey) => Promise<any> }> {
  return program.account as unknown as Record<
    string,
    { fetch: (addr: PublicKey) => Promise<any> }
  >;
}

/** Access methods namespace without triggering TS2589 on deep Anchor inference */
function methods(program: FaucetProgram): any {
  return methods(program);
}

/** A read-only dummy wallet for fetch-only operations */
function readOnlyWallet() {
  const kp = PublicKey.default;
  return {
    publicKey: kp,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };
}

// ─── PDA Derivation ───────────────────────────────────────────────────────────

export const getFaucetPda = (name: string) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('faucet'), Buffer.from(name)],
    SOLANA_PROGRAM_ID
  );

export const getTokenVaultPda = (faucetPubkey: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), faucetPubkey.toBuffer()],
    SOLANA_PROGRAM_ID
  );

export const getWhitelistEntryPda = (faucetPubkey: PublicKey, userPubkey: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('whitelist'), faucetPubkey.toBuffer(), userPubkey.toBuffer()],
    SOLANA_PROGRAM_ID
  );

export const getAdminRecordPda = (faucetPubkey: PublicKey, adminPubkey: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('admin'), faucetPubkey.toBuffer(), adminPubkey.toBuffer()],
    SOLANA_PROGRAM_ID
  );

export const getClaimStatusPda = (faucetPubkey: PublicKey, userPubkey: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('claim'), faucetPubkey.toBuffer(), userPubkey.toBuffer()],
    SOLANA_PROGRAM_ID
  );

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FaucetDetails {
  faucetAddress: string;
  token: string;
  owner: string;
  name: string;
  claimAmount: bigint;
  startTime: number;
  endTime: number;
  isClaimActive: boolean;
  balance: bigint;
  backendMode: boolean;
  /** 'dropcode' = faucetType 0 (backend-signed), 'droplist' = faucetType 1 (open) */
  faucetType: 'dropcode' | 'droplist';
}

export interface ClaimStatusResult {
  claimed: boolean;
  amount: bigint;
  claimTime: number;
}

export interface WhitelistEntryResult {
  isWhitelisted: boolean;
  customAmount: bigint;
}

// ─── 1. initializeFaucet ──────────────────────────────────────────────────────

/**
 * Creates a new faucet on-chain.
 *
 * @param useBackend - true = faucetType 0 (backend-signed claims), false = faucetType 1 (open claims)
 * @returns The faucet PDA address as a string
 */
export async function createSolanaFaucet(
  connection: Connection,
  wallet: any,
  name: string,
  tokenMintAddress: string,
  claimAmount: number,
  startTime: number,
  endTime: number,
  useBackend: boolean
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const tokenMint = new PublicKey(tokenMintAddress);

  const [faucetPda, faucetBump] = getFaucetPda(name);
  const [tokenVaultPda] = getTokenVaultPda(faucetPda);

  const faucetTypeU8 = useBackend ? 0 : 1;

  try {
    const tx = await methods(program)
      .initializeFaucet(
        name,
        new BN(claimAmount),
        new BN(startTime),
        new BN(endTime),
        faucetTypeU8,
        { faucet: faucetBump }
      )
      .accounts({
        authority: wallet.publicKey,
        backendSigner: BACKEND_SIGNER_PUBKEY,
        feeVault: PLATFORM_FEE_VAULT,
        tokenMint,
        faucet: faucetPda,
        tokenVault: tokenVaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY, // ← correct rent sysvar
      })
      .rpc();

    console.log('✅ Faucet created. Tx:', tx);
    return faucetPda.toString();
  } catch (error: any) {
    console.error('❌ createSolanaFaucet:', error);
    throw new Error(error.message || 'Failed to create faucet');
  }
}

// ─── 2. fundFaucet ────────────────────────────────────────────────────────────

/**
 * Deposits tokens into the faucet vault. A platform fee is charged on funding.
 */
export async function fundSolanaFaucet(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  amount: number
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);

  try {
    const faucetState = await accounts(program).faucetState.fetch(faucetPubkey);

    const funderTokenAccount = await getAssociatedTokenAddress(
      faucetState.tokenMint,
      wallet.publicKey
    );
    const platformFeeAccount = await getAssociatedTokenAddress(
      faucetState.tokenMint,
      BACKEND_SIGNER_PUBKEY
    );

    const tx = await methods(program)
      .fundFaucet(new BN(amount))
      .accounts({
        funder: wallet.publicKey,
        faucet: faucetPubkey,
        funderTokenAccount,
        tokenVault: faucetState.tokenVault,
        backendWallet: BACKEND_SIGNER_PUBKEY,
        platformFeeAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log('✅ Faucet funded. Tx:', tx);
    return tx;
  } catch (error: any) {
    console.error('❌ fundSolanaFaucet:', error);
    throw new Error(error.message || 'Failed to fund faucet');
  }
}

// ─── 3. claim (backend-signed) ────────────────────────────────────────────────

/**
 * Executes a claim on behalf of a recipient.
 * Must be called from a server-side context where the backend Keypair is available,
 * because the `backend` account must sign the transaction.
 *
 * For faucetType 0 (dropcode): the backend signs.
 * For faucetType 1 (droplist): use `claimSolanaTokensUser` below instead.
 */
export async function claimSolanaTokensBackend(
  connection: Connection,
  backendWallet: any,
  faucetAddress: string,
  recipientAddress: string,
  amount: number,
  isWhitelisted: boolean
): Promise<string> {
  const program = getSolanaProgram(connection, backendWallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const recipientPubkey = new PublicKey(recipientAddress);

  try {
    const faucetState = await accounts(program).faucetState.fetch(faucetPubkey);
    const recipientTokenAccount = await getAssociatedTokenAddress(
      faucetState.tokenMint,
      recipientPubkey
    );
    const [claimStatusPda] = getClaimStatusPda(faucetPubkey, recipientPubkey);
    const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, recipientPubkey);

    const tx = await methods(program)
      .claim(new BN(amount))
      .accounts({
        backend: backendWallet.publicKey,
        recipient: recipientPubkey,
        faucet: faucetPubkey,
        tokenVault: faucetState.tokenVault,
        recipientTokenAccount,
        claimStatus: claimStatusPda,
        // Pass the PDA when whitelisted; pass null to omit the optional account
        whitelistEntry: isWhitelisted ? whitelistEntryPda : null,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Claimed (backend). Tx:', tx);
    return tx;
  } catch (error: any) {
    console.error('❌ claimSolanaTokensBackend:', error);
    throw error;
  }
}

/**
 * Frontend-compatible claim where the *user* wallet signs (faucetType 1 / droplist).
 * The `backend` account in this variant is the user themselves.
 */
export async function claimSolanaTokensUser(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  amount: number,
  isWhitelisted: boolean
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);

  try {
    const faucetState = await accounts(program).faucetState.fetch(faucetPubkey);
    const recipientTokenAccount = await getAssociatedTokenAddress(
      faucetState.tokenMint,
      wallet.publicKey
    );
    const [claimStatusPda] = getClaimStatusPda(faucetPubkey, wallet.publicKey);
    const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, wallet.publicKey);

    const tx = await methods(program)
      .claim(new BN(amount))
      .accounts({
        backend: wallet.publicKey,
        recipient: wallet.publicKey,
        faucet: faucetPubkey,
        tokenVault: faucetState.tokenVault,
        recipientTokenAccount,
        claimStatus: claimStatusPda,
        whitelistEntry: isWhitelisted ? whitelistEntryPda : null,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Claimed (user). Tx:', tx);
    return tx;
  } catch (error: any) {
    console.error('❌ claimSolanaTokensUser:', error);
    throw error;
  }
}

// ─── 4. withdraw ─────────────────────────────────────────────────────────────

/**
 * Withdraws tokens from the vault back to the authority's token account.
 * Only callable by the faucet authority.
 */
export async function withdrawSolanaTokens(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  amount: number
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);

  try {
    const faucetState = await accounts(program).faucetState.fetch(faucetPubkey);
    const adminTokenAccount = await getAssociatedTokenAddress(
      faucetState.tokenMint,
      wallet.publicKey
    );

    const tx = await methods(program)
      .withdraw(new BN(amount))
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        tokenVault: faucetState.tokenVault,
        adminTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log('✅ Withdrawn. Tx:', tx);
    return tx;
  } catch (error: any) {
    console.error('❌ withdrawSolanaTokens:', error);
    throw new Error(error.message || 'Failed to withdraw tokens');
  }
}

// ─── 5. addToWhitelist ────────────────────────────────────────────────────────

/**
 * Adds a single user to the faucet whitelist with an optional custom claim amount.
 * Pass 0 for `customAmount` to use the faucet's default `claimAmount`.
 */
export async function addToSolanaWhitelist(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  userAddress: string,
  customAmount: number
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const userPubkey = new PublicKey(userAddress);
  const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, userPubkey);

  try {
    const tx = await methods(program)
      .addToWhitelist(new BN(customAmount))
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        user: userPubkey,
        whitelistEntry: whitelistEntryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Added to whitelist. Tx:', tx);
    return tx;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to add to whitelist');
  }
}

// ─── 6. addAdmin ──────────────────────────────────────────────────────────────

/**
 * Grants admin privileges to a public key for this faucet.
 */
export async function addSolanaAdmin(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  adminAddress: string
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const adminPubkey = new PublicKey(adminAddress);
  const [adminRecordPda] = getAdminRecordPda(faucetPubkey, adminPubkey);

  try {
    const tx = await methods(program)
      .addAdmin(adminPubkey)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        adminRecord: adminRecordPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Admin added. Tx:', tx);
    return tx;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to add admin');
  }
}

// ─── 7. removeAdmin ───────────────────────────────────────────────────────────

/**
 * Revokes admin privileges from a public key.
 */
export async function removeSolanaAdmin(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  adminAddress: string
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const adminPubkey = new PublicKey(adminAddress);
  const [adminRecordPda] = getAdminRecordPda(faucetPubkey, adminPubkey);

  try {
    const tx = await methods(program)
      .removeAdmin(adminPubkey)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        adminRecord: adminRecordPda,
      })
      .rpc();

    console.log('✅ Admin removed. Tx:', tx);
    return tx;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to remove admin');
  }
}

// ─── 8. resetSingleClaim ──────────────────────────────────────────────────────

/**
 * Resets the claim status for a single user, allowing them to claim again.
 */
export async function resetSingleSolanaClaim(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  userAddress: string
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const userPubkey = new PublicKey(userAddress);
  const [claimStatusPda] = getClaimStatusPda(faucetPubkey, userPubkey);

  try {
    const tx = await methods(program)
      .resetSingleClaim(userPubkey)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        claimStatus: claimStatusPda,
      })
      .rpc();

    console.log('✅ Claim reset. Tx:', tx);
    return tx;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to reset user claim');
  }
}

// ─── 9. removeFromWhitelist ───────────────────────────────────────────────────

/**
 * Removes a user from the faucet whitelist.
 */
export async function removeFromSolanaWhitelist(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  userAddress: string
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const userPubkey = new PublicKey(userAddress);
  const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, userPubkey);

  try {
    const tx = await methods(program)
      .removeFromWhitelist()
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        user: userPubkey,
        whitelistEntry: whitelistEntryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Removed from whitelist. Tx:', tx);
    return tx;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to remove from whitelist');
  }
}

// ─── 10. updateFaucetConfig ───────────────────────────────────────────────────

/**
 * Updates the faucet's claim amount, time window, and optionally the backend signer.
 * Pass `null` for `newBackendSigner` to leave it unchanged.
 */
export async function updateSolanaFaucetConfig(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  newAmount: number,
  newStartTime: number,
  newEndTime: number,
  newBackendSigner: string | null
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);

  // The IDL arg is `{ option: "publicKey" }`, so wrap in Some/None style
  const backendSignerOption = newBackendSigner ? new PublicKey(newBackendSigner) : null;

  try {
    const tx = await methods(program)
      .updateFaucetConfig(
        new BN(newAmount),
        new BN(newStartTime),
        new BN(newEndTime),
        backendSignerOption
      )
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
      })
      .rpc();

    console.log('✅ Config updated. Tx:', tx);
    return tx;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update config');
  }
}

// ─── 11. setPaused ────────────────────────────────────────────────────────────

/**
 * Pauses or unpauses the faucet. While paused, claims will be rejected on-chain.
 */
export async function setSolanaPaused(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  paused: boolean
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);

  try {
    const tx = await methods(program)
      .setPaused(paused)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
      })
      .rpc();

    console.log(`✅ Faucet ${paused ? 'paused' : 'unpaused'}. Tx:`, tx);
    return tx;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update pause status');
  }
}

// ─── 12. updateName ──────────────────────────────────────────────────────────

/**
 * Updates the display name stored in the faucet state.
 * Note: this does NOT change the PDA seed; the faucet address remains the same.
 */
export async function updateSolanaFaucetName(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  newName: string
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);

  try {
    const tx = await methods(program)
      .updateName(newName)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
      })
      .rpc();

    console.log('✅ Name updated. Tx:', tx);
    return tx;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update name');
  }
}

// ─── 13. transferAuthority ────────────────────────────────────────────────────

/**
 * Transfers ownership of the faucet to a new authority.
 * ⚠️ This is irreversible unless the new authority transfers it back.
 */
export async function transferSolanaAuthority(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  newAuthority: string
): Promise<string> {
  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const newAuthorityPubkey = new PublicKey(newAuthority);

  try {
    const tx = await methods(program)
      .transferAuthority(newAuthorityPubkey)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
      })
      .rpc();

    console.log('✅ Authority transferred. Tx:', tx);
    return tx;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to transfer authority');
  }
}

// ─── Read / Fetch Functions ───────────────────────────────────────────────────

/**
 * Fetches all on-chain state for a faucet including vault balance.
 */
export async function getSolanaFaucetDetails(
  connection: Connection,
  faucetAddress: string
): Promise<FaucetDetails> {
  const program = getSolanaProgram(connection, readOnlyWallet());
  const faucetPubkey = new PublicKey(faucetAddress);

  try {
    const state = await accounts(program).faucetState.fetch(faucetPubkey);

    let vaultBalance = BigInt(0);
    try {
      const vaultAccount = await getAccount(connection, state.tokenVault);
      vaultBalance = vaultAccount.amount;
    } catch {
      console.warn('Could not fetch vault balance (may be empty or not yet created).');
    }

    return {
      faucetAddress,
      token: state.tokenMint.toString(),
      owner: state.authority.toString(),
      name: state.name,
      claimAmount: BigInt(state.claimAmount.toString()),
      startTime: Number(state.startTime.toString()),
      endTime: Number(state.endTime.toString()),
      isClaimActive: !state.paused,
      balance: vaultBalance,
      backendMode: state.faucetType === 0,
      faucetType: state.faucetType === 0 ? 'dropcode' : 'droplist',
    };
  } catch (error: any) {
    console.error('❌ getSolanaFaucetDetails:', error);
    throw error;
  }
}

/**
 * Returns whether a user has already claimed from a faucet.
 * Returns `{ claimed: false }` if the ClaimStatus account has not been created yet.
 */
export async function getSolanaClaimStatus(
  connection: Connection,
  faucetAddress: string,
  userAddress: string
): Promise<ClaimStatusResult> {
  const program = getSolanaProgram(connection, readOnlyWallet());
  const faucetPubkey = new PublicKey(faucetAddress);
  const userPubkey = new PublicKey(userAddress);
  const [claimPda] = getClaimStatusPda(faucetPubkey, userPubkey);

  try {
    const status = await accounts(program).claimStatus.fetch(claimPda);
    return {
      claimed: status.claimed,
      amount: BigInt(status.amount.toString()),
      claimTime: Number(status.claimTime.toString()),
    };
  } catch (err: any) {
    if (
      err.message?.includes('Account does not exist') ||
      err.message?.includes('could not find account')
    ) {
      return { claimed: false, amount: BigInt(0), claimTime: 0 };
    }
    throw err;
  }
}

/**
 * Checks whether a user is on the whitelist and returns their custom claim amount.
 * Returns `{ isWhitelisted: false }` if no entry exists.
 */
export async function getSolanaWhitelistEntry(
  connection: Connection,
  faucetAddress: string,
  userAddress: string
): Promise<WhitelistEntryResult> {
  const program = getSolanaProgram(connection, readOnlyWallet());
  const faucetPubkey = new PublicKey(faucetAddress);
  const userPubkey = new PublicKey(userAddress);
  const [whitelistPda] = getWhitelistEntryPda(faucetPubkey, userPubkey);

  try {
    const entry = await accounts(program).whitelistEntry.fetch(whitelistPda);
    return {
      isWhitelisted: entry.isWhitelisted,
      customAmount: BigInt(entry.customAmount.toString()),
    };
  } catch {
    return { isWhitelisted: false, customAmount: BigInt(0) };
  }
}

/**
 * Checks whether an admin record PDA exists for a given public key on a faucet.
 */
export async function isSolanaAdmin(
  connection: Connection,
  faucetAddress: string,
  adminAddress: string
): Promise<boolean> {
  const program = getSolanaProgram(connection, readOnlyWallet());
  const faucetPubkey = new PublicKey(faucetAddress);
  const adminPubkey = new PublicKey(adminAddress);
  const [adminRecordPda] = getAdminRecordPda(faucetPubkey, adminPubkey);

  try {
    const record = await accounts(program).adminRecord.fetch(adminRecordPda);
    return record.admin.toString() === adminAddress;
  } catch {
    return false;
  }
}

/**
 * Convenience: returns true if the faucet is currently paused.
 */
export async function isSolanaFaucetPaused(
  connection: Connection,
  faucetAddress: string
): Promise<boolean> {
  const details = await getSolanaFaucetDetails(connection, faucetAddress);
  return !details.isClaimActive;
}

// ─── Batch Operations ─────────────────────────────────────────────────────────

/**
 * Adds multiple users to the whitelist in a single transaction.
 * Recommended batch size: ≤ 15 entries per transaction.
 */
export async function batchAddToSolanaWhitelist(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  entries: { userAddress: string; customAmount: number }[]
): Promise<string> {
  if (entries.length === 0) throw new Error('No entries to add');

  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const transaction = new Transaction();

  transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));

  for (const { userAddress, customAmount } of entries) {
    const userPubkey = new PublicKey(userAddress);
    const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, userPubkey);

    const ix = await methods(program)
      .addToWhitelist(new BN(customAmount))
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        user: userPubkey,
        whitelistEntry: whitelistEntryPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    transaction.add(ix);
  }

  try {
    const signature = await program.provider.sendAndConfirm!(transaction);
    console.log(`✅ Batch whitelist added (${entries.length} users). Tx:`, signature);
    return signature;
  } catch (error: any) {
    console.error('❌ batchAddToSolanaWhitelist:', error);
    throw new Error(error.message || 'Batch whitelist add failed');
  }
}

/**
 * Removes multiple users from the whitelist in a single transaction.
 */
export async function batchRemoveFromSolanaWhitelist(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  userAddresses: string[]
): Promise<string> {
  if (userAddresses.length === 0) throw new Error('No users to remove');

  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const transaction = new Transaction();

  transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));

  for (const userAddress of userAddresses) {
    const userPubkey = new PublicKey(userAddress);
    const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, userPubkey);

    const ix = await methods(program)
      .removeFromWhitelist()
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        user: userPubkey,
        whitelistEntry: whitelistEntryPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    transaction.add(ix);
  }

  const signature = await program.provider.sendAndConfirm!(transaction);
  console.log(`✅ Batch removed (${userAddresses.length} users). Tx:`, signature);
  return signature;
}

/**
 * Batch-sets custom claim amounts for multiple users by (re-)adding them to the whitelist.
 * This is equivalent to calling `addToWhitelist` per user with a specific amount.
 */
export async function batchSetSolanaCustomClaimAmounts(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  entries: { userAddress: string; amount: number }[]
): Promise<string> {
  if (entries.length === 0) throw new Error('No entries');

  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const transaction = new Transaction();

  transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));

  for (const { userAddress, amount } of entries) {
    const userPubkey = new PublicKey(userAddress);
    const [whitelistEntryPda] = getWhitelistEntryPda(faucetPubkey, userPubkey);

    const ix = await methods(program)
      .addToWhitelist(new BN(amount))
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        user: userPubkey,
        whitelistEntry: whitelistEntryPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    transaction.add(ix);
  }

  const signature = await program.provider.sendAndConfirm!(transaction);
  console.log(`✅ Batch custom amounts set (${entries.length} users). Tx:`, signature);
  return signature;
}

/**
 * Resets claim status for multiple users in a single transaction.
 */
export async function batchResetSolanaClaims(
  connection: Connection,
  wallet: any,
  faucetAddress: string,
  userAddresses: string[]
): Promise<string> {
  if (userAddresses.length === 0) throw new Error('No users to reset');

  const program = getSolanaProgram(connection, wallet);
  const faucetPubkey = new PublicKey(faucetAddress);
  const transaction = new Transaction();

  transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));

  for (const userAddress of userAddresses) {
    const userPubkey = new PublicKey(userAddress);
    const [claimStatusPda] = getClaimStatusPda(faucetPubkey, userPubkey);

    const ix = await methods(program)
      .resetSingleClaim(userPubkey)
      .accounts({
        authority: wallet.publicKey,
        faucet: faucetPubkey,
        claimStatus: claimStatusPda,
      })
      .instruction();

    transaction.add(ix);
  }

  const signature = await program.provider.sendAndConfirm!(transaction);
  console.log(`✅ Batch reset claims (${userAddresses.length} users). Tx:`, signature);
  return signature;
}