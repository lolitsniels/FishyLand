/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Link } from "react-router-dom";
import { Mail as MailIcon, MessageCircle, BookMarked, ShieldCheck } from "lucide-react";
import { LegalLayout, H2, CONTACT_EMAIL, DISCORD_URL } from "./LegalShared";

const Card = ({ icon: Icon, title, children, testId }) => (
  <div className="panel p-4" data-testid={testId}>
    <div className="flex items-center gap-2 font-display text-[14px] text-[#f4ead2]"><Icon size={15} className="text-[var(--gold)]" /> {title}</div>
    <div className="text-[13px] text-[var(--text-2)] mt-2 space-y-1">{children}</div>
  </div>
);

export default function Contact() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact FishyLand",
    url: "https://thefishinglands.com/contact",
    mainEntity: { "@type": "Organization", name: "FishyLand", email: CONTACT_EMAIL, url: "https://thefishinglands.com", contactPoint: { "@type": "ContactPoint", email: CONTACT_EMAIL, contactType: "customer support", availableLanguage: "English" } },
  };
  return (
    <LegalLayout slug="contact" title="Contact Us" type="ContactPage" jsonLd={jsonLd}
      description={`Reach FishyLand team by email at ${CONTACT_EMAIL} or on Discord for support, account recovery, purchases, press and partnerships.`}>
      <p>We are a small team and we read everything. The quickest way to reach us is email; for a chat with other anglers and the developers, join the Discord.</p>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <Card icon={MailIcon} title="Email" testId="contact-card-email">
          <p><a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--gold)] text-[15px] font-semibold hover:underline break-all" data-testid="contact-email">{CONTACT_EMAIL}</a></p>
          <p>Support, account recovery, purchase issues, privacy requests, press and partnerships. We usually reply within one to two days.</p>
        </Card>
        <Card icon={MessageCircle} title="Discord" testId="contact-card-discord">
          <p><a href={DISCORD_URL} target="_blank" rel="noreferrer" className="text-[var(--gold)] hover:underline" data-testid="contact-discord">Join the community server</a></p>
          <p>Announcements, patch notes, bug reports, crew recruitment and fishing talk with other players.</p>
        </Card>
        <Card icon={BookMarked} title="Before you write" testId="contact-card-wiki">
          <p>Most questions about odds, prices, energy, quests and events are answered in the <Link to="/wiki" className="text-[var(--gold)] hover:underline">Wiki</Link>, which is generated from the live game rules.</p>
        </Card>
        <Card icon={ShieldCheck} title="Account & purchases" testId="contact-card-account">
          <p>Include your angler name. For a purchase, add the Tebex or PayPal transaction reference. For account recovery, write from the email address on the account.</p>
        </Card>
      </div>

      <H2 id="what-to-include">Helpful details</H2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Your angler name and roughly when the problem happened.</li>
        <li>Which water or page you were on and what you expected to happen.</li>
        <li>A screenshot if something looked wrong. Browser and device help too.</li>
      </ul>

      <H2 id="reporting">Reporting players or content</H2>
      <p>Use the report option in the game where available, or email us with the angler name and a screenshot. Reports are handled under our <Link to="/terms" className="text-[var(--gold)] hover:underline">Terms of Service</Link>. Privacy requests (data access or deletion) are described in our <Link to="/privacy" className="text-[var(--gold)] hover:underline">Privacy Policy</Link>.</p>
    </LegalLayout>
  );
}
