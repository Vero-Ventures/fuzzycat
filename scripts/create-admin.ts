import { createAdminClient } from '@/lib/supabase/admin';

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: bun run db:create-admin <email> <password>');
  process.exit(1);
}

async function createAdmin() {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'admin' },
  });

  if (error) {
    console.error('Failed to create admin user:', error.message);
    process.exit(1);
  }

  console.log(`Admin user created: ${data.user.email} (${data.user.id})`);
}

createAdmin();
