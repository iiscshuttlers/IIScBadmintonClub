// Add admin emails to your .env file as VITE_ADMIN_EMAILS="email1@example.com,email2@example.com"
const envAdmins = import.meta.env.VITE_ADMIN_EMAILS
  ? import.meta.env.VITE_ADMIN_EMAILS.split(',').map((e: string) => e.trim().toLowerCase())
  : [];

// Fallback to hardcoded list if env is not provided to prevent breaking current admin access
const FALLBACK_EMAILS = [
  "iiscbadmintonclub@gmail.com",
  "janmejayraja@iisc.ac.in",
  "raja79sharma@gmail.com",
  "rajajanmejaya@gmail.com"
];

export const ADMIN_EMAILS = Array.from(new Set([...envAdmins, ...FALLBACK_EMAILS]));

export const isAdminEmail = (email?: string | null) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};
