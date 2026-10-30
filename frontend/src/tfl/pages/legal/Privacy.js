/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Link } from "react-router-dom";
import { LegalLayout, H2, H3, UL, Mail } from "./LegalShared";

const UPDATED = "2026-09-22";

export default function Privacy() {
  return (
    <LegalLayout slug="privacy" title="Privacy Policy" updated={UPDATED}
      description="How FishyLand collects, uses and protects your data: accounts, cookies, advertising (Google AdSense), payments, reCAPTCHA, push notifications and your rights.">
      <p>This Privacy Policy explains what information the operator of FishyLand ("we", "us") collects when you visit thefishinglands.com or play the game, why we collect it, and the choices you have. FishyLand is a free browser game; we collect as little personal data as we can while still running a persistent multiplayer world.</p>

      <H2 id="collect">1. Information we collect</H2>
      <H3>Information you give us</H3>
      <UL>
        <li><b>Account details</b>, an angler name and a password (stored only as a salted hash). An email address is optional; if you add one we use it solely for password resets and account-security notices.</li>
        <li><b>Content you create</b>, chat messages, crew names and descriptions, pond signs, guestbook entries, market listings and messages to other players. This content is visible to other players as part of the game.</li>
        <li><b>Support requests</b>, anything you send us by email or Discord.</li>
      </UL>
      <H3>Information collected automatically</H3>
      <UL>
        <li><b>Gameplay data</b>, catches, inventory, gold, quests, achievements, crew membership, tournament results and similar records. This is the game itself and is needed to keep a persistent world.</li>
        <li><b>Technical data</b>, IP address, browser type, device type (touch / desktop, installed web app or browser), language, referring site and the pages you visit. We use this for security, abuse prevention, and to see which sites send us players.</li>
        <li><b>Guest accounts</b>, if you play as a guest we create a temporary account tied to a token stored in your browser so your progress survives a refresh. Guest accounts contain no personal details unless you later claim them with a name and password.</li>
      </UL>

      <H2 id="cookies">2. Cookies and local storage</H2>
      <p>We use a small number of cookies and browser storage items that are strictly necessary for the game to work: your sign-in token, your interface preferences (theme, weight unit, pop-up settings), a session marker used to count visits, and a short-lived cookie used by our hosting provider for security and load balancing.</p>
      <p>Third parties listed below may also set cookies or use similar technologies when you use the site. You can delete or block cookies in your browser settings; the game will still load, but you will be signed out and preferences will reset.</p>

      <H2 id="ads">3. Advertising (Google AdSense)</H2>
      <p>We show advertisements served by Google AdSense to keep the game free. Google and its partners use cookies (such as the DoubleClick cookie) and device identifiers to serve ads based on your prior visits to this and other websites, to limit how often you see an ad, and to measure ad performance.</p>
      <UL>
        <li>You can opt out of personalised advertising at <a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer" className="text-[var(--gold)] hover:underline">Google Ads Settings</a> or at <a href="https://www.aboutads.info/choices" target="_blank" rel="noreferrer" className="text-[var(--gold)] hover:underline">aboutads.info</a>.</li>
        <li>Visitors in the European Economic Area, the United Kingdom and Switzerland are shown a consent message before any advertising cookies are set, and can change their choice at any time through that message.</li>
        <li>How Google uses data from sites that use its services is described at <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer" className="text-[var(--gold)] hover:underline">policies.google.com/technologies/partner-sites</a>.</li>
      </UL>

      <H2 id="third-parties">4. Third-party services</H2>
      <p>We rely on a handful of service providers. Each only receives the data needed to do its job:</p>
      <UL>
        <li><b>Google reCAPTCHA</b>, protects sign-up, sign-in and guest creation against bots. It collects hardware and software information and sends it to Google for analysis. Subject to the <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-[var(--gold)] hover:underline">Google Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="text-[var(--gold)] hover:underline">Terms of Service</a>.</li>
        <li><b>Tebex and PayPal</b>, process optional purchases (the Angler Pass, boosters and Pearls). Payment details are entered on the processor's own pages; we never see or store card numbers. We receive a transaction reference, the item bought and the angler it was bought for.</li>
        <li><b>Resend</b>, delivers password-reset and account emails on our behalf if you have added an email address.</li>
        <li><b>Web push</b>, if you turn on notifications, your browser gives us an anonymous push subscription so we can alert you about expeditions, bosses and duels. You can turn this off in your browser or in the game settings at any time.</li>
        <li><b>Toplist / voting sites</b>, when you vote for the game on a partner toplist, that site tells us your angler name so we can hand out the reward.</li>
        <li><b>Discord</b>, our community server is run on Discord and governed by Discord's own policies.</li>
      </UL>

      <H2 id="use">5. How we use information</H2>
      <UL>
        <li>To run the game: save your progress, show your catches to other players, run the market, crews, chat and events.</li>
        <li>To keep the game fair and safe: detect bots, multi-accounting, exploits and abusive behaviour, and enforce our <Link to="/terms" className="text-[var(--gold)] hover:underline">Terms of Service</Link>.</li>
        <li>To support you: answer emails, reset passwords, investigate purchases.</li>
        <li>To improve the game: aggregated statistics such as which waters are popular or which pages new players arrive on. We do not sell personal data.</li>
      </UL>

      <H2 id="legal-basis">6. Legal bases (EEA / UK visitors)</H2>
      <p>Where the GDPR or UK GDPR applies we process data on the basis of: performance of a contract (providing the game you asked to play), our legitimate interests (security, anti-cheat, understanding traffic), your consent (advertising cookies, optional email, push notifications), and legal obligations (keeping purchase records).</p>

      <H2 id="retention">7. Data retention</H2>
      <p>Game accounts and their history are kept for as long as the account exists, because a persistent world depends on it. Unclaimed guest accounts are removed automatically after a period of inactivity. Server and security logs are kept for a limited time. Purchase records are kept as long as required by tax and accounting law.</p>

      <H2 id="rights">8. Your rights and choices</H2>
      <UL>
        <li>You can view and change your angler name, email, password, avatar and preferences in the game at any time.</li>
        <li>You may ask us for a copy of the personal data we hold about you, to correct it, or to delete your account and its personal data. Email <Mail /> from the address on the account, or message us from inside the game.</li>
        <li>You can withdraw consent for advertising cookies through the consent message, and for push notifications through your browser.</li>
        <li>If you are in the EEA or UK you also have the right to object to certain processing and to lodge a complaint with your local data-protection authority.</li>
      </UL>

      <H2 id="children">9. Children</H2>
      <p>FishyLand is intended for players aged 13 and over. We do not knowingly collect personal information from children under 13. If you believe a child has created an account, contact us at <Mail /> and we will remove it.</p>

      <H2 id="security">10. Security</H2>
      <p>All traffic is served over HTTPS. Passwords are hashed, never stored in plain text. Access to the game database is restricted to the operator. No system is perfectly secure, so please use a unique password and add an email address so you can recover your account.</p>

      <H2 id="transfers">11. International transfers</H2>
      <p>Our servers and service providers may be located outside your country, including in the United States. Where required we rely on standard contractual clauses or equivalent safeguards offered by those providers.</p>

      <H2 id="changes">12. Changes to this policy</H2>
      <p>We may update this policy as the game grows. The date at the top shows the latest revision; significant changes will be announced in the in-game news feed.</p>

      <H2 id="contact">13. Contact</H2>
      <p>Questions about privacy? Email <Mail /> or see the <Link to="/contact" className="text-[var(--gold)] hover:underline">Contact page</Link>.</p>
    </LegalLayout>
  );
}
