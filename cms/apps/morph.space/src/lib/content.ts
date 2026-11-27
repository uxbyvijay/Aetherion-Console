import type { Formation } from "../components/Morph";

﻿// ---------- Landing page ----------

export const pillars = [
  {
    title: "Your domain",
    text: "Pick the address your users will visit. Everything you set up lives there, under your name.",
  },
  {
    title: "Your tools",
    text: "Add the tools you want to offer and arrange them the way that makes sense for you.",
  },
  {
    title: "Your users",
    text: "Invite people in and share access. You decide who can use what.",
  },
];

export const steps = [
  {
    title: "Choose a domain",
    text: "Start with the address you want people to use.",
  },
  {
    title: "Set up your tools",
    text: "Add the tools you need and adjust them to fit the way you work.",
  },
  {
    title: "Share with your users",
    text: "Send an invite or a link so people can get started right away.",
  },
  {
    title: "Keep it running",
    text: "Add tools, change who has access and make updates whenever you need to.",
  },
];

export const features = [
  { title: "Bring your own domain", text: "Use an address that is yours, so people always know where they are." },
  { title: "Add tools as you go", text: "Start with one tool and add more later. Rearrange them or take them away whenever you like." },
  { title: "Control who gets in", text: "Give each person the tools they need, and nothing more." },
  { title: "Share with a link", text: "Send one link and your users can get started straight away." },
  { title: "One place to manage", text: "See your tools, your users and your settings together." },
  { title: "Yours to run", text: "You decide what you offer and who it is for." },
];

// ---------- How it works page ----------

export const missionIntro = [
  "The traditional Web connects pages. The Real Time Web connects intelligence, services, and the physical world.",
  "Morph Space is your private gateway to the Real Time Web, a network built for connected services, devices, and AI agents.",
];

/** The message that opens the FAQ section. */
export const gateway = {
  title: "Your Space. Your Data. Your Network.",
  text: "Create your own private space on the Real Time Web. Protect and share your data, define your service addresses, and build a network where applications, devices, and AI agents connect and transform information into new possibilities.",
  tagline: "Create Your Space. Connect Your World.",
  buttonLabel: "Create Your Space",
  secondaryLabel: "Explore Synx Tools",
  secondaryUrl: "https://synx.tools",
};

/** How Morph Space is described: a personal network infrastructure, not a file-sharing service. */
export const positioning = {
  title: "Morph Space — Your Personal Network Infrastructure",
  summary: "Morph Space gives you the freedom to create and control your own digital environment. Design your network architecture, establish addresses for your services, protect and share your data, and transform information into new contexts.",
  detail: "Powered by Real Time Web, Morph Space connects your data, applications, devices, and AI agents in a distributed network — on your terms.",
};

/** From idea to live service. */
export const creatorPath = [
  { title: "Pick your space", text: "Choose a plan and a domain: your corner of the Real Time Web." },
  { title: "Bring a resource", text: "A camera feed, a price list, a trained model. Anything that produces something useful." },
  { title: "Shape it into a service", text: "It becomes a Morphic Service, with an address people and AI agents can reach." },
  { title: "Let it travel", text: "Others build on it. It stays yours wherever it goes." },
];

/** Chapters of the How it works story; the sticky point cloud re-forms into `formation` as each one scrolls into view. */
export const storyChapters: {
  id: string;
  title: string;
  formation: Formation;
  body: string[];
}[] = [
  {
    id: "new-visitors",
    title: "Your next visitor may not have eyes",
    formation: "sphere",
    body: [
      "AI agents don't scroll or click around. They arrive with a task, look for a service that can handle it, use it and move on.",
      "For them a clear address and a predictable format count for more than a beautiful homepage. Morph Space gives every service both from day one.",
    ],
  },
  {
    id: "sensor-to-app",
    title: "From a sensor to an app, in three services",
    formation: "network",
    body: [
      "Your IoT sensor runs as a device service in your domain, and every unit you make has its own ghost ID: its address on the network.",
      "A temperature service links to it and morphs the readings to fit, say from Fahrenheit to Celsius. Your mobile app links to that. Readings flow peer to peer, but only when the same person owns both ends.",
    ],
  },
  {
    id: "ownership",
    title: "Your data stays at its source",
    formation: "cube",
    body: [
      "Connected services subscribe to the data they need and get updates when something changes. The data itself stays where it started.",
      "You decide what to share, with whom and on which terms. Synx Pass sets who or what may reach your resources.",
    ],
  },
];

// ---------- Features page ----------

