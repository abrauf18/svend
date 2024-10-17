import { createClient } from '@supabase/supabase-js';

// Example test execution:
// SUPABASE_SERVICE_ROLE_KEY=key node add-test-user.js test@example.com testpassword

// Replace these with your local Supabase project's URL and service role key
const supabaseUrl = 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function addTestUser(email, password) {
  // Sign up the user
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
  });

  if (error) {
    console.error('Error creating user:', error.message);
    return;
  }

  console.log('User created successfully:', data.user);

  // Retrieve the user's hashed password
  // Note: This requires admin access, which might not be available in all environments
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(data.user.id);

  if (userError) {
    console.error('Error retrieving user data:', userError.message);
    return;
  }
}

// Get email and password from command-line arguments
const [,, email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node add-test-user.js <email> <password>');
  process.exit(1);
}

// Call addTestUser with command-line arguments
addTestUser(email, password);
