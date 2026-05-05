'use client';

import dynamic from 'next/dynamic';

const DashboardLayout = dynamic(() => import('@/components/DashboardLayout'), {
  ssr: false,
});

export default function DemoPage() {
  return <DashboardLayout />;
}