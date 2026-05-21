export const ADMIN_EMAILS = [
  "iiscbadmintonclub@gmail.com",
  "janmejayraja@iisc.ac.in",
  "janmejay@iisc.ac.in",
  "raja79sharma@gmail.com"
];

export const isAdminEmail = (email?: string | null) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};
