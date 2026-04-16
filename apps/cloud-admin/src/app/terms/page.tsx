import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service — Pulse' };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-gray-200">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/login" className="text-brand-primary-light text-sm hover:underline">&larr; Back to Pulse</Link>

        <h1 className="text-3xl font-bold text-white mt-6 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: April 2026</p>

        <div className="prose-sm space-y-6 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Acceptance of Terms</h2>
            <p>By accessing or using Pulse ("the Platform"), provided by Inteliflow AI ("we", "us", "our"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. Description of Service</h2>
            <p>Pulse is a learning delivery infrastructure platform that enables schools to distribute educational content (video lessons, quizzes, documents) to on-premises school nodes for local delivery, including offline operation. The Platform includes cloud-based management tools and on-premises node software.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. Accounts & Access</h2>
            <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. School administrators are responsible for managing user access within their organization. You must not share account credentials or enrollment tokens outside your authorized school network.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Acceptable Use</h2>
            <p>You agree to use Pulse only for lawful educational purposes. You must not: upload content that violates intellectual property rights; attempt to gain unauthorized access to other tenants' data; reverse engineer the Platform software; use the Platform to distribute malicious content; or exceed reasonable usage limits that impact other users.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Content & Intellectual Property</h2>
            <p>You retain ownership of all content you upload to Pulse. By uploading content, you grant us a limited license to store, process, and deliver that content through the Platform to your authorized school nodes and users. We do not claim ownership of your educational materials. We may use aggregated, anonymized usage data to improve the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">6. Data & Privacy</h2>
            <p>We handle personal data in accordance with our <Link href="/privacy" className="text-brand-primary-light hover:underline">Privacy Policy</Link>. Pulse is designed with multi-tenant isolation — each school organization's data is separated and protected by row-level security. Student data is processed in compliance with applicable education data privacy regulations including COPPA, FERPA, and GDPR where applicable.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">7. Node Software</h2>
            <p>School nodes run software provided by Inteliflow. You are responsible for maintaining the physical security of node hardware. We provide software updates which may be applied automatically or manually depending on your configuration. Nodes store educational content locally; you are responsible for the security of local storage.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">8. Service Availability</h2>
            <p>We strive to maintain high availability of cloud services. However, we do not guarantee uninterrupted service. The offline capability of school nodes is a core feature — local content delivery continues regardless of cloud availability. We will provide reasonable notice of planned maintenance.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Inteliflow AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform. Our total liability shall not exceed the fees paid by you in the twelve months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">10. Termination</h2>
            <p>Either party may terminate the agreement with 30 days written notice. Upon termination, we will provide a reasonable period to export your data. We may suspend access immediately if you violate these terms. Termination does not affect content already synced to school nodes until those nodes are decommissioned.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">11. Changes to Terms</h2>
            <p>We may update these terms from time to time. We will notify registered users of material changes via email or in-app notification. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">12. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:legal@inteliflowai.com" className="text-brand-primary-light hover:underline">legal@inteliflowai.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
