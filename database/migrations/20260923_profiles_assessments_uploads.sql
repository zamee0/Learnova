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

CREATE OR REPLACE FUNCTION teacher_course_metrics(p_teacher_id INT)
RETURNS TABLE(course_count BIGINT, enrolled_students BIGINT, average_rating NUMERIC)
LANGUAGE SQL STABLE AS $$
    SELECT
        (SELECT COUNT(*) FROM courses c WHERE c.teacher_id = p_teacher_id),
        (SELECT COUNT(DISTINCT e.user_id) FROM enrollments e JOIN courses c ON c.id=e.course_id
          WHERE c.teacher_id=p_teacher_id AND e.status <> 'dropped'),
        COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2) FROM course_reviews r
                   JOIN courses c ON c.id=r.course_id WHERE c.teacher_id=p_teacher_id), 0)
$$;

CREATE OR REPLACE PROCEDURE publish_course_assignments(
    IN p_course_id INT,
    IN p_teacher_id INT,
    IN p_assignments JSONB,
    INOUT p_created JSONB DEFAULT '[]'::jsonb
)
LANGUAGE plpgsql AS $$
DECLARE
    item JSONB;
    created_row RECORD;
BEGIN
    IF p_assignments IS NULL OR jsonb_typeof(p_assignments) <> 'array' OR jsonb_array_length(p_assignments)=0 THEN
        RAISE EXCEPTION 'Assignments must be a non-empty JSON array' USING ERRCODE='22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM courses WHERE id=p_course_id AND teacher_id=p_teacher_id) THEN
        RAISE EXCEPTION 'Teacher does not own this course' USING ERRCODE='42501';
    END IF;
    p_created := COALESCE(p_created, '[]'::jsonb);
    FOR item IN SELECT value FROM jsonb_array_elements(p_assignments)
    LOOP
        INSERT INTO assignments (course_id,teacher_id,title,description,instructions,total_marks,deadline,attachments)
        VALUES (p_course_id,p_teacher_id,item->>'title',NULLIF(item->>'description',''),
                NULLIF(item->>'instructions',''),COALESCE((item->>'total_marks')::numeric,100),
                (item->>'deadline')::timestamptz,COALESCE(item->'attachments','[]'::jsonb))
        RETURNING id,title,deadline,total_marks INTO created_row;
        p_created := p_created || jsonb_build_array(jsonb_build_object(
            'id',created_row.id,'title',created_row.title,'deadline',created_row.deadline,'total_marks',created_row.total_marks));
    END LOOP;
END;
$$;
