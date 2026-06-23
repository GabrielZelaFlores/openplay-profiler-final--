export interface QuestionInfo {
  label: string;
  stem: string;
  measure: string;
}

const QUESTIONS: Record<string, QuestionInfo> = {
  gdt_1: {
    label: "Difficulties controlling gaming activity",
    stem: "Please indicate how often the following issues occurred over the past 3 months.",
    measure: "Gaming Disorder Test",
  },
  gdt_2: {
    label: "Increasing priority to gaming over other life interests",
    stem: "Please indicate how often the following issues occurred over the past 3 months.",
    measure: "Gaming Disorder Test",
  },
  gdt_3: {
    label: "Continued gaming despite negative consequences",
    stem: "Please indicate how often the following issues occurred over the past 3 months.",
    measure: "Gaming Disorder Test",
  },
  gdt_4: {
    label: "Significant life problems due to gaming behavior",
    stem: "Please indicate how often the following issues occurred over the past 3 months.",
    measure: "Gaming Disorder Test",
  },
  promis_1: { label: "I felt worthless", stem: "In the past 7 days...", measure: "PROMIS Depression" },
  promis_2: { label: "I had nothing to look forward to", stem: "In the past 7 days...", measure: "PROMIS Depression" },
  promis_3: { label: "I felt helpless", stem: "In the past 7 days...", measure: "PROMIS Depression" },
  promis_4: { label: "I felt sad", stem: "In the past 7 days...", measure: "PROMIS Depression" },
  promis_5: { label: "I felt like a failure", stem: "In the past 7 days...", measure: "PROMIS Depression" },
  promis_6: { label: "I felt depressed", stem: "In the past 7 days...", measure: "PROMIS Depression" },
  promis_7: { label: "I felt unhappy", stem: "In the past 7 days...", measure: "PROMIS Depression" },
  promis_8: { label: "I felt hopeless", stem: "In the past 7 days...", measure: "PROMIS Depression" },
  wemwbs_1: { label: "Feeling optimistic about the future", stem: "Feelings and thoughts over the last 2 weeks.", measure: "WEMWBS" },
  wemwbs_2: { label: "Feeling relaxed", stem: "Feelings and thoughts over the last 2 weeks.", measure: "WEMWBS" },
  wemwbs_3: { label: "Thinking clearly", stem: "Feelings and thoughts over the last 2 weeks.", measure: "WEMWBS" },
  wemwbs_4: { label: "Feeling close to other people", stem: "Feelings and thoughts over the last 2 weeks.", measure: "WEMWBS" },
  wemwbs_5: { label: "Able to make up my own mind", stem: "Feelings and thoughts over the last 2 weeks.", measure: "WEMWBS" },
  wemwbs_6: { label: "Feeling useful", stem: "Feelings and thoughts over the last 2 weeks.", measure: "WEMWBS" },
  wemwbs_7: { label: "Dealing with problems well", stem: "Feelings and thoughts over the last 2 weeks.", measure: "WEMWBS" },
};

export function getQuestionInfo(column: string): QuestionInfo | null {
  const normalized = column.replace(/^bw_/, "").replace(/^intake_/, "");
  return QUESTIONS[normalized] ?? null;
}
