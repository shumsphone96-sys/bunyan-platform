-- READ ONLY. Not executed against production by this change.
-- Use a private authenticated console after securing a recoverable backup.
-- Do not publish output or database dumps to public GitHub/CI logs.
-- Missing tables/columns are a release blocker, not a reason to reset the database.
PRAGMA quick_check;
PRAGMA foreign_key_check;
SELECT name,type FROM sqlite_master WHERE type IN ('table','index') ORDER BY type,name;
PRAGMA table_info(applications);
PRAGMA table_info(members);
PRAGMA table_info(admins);
PRAGMA table_info(sessions);
PRAGMA table_info(club_staff_users);
PRAGMA table_info(club_staff_sessions);
SELECT COUNT(*) AS application_count FROM applications;
SELECT status,COUNT(*) AS count FROM applications GROUP BY status;
SELECT COUNT(*) AS member_count FROM members;
SELECT status,COUNT(*) AS count FROM members GROUP BY status;
SELECT COUNT(*) AS duplicate_application_links FROM (SELECT application_id FROM members WHERE application_id IS NOT NULL GROUP BY application_id HAVING COUNT(*)>1);
SELECT COUNT(*) AS duplicate_member_numbers FROM (SELECT member_no FROM members WHERE member_no IS NOT NULL AND member_no<>'' GROUP BY member_no HAVING COUNT(*)>1);
SELECT COUNT(*) AS approved_without_member FROM applications a WHERE a.status='approved' AND NOT EXISTS(SELECT 1 FROM members m WHERE m.application_id=a.id);
SELECT role,is_active,COUNT(*) AS count FROM club_staff_users GROUP BY role,is_active;
