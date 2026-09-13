UPDATE "Opportunity"
SET "isRepeatOrder" = true
WHERE "isRepeatOrder" = false
  AND "title" LIKE 'Repeat Order: %';
