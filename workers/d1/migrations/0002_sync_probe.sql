-- Ensure note column exists even if __ping existed from early testing
ALTER TABLE __ping ADD COLUMN note TEXT;
