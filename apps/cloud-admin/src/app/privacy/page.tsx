import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy — Pulse' };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-gray-200">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/login" className="text-brand-primary text-sm hover:underline">&larr; Back to Pulse</Link>

        <h1 className="text-3xl font-bold text-white mt-6 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: April 2026</p>

        <div className="prose-sm space-y-6 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Overview</h2>
            <p>Inteliflow AI ("we", "us") operates the Pulse learning delivery platform. This Privacy Policy explains how we collect, use, store, and protect personal data when you use Pulse. We are committed to protecting the privacy of students, teachers, and school administrators.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. Data We Collect</h2>
            <p><strong>Account Data:</strong> Name, email address, role, and school affiliation for administrators and teachers.</p>
            <p><strong>Student Data:</strong> Student number, grade level, quiz responses, progress data, and session activity. We collect the minimum data necessary for the Platform to function.</p>
            <p><strong>Device Data:</strong> Device type, IP address (local network only), enrollment status, and last activity time.</p>
            <p><strong>Node Data:</strong> Hardware metrics (CPU, memory, storage), software version, connectivity status, and sync activity.</p>
            <p><strong>Usage Data:</strong> Playback sessions, content access patterns, and feature usage for analytics.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. How We Use Data</h2>
            <p>We use collected data to: deliver educational content to authorized users; track student progress and quiz results; monitor node health and sync operations; generate analytics for school administrators; improve the Platform; and communicate service updates.</p>
            <p>We do <strong>not</strong> use student data for advertising, profiling, or any purpose unrelated to educational delivery.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Data Storage & Security</h2>
            <p><strong>Cloud:</strong> Account data, content metadata, and aggregated analytics are stored in Supabase (hosted on secure cloud infrastructure) with row-level security ensuring complete tenant isolation.</p>
            <p><strong>On-Premises:</strong> Educational content, student session data, and quiz results are stored locally on school nodes using encrypted SQLite databases. This data stays on school premises unless synced to the cloud.</p>
            <p><strong>Encryption:</strong> All data in transit uses TLS/HTTPS. File integrity is verified with SHA-256 checksums.</p>
            <p><strong>Access Control:</strong> Role-based access control with six permission levels. API rate limiting and authentication tokens protect all endpoints.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Data Sharing</h2>
            <p>We do not sell, rent, or share personal data with third parties for marketing purposes. Data may be shared with: authorized school administrators within the same tenant; service providers necessary to operate the Platform (cloud hosting, authentication); and law enforcement when required by law.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">6. Children's Privacy (COPPA Compliance)</h2>
            <p>Pulse may process data of children under 13 as directed by schools. We comply with COPPA by: collecting only educationally necessary data; obtaining consent through the school (acting as the parent's agent); providing schools with access to review and delete student data; and not using student data for commercial purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">7. FERPA Compliance</h2>
            <p>For U.S. schools, Pulse operates as a "school official" under FERPA. We use education records solely for the educational purposes authorized by the school. Schools maintain control over student data and can request access, correction, or deletion at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">8. GDPR Compliance</h2>
            <p>For schools in the EU/EEA, we process personal data as a data processor on behalf of schools (data controllers). We process data lawfully based on the school's instructions. Data subjects have rights to access, rectify, erase, and port their data. We maintain records of processing activities and will notify of data breaches within 72 hours.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">9. Data Retention</h2>
            <p>Account data is retained while the account is active. Student progress and quiz data is retained for the duration of the school's subscription. Node metrics are retained for 30 days. Audit logs are retained for 1 year. Upon termination, data is deleted within 90 days unless required by law.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">10. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to: access your personal data; correct inaccurate data; delete your data; export your data in a portable format; object to processing; and withdraw consent. Contact your school administrator or us directly to exercise these rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">11. Offline Data</h2>
            <p>When school nodes operate offline, student data (quiz results, progress, session logs) is stored locally on the node. This data syncs to the cloud when connectivity is restored. Schools are responsible for the physical security of node hardware and locally stored data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">12. Changes to This Policy</h2>
            <p>We may update this policy from time to time. Material changes will be communicated via email to school administrators. The "Last updated" date at the top reflects the most recent revision.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">13. Contact</h2>
            <p>For privacy inquiries or data requests, contact our Data Protection Officer at <a href="mailto:privacy@inteliflowai.com" className="text-brand-primary hover:underline">privacy@inteliflowai.com</a>.</p>
            <p className="mt-2">Inteliflow AI<br />Email: <a href="mailto:info@inteliflowai.com" className="text-brand-primary hover:underline">info@inteliflowai.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