/** What a creator gets, each with the point-cloud formation shown on its card. */
export const featureList: { title: string; text: string; formation: Formation }[] = [
  { title: "Your own domain", text: "Register a Morph Space domain and get your own address on the Real Time Web.", formation: "sphere" },
  { title: "Synx developer tools", text: "Use the Synx toolkit to create, connect and manage everything you publish.", formation: "grid" },
  { title: "Morphic Services", text: "Turn a machine, an IoT device, a dataset or an AI model into a service others can use.", formation: "cube" },
  { title: "An address for every service", text: "Each service you publish can be found and reached directly on the Real Time Web.", formation: "ring" },
  { title: "Connect data and intelligence", text: "Chain your services with other sources and AI layers to build something bigger together.", formation: "network" },
  { title: "Found by AI agents", text: "Made for agents that look for working services to reuse, as well as for people.", formation: "wave" },
];

/** What Morph Space gives you, beyond a private server. */
export const ownership = [
  { stat: "Ownership", title: "Yours to control", text: "Your own private infrastructure, domains, services, and access control." },
  { stat: "Connectivity", title: "Part of a network", text: "Take part in a distributed network where machines, applications, and AI agents communicate through the Real Time Web." },
  { stat: "Autonomy", title: "Less central, more yours", text: "Create and operate intelligent services that work with live data, with less dependence on centralized applications." },
];

export const morphFaqs = [
  {
    q: "What is Morph Space?",
    a: "Morph Space is your private gateway to the Real Time Web (RTW), a new network architecture designed for connected services, devices, and AI agents. With your own private server, you can create and manage RTW domains, deploy services, and connect data sources using Synx Tools. It gives you the infrastructure to build and operate your own digital ecosystem without relying on traditional centralized platforms.",
  },
  {
    q: "How is Morph Space different from traditional cloud hosting?",
    a: "Traditional cloud platforms rely on centralized servers, databases, and APIs to exchange information between applications. Built on Real Time Web technology, Morph Space lets services discover each other, communicate directly, and subscribe to live data changes. Instead of continuously asking a central system for information, connected services receive updates when something changes. That means more efficient communication, greater autonomy, and a distributed architecture where data can stay at its source.",
  },
  {
    q: "What can I build with Morph Space?",
    a: "Everything from simple applications to autonomous AI ecosystems. You can create AI agents that work with live data, connect IoT devices, automate processes, integrate existing systems, and develop services that communicate across organizational and technical boundaries. With Synx Tools you manage domains, identities, permissions, and network resources, and stay in control of how your services interact.",
  },
  {
    q: "Do I own and control my data and services?",
    a: "Yes. Morph Space is designed around the principle that you keep ownership and control of your digital resources. Your private server is where you manage your RTW domains, services, identities, and access permissions, and with Synx Pass you define who or what is authorized to reach your resources. Data can remain at its original source while authorized services subscribe to the information they need. You decide what to share, with whom, and under which conditions.",
  },
  {
    q: "Do I need programming skills to use Morph Space?",
    a: "No, though Morph Space is built for developers, innovators, businesses, and anyone interested in connected digital services. Developers can use Synx Tools to manage their infrastructure directly. With Skalle AI, our AI-powered interface, the goal is to let you create, configure, and administer services in natural language, so that building digital infrastructure is as simple as describing what you want to achieve.",
  },
  {
    q: "Can my Morph Space services communicate with other Morph Space users?",
    a: "Absolutely. That's one of the fundamental ideas behind the Real Time Web. Your private Morph Space isn't an isolated environment: it can become part of a growing distributed network where domains, services, devices, and AI agents discover and interact with one another, subject to authorization and access permissions. As more participants join, new opportunities open up for collaboration, automation, and eventually a global marketplace where data and digital services are exchanged directly between their owners.",
  },
  {
    q: "How many services can sit between a data source and its user?",
    a: "As many as you need. There is no limit to the number of intermediaries, or context changes, in a linking path. When services link across different private Morph Spaces there is a little extra delay, because the data follows the linking path. Everything still happens in real time, but there is always some network latency between spaces. If most of your services live in one space, latency is limited to internal read and write cycles in memory.",
  },
];

// ---------- Contact page ----------

/** A form field that only some topics ask for. `plan` renders a plan picker. */
export type TopicField = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "url" | "plan" | "file";
  autoComplete?: string;
  /** file fields: accepted types and size limit in MB */
  accept?: string;
  maxMb?: number;
};

export type ContactTopic = { title: string; text: string; message: string; fields: TopicField[] };

