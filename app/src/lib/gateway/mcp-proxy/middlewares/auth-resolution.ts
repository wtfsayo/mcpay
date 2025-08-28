import { auth } from "@/lib/gateway/auth";
import { extractApiKey, hashApiKey } from "@/lib/gateway/auth-utils";
import { txOperations, withTransaction } from "@/lib/gateway/db/actions";
import type { UserWithWallet, AuthType } from "@/types";
import type { Context, Next } from "hono";

// Variables this middleware provides on the Hono context
export type AuthResolutionVariables = {
    user: UserWithWallet | null;
    authMethod: "api_key" | "session" | "wallet_header" | "none";
};

/**
 * Helper to get or create a user from a wallet address using the
 * multi-wallet system, mirroring logic in the MCP proxy route.
 */
async function getOrCreateUser(walletAddress: string, provider = "unknown"): Promise<UserWithWallet | null> {
    if (!walletAddress || typeof walletAddress !== "string") return null;

    return await withTransaction(async (tx) => {
        // First check new wallet system
        const walletRecord = await txOperations.getWalletByAddress(walletAddress)(tx);

        if (walletRecord?.user) {
            await txOperations.updateUserLastLogin(walletRecord.user.id)(tx);
            await txOperations.updateWalletMetadata(walletRecord.id, {
                lastUsedAt: new Date()
            })(tx);

            return {
                ...walletRecord.user,
                walletAddress: walletRecord.walletAddress
            } as UserWithWallet;
        }

        // Fallback: legacy field
        let user = await txOperations.getUserByWalletAddress(walletAddress)(tx);

        if (user) {
            await txOperations.migrateLegacyWallet(user.id)(tx);
            await txOperations.updateUserLastLogin(user.id)(tx);
            return user as UserWithWallet;
        }

        // Create new user with wallet
        let blockchain = "ethereum";
        if (walletAddress.length === 44 && !walletAddress.startsWith("0x")) {
            blockchain = "solana";
        } else if (walletAddress.endsWith(".near") || walletAddress.length === 64) {
            blockchain = "near";
        }

        user = await txOperations.createUser({
            walletAddress,
            displayName: `User_${walletAddress.substring(0, 8)}`,
            walletType: "external",
            walletProvider: provider,
            blockchain,
        })(tx);

        return user as UserWithWallet;
    });
}

/**
 * Hono middleware that resolves authentication using the following priority:
 * 1) API key (in headers, query, or JSON body) → validate → primary wallet
 * 2) Session (better-auth)
 * 3) X-Wallet-Address header → get/create user
 *
 * Sets `c.set('user', UserWithWallet | null)` and `c.set('authMethod', string)`
 */
export const authResolution = async (
    c: Context<{ Bindings: AuthType, Variables: AuthResolutionVariables }>,
    next: Next
) => {
    // Parse URL and potential JSON body for API key extraction
    const url = new URL(c.req.url);
    const searchParams = url.searchParams;

    let bodyParams: Record<string, unknown> | undefined = undefined;
    try {
        const contentType = c.req.header("content-type") || "";
        if (contentType.includes("application/json") && c.req.raw.body) {
            const clonedRequest = c.req.raw.clone();
            const body = await clonedRequest.json();
            if (typeof body === "object" && body !== null) {
                bodyParams = body as Record<string, unknown>;
            }
        }
    } catch {
        // ignore JSON parse errors
    }

    // 1) Try API key
    const apiKey = extractApiKey({
        headers: c.req.raw.headers,
        searchParams,
        bodyParams
    });

    if (apiKey) {
        try {
            const keyHash = hashApiKey(apiKey);
            const apiKeyResult = await withTransaction(async (tx) => {
                return await txOperations.validateApiKey(keyHash)(tx);
            });

            if (apiKeyResult?.user) {
                // Get user's primary/managed wallet for auto-signing
                const userWallets = await withTransaction(async (tx) => {
                    return await txOperations.getUserWallets(apiKeyResult.user.id, true)(tx);
                });

                const primaryWallet = userWallets.find(w => w.isPrimary) || userWallets[0];

                if (primaryWallet) {
                    const fullUser = await withTransaction(async (tx) => {
                        return await txOperations.getUserById(apiKeyResult.user.id)(tx);
                    });

                    if (fullUser) {
                        c.set("user", {
                            ...fullUser,
                            walletAddress: primaryWallet.walletAddress
                        } as UserWithWallet);
                        c.set("authMethod", "api_key");
                        await next();
                        return;
                    }
                } else {
                    // No wallet yet, still set user (walletAddress null)
                    const fullUser = await withTransaction(async (tx) => {
                        return await txOperations.getUserById(apiKeyResult.user.id)(tx);
                    });
                    if (fullUser) {
                        c.set("user", {
                            ...fullUser,
                            walletAddress: null
                        } as UserWithWallet);
                        c.set("authMethod", "api_key");
                        await next();
                        return;
                    }
                }
            }
        } catch {
            // fall through to session
        }
    }

    // 2) Try session
    try {
        const authResult = await auth.api.getSession({ headers: c.req.raw.headers });

        if (authResult?.session && authResult?.user) {
            const userWallets = await withTransaction(async (tx) => {
                return await txOperations.getUserWallets(authResult.user.id, true)(tx);
            });

            const primaryWallet = userWallets.find(w => w.isPrimary) || userWallets[0];

            if (primaryWallet) {
                const fullUser = await withTransaction(async (tx) => {
                    return await txOperations.getUserById(authResult.user.id)(tx);
                });

                if (fullUser) {
                    c.set("user", {
                        ...fullUser,
                        walletAddress: primaryWallet.walletAddress
                    } as UserWithWallet);
                    c.set("authMethod", "session");
                    await next();
                    return;
                }
            } else {
                const fullUser = await withTransaction(async (tx) => {
                    return await txOperations.getUserById(authResult.user.id)(tx);
                });

                if (fullUser) {
                    c.set("user", {
                        ...fullUser,
                        walletAddress: null
                    } as UserWithWallet);
                    c.set("authMethod", "session");
                    await next();
                    return;
                }
            }
        }
    } catch {
        // fall through to wallet header
    }

    // 3) Wallet header
    const walletAddress = c.req.header("X-Wallet-Address");
    if (walletAddress) {
        const user = await getOrCreateUser(walletAddress);
        if (user) {
            c.set("user", user);
            c.set("authMethod", "wallet_header");
            await next();
            return;
        }
    }

    // None
    c.set("user", null);
    c.set("authMethod", "none");
    await next();
};

export default authResolution;


