-- Jabatan pemakai roster bersifat opsional. Bila tidak ada satu pun baris yang
-- mengisinya, kolom ini tidak dicetak pada PDF PO.
ALTER TABLE "PurchaseOrderRosterEntry" ADD COLUMN "jabatan" VARCHAR(80);
