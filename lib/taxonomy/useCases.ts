export const USE_CASES = [
  {
    id: "missed_calls",
    reason: "answering calls and messages when you're busy",
    label: "Answer calls and messages when I'm busy",
    short: "Missed calls",
    description:
      "AI receptionist, missed-call text back, voicemail answering, taking phone or takeout orders when staff can't pick up.",
  },
  {
    id: "booking_waitlist",
    reason: "managing bookings and your line",
    label: "Manage bookings and my line",
    short: "Bookings",
    description:
      "Online booking, appointment reminders, reservations, waitlists and walk-in queues.",
  },
  {
    id: "auto_replies",
    reason: "answering common questions, reviews and messages",
    label: "Answer the same questions for me (reviews, DMs, email)",
    short: "Auto replies",
    description:
      "Replying to reviews, social media DMs, website chat and email with AI-written answers.",
  },
  {
    id: "customer_list",
    reason: "organizing your customer list",
    label: "Clean up and organize my customer list",
    short: "Customer list",
    description:
      "Simple CRM, contact management, merging scattered customer info from spreadsheets, paper and email.",
  },
  {
    id: "win_back",
    reason: "bringing back customers who stopped coming",
    label: "Bring back customers who stopped coming",
    short: "Win back",
    description:
      "Automated email or text marketing, loyalty, reminders for repeat service (tune-ups, haircuts), re-engagement campaigns.",
  },
  {
    id: "scheduling_dispatch",
    reason: "scheduling jobs and crews",
    label: "Schedule jobs and crews",
    short: "Scheduling",
    description:
      "Field service scheduling, dispatching crews, routing, job tracking and quotes for trades.",
  },
] as const;

export type UseCaseId = (typeof USE_CASES)[number]["id"];
export const USE_CASE_IDS = USE_CASES.map((u) => u.id) as [UseCaseId, ...UseCaseId[]];
export const getUseCase = (id: string) => USE_CASES.find((u) => u.id === id);
