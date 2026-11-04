-- AlterEnum: adjustable dumbbells, a heavy handle plus plates (the handle is added to the
-- plates typed, like a barbell's bar). Fixed dumbbells keep the value "dumbbell".
ALTER TYPE "Equipment" ADD VALUE 'heavy_dumbbell' AFTER 'dumbbell';
