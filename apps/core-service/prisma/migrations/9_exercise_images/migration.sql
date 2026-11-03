-- CreateTable
CREATE TABLE "exercise_images" (
    "exerciseId" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "thumb" BYTEA NOT NULL,
    "thumbType" TEXT NOT NULL,
    "large" BYTEA NOT NULL,
    "largeType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_images_pkey" PRIMARY KEY ("exerciseId","slot")
);

-- AddForeignKey
ALTER TABLE "exercise_images" ADD CONSTRAINT "exercise_images_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

