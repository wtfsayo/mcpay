import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";

const VALID_KEYS = process.env.VALID_KEYS?.split(",");
const TWITTERAPI_IO_KEY = process.env.TWITTERAPI_IO_KEY;
const TWITTER_API_BASE = "https://api.twitterapi.io";

// Helper function to make Twitter API requests
async function makeTwitterRequest(endpoint: string, params: Record<string, any> = {}) {
  if (!TWITTERAPI_IO_KEY) {
    throw new Error("TWITTERAPI_IO_KEY environment variable is required");
  }

  const url = new URL(`${TWITTER_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      'X-API-Key': TWITTERAPI_IO_KEY,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Twitter API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

const handler = createMcpHandler((server) => {
  // User Info Tool
  server.tool(
    "getUserInfo",
    "Get Twitter user information by username",
    {
      userName: z.string().describe("The Twitter username (without @)")
    },
    async ({ userName }) => {
      const data = await makeTwitterRequest('/twitter/user/info', { userName });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Get User Tweets Tool
  server.tool(
    "getUserTweets",
    "Get recent tweets from a user",
    {
      userName: z.string().describe("The Twitter username (without @)").optional(),
      userId: z.string().describe("The Twitter user ID (recommended for stability)").optional(),
      cursor: z.string().describe("Cursor for pagination (empty string for first page)").default(""),
      includeReplies: z.boolean().describe("Whether to include replies").default(false)
    },
    async ({ userName, userId, cursor, includeReplies }) => {
      if (!userName && !userId) {
        throw new Error("Either userName or userId must be provided");
      }
      const params = { userName, userId, cursor, includeReplies };
      const data = await makeTwitterRequest('/twitter/user/last_tweets', params);
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Get User Followers Tool
  server.tool(
    "getUserFollowers",
    "Get followers of a Twitter user",
    {
      userName: z.string().describe("The Twitter username (without @)"),
      cursor: z.string().describe("Cursor for pagination (empty string for first page)").default(""),
      pageSize: z.number().min(20).max(200).describe("Number of followers per page (20-200)").default(200)
    },
    async ({ userName, cursor, pageSize }) => {
      const data = await makeTwitterRequest('/twitter/user/followers', { userName, cursor, pageSize });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Get User Following Tool
  server.tool(
    "getUserFollowing",
    "Get users that a Twitter user is following",
    {
      userName: z.string().describe("The Twitter username (without @)"),
      cursor: z.string().describe("Cursor for pagination (empty string for first page)").default(""),
      pageSize: z.number().min(20).max(200).describe("Number of following per page (20-200)").default(200)
    },
    async ({ userName, cursor, pageSize }) => {
      const data = await makeTwitterRequest('/twitter/user/followings', { userName, cursor, pageSize });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Search Users Tool
  server.tool(
    "searchUsers",
    "Search for Twitter users by keyword",
    {
      query: z.string().describe("The search keyword"),
      sinceTime: z.number().describe("Unix timestamp - search results on or after this time").optional(),
      untilTime: z.number().describe("Unix timestamp - search results before this time").optional()
    },
    async ({ query, sinceTime, untilTime }) => {
      const data = await makeTwitterRequest('/twitter/user/search', { query, sinceTime, untilTime });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Get Tweets by IDs Tool
  server.tool(
    "getTweetsByIds",
    "Get tweets by their IDs",
    {
      tweetIds: z.string().describe("Comma-separated tweet IDs (e.g., '1234567890,1234567891')")
    },
    async ({ tweetIds }) => {
      const data = await makeTwitterRequest('/twitter/tweets', { tweet_ids: tweetIds });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Get Tweet Replies Tool
  server.tool(
    "getTweetReplies",
    "Get replies to a specific tweet",
    {
      tweetId: z.string().describe("The tweet ID to get replies for"),
      cursor: z.string().describe("Cursor for pagination (empty string for first page)").default(""),
      sinceTime: z.number().describe("Unix timestamp - replies on or after this time").optional(),
      untilTime: z.number().describe("Unix timestamp - replies before this time").optional()
    },
    async ({ tweetId, cursor, sinceTime, untilTime }) => {
      const data = await makeTwitterRequest('/twitter/tweet/replies', { tweetId, cursor, sinceTime, untilTime });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Advanced Tweet Search Tool
  server.tool(
    "advancedTweetSearch",
    "Perform advanced search for tweets with filters",
    {
      query: z.string().describe("Search query (e.g., 'AI OR Twitter from:elonmusk since:2021-12-31')"),
      queryType: z.enum(["Latest", "Top"]).describe("Type of search results").default("Latest"),
      cursor: z.string().describe("Cursor for pagination (empty string for first page)").default("")
    },
    async ({ query, queryType, cursor }) => {
      const data = await makeTwitterRequest('/twitter/tweet/advanced_search', { query, queryType, cursor });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Get Tweet Quotes Tool
  server.tool(
    "getTweetQuotes",
    "Get quotes (retweets with comments) of a specific tweet",
    {
      tweetId: z.string().describe("The tweet ID to get quotes for"),
      cursor: z.string().describe("Cursor for pagination (empty string for first page)").default(""),
      includeReplies: z.boolean().describe("Whether to include replies in results").default(true),
      sinceTime: z.number().describe("Unix timestamp - quotes on or after this time").optional(),
      untilTime: z.number().describe("Unix timestamp - quotes before this time").optional()
    },
    async ({ tweetId, cursor, includeReplies, sinceTime, untilTime }) => {
      const data = await makeTwitterRequest('/twitter/tweet/quotes', { tweetId, cursor, includeReplies, sinceTime, untilTime });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Get Tweet Thread Context Tool
  server.tool(
    "getTweetThread",
    "Get the entire conversation thread for a tweet",
    {
      tweetId: z.string().describe("The tweet ID to get thread context for"),
      cursor: z.string().describe("Cursor for pagination (empty string for first page)").default("")
    },
    async ({ tweetId, cursor }) => {
      const data = await makeTwitterRequest('/twitter/tweet/thread_context', { tweetId, cursor });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Get User Mentions Tool
  server.tool(
    "getUserMentions",
    "Get tweets mentioning a specific user",
    {
      userName: z.string().describe("The Twitter username (without @)"),
      cursor: z.string().describe("Cursor for pagination (empty string for first page)").default(""),
      sinceTime: z.number().describe("Unix timestamp - mentions on or after this time").optional(),
      untilTime: z.number().describe("Unix timestamp - mentions before this time").optional()
    },
    async ({ userName, cursor, sinceTime, untilTime }) => {
      const data = await makeTwitterRequest('/twitter/user/mentions', { userName, cursor, sinceTime, untilTime });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Get Trending Topics Tool
  server.tool(
    "getTrends",
    "Get trending topics by location",
    {
      woeid: z.number().describe("WOEID (Where On Earth ID) for location (e.g., 2418046 for New York)"),
      count: z.number().min(30).describe("Number of trends to return (minimum 30)").default(30)
    },
    async ({ woeid, count }) => {
      const data = await makeTwitterRequest('/twitter/trends', { woeid, count });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Check Follow Relationship Tool
  server.tool(
    "checkFollowRelationship",
    "Check if one user follows another user",
    {
      sourceUserName: z.string().describe("Screen name of the source user"),
      targetUserName: z.string().describe("Screen name of the target user")
    },
    async ({ sourceUserName, targetUserName }) => {
      const data = await makeTwitterRequest('/twitter/user/check_follow_relationship', { 
        source_user_name: sourceUserName, 
        target_user_name: targetUserName 
      });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Get List Tweets Tool
  server.tool(
    "getListTweets",
    "Get tweets from a Twitter List",
    {
      listId: z.string().describe("The Twitter List ID"),
      cursor: z.string().describe("Cursor for pagination (empty string for first page)").default(""),
      includeReplies: z.boolean().describe("Whether to include replies").default(true),
      sinceTime: z.number().describe("Unix timestamp - tweets on or after this time").optional(),
      untilTime: z.number().describe("Unix timestamp - tweets before this time").optional()
    },
    async ({ listId, cursor, includeReplies, sinceTime, untilTime }) => {
      const data = await makeTwitterRequest('/twitter/list/tweets', { 
        listId, cursor, includeReplies, sinceTime, untilTime 
      });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );

  // Batch Get Users Tool
  server.tool(
    "batchGetUsers",
    "Get multiple user profiles by user IDs (batch operation)",
    {
      userIds: z.string().describe("Comma-separated user IDs (e.g., '1234567890,1234567891')")
    },
    async ({ userIds }) => {
      const data = await makeTwitterRequest('/twitter/user/batch_info_by_ids', { userIds });
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2) 
        }] 
      };
    }
  );
});

const wrappedHandler = async (req: Request) => {
  const apiKey = req.headers.get('x-api-key');
  const isAuthenticated = apiKey && VALID_KEYS?.includes(apiKey);

  // Add auth info to request headers
  const modifiedReq = new Request(req.url, {
    method: req.method,
    headers: {
      ...Object.fromEntries(req.headers),
      'x-auth-status': isAuthenticated ? 'authenticated' : 'unauthenticated'
    },
    body: req.body,
    // @ts-ignore -- 'duplex' required by Node.js 18+ but not in TypeScript types yet
    duplex: 'half'
  });

  return handler(modifiedReq);
};

export { wrappedHandler as GET, wrappedHandler as POST, wrappedHandler as DELETE };
