export type Reading = {
  id: number;
  timestamp: string;
  mgDl: number;
  status: number;
  meal?: string;
};

export type Page = "overview" | "explore" | "readings" | "import" | "reports" | "settings";
