-- Extend users role enum and add superadmin-specific fields.
ALTER TABLE `users`
  MODIFY `role` ENUM('user', 'admin', 'owner', 'manager', 'superadmin') NOT NULL DEFAULT 'user',
  ADD COLUMN `isSuperadmin` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `superadminSince` DATETIME(3) NULL,
  ADD COLUMN `superadminLastAt` DATETIME(3) NULL;
