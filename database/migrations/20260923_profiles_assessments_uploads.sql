ALTER TABLE teacher_profiles
  ADD COLUMN IF NOT EXISTS qualifications JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_qualifications_array') THEN
    ALTER TABLE teacher_profiles ADD CONSTRAINT teacher_qualifications_array
      CHECK (jsonb_typeof(qualifications) = 'array');
  END IF;
END $$;

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignment_attachments_array') THEN
    ALTER TABLE assignments ADD CONSTRAINT assignment_attachments_array
      CHECK (jsonb_typeof(attachments) = 'array');
  END IF;
END $$;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_data TEXT;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_type VARCHAR(100);
ALTER TABLE classroom_posts ADD COLUMN IF NOT EXISTS attachment_data TEXT;
ALTER TABLE classroom_posts ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);
ALTER TABLE classroom_posts ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(100);
