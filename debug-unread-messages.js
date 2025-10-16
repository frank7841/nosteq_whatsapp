const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugUnreadMessages() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'whatsapp_gateway'
    });

    console.log('🔗 Connected to database successfully');
    console.log('📊 Starting unread messages analysis...\n');

    // 1. Check total messages
    const [totalMessages] = await connection.execute('SELECT COUNT(*) as count FROM messages');
    console.log('📈 Total messages in database:', totalMessages[0].count);

    // 2. Check inbound messages
    const [inboundMessages] = await connection.execute(
      "SELECT COUNT(*) as count FROM messages WHERE direction = 'inbound'"
    );
    console.log('📥 Total inbound messages:', inboundMessages[0].count);

    // 3. Check unread inbound messages
    const [unreadInbound] = await connection.execute(
      "SELECT COUNT(*) as count FROM messages WHERE direction = 'inbound' AND read_at IS NULL"
    );
    console.log('📬 Total unread inbound messages:', unreadInbound[0].count);

    // 4. Check conversations table
    const [totalConversations] = await connection.execute('SELECT COUNT(*) as count FROM conversations');
    console.log('💬 Total conversations:', totalConversations[0].count);

    // 5. Check conversations with assigned users
    const [assignedConversations] = await connection.execute(
      'SELECT COUNT(*) as count FROM conversations WHERE assigned_user_id IS NOT NULL'
    );
    console.log('👤 Conversations with assigned users:', assignedConversations[0].count);

    // 6. List all users
    const [users] = await connection.execute('SELECT id, email, name FROM users');
    console.log('\n👥 Users in database:');
    users.forEach(user => {
      console.log(`   - ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`);
    });

    // 7. For each user, check their assigned conversations and unread messages
    console.log('\n🔍 Per-user analysis:');
    for (const user of users) {
      console.log(`\n--- User: ${user.name} (ID: ${user.id}) ---`);
      
      // User's assigned conversations
      const [userConversations] = await connection.execute(
        'SELECT id, customer_id, status, created_at FROM conversations WHERE assigned_user_id = ?',
        [user.id]
      );
      console.log(`   📋 Assigned conversations: ${userConversations.length}`);
      
      if (userConversations.length > 0) {
        userConversations.forEach(conv => {
          console.log(`      - Conversation ${conv.id} (Customer: ${conv.customer_id}, Status: ${conv.status})`);
        });

        // Unread messages in user's conversations
        const [unreadInUserConvs] = await connection.execute(`
          SELECT COUNT(*) as count 
          FROM messages m 
          JOIN conversations c ON m.conversation_id = c.id 
          WHERE c.assigned_user_id = ? 
            AND m.direction = 'inbound' 
            AND m.read_at IS NULL
        `, [user.id]);
        console.log(`   📬 Unread messages in assigned conversations: ${unreadInUserConvs[0].count}`);

        // List actual unread messages for this user
        const [unreadMessagesList] = await connection.execute(`
          SELECT m.id, m.conversation_id, m.content, m.created_at, c.assigned_user_id
          FROM messages m 
          JOIN conversations c ON m.conversation_id = c.id 
          WHERE c.assigned_user_id = ? 
            AND m.direction = 'inbound' 
            AND m.read_at IS NULL
          ORDER BY m.created_at DESC
          LIMIT 5
        `, [user.id]);
        
        if (unreadMessagesList.length > 0) {
          console.log(`   📝 Recent unread messages (showing up to 5):`);
          unreadMessagesList.forEach(msg => {
            console.log(`      - Message ${msg.id}: "${msg.content.substring(0, 50)}..." (${msg.created_at})`);
          });
        }
      }
    }

    const [orphanedMessages] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM messages m 
      LEFT JOIN conversations c ON m.conversation_id = c.id 
      WHERE m.direction = 'inbound' 
        AND m.read_at IS NULL 
        AND (c.id IS NULL OR c.assigned_user_id IS NULL)
    `);
    console.log(`\n🚨 Orphaned unread messages (no conversation or no assigned user): ${orphanedMessages[0].count}`);

    // 9. Show sample of all unread messages regardless of assignment
    const [allUnreadSample] = await connection.execute(`
      SELECT m.id, m.conversation_id, m.content, m.created_at, c.assigned_user_id, c.status as conv_status
      FROM messages m 
      LEFT JOIN conversations c ON m.conversation_id = c.id 
      WHERE m.direction = 'inbound' 
        AND m.read_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 10
    `);
    
    console.log(`\n📋 Sample of all unread inbound messages (showing up to 10):`);
    allUnreadSample.forEach(msg => {
      console.log(`   - Message ${msg.id} (Conv: ${msg.conversation_id}, Assigned: ${msg.assigned_user_id || 'NONE'}, Status: ${msg.conv_status})`);
      console.log(`     Content: "${msg.content.substring(0, 80)}..."`);
      console.log(`     Created: ${msg.created_at}`);
    });

    console.log('\n✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the debug script
debugUnreadMessages().catch(console.error);
