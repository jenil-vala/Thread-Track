require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const db = require('../db/knex');

const ADMIN_MOBILE = '9879312949';

async function resetAdminPassword() {
  const newPassword = process.argv[2] || 'admin123';
  console.log(`=========================================`);
  console.log(`THREAD TRACK ADMIN PASSWORD RESET UTILITY`);
  console.log(`=========================================`);
  console.log(`Target Admin Mobile: ${ADMIN_MOBILE}`);
  console.log(`Target New Password: ${newPassword}`);
  console.log(`-----------------------------------------`);
  console.log(`Connecting to database...`);

  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Check if admin already exists
    const adminUser = await db('users').where({ mobile: ADMIN_MOBILE }).first();

    if (adminUser) {
      // Update
      await db('users')
        .where({ id: adminUser.id })
        .update({
          password_hash: passwordHash,
          role: 'Admin',
          active: true,
          updated_at: db.fn.now()
        });
      console.log(`SUCCESS: Admin user '${adminUser.name}' password has been updated!`);
    } else {
      // Create new
      await db('users').insert({
        name: 'Super Admin',
        mobile: ADMIN_MOBILE,
        email: 'admin@threadtrack.com',
        password_hash: passwordHash,
        role: 'Admin',
        active: true
      });
      console.log(`SUCCESS: No admin found with mobile '${ADMIN_MOBILE}'. Created a new Super Admin account.`);
    }

    console.log(`Log in credentials: Mobile "${ADMIN_MOBILE}", Password "${newPassword}"`);
  } catch (error) {
    console.error(`ERROR resetting password:`, error);
  } finally {
    // Close Knex pool
    await db.destroy();
    console.log(`Database connection closed.`);
    console.log(`=========================================`);
  }
}

resetAdminPassword();
