/**
 * Post-burn survey definition — single source of truth for question keys,
 * labels, and answer shapes. Shared by the wizard (client), the server action
 * (validation), and the results page (aggregation).
 *
 * Answers are stored as JSON on `burn_surveys.answers`, keyed by `key`.
 */

export const SURVEY_YEAR = 2026;

/**
 * "Sensitive" text answers (naming individuals) are never attributed to the
 * respondent and only appear in results once this many campers have
 * responded, so early answers can't be traced back to whoever just submitted.
 */
export const SENSITIVE_MIN_RESPONSES = 10;

export type ScaleQuestion = {
  kind: "scale";
  key: string;
  label: string;
  hint?: string;
  /** Labels for the 1 and 5 ends of the scale. */
  low: string;
  high: string;
  required?: boolean;
};

export type ChoiceQuestion = {
  kind: "choice";
  key: string;
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  /** Only show when another answer matches one of these values. */
  showIf?: { key: string; in: string[] };
  required?: boolean;
};

export type MultiQuestion = {
  kind: "multi";
  key: string;
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  required?: boolean;
};

export type TextQuestion = {
  kind: "text";
  key: string;
  label: string;
  hint?: string;
  placeholder?: string;
  showIf?: { key: string; in: string[] };
  /** Always anonymous + threshold-gated in results (see SENSITIVE_MIN_RESPONSES). */
  sensitive?: boolean;
  required?: boolean;
};

export type SurveyQuestion =
  | ScaleQuestion
  | ChoiceQuestion
  | MultiQuestion
  | TextQuestion;

export type SurveySection = {
  key: string;
  title: string;
  blurb: string;
  questions: SurveyQuestion[];
};

const SUPPORT_OPTIONS = [
  { value: "strongly_support", label: "Strongly support" },
  { value: "support", label: "Support" },
  { value: "unsure", label: "Unsure" },
  { value: "against", label: "Against" },
];

