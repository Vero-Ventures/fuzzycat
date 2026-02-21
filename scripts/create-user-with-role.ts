import { createAdminClient } from '@/lib/supabase/admin';

const email = process.argv[2];
const role = process.argv[3];
const password = process.env.CREATE_USER_PASSWORD;

if (!email || !role || !password) {
  console.error(
    'Usage: CREATE_USER_PASSWORD=<password> bun run scripts/create-user-with-role.ts <email> <role>',
  );
  process.exit(1);
}

async function createUser() {
  const admin = createAdminClient();

  // Check if user exists
  const {
    data: { users },
    error: listError,
  } = await admin.auth.admin.listUsers();
  if (listError) {
    console.error('Failed to list users:', listError.message);
    process.exit(1);
  }

  const existingUser = users.find((u) => u.email === email);
  if (existingUser) {
    console.log(`User ${email} already exists.`);
    // Update role if needed
    const { error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
      app_metadata: { role },
      user_metadata: { full_name: `Test ${role}` },
    });
    if (updateError) {
      console.error('Failed to update user role for %s: %s', email, updateError.message);
      process.exit(1);
    }
    console.log(`Updated user ${email} with role ${role}`);
    return;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { full_name: `Test ${role}` },
  });

  if (error) {
    console.error('Failed to create user:', error.message);
    process.exit(1);
  }

  console.log(`User created: ${data.user.email} (${data.user.id}) with role ${role}`);
}

createUser();
