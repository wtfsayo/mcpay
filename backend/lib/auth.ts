import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { randomUUID } from "crypto";
import db from "../db/index.js";
import * as schema from "../db/schema.js";
 
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string, 
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
  // Generate UUID for user IDs instead of default string IDs
  advanced: {
    generateId: () => randomUUID(),
    // Configure cross-origin cookie settings
    defaultCookieAttributes: {
      sameSite: "none",
      secure: false, // Only secure in production
      partitioned: true // New browser standards for foreign cookies
    }
  },
});