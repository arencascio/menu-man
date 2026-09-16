export default function CustomerEmailLine({ email }: { email: string | null }) {
  if (!email) return null;
  return <p>Email on order: <strong>{email}</strong></p>;
}
