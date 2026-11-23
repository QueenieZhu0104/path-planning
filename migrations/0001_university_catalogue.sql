CREATE TABLE IF NOT EXISTS universities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT,
  region TEXT,
  official_url TEXT,
  programs_json TEXT NOT NULL DEFAULT '[]',
  source_label TEXT NOT NULL,
  record_status TEXT NOT NULL,
  stored_review_date TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_universities_name ON universities(name);
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities(country);
