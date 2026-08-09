import PageShell from "@/components/site/PageShell";

// Wrapped in PageShell like every other marketing page. It previously rendered a
// bare div with no PageShell and no SEO element, so it had no title, description
// or canonical of its own: the prerendered file was correct, but navigating here
// from another page left the previous page's head in place. cta={false} because a
// sales prompt does not belong at the end of a legal document.
const PrivacyPolicy = () => {
  return (
    <PageShell
      title="Privacy Policy | OctaDezx"
      description="How OctaDezx collects, uses, stores and protects data for businesses and their customers, including security practices and your data rights."
      canonical="https://octadezx.com/privacy"
      cta={false}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-slate-900">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: April 12, 2026</p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* 1. Introduction */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              OctaDezx ("we," "our," or "us") operates the website octadezx.com and provides an AI-powered commerce automation platform (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. By using OctaDezx, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Information We Collect</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">2.1 Account Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you create an account, we collect your email address, name, and authentication credentials. If you sign up via Google OAuth, we receive your public profile information from Google.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">2.2 Business Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              Business owners provide business names, descriptions, policies, product catalogs (including product names, descriptions, images, pricing), AI instructions, and knowledge base articles. This information is used to power your AI assistant.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">2.3 Chat & Conversation Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              We store chat sessions and messages between your customers and the AI assistant. This includes customer names, email addresses (if provided), message content, and any images shared during conversations. This data is necessary to provide the chat service and order processing functionality.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">2.4 Usage Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              We automatically collect information about how you interact with the Service, including daily unique customer counts, message volumes, page views, feature usage, and session data. This helps us enforce plan limits and improve the Service.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">2.5 Payment Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              Payment processing is handled by Lemon Squeezy. We do not store your credit card details. We receive and store your Lemon Squeezy customer ID and subscription ID to manage your subscription status.
            </p>
          </section>

          {/* 3. How We Use Information */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>To provide, maintain, and improve the Service</li>
              <li>To process your subscription and manage billing</li>
              <li>To power AI-driven customer conversations using your business data</li>
              <li>To process and track orders placed through the AI assistant</li>
              <li>To enforce usage limits based on your subscription plan</li>
              <li>To send transactional emails (account verification, password resets)</li>
              <li>To respond to support requests</li>
              <li>To analyze usage patterns and improve the Service</li>
              <li>To detect and prevent fraud or abuse</li>
            </ul>
          </section>

          {/* 4. Third-Party Services */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the following third-party services to operate OctaDezx:
            </p>
            <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
              <li>
                <strong className="text-foreground">Supabase</strong>, Database hosting, authentication, and file storage. Your data is stored on Supabase's infrastructure.
              </li>
              <li>
                <strong className="text-foreground">Google Gemini AI</strong>, Powers the AI chat assistant. Chat messages and business context are sent to Google's Gemini API to generate responses. Google's AI data usage policies apply.
              </li>
              <li>
                <strong className="text-foreground">Google Analytics</strong>, We use Google Analytics to understand website traffic and usage patterns. This service may use cookies to collect anonymized browsing data.
              </li>
              <li>
                <strong className="text-foreground">Microsoft Clarity</strong>, We use Clarity to understand user behavior through session recordings and heatmaps. This helps us improve the user experience.
              </li>
              <li>
                <strong className="text-foreground">Lemon Squeezy</strong>, Handles all payment processing, subscription management, and invoicing. Your payment information is stored and processed by Lemon Squeezy.
              </li>
              <li>
                <strong className="text-foreground">Telnyx</strong>, Carries phone calls for businesses that use the voice feature. Call audio passes through Telnyx's network, and Telnyx holds the call metadata every telephone carrier records.
              </li>
              <li>
                <strong className="text-foreground">Deepgram</strong>, Turns speech into text and text back into speech during calls and for voicemail and voice notes. Call audio is sent to Deepgram to be processed.
              </li>
            </ul>
          </section>

          {/* 5. Voice Calls */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Voice Calls</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Businesses on Pro and above can give their AI assistant a phone number. This section
              explains what happens on those calls. It applies both to businesses using OctaDezx and
              to the people who call them.
            </p>
            <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
              <li>
                <strong className="text-foreground">You are always told it is an AI.</strong> Every assistant greeting
                discloses that the caller is speaking with an automated assistant. Businesses can reword
                that disclosure but cannot remove it.
              </li>
              <li>
                <strong className="text-foreground">Transcripts.</strong> Calls are converted to text and stored with the
                business's other customer conversations, so their team can see what was said.
              </li>
              <li>
                <strong className="text-foreground">Recordings are optional.</strong> Audio is only recorded when the
                business switches recording on. When it does, callers hear an announcement before the
                conversation starts, and in two-party consent jurisdictions the business can require the
                caller to agree first. Declining still gets you a full conversation, just no audio.
              </li>
              <li>
                <strong className="text-foreground">Audio expires, text does not.</strong> Recordings are deleted after the
                business's chosen retention window, 30 days by default and never more than a year. The
                transcript is kept as part of the customer service record.
              </li>
              <li>
                <strong className="text-foreground">Outbound calls.</strong> A business can also have the assistant call
                customers. Those calls only go out between 8am and 9pm in your local time, they tell you
                how to opt out, and saying stop calling removes your number immediately and cancels
                anything already queued for you.
              </li>
              <li>
                <strong className="text-foreground">Erasure.</strong> You can ask a business to erase your call audio and
                close your call records at any time, and they can do that from their dashboard.
              </li>
            </ul>
          </section>

          {/* 6. Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active. If you cancel your subscription, your data is retained for 30 days after the subscription ends, after which it may be deleted. Chat session data is retained for the lifetime of the business account to support order history and customer service records. You may request deletion of your data at any time by contacting us.
            </p>
          </section>

          {/* 7. Your Rights */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Depending on your jurisdiction, you may have the following rights:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Access</strong>, Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-foreground">Correction</strong>, Request correction of inaccurate personal data.</li>
              <li><strong className="text-foreground">Deletion</strong>, Request deletion of your personal data.</li>
              <li><strong className="text-foreground">Export</strong>, Request a portable copy of your data.</li>
              <li><strong className="text-foreground">Objection</strong>, Object to certain processing of your personal data.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To exercise any of these rights, please contact us at kevin@octadezx.com.
            </p>
          </section>

          {/* 8. Cookies */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar tracking technologies to operate and improve the Service. These include:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
              <li><strong className="text-foreground">Essential cookies</strong>, Required for authentication and session management (Supabase auth tokens).</li>
              <li><strong className="text-foreground">Analytics cookies</strong>, Used by Google Analytics and Microsoft Clarity to understand usage patterns.</li>
              <li><strong className="text-foreground">Advertising cookies</strong>, Used by Google Ads for conversion tracking.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              You can control cookie preferences through your browser settings. Disabling essential cookies may prevent you from using the Service.
            </p>
          </section>

          {/* 9. Data Security */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">9. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational measures to protect your data, including encryption in transit (HTTPS/TLS), row-level security policies on our database, and secure authentication practices. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          {/* 10. Children's Privacy */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">10. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
            </p>
          </section>

          {/* 11. Changes */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">11. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. Your continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* 12. Contact */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-muted-foreground mt-2">
              <strong className="text-foreground">Email:</strong>{" "}
              <a href="mailto:kevin@octadezx.com" className="text-primary hover:underline">kevin@octadezx.com</a>
            </p>
          </section>
        </div>
      </div>
    </PageShell>
  );
};

export default PrivacyPolicy;
