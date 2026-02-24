
-- contract_payments: add CASCADE
ALTER TABLE contract_payments DROP CONSTRAINT contract_payments_contract_id_fkey;
ALTER TABLE contract_payments ADD CONSTRAINT contract_payments_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES travel_contracts(id) ON DELETE CASCADE;

-- contract_service_travelers: add CASCADE
ALTER TABLE contract_service_travelers DROP CONSTRAINT contract_service_travelers_contract_id_fkey;
ALTER TABLE contract_service_travelers ADD CONSTRAINT contract_service_travelers_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES travel_contracts(id) ON DELETE CASCADE;

-- email_log: set NULL on delete
ALTER TABLE email_log DROP CONSTRAINT email_log_contract_id_fkey;
ALTER TABLE email_log ADD CONSTRAINT email_log_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES travel_contracts(id) ON DELETE SET NULL;

-- bank_notifications: set NULL on delete
ALTER TABLE bank_notifications DROP CONSTRAINT bank_notifications_matched_contract_id_fkey;
ALTER TABLE bank_notifications ADD CONSTRAINT bank_notifications_matched_contract_id_fkey
  FOREIGN KEY (matched_contract_id) REFERENCES travel_contracts(id) ON DELETE SET NULL;

-- notifications: set NULL on delete
ALTER TABLE notifications DROP CONSTRAINT notifications_contract_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES travel_contracts(id) ON DELETE SET NULL;

-- vouchers: set NULL on delete
ALTER TABLE vouchers DROP CONSTRAINT vouchers_contract_id_fkey;
ALTER TABLE vouchers ADD CONSTRAINT vouchers_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES travel_contracts(id) ON DELETE SET NULL;