export const SURVEY_SECTIONS: SurveySection[] = [
  {
    key: "overall",
    title: "The big picture",
    blurb: "Dust's settled. How was it?",
    questions: [
      {
        kind: "scale",
        key: "overall",
        label: "Overall, how was NODE 2026 for you?",
        low: "Rough",
        high: "Best burn yet",
        required: true,
      },
      {
        kind: "choice",
        key: "returning",
        label: "Are you coming back for NODE 2027?",
        options: [
          { value: "hell_yes", label: "Hell yes" },
          { value: "probably", label: "Probably" },
          { value: "not_sure", label: "Not sure yet" },
          { value: "probably_not", label: "Probably not" },
          { value: "no", label: "No" },
        ],
        required: true,
      },
      {
        kind: "text",
        key: "highlight",
        label: "Highlight of your week?",
        placeholder: "A moment, a shift, a sunrise…",
      },
      {
        kind: "text",
        key: "lowlight",
        label: "Lowlight of your week?",
        placeholder: "The thing you'd erase",
      },
      {
        kind: "text",
        key: "person_highlight",
        label: "Someone who made your burn — who, and why?",
        hint: `Always anonymous. Only visible to admins once ${SENSITIVE_MIN_RESPONSES}+ campers have responded.`,
        placeholder: "Give them their flowers",
        sensitive: true,
      },
      {
        kind: "text",
        key: "person_lowlight",
        label: "Someone who made it harder — who, and what happened?",
        hint: `Always anonymous. Only visible to admins once ${SENSITIVE_MIN_RESPONSES}+ campers have responded. Be honest, not cruel.`,
        placeholder: "This is how leads find out",
        sensitive: true,
      },
    ],
  },
  {
    key: "camp_life",
    title: "Camp life",
    blurb: "Rate the pieces. Skip anything you didn't experience.",
    questions: [
      {
        kind: "scale",
        key: "kitchen",
        label: "Kitchen & food",
        low: "Hungry",
        high: "CHOW TIME forever",
      },
      {
        kind: "scale",
        key: "bar",
        label: "Bar & events (Martini Therapy, Hip Hop BBQ…)",
        low: "Meh",
        high: "Legendary",
      },
      {
        kind: "scale",
        key: "infrastructure",
        label: "Shade, power, showers, structures",
        low: "Falling apart",
        high: "Dialed",
      },
      {
        kind: "scale",
        key: "vibe",
        label: "Camp vibe & community",
        low: "Cliquey",
        high: "Family",
      },
      {
        kind: "scale",
        key: "leadership",
        label: "Leadership & decision-making",
        low: "Chaotic",
        high: "Clear & fair",
      },
      {
        kind: "scale",
        key: "safety",
        label: "Did you feel safe and looked after?",
        low: "Not really",
        high: "Completely",
      },
      {
        kind: "text",
        key: "camp_life_notes",
        label: "Anything to add about camp life?",
        placeholder: "What worked, what didn't, what surprised you",
      },
    ],
  },
  {
    key: "jobs",
    title: "Jobs & strike",
    blurb: "The board, the shifts, the teardown.",
    questions: [
      {
        kind: "choice",
        key: "jobs_target",
        label: "The 50-point shift target felt…",
        options: [
          { value: "too_low", label: "Too low — I could do more" },
          { value: "about_right", label: "About right" },
          { value: "too_high", label: "Too high" },
        ],
      },
      {
        kind: "scale",
        key: "jobs_signup",
        label: "Signing up for shifts on the jobs board was…",
        low: "Confusing",
        high: "Easy",
      },
      {
        kind: "scale",
        key: "jobs_fairness",
        label: "The workload felt fairly shared across camp",
        low: "Disagree",
        high: "Agree",
      },
      {
        kind: "scale",
        key: "strike",
        label: "How did strike go?",
        low: "Painful",
        high: "Smooth",
      },
      {
        kind: "text",
        key: "jobs_notes",
        label: "Best shift, worst shift, what would you change?",
        placeholder: "Be specific — leads read these",
      },
    ],
  },
  {
    key: "before",
    title: "Before the burn",
    blurb: "Planning, money, logistics, this website.",
    questions: [
      {
        kind: "scale",
        key: "comms_before",
        label: "Communication before the burn (emails, messages, updates)",
        low: "In the dark",
        high: "Always knew what was up",
      },
      {
        kind: "scale",
        key: "dashboard",
        label: "The NODE dashboard (payments, jobs, dates, this site)",
        low: "Frustrating",
        high: "Smooth",
      },
      {
        kind: "scale",
        key: "arrival",
        label: "Arrival process (SAP passes, Reno rides, getting to camp)",
        low: "Stressful",
        high: "Seamless",
      },
      {
        kind: "choice",
        key: "dues_value",
        label: "For what you got, dues felt like…",
        options: [
          { value: "great_value", label: "Great value" },
          { value: "fair", label: "Fair" },
          { value: "a_stretch", label: "A stretch" },
          { value: "too_much", label: "Too much" },
        ],
      },
      {
        kind: "choice",
        key: "storage_next",
        label: "Planning to keep gear in NODE storage for 2027?",
        options: [
          { value: "yes", label: "Yes" },
          { value: "not_sure", label: "Not sure" },
          { value: "no", label: "No" },
        ],
      },
      {
        kind: "text",
        key: "before_notes",
        label: "Anything about the lead-up we should know?",
        placeholder: "Timing, cost, info you wish you'd had",
      },
    ],
  },
  {
    key: "future",
    title: "NODE 2027",
    blurb:
      "NODE 2027 might not look like 2026. We're weighing real changes to how the camp works and who it's for. Nothing's decided — this is where you weigh in.",
    questions: [
      {
        kind: "scale",
        key: "give_take",
        label: "Honest self-check: this year, how much did you put in vs. take out?",
        low: "Mostly took",
        high: "Mostly gave",
      },
      {
        kind: "choice",
        key: "direction",
        label: "Where should NODE go in 2027?",
        options: [
          { value: "as_is", label: "Keep it as it is" },
          { value: "higher_bar", label: "Same size, higher bar for participation" },
          { value: "smaller", label: "Smaller and participants-only" },
          { value: "grow_workers", label: "Grow — but only with people who work" },
        ],
      },
      {
        kind: "choice",
        key: "deposit",
        label:
          "A refundable work deposit — paid on top of dues, returned when you finish your shifts (or split among those who covered for no-shows). Would you support it?",
        options: SUPPORT_OPTIONS,
      },
      {
        kind: "choice",
        key: "deposit_amount",
        label: "What deposit amount feels right?",
        options: [
          { value: "150", label: "$150" },
          { value: "300", label: "$300" },
          { value: "500", label: "$500" },
          { value: "1000", label: "$1,000" },
        ],
        showIf: { key: "deposit", in: ["strongly_support", "support", "unsure"] },
      },
      {
        kind: "choice",
        key: "dues_by_work",
        label:
          "Dues tied to contribution — leads, build crew, and strike-to-the-end campers pay less; lighter participation pays more.",
        options: SUPPORT_OPTIONS,
      },
      {
        kind: "multi",
        key: "no_show_consequence",
        label: "Campers who skip their shifts should…",
        hint: "Pick all you'd stand behind.",
        options: [
          { value: "lose_deposit", label: "Lose their deposit" },
          { value: "not_invited", label: "Not be invited back" },
          { value: "pay_more", label: "Pay higher dues next year" },
          { value: "talk_to_leads", label: "Have a conversation with leads" },
          { value: "nothing", label: "Nothing — life happens on playa" },
        ],
      },
      {
        kind: "multi",
        key: "commit_2027",
        label: "What would you personally commit to for 2027?",
        hint: "Only pick what you'd actually do.",
        options: [
          { value: "lead", label: "Lead a team" },
          { value: "build", label: "Build week (early arrival)" },
          { value: "strike_full", label: "Strike through the last day" },
          { value: "preburn", label: "Pre-burn work (planning, fabrication, fundraising)" },
          { value: "event", label: "Run an event or a bar shift" },
          { value: "mentor", label: "Mentor new campers" },
          { value: "art", label: "Bring an art piece or interactive" },
          { value: "recruit", label: "Recruit someone who works" },
        ],
      },
      {
        kind: "text",
        key: "plug_and_play",
        label: "Where does NODE risk being plug-and-play, and what would fix it?",
        placeholder: "Name the fat. Propose the cut.",
      },
    ],
  },
  {
    key: "last",
    title: "Last words",
    blurb: "Almost done.",
    questions: [
      {
        kind: "text",
        key: "change_one",
        label: "One thing we should change for 2027",
        placeholder: "Big or small",
      },
      {
        kind: "text",
        key: "keep_one",
        label: "One thing we should never change",
        placeholder: "The sacred stuff",
      },
      {
        kind: "choice",
        key: "lead_interest",
        label: "Want to step up into a lead role in 2027?",
        options: [
          { value: "yes", label: "Yes, sign me up" },
          { value: "maybe", label: "Maybe — tell me more" },
          { value: "no", label: "Not this year" },
        ],
      },
      {
        kind: "text",
        key: "lead_area",
        label: "What area would you want to lead?",
        placeholder: "Kitchen, bar, build, art, power, rides, something new…",
        showIf: { key: "lead_interest", in: ["yes", "maybe"] },
      },
      {
        kind: "text",
        key: "private_note",
        label: "Anything for leadership only?",
        hint: "Only admins see survey answers; this one is for the hard stuff.",
        placeholder: "Concerns, conflicts, things you'd rather not say in a group",
      },
    ],
  },
];

export const ALL_QUESTIONS: SurveyQuestion[] = SURVEY_SECTIONS.flatMap(
  (s) => s.questions
);

export const SENSITIVE_KEYS: string[] = ALL_QUESTIONS.filter(
  (q) => q.kind === "text" && q.sensitive
).map((q) => q.key);

export function findQuestion(key: string): SurveyQuestion | undefined {
  return ALL_QUESTIONS.find((q) => q.key === key);
}

/** One answer value as stored in `burn_surveys.answers`. */
export type SurveyAnswerValue = number | string | string[] | null | undefined;
/** Raw answers map as stored in `burn_surveys.answers`. */
export type SurveyAnswers = Record<string, SurveyAnswerValue>;

export function isQuestionVisible(
  q: SurveyQuestion,
  answers: SurveyAnswers
): boolean {
  if ((q.kind !== "text" && q.kind !== "choice") || !q.showIf) return true;
  const v = answers[q.showIf.key];
  return typeof v === "string" && q.showIf.in.includes(v);
}
