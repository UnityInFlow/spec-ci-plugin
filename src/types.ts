export interface ActionInputs {
  specFile: string;
  failOn: "errors" | "warnings" | "never";
  postComment: boolean;
  injectionScannerVersion: string;
}

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckResult {
  name: string;
  status: CheckStatus;
  details: string[];
}

export interface ScopeResult {
  compliant: boolean;
  declaredScope: string[];
  changedFiles: string[];
  outOfScope: string[];
}

export interface CriteriaMatch {
  criterion: string;
  matched: boolean;
  testFile?: string;
  testName?: string;
}

export interface ComplianceReport {
  specFile: string;
  checks: CheckResult[];
  scopeResult?: ScopeResult;
  criteriaMatches: CriteriaMatch[];
  overallStatus: CheckStatus;
}
