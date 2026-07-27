CREATE SEQUENCE IF NOT EXISTS donation_receipt_seq START 1;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS verification_token text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_donations_verification_token ON donations(verification_token) WHERE verification_token IS NOT NULL;
UPDATE donations
SET verification_token = encode(gen_random_bytes(24),'hex')
WHERE verification_token IS NULL;
ALTER TABLE donations ALTER COLUMN verification_token SET DEFAULT encode(gen_random_bytes(24),'hex');
CREATE INDEX IF NOT EXISTS idx_donations_receipt_status_created ON donations(receipt_number,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity_created ON audit_logs(entity_type,entity_id,created_at DESC);
DELETE FROM password_reset_codes WHERE expires_at < now() - interval '7 days' OR used_at IS NOT NULL AND used_at < now() - interval '7 days';
