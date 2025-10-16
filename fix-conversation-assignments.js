const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixConversationAssignments() {
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
    console.log('🔧 Starting conversation assignment fix...\n');

    // 1. Check current state
    const [unassignedConversations] = await connection.execute(
      'SELECT COUNT(*) as count FROM conversations WHERE assigned_user_id IS NULL'
    );
    console.log('📊 Conversations without assigned user:', unassignedConversations[0].count);

    const [totalConversations] = await connection.execute(
      'SELECT COUNT(*) as count FROM conversations'
    );
    console.log('📊 Total conversations:', totalConversations[0].count);

    // 2. Check if user 1 exists
    const [users] = await connection.execute('SELECT id, email, name FROM users WHERE id = 1');
    if (users.length === 0) {
      console.log('❌ User with ID 1 not found. Available users:');
      const [allUsers] = await connection.execute('SELECT id, email, name FROM users');
      allUsers.forEach(user => {
        console.log(`   - ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`);
      });
      return;
    }
    
    console.log('✅ Found user 1:', users[0].email, users[0].name);

    // 3. Show sample of unassigned conversations
    const [sampleUnassigned] = await connection.execute(`
      SELECT c.id, c.customer_id, c.status, c.created_at,
             COUNT(m.id) as message_count,
             SUM(CASE WHEN m.direction = 'inbound' AND m.read_at IS NULL THEN 1 ELSE 0 END) as unread_count
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.assigned_user_id IS NULL
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 5
    `);
    
    console.log('\n📋 Sample unassigned conversations:');
    sampleUnassigned.forEach(conv => {
      console.log(`   - Conversation ${conv.id}: ${conv.message_count} messages, ${conv.unread_count} unread (Customer: ${conv.customer_id})`);
    });

    // 4. Ask for confirmation (in a real script, you might want to add readline)
    console.log('\n🤔 Do you want to assign ALL unassigned conversations to user 1?');
    console.log('   This will make all unread messages visible to user 1.');
    
    // For now, let's proceed automatically. In production, you might want manual confirmation.
    console.log('✅ Proceeding with assignment...\n');

    // 5. Assign all unassigned conversations to user 1
    const [updateResult] = await connection.execute(
      'UPDATE conversations SET assigned_user_id = 1 WHERE assigned_user_id IS NULL'
    );
    
    console.log(`✅ Updated ${updateResult.affectedRows} conversations`);

    // 6. Verify the fix
    const [newUnassignedCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM conversations WHERE assigned_user_id IS NULL'
    );
    console.log('📊 Conversations still unassigned:', newUnassignedCount[0].count);

    const [assignedToUser1] = await connection.execute(
      'SELECT COUNT(*) as count FROM conversations WHERE assigned_user_id = 1'
    );
    console.log('📊 Conversations now assigned to user 1:', assignedToUser1[0].count);

    // 7. Check unread count for user 1 after fix
    const [unreadForUser1] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM messages m 
      JOIN conversations c ON m.conversation_id = c.id 
      WHERE c.assigned_user_id = 1 
        AND m.direction = 'inbound' 
        AND m.read_at IS NULL
    `);
    console.log('📬 Unread messages now visible to user 1:', unreadForUser1[0].count);

    console.log('\n🎉 Conversation assignment fix completed!');
    console.log('   User 1 should now see all unread messages in the API.');

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

// Run the fix script
fixConversationAssignments().catch(console.error);
