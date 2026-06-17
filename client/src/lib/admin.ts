// Master admin emails — only used as a bootstrap fallback if role column is not yet set.
// All role checks should use players.role from the DB, not this list.
export const MASTER_ADMIN_EMAILS = [
  "iiscbadmintonclub@gmail.com",
  "janmejayraja@iisc.ac.in",
  "rajajanmejaya@gmail.com",
];

export const isMasterAdminEmail = (email?: string | null) => {
  if (!email) return false;
  return MASTER_ADMIN_EMAILS.includes(email.toLowerCase());
};
