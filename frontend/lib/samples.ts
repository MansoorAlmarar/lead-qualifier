import type { Lead } from "./schema";

// Fictional leads only.
export const SAMPLES: { label: string; lead: Lead }[] = [
  {
    label: "Strong lead",
    lead: {
      name: "Sara Khan",
      company: "Gulf Logistics LLC",
      role: "Operations Director",
      budget: "AED 40,000",
      need: "We want to automate invoice processing and customer email replies.",
      timeline: "Within 2 months",
      source: "LinkedIn referral",
      notes: "Currently three staff do this manually. Ready for a call this week.",
    },
  },
  {
    label: "Weak lead",
    lead: {
      name: "Omar",
      company: "",
      role: "Student",
      budget: "Free if possible",
      need: "Maybe a chatbot, not sure what for.",
      timeline: "Someday",
      source: "Cold DM",
      notes: "",
    },
  },
  {
    label: "Spam",
    lead: {
      name: "Best Deals Team",
      company: "Cheap SEO Ltd",
      role: "",
      budget: "",
      need: "We offer 10,000 backlinks for $5. Reply now for a special price!!!",
      timeline: "",
      source: "Contact form",
      notes: "",
    },
  },
];
