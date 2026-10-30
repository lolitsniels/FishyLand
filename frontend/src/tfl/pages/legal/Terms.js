/*
 * Fishing Realms, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Link } from "react-router-dom";
import { LegalLayout, H2, UL, Mail } from "./LegalShared";

const UPDATED = "2026-09-22";

export default function Terms() {
  return (
    <LegalLayout slug="terms" title="Terms of Service" updated={UPDATED}
      description="The rules for playing Fishing Realms: accounts, fair play, virtual currency and purchases, user content, and what happens if the rules are broken.">
      <p>These Terms of Service ("Terms") are an agreement between you and the operator of Fishing Realms ("we", "us") covering your use of thefishinglands.com and the game it hosts (the "Service"). By creating an account, playing as a guest, or otherwise using the Service you agree to these Terms and to our <Link to="/privacy" className="text-[var(--gold)] hover:underline">Privacy Policy</Link>. If you do not agree, please do not use the Service.</p>

      <H2 id="eligibility">1. Eligibility</H2>
      <p>You must be at least 13 years old to play. If you are under the age of majority where you live, you confirm that a parent or guardian has reviewed and agreed to these Terms on your behalf. Purchases may only be made by adults or with a parent's or guardian's permission.</p>

      <H2 id="accounts">2. Your account</H2>
      <UL>
        <li>One angler per person. Creating or controlling multiple accounts to gain an advantage (extra energy, market manipulation, self-referrals, vote rewards, tournament entries) is not allowed.</li>
        <li>You are responsible for keeping your password secret and for everything done with your account. Add an email address so you can recover it; we cannot restore accounts we cannot verify.</li>
        <li>Angler names, crew names, pond signs and other visible text must not be offensive, impersonate staff or other players, or contain advertising.</li>
        <li>Accounts may not be sold, traded, shared or given away.</li>
      </UL>

      <H2 id="fair-play">3. Fair play</H2>
      <p>Fishing Realms is a shared world, so cheating harms every other player. You agree not to:</p>
      <UL>
        <li>use bots, macros, scripts, auto-clickers or any automation to cast, fight fish, trade or chat;</li>
        <li>exploit bugs, tamper with requests to the server, or interfere with the tension-fight or duel verification;</li>
        <li>trade gold, Pearls, fish or items for real money outside the Service, or advertise such trades;</li>
        <li>harass, threaten, spam, scam or discriminate against other players, or post sexual, hateful or illegal content in chat, messages, crews or ponds;</li>
        <li>collect other players' data, or attempt to gain access to accounts or systems that are not yours.</li>
      </UL>
      <p>Fights, trades and rewards are validated on our servers. Actions that fail validation are rejected, and repeat offenders lose their accounts.</p>

      <H2 id="virtual">4. Virtual currency, items and purchases</H2>
      <UL>
        <li>Gold, Pearls, fish, tackle, titles, portraits, the Angler Pass and every other in-game item are <b>licensed, not sold</b>. They have no real-world value, cannot be exchanged for money, and remain our property. We may adjust, rebalance or remove them to keep the game healthy.</li>
        <li>Optional purchases are processed by Tebex or PayPal under their own terms. Prices include applicable taxes where required. You receive the item once payment clears.</li>
        <li>Because digital items are delivered immediately, purchases are <b>non-refundable</b> except where required by law or where the item was not delivered. Contact <Mail /> with your transaction reference and we will put it right.</li>
        <li>Chargebacks filed without first contacting us may result in the removal of the purchased items and suspension of the account.</li>
        <li>Rewards from voting sites and referrals are granted at our discretion and may be withheld where we detect fraud.</li>
      </UL>

      <H2 id="content">5. Your content</H2>
      <p>You keep ownership of the text you write in the game. You grant us a worldwide, royalty-free licence to store, display and reproduce it as part of running the Service (for example showing your chat message to other players or your crew description on a public profile). We may remove any content that breaks these Terms without notice.</p>

      <H2 id="ip">6. Our content</H2>
      <p>The game, its name, artwork, fish, worlds, text, code and design are protected by copyright and other laws and belong to the operator of Fishing Realms. You may not copy, scrape, redistribute or create derivative works from them without written permission. Screenshots and videos of your own gameplay for personal, non-commercial or review purposes are welcome.</p>

      <H2 id="ads">7. Advertising</H2>
      <p>The Service is free to play and supported by advertising, including ads served by Google AdSense. Ads are clearly separated from game content. Clicking your own ads repeatedly, encouraging others to click ads, or using tools that manipulate ad delivery is prohibited.</p>

      <H2 id="availability">8. Availability and changes</H2>
      <p>We work hard to keep the world online, but the Service is provided <b>"as is"</b> and <b>"as available"</b>. We may change, suspend or discontinue any feature, event, water, item or the whole Service at any time, including for maintenance, balance changes or if it becomes impractical to run. We do not guarantee that progress will never be lost, although we take regular backups.</p>

      <H2 id="termination">9. Suspension and termination</H2>
      <p>We may warn, mute, suspend or permanently ban accounts that break these Terms, at our discretion and without refund. You may stop playing and delete your account at any time by contacting us. Sections 4–6 and 10–12 survive termination.</p>

      <H2 id="liability">10. Disclaimer and limitation of liability</H2>
      <p>To the fullest extent permitted by law, we disclaim all warranties, express or implied, and will not be liable for any indirect, incidental, special or consequential damages, loss of data, loss of virtual items or loss of enjoyment arising from your use of the Service. Our total liability to you for any claim is limited to the amount you paid us in the twelve months before the claim, or €20 if you paid nothing. Nothing in these Terms limits rights that consumer law grants you and that cannot be waived.</p>

      <H2 id="links">11. Third-party links and services</H2>
      <p>The Service links to third parties such as Discord, toplist voting sites and payment processors. We are not responsible for their content or practices; their own terms apply.</p>

      <H2 id="changes">12. Changes to these Terms</H2>
      <p>We may update these Terms as the game evolves. The date at the top shows the latest version and significant changes will be announced in the in-game news. Continuing to play after a change means you accept the new Terms.</p>

      <H2 id="contact">13. Contact</H2>
      <p>Questions about these Terms? Email <Mail /> or visit the <Link to="/contact" className="text-[var(--gold)] hover:underline">Contact page</Link>.</p>
    </LegalLayout>
  );
}
