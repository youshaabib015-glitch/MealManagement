const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'meal_management.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('Initializing database...');

// Create tables
const createTables = () => {
  // Settings table (for storing meal rate, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users table (for authentication)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'manager',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone_number TEXT,
      room_number TEXT,
      deposit_balance REAL DEFAULT 0,
      join_date DATE NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Meals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      date DATE NOT NULL,
      breakfast INTEGER DEFAULT 0,
      lunch INTEGER DEFAULT 0,
      dinner INTEGER DEFAULT 0,
      total_meals INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      UNIQUE(member_id, date)
    )
  `);

  // Guest meals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS guest_meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_name TEXT NOT NULL,
      member_id INTEGER NOT NULL,
      meal_count INTEGER NOT NULL,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )
  `);

  // Expenses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Deposits table (money added by members)
  db.exec(`
    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      type TEXT CHECK(type IN ('deposit', 'deduction', 'refund', 'meal_cost')) DEFAULT 'deposit',
      description TEXT,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )
  `);

  // Monthly reset log
  db.exec(`
    CREATE TABLE IF NOT EXISTS monthly_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reset_date DATE NOT NULL,
      month_year TEXT NOT NULL,
      total_members INTEGER,
      total_meals INTEGER,
      total_expenses REAL,
      meal_rate REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Tables created successfully.');
};

// Insert default data
const insertDefaultData = () => {
  // Check if admin user exists
  const userExists = db.prepare('SELECT id FROM users WHERE username = ?').get('manager');
  
  if (!userExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('manager', hashedPassword);
    console.log('Default admin user created: manager / admin123');
  }

  // Default settings
  const defaultSettings = [
    { key: 'meal_rate', value: '0' },
    { key: 'currency', value: 'BDT' },
    { key: 'mess_name', value: 'Student Mess' },
    { key: 'auto_monthly_reset', value: '0' }
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  defaultSettings.forEach(setting => {
    insertSetting.run(setting.key, setting.value);
  });

  console.log('Default settings inserted.');
};

// Sample test data
const insertSampleData = () => {
  const memberCount = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
  
  if (memberCount === 0) {
    console.log('Inserting sample data...');
    
    const members = [
      { full_name: 'Rahim Uddin', phone_number: '01712345678', room_number: '101', deposit_balance: 5000, join_date: '2024-01-15' },
      { full_name: 'Karim Ahmed', phone_number: '01812345678', room_number: '102', deposit_balance: 3000, join_date: '2024-01-20' },
      { full_name: 'Salam Khan', phone_number: '01912345678', room_number: '103', deposit_balance: 4500, join_date: '2024-02-01' },
      { full_name: 'Jamil Hasan', phone_number: '01612345678', room_number: '201', deposit_balance: 2000, join_date: '2024-02-10' },
      { full_name: 'Faruk Mia', phone_number: '01512345678', room_number: '202', deposit_balance: 6000, join_date: '2024-03-01' }
    ];

    const insertMember = db.prepare(`
      INSERT INTO members (full_name, phone_number, room_number, deposit_balance, join_date)
      VALUES (?, ?, ?, ?, ?)
    `);

    const memberIds = [];
    members.forEach(member => {
      const result = insertMember.run(member.full_name, member.phone_number, member.room_number, member.deposit_balance, member.join_date);
      memberIds.push(result.lastInsertRowid);
    });

    // Sample meals for current month
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    
    for (let day = 1; day <= 5; day++) {
      const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      memberIds.forEach((memberId, index) => {
        const breakfast = Math.floor(Math.random() * 2);
        const lunch = 1;
        const dinner = 1;
        const total = breakfast + lunch + dinner;
        
        db.prepare(`
          INSERT OR IGNORE INTO meals (member_id, date, breakfast, lunch, dinner, total_meals)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(memberId, date, breakfast, lunch, dinner, total);
      });
    }

    // Sample guest meals
    db.prepare(`
      INSERT INTO guest_meals (guest_name, member_id, meal_count, date)
      VALUES (?, ?, ?, ?)
    `).run('Guest of Rahim', memberIds[0], 3, `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`);

    db.prepare(`
      INSERT INTO guest_meals (guest_name, member_id, meal_count, date)
      VALUES (?, ?, ?, ?)
    `).run('Guest of Karim', memberIds[1], 2, `${currentYear}-${String(currentMonth).padStart(2, '0')}-02`);

    // Sample expenses
    const expenses = [
      { description: 'Rice (50kg)', amount: 3500, category: 'Groceries', date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01` },
      { description: 'Vegetables', amount: 1200, category: 'Groceries', date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-02` },
      { description: 'Fish & Meat', amount: 2800, category: 'Groceries', date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-03` },
      { description: 'Gas Bill', amount: 800, category: 'Utilities', date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01` },
      { description: 'Spices & Oil', amount: 1500, category: 'Groceries', date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-04` }
    ];

    const insertExpense = db.prepare(`
      INSERT INTO expenses (description, amount, category, date)
      VALUES (?, ?, ?, ?)
    `);

    expenses.forEach(expense => {
      insertExpense.run(expense.description, expense.amount, expense.category, expense.date);
    });

    // Sample deposits
    const deposits = [
      { member_id: memberIds[0], amount: 2000, type: 'deposit', description: 'Monthly deposit', date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01` },
      { member_id: memberIds[1], amount: 1500, type: 'deposit', description: 'Monthly deposit', date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01` },
      { member_id: memberIds[2], amount: 3000, type: 'deposit', description: 'Monthly deposit', date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01` }
    ];

    const insertDeposit = db.prepare(`
      INSERT INTO deposits (member_id, amount, type, description, date)
      VALUES (?, ?, ?, ?, ?)
    `);

    deposits.forEach(deposit => {
      insertDeposit.run(deposit.member_id, deposit.amount, deposit.type, deposit.description, deposit.date);
    });

    console.log('Sample data inserted successfully.');
  }
};

// Run initialization
try {
  createTables();
  insertDefaultData();
  insertSampleData();
  console.log('Database initialization complete!');
} catch (error) {
  console.error('Error initializing database:', error);
} finally {
  db.close();
}