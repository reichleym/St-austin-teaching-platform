-- AlterTable
ALTER TABLE "User"
ADD COLUMN "inviteToken" TEXT,
ADD COLUMN "inviteExpires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteToken_key" ON "User"("inviteToken");
