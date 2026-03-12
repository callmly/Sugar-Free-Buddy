import { pool } from "./db";

async function initDatabase() {
    const createTablesSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR REFERENCES users(id),
      content TEXT NOT NULL,
      is_coach BOOLEAN DEFAULT false NOT NULL,
      reply_to_id VARCHAR,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS check_ins (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR REFERENCES users(id) NOT NULL,
      mood INTEGER NOT NULL,
      craving INTEGER NOT NULL,
      energy INTEGER NOT NULL DEFAULT 3,
      trigger TEXT,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      openai_api_key TEXT,
      openai_model TEXT DEFAULT 'gpt-4o-mini',
      custom_instructions TEXT,
      chat_instructions TEXT,
      allow_registration BOOLEAN DEFAULT true NOT NULL,
      relapse_time TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON check_ins(user_id);
    CREATE INDEX IF NOT EXISTS idx_checkins_created_at ON check_ins(created_at);
    `;

    try {
      console.log("Initializing database...");
      await pool.query(createTablesSQL);

      const result = await pool.query("SELECT COUNT(*) FROM admin_settings");
      if (result.rows[0].count === "0") {
        await pool.query(`
          INSERT INTO admin_settings (relapse_time, openai_model, allow_registration)
          VALUES (NOW(), 'gpt-4o-mini', true)
        `);
        console.log("✅ Default admin settings created (registration enabled)");
      }

      await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id VARCHAR`);
      await pool.query(`ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT`);
      await pool.query(`ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS anthropic_model TEXT DEFAULT 'claude-3-5-sonnet-20241022'`);
      await pool.query(`ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'openai'`);

      console.log("✅ Database initialized successfully");
    } catch (error) {
      console.error("Database initialization error:", error);
      throw error;
    }
}

export { initDatabase };
