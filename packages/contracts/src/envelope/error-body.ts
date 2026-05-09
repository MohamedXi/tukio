export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface ErrorBody {
  type: string;
  title: string;
  detail: string;
  instance: string;
  tukioCode: string;
  issues?: ValidationIssue[];
}
