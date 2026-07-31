import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in · Follow-up Manager" };

export default async function LoginPage({
  searchParams,
}: {
  // Next 16: searchParams is a promise.
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <LoginForm next={next} />
    </div>
  );
}
