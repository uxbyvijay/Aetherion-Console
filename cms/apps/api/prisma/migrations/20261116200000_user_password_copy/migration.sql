-- An encrypted copy of a password an admin set, so admins can show it again
ALTER TABLE "User" ADD COLUMN "passwordCopy" TEXT;
