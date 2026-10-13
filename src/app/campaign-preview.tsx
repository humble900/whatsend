"use client";

import { useState } from "react";
import { CheckCheck } from "lucide-react";
import s from "./landing-styles";

const examples = [
  { label: "Special offer", name: "Weekend sale", list: "Audience: Returning customers", message: "Hi Alex, our summer collection is 20% off until Sunday. Browse the collection at shop.example/summer. Reply if you need help with sizing.", reply: "Is the linen shirt available in medium?", answer: "Yes, it is. Would you like the product link?" },
  { label: "New product", name: "Product launch", list: "Audience: Product updates list", message: "Hi Alex, the linen shirts you asked about are now available. See the new colors at shop.example/linen. Which color are you looking for?", reply: "Do you have it in navy?", answer: "Yes. I can send you the link to the navy shirt." },
  { label: "Event invite", name: "Store launch", list: "Audience: Local customers", message: "Hi Alex, our new store opens this Friday at 6 pm. You’re invited to see the collection and meet the team. Would you like the address?", reply: "Yes, please send the address.", answer: "We’re at 24 Market Street. See you on Friday." },
];

export default function CampaignPreview() {
  const [active, setActive] = useState(0);
  const example = examples[active];
  return (
    <div className={s.previewWrap}>
      <div className={s.preview}>
        <div className={s.previewBody}>
          <div className={s.previewTitle}><div><span>Campaign example</span><h3>{example.name}</h3></div></div>
          <div className={s.demoTabs} role="group" aria-label="Choose a campaign example">
            {examples.map((item, i) => <button key={item.label} aria-pressed={active === i} onClick={() => setActive(i)} className={active === i ? s.activeTab : undefined}>{item.label}</button>)}
          </div>
          <p className="ws-demoAudience">{example.list}</p>
          <div className={s.chat} aria-live="polite" aria-atomic="true">
            <div className={s.message}><p>{example.message}</p><span className={s.messageTime}>10:42 <CheckCheck size={15} /></span></div>
            <div className={s.reply}>{example.reply}<span>10:43</span></div>
            <div className={s.message}><p>{example.answer}</p><span className={s.messageTime}>10:44 <CheckCheck size={15} /></span></div>
          </div>
        </div>
      </div>
      <p className="ws-demoCaption">Example messages. No messages are sent from this preview.</p>
    </div>
  );
}