/** Contact topics. Name, email and message are always asked; `fields` are the extra ones for that topic. */
export const contactTopics: ContactTopic[] = [
  {
    title: "Support",
    text: "Help with your space, domain or services.",
    message: "What do you need help with?",
    fields: [
      { name: "domain", label: "Your domain", placeholder: "e.g. yourname.com", autoComplete: "url" },
      { name: "plan", label: "Plan", type: "plan" },
    ],
  },
  {
    title: "Partners",
    text: "Build or integrate with Morph Space.",
    message: "How would you like to work together?",
    fields: [
      { name: "company", label: "Company", placeholder: "Company name", required: true, autoComplete: "organization" },
      { name: "website", label: "Website", placeholder: "https://", type: "url", autoComplete: "url" },
    ],
  },
  {
    title: "Investors",
    text: "Talk to us about the Real Time Web.",
    message: "Tell us about your fund and what interests you",
    fields: [
      { name: "firm", label: "Firm or fund", placeholder: "Firm name", required: true, autoComplete: "organization" },
      { name: "website", label: "Website or LinkedIn", placeholder: "https://", type: "url", autoComplete: "url" },
    ],
  },
  {
    title: "Careers",
    text: "Come and build Morph Space with us.",
    message: "Tell us a little about yourself",
    fields: [
      { name: "role", label: "Role you're interested in", placeholder: "e.g. Frontend engineer", required: true },
      { name: "profile", label: "LinkedIn or portfolio", placeholder: "https://", type: "url", autoComplete: "url" },
      { name: "resume", label: "Resume", type: "file", required: true, accept: ".pdf,.doc,.docx", maxMb: 5 },
    ],
  },
];

export const communityLinks = [
  { title: "Documentation", text: "Guides and references for every Synx tool.", href: "https://synx.tools/tools" },
  { title: "Discord", text: "Ask questions and meet other builders.", href: "https://discord.com/invite/Jdr4HsET7B" },
];

// ---------- Pricing ----------

export type Period = "monthly" | "yearly";
export const periods: { id: Period; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Annual" },
];

/** Percent saved when paying annually (shown next to the toggle and applied to every paid plan). */
export let ANNUAL_SAVING = 10;
/** Lets the CMS change the yearly saving (importers see the new value). */
export const setAnnualSaving = (n: number) => {
  ANNUAL_SAVING = n;
};

export type Plan = {
  id: string;
  name: string;
  /** USD per month. 0 = free, null = priced on request. */
  monthly: number | null;
  specs: string[];
  popular?: boolean;
};

export const plans: Plan[] = [
  {
    id: "shared",
    name: "Shared",
    monthly: 0,
    specs: ["Shared space", "Ghost management", "User access RTW", "Community support"],
  },
  {
    id: "creator",
    name: "Creator Space",
    monthly: 81.63,
    specs: [
      "Private Morph Space",
      "2 vCPU · 8 GB RAM",
      "100 GB of Ghost",
      "8 TB bandwidth",
      "Access to Synx DNS, Synx BIOS, Synx Skalle, GitHub, Support",
      "Community support",
    ],
  },
  {
    id: "entrepreneur",
    name: "Entrepreneur Space",
    popular: true,
    monthly: 143.3,
    specs: [
      "Private Morph Space",
      "4 vCPU · 16 GB RAM",
      "200 GB of Ghost",
      "16 TB bandwidth",
      "Access to Synx DNS, Synx BIOS, Synx Skalle, GitHub, Support",
      "Custom domain support",
      "Community support",
    ],
  },
  {
    id: "tycoon",
    name: "Tycoon Space",
    monthly: 246.63,
    specs: [
      "Private Morph Space",
      "8 vCPU · 32 GB RAM",
      "400 GB of Ghost",
      "32 TB bandwidth",
      "Access to Synx DNS, Synx BIOS, Synx Skalle, GitHub, Support",
      "Dedicated resources",
      "Public IP address",
      "Priority support",
    ],
  },
  {
    id: "matrix",
    name: "Matrix Space",
    monthly: null,
    specs: [
      "Private Morph Space",
      "Unlimited hardware",
      "Public IP addresses",
      "White-label branding",
      "Dedicated manager",
      "Custom SLA",
      "Custom pricing",
    ],
  },
];

export const faqs = [
  {
    q: "Which plan should I start with?",
    a: "Start with Shared for free. When you need your own private Morph Space, move up to Creator Space.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes. Custom domain support is included in Entrepreneur Space.",
  },
  {
    q: "What does Matrix Space include?",
    a: "Your own private Morph Space with public IP addresses, white-label branding, a dedicated manager, a custom SLA, unlimited hardware and custom pricing. Get in touch and we’ll put together pricing for you.",
  },
  {
    q: "Is Morph Space just a hosting plan?",
    a: "No. It's more than a private server. You get your own infrastructure, domains, services, and access control (ownership), a way to take part in a network where machines, applications, and AI agents communicate (connectivity), and the ability to run intelligent services on live data (autonomy).",
  },
  {
    q: "How does annual billing work?",
    a: "Paying annually saves you 10% compared with paying monthly. Prices are shown per month in US dollars and exclude taxes. You can pick another currency above the plans to see an approximate conversion.",
  },
];

/** Where the Login button goes. PLACEHOLDER: point this at the real sign-in page. */
export const LOGIN_URL = "#";
