# TwitterAPI.io MCP Server

A Model Context Protocol (MCP) server that provides access to TwitterAPI.io's comprehensive Twitter data endpoints.

## Features

This MCP server provides 15 powerful tools for accessing Twitter data:

### User Tools
- **getUserInfo** - Get user profile information by username
- **getUserTweets** - Get recent tweets from a user (with pagination)
- **getUserFollowers** - Get followers list (with pagination)
- **getUserFollowing** - Get following list (with pagination)
- **getUserMentions** - Get tweets mentioning a specific user
- **searchUsers** - Search for users by keyword
- **checkFollowRelationship** - Check if one user follows another
- **batchGetUsers** - Get multiple user profiles in a single request

### Tweet Tools
- **getTweetsByIds** - Get tweets by their IDs (batch operation)
- **getTweetReplies** - Get replies to a specific tweet
- **getTweetQuotes** - Get quote tweets for a specific tweet
- **getTweetThread** - Get entire conversation thread context
- **advancedTweetSearch** - Advanced search with filters and operators

### List & Community Tools
- **getListTweets** - Get tweets from a Twitter List
- **getTrends** - Get trending topics by location (WOEID)

## Setup

### 1. Get TwitterAPI.io API Key
1. Visit [TwitterAPI.io](https://twitterapi.io)
2. Sign up for an account
3. Get your API key from the dashboard

### 2. Environment Configuration
Set up your environment variables:
```bash
# Required: Your TwitterAPI.io API key
TWITTERAPI_IO_KEY=your_twitterapi_io_api_key

# Optional: For MCP server authentication
VALID_KEYS=your_mcp_server_api_key_1,your_mcp_server_api_key_2
```

### 3. Deploy to Vercel
```bash
# Navigate to the project directory
cd mcp-examples/twitterapi.io

# Set environment variables in Vercel
vercel env add TWITTERAPI_IO_KEY

# Deploy to Vercel
vercel deploy
```

## Usage

All tools are now configured automatically with your API key from the environment variable. Here are some examples:

### Get User Information
```json
{
  "tool": "getUserInfo",
  "parameters": {
    "userName": "elonmusk"
  }
}
```

### Search Tweets
```json
{
  "tool": "advancedTweetSearch",
  "parameters": {
    "query": "AI OR \"artificial intelligence\" from:elonmusk since:2024-01-01",
    "queryType": "Latest"
  }
}
```

### Get User's Recent Tweets
```json
{
  "tool": "getUserTweets",
  "parameters": {
    "userName": "elonmusk",
    "includeReplies": false,
    "cursor": ""
  }
}
```

### Get Tweet Thread
```json
{
  "tool": "getTweetThread",
  "parameters": {
    "tweetId": "1234567890123456789"
  }
}
```

### Check Follow Relationship
```json
{
  "tool": "checkFollowRelationship",
  "parameters": {
    "sourceUserName": "user1",
    "targetUserName": "user2"
  }
}
```

### Get User Followers with Pagination
```json
{
  "tool": "getUserFollowers",
  "parameters": {
    "userName": "elonmusk",
    "pageSize": 200,
    "cursor": ""
  }
}
```

### Get Trending Topics
```json
{
  "tool": "getTrends",
  "parameters": {
    "woeid": 2418046,
    "count": 50
  }
}
```

## Advanced Search Query Examples

The `advancedTweetSearch` tool supports powerful search operators:

- **Keywords**: `"artificial intelligence"` (exact phrase)
- **User tweets**: `from:elonmusk`
- **Mentions**: `@openai`
- **Hashtags**: `#AI`
- **Date ranges**: `since:2024-01-01` `until:2024-12-31`
- **Boolean operators**: `AI OR "machine learning"`
- **Exclude terms**: `AI -bitcoin`
- **Language**: `lang:en`
- **Minimum metrics**: `min_retweets:100`

Example complex query:
```
("artificial intelligence" OR "machine learning") from:elonmusk since:2024-01-01 -crypto lang:en min_retweets:10
```

## Pagination

Many endpoints support pagination using cursors:

1. First request: Set `cursor` to empty string `""`
2. Subsequent requests: Use the `next_cursor` from the previous response
3. Continue until `has_next_page` is `false`

Example pagination workflow:
```json
// First request
{
  "tool": "getUserTweets",
  "parameters": {
    "userName": "elonmusk",
    "cursor": ""
  }
}

// Subsequent request using next_cursor from previous response
{
  "tool": "getUserTweets",
  "parameters": {
    "userName": "elonmusk",
    "cursor": "DAABCgABF__8jQIAAA"
  }
}
```

## Rate Limits & Pricing

TwitterAPI.io uses a credit-based pricing system:
- **User profiles**: 18 credits (single), 10 credits (bulk 100+)
- **Tweets**: 15 credits per 1k tweets
- **Followers/Following**: 15 credits per 1k users
- **Advanced search**: Variable based on results
- **Minimum charge**: 0.15 credits per request (even if no data)

See [TwitterAPI.io pricing](https://twitterapi.io/pricing) for current rates.

## Error Handling

The server provides detailed error messages for common issues:
- Missing or invalid API keys (`TWITTERAPI_IO_KEY not configured`)
- Invalid usernames or tweet IDs
- Rate limit exceeded
- Network connectivity issues

All responses include detailed JSON data or error messages to help with debugging.

## Popular Use Cases

1. **Social Media Analytics** - Track user engagement and tweet performance
2. **Research** - Analyze conversation threads and user relationships
3. **Content Discovery** - Find trending topics and influential users
4. **Competitive Analysis** - Monitor competitor activity and mentions
5. **Academic Research** - Study social media patterns and behaviors
6. **Real-time Monitoring** - Track mentions and hashtags
7. **Audience Analysis** - Study follower/following relationships

## Support

- TwitterAPI.io Documentation: [docs.twitterapi.io](https://docs.twitterapi.io)
- MCP Protocol: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- Issues: Create an issue in this repository

## Security

- API keys are stored as environment variables (more secure)
- All requests use HTTPS
- No user data is cached or stored
- Follow TwitterAPI.io's terms of service
- Environment variables are not exposed in tool responses
