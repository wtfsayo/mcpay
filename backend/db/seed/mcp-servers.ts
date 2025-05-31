import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { mcpServers, users } from '../schema.js';

const db = drizzle(process.env.DATABASE_URL!);

export async function seedMcpServers() {
  console.log('🌱 Seeding MCP servers...');

  // First, let's create a sample user if needed (optional, since creatorId can be null)
  const sampleUser: typeof users.$inferInsert = {
    walletAddress: '0x1234567890123456789012345678901234567890',
    email: 'creator@mcpay.fun',
    displayName: 'MCP Creator',
  };

  const [existingUser] = await db.select().from(users).where(eq(users.walletAddress, sampleUser.walletAddress));
  let userId = existingUser?.id;

  if (!existingUser) {
    const insertedUsers = await db.insert(users).values(sampleUser).returning();
    const newUser = insertedUsers[0];
    if (!newUser) {
      throw new Error('Failed to create sample user');
    }
    userId = newUser.id;
    console.log('✅ Sample user created!');
  }

  // Sample MCP servers to seed
  const sampleServers: (typeof mcpServers.$inferInsert)[] = [
    {
      serverId: 'financial-data-server',
      mcpOrigin: 'https://api.financialdata.com/mcp',
      creatorId: userId,
      receiverAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      requireAuth: true,
      authHeaders: {
        'X-API-Key': 'required',
        'Authorization': 'Bearer token'
      },
      status: 'active',
      name: 'Financial Data Server',
      description: 'Provides real-time financial data and market analysis tools',
      metadata: {
        category: 'finance',
        version: '1.0.0',
        tags: ['stocks', 'crypto', 'market-data']
      }
    },
    {
      serverId: 'weather-api-server',
      mcpOrigin: 'https://weather.mcpay.fun/mcp',
      creatorId: userId,
      receiverAddress: '0x9876543210987654321098765432109876543210',
      requireAuth: false,
      status: 'active',
      name: 'Weather API Server',
      description: 'Global weather data and forecasting services',
      metadata: {
        category: 'weather',
        version: '2.1.0',
        tags: ['weather', 'forecast', 'climate']
      }
    },
    {
      serverId: 'blockchain-analytics',
      mcpOrigin: 'https://blockchain.mcpay.fun/mcp',
      creatorId: null, // No specific creator
      receiverAddress: '0x5555666677778888999900001111222233334444',
      requireAuth: true,
      authHeaders: {
        'X-Chain-Key': 'required'
      },
      status: 'active',
      name: 'Blockchain Analytics',
      description: 'On-chain data analysis and transaction monitoring',
      metadata: {
        category: 'blockchain',
        version: '1.5.2',
        tags: ['ethereum', 'bitcoin', 'analytics', 'defi']
      }
    },
    {
      serverId: 'ai-content-generator',
      mcpOrigin: 'https://ai.mcpay.fun/mcp',
      creatorId: userId,
      receiverAddress: '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555',
      requireAuth: true,
      authHeaders: {
        'Authorization': 'Bearer token',
        'X-Model-Access': 'premium'
      },
      status: 'maintenance',
      name: 'AI Content Generator',
      description: 'Advanced AI tools for content creation and analysis',
      metadata: {
        category: 'ai',
        version: '3.0.0-beta',
        tags: ['ai', 'content', 'generation', 'nlp']
      }
    }
  ];

  // Insert the sample servers
  console.log('📝 Inserting sample MCP servers...');
  
  for (const server of sampleServers) {
    const [existingServer] = await db.select().from(mcpServers).where(eq(mcpServers.serverId, server.serverId));
    
    if (!existingServer) {
      await db.insert(mcpServers).values(server);
      console.log(`✅ Created server: ${server.name} (${server.serverId})`);
    } else {
      console.log(`⏭️  Server already exists: ${server.name} (${server.serverId})`);
    }
  }

  // Display all servers
  const allServers = await db.select().from(mcpServers);
  console.log('\n📊 All MCP servers in database:');
  allServers.forEach(server => {
    console.log(`  - ${server.name} (${server.serverId}) - Status: ${server.status}`);
  });

  // Example update operation
  console.log('\n🔄 Updating server status...');
  await db
    .update(mcpServers)
    .set({
      status: 'active',
      updatedAt: new Date()
    })
    .where(eq(mcpServers.serverId, 'ai-content-generator'));
  console.log('✅ Updated ai-content-generator status to active');

  // Example query with filters
  const activeServers = await db.select().from(mcpServers).where(eq(mcpServers.status, 'active'));
  console.log(`\n🟢 Found ${activeServers.length} active servers`);

  console.log('\n🎉 MCP servers seeding completed!');
}