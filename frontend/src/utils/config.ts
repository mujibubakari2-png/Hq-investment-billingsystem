// Utils configuration for the frontend
// PUBLIC_API_BASE – the base URL that the MikroTik router will call.
// Since you don't have a domain yet, replace the placeholder with your droplet's public IP.
// Example: 'http://203.0.113.45'
// You can also override this value by setting VITE_PUBLIC_API_URL in a .env file
// (e.g., VITE_PUBLIC_API_URL=http://203.0.113.45) before running pnpm build.
export const PUBLIC_API_BASE =
  import.meta.env.VITE_PUBLIC_API_URL ||
  // <-- replace the string below with your actual droplet public IP
  "http://174.138.42.168";
