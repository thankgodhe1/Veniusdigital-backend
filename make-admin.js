const mongoose = require('mongoose');
const User = require('./models/user.model');
const { roles } = require('./utils/constants');   // ← Import roles
require('dotenv').config();

const makeAdmin = async (email) => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI is not found in your .env file');
      process.exit(1);
    }

    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB successfully');

    if (!email) {
      console.error('❌ Please provide an email');
      process.exit(1);
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      process.exit(1);
    }

    const oldRole = user.role;

    if (oldRole === roles.admin) {
      console.log(`⚠️ This user is already an Admin`);
    } else {
      user.role = roles.admin;        // ← Use the constant
      await user.save();
      console.log(`🎉 SUCCESS! User role changed to ADMIN`);
    }

    console.log(`\nUser Details:`);
    console.log(`   Email      : ${user.email}`);
    console.log(`   Old Role   : ${oldRole}`);
    console.log(`   New Role   : ${user.role}`);
    console.log(`   Account    : ${user.account}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

// ====================== RUN ======================
const email = process.argv[2];

if (!email) {
  console.log('\nUsage:');
  console.log('   node make-admin.js <email>');
  console.log('\nExample:');
  console.log('   node make-admin.js piuspolocha8@gmail.com\n');
  process.exit(1);
}

makeAdmin(email);