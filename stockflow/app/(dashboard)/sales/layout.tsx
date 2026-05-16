import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'SALES' && user.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  return <>{children}</>;
}
