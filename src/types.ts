export type AnswerValue = string | number | boolean | string[];
export type AnswerSource = 'user' | 'default' | 'inferred';

export interface StoredAnswer {
  value: AnswerValue;
  source: AnswerSource;
  at: string;
}

export interface StoredSection {
  content: string;
  /** 'computed' | 'host' | 'sampling' | '<provider>:<model>' */
  generatedBy: string;
  answersVersion: number;
  updatedAt: string;
  /** validation problems that remained after retries (section was stored anyway) */
  warnings?: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  answers: Record<string, StoredAnswer>;
  /** optional questions the user chose to skip */
  skipped: string[];
  /** incremented whenever an answer value changes; used to detect stale sections */
  answersVersion: number;
  sections: Record<string, StoredSection>;
  /** set when the user declined popup forms, so we stay in chat mode */
  uiMode?: 'chat';
}
