-- Normalize legacy approval status values
UPDATE "TaskColumnApproval" SET "status" = 'approved' WHERE "status" = 'approve';
UPDATE "TaskColumnApproval" SET "status" = 'rejected' WHERE "status" = 'reject';
