import db from "@/lib/gateway/db";
import * as schema from "@/lib/gateway/db/schema";
import { getGitHubConfig } from "@/lib/gateway/env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { randomUUID } from "crypto";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      users: schema.users,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  socialProviders: {
    github: {
      clientId: getGitHubConfig().clientId,
      clientSecret: getGitHubConfig().clientSecret,
    }
  },
  user: {
    additionalFields: {
      walletAddress: {
        type: "string",
        required: false,
      },
      displayName: {
        type: "string",
        required: false,
      },
      avatarUrl: {
        type: "string",
        required: false,
      },
    },
    modelName: "users", // Use the "users" table name
  },
  // Generate UUID for user IDs instead of default string IDss
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
    // crossSubDomainCookies: {
    //   enabled: true,
    //   domain: "http://localhost:3232",
    // },
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      partitioned: true // New browser standards for foreign cookies
    }
  },
  // Note: Better-auth hooks are not well documented in current version
  // We use middleware approach in api.ts for reliable CDP wallet auto-creation
});

