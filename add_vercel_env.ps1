# Add VITE_ADMIN_EMAIL to Vercel via echo pipe
$value = "exodofinancaspessoas@gmail.com"
echo $value | npx vercel env add VITE_ADMIN_EMAIL production
