-- Create tables

CREATE TABLE IF NOT EXISTS "Program" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Subject" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ProgramSubject" (
  "id" SERIAL PRIMARY KEY,
  "programId" INT NOT NULL,
  "subjectId" INT NOT NULL,
  "term" INT NOT NULL,
  CONSTRAINT "ProgramSubject_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgramSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgramSubject_program_subject_term_unique" UNIQUE ("programId","subjectId","term")
);

CREATE TABLE IF NOT EXISTS "Term" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate" TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS "Group" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "termId" INT NOT NULL,
  CONSTRAINT "Group_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "StudentProfile" (
  "id" SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "fullName" TEXT NOT NULL,
  "curp" TEXT,
  "phone" TEXT,
  "address" TEXT
);

CREATE TABLE IF NOT EXISTS "Enrollment" (
  "id" SERIAL PRIMARY KEY,
  "studentId" INT NOT NULL,
  "groupId" INT NOT NULL,
  CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Enrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Enrollment_student_group_unique" UNIQUE ("studentId","groupId")
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS "ProgramSubject_program_idx" ON "ProgramSubject"("programId");
CREATE INDEX IF NOT EXISTS "ProgramSubject_subject_idx" ON "ProgramSubject"("subjectId");
CREATE INDEX IF NOT EXISTS "Group_term_idx" ON "Group"("termId");
CREATE INDEX IF NOT EXISTS "Enrollment_student_idx" ON "Enrollment"("studentId");
CREATE INDEX IF NOT EXISTS "Enrollment_group_idx" ON "Enrollment"("groupId");
