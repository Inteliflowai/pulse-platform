import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pulse — Learning Intelligence for Classroom Delivery | Inteliflow',
  description: 'Curriculum, video, and formative checks orchestrated in real time — online or offline, cloud or on-premises. Built on pedagogy. Powered by AI.',
  openGraph: {
    title: 'Pulse — Learning Intelligence for Classroom Delivery',
    description: 'Offline-first content delivery for K-12 schools. Schedule lessons, sync to edge nodes, stream locally. CORE quiz handoff, fleet monitoring, teacher conductor.',
    url: 'https://pulse.inteliflowai.com/pulse',
    siteName: 'Pulse by Inteliflow',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pulse — Learning Intelligence for Classroom Delivery',
    description: 'Offline-first content delivery for K-12 schools. Built on pedagogy. Powered by AI.',
  },
  robots: { index: true, follow: true },
};

export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
