UPDATE "AppUser"
SET "role" = 'ADMIN_CUSTOMER', "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" = 'SALES';

UPDATE "AppUser"
SET "role" = 'ADMIN_PRODUCTION', "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" = 'ADMIN';
