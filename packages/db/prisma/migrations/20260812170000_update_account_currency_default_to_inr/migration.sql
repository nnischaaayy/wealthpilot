-- Change the default currency for new accounts from USD to INR, matching
-- the app's actual user base. Existing rows are not touched by a DEFAULT
-- change; those are updated separately, not by this migration.
ALTER TABLE "accounts" ALTER COLUMN "currency" SET DEFAULT 'INR';
