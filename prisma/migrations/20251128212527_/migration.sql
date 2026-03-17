/*
  Warnings:

  - The primary key for the `bundle` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `bundle` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to drop the `bundle_products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_designs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `bundle_products` DROP FOREIGN KEY `bundle_products_bundleId_fkey`;

-- DropForeignKey
ALTER TABLE `bundle_products` DROP FOREIGN KEY `bundle_products_productId_fkey`;

-- DropForeignKey
ALTER TABLE `product_designs` DROP FOREIGN KEY `product_designs_designId_fkey`;

-- DropForeignKey
ALTER TABLE `product_designs` DROP FOREIGN KEY `product_designs_productId_fkey`;

-- DropIndex
DROP INDEX `locations_slug_idx` ON `locations`;

-- DropIndex
DROP INDEX `orders_status_idx` ON `orders`;

-- DropIndex
DROP INDEX `reviews_rating_idx` ON `reviews`;

-- AlterTable
ALTER TABLE `bundle` DROP PRIMARY KEY,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `product` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `reviews` MODIFY `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `setting` MODIFY `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `upsell` MODIFY `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- DropTable
DROP TABLE `bundle_products`;

-- DropTable
DROP TABLE `product_designs`;

-- CreateTable
CREATE TABLE `ProductDesign` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` VARCHAR(191) NOT NULL,
    `designId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ProductDesign_productId_designId_key`(`productId`, `designId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_cross_sells` (
    `productId` VARCHAR(191) NOT NULL,
    `crossSellId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`productId`, `crossSellId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_upsells` (
    `productId` VARCHAR(191) NOT NULL,
    `upsellId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`productId`, `upsellId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BundleProduct` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bundleId` INTEGER NOT NULL,
    `productId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `BundleProduct_bundleId_productId_key`(`bundleId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductDesign` ADD CONSTRAINT `ProductDesign_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductDesign` ADD CONSTRAINT `ProductDesign_designId_fkey` FOREIGN KEY (`designId`) REFERENCES `Design`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_cross_sells` ADD CONSTRAINT `product_cross_sells_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_cross_sells` ADD CONSTRAINT `product_cross_sells_crossSellId_fkey` FOREIGN KEY (`crossSellId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_upsells` ADD CONSTRAINT `product_upsells_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_upsells` ADD CONSTRAINT `product_upsells_upsellId_fkey` FOREIGN KEY (`upsellId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BundleProduct` ADD CONSTRAINT `BundleProduct_bundleId_fkey` FOREIGN KEY (`bundleId`) REFERENCES `Bundle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BundleProduct` ADD CONSTRAINT `BundleProduct_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
