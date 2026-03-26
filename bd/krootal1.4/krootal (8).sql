-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : jeu. 26 mars 2026 à 20:09
-- Version du serveur : 10.4.32-MariaDB
-- Version de PHP : 8.1.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `krootal`
--

-- --------------------------------------------------------

--
-- Structure de la table `addonsetting`
--

CREATE TABLE `addonsetting` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `type` varchar(191) NOT NULL,
  `price` varchar(191) NOT NULL,
  `description` varchar(191) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `addonsetting`
--

INSERT INTO `addonsetting` (`id`, `name`, `type`, `price`, `description`, `active`, `createdAt`, `updatedAt`) VALUES
(1, 'API Access', 'Fixed', '79', 'Unlock full API access', 1, '2026-03-10 17:44:51.115', '2026-03-10 17:44:51.115');

-- --------------------------------------------------------

--
-- Structure de la table `adminusers`
--

CREATE TABLE `adminusers` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `roleId` int(11) NOT NULL,
  `twoFa` tinyint(1) DEFAULT 0,
  `lastLogin` datetime DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `affiliates`
--

CREATE TABLE `affiliates` (
  `id` char(36) NOT NULL,
  `userId` int(11) UNSIGNED DEFAULT NULL,
  `name` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `refCode` varchar(191) NOT NULL,
  `revenue` double NOT NULL DEFAULT 0,
  `stripeAccountId` varchar(191) DEFAULT NULL,
  `iban` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `affiliate_tracking`
--

CREATE TABLE `affiliate_tracking` (
  `id` char(36) NOT NULL,
  `affiliateId` varchar(191) NOT NULL,
  `orderId` varchar(191) DEFAULT NULL,
  `ip` varchar(191) DEFAULT NULL,
  `userAgent` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL,
  `adminId` int(10) UNSIGNED DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `target` varchar(255) DEFAULT NULL,
  `metadata` text DEFAULT NULL,
  `ip` varchar(50) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `adminId`, `action`, `target`, `metadata`, `ip`, `createdAt`) VALUES
(1, 1, 'Updated plan pricing', 'Pro Plan', 'price: $499 → $549', '192.168.1.45', '2026-02-26 14:30:12'),
(2, 2, 'Issued refund', 'INV-2026-0286', 'amount: $129.00', '10.0.0.12', '2026-02-26 13:15:44'),
(3, 1, 'Suspended account', 'PetPals Clinic', 'reason: non-payment', '192.168.1.45', '2026-02-26 11:42:08'),
(4, 3, 'Toggled feature flag', 'advanced_automation_v2', 'enabled: true', '172.16.0.8', '2026-02-25 16:20:33'),
(5, 1, 'Created API key', 'System', 'key: rv_live_...x4k2', '192.168.1.45', '2026-02-25 10:05:17');

-- --------------------------------------------------------

--
-- Structure de la table `bundle`
--

CREATE TABLE `bundle` (
  `id` int(11) NOT NULL,
  `title` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `bundleproduct`
--

CREATE TABLE `bundleproduct` (
  `id` int(11) NOT NULL,
  `bundleId` int(11) NOT NULL,
  `productId` varchar(191) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `card_type`
--

CREATE TABLE `card_type` (
  `id` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `color` varchar(20) NOT NULL DEFAULT '#6b7280',
  `image` text DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `card_type`
--

INSERT INTO `card_type` (`id`, `name`, `color`, `image`, `active`, `createdAt`, `updatedAt`) VALUES
('classic', 'Classic', '#6b7280', NULL, 1, '2026-03-14 12:35:57', '2026-03-14 12:35:57'),
('gold-edition', 'Gold Edition', '#F59E0B', '/uploads/card-types/gold.webp', 1, '2026-03-16 12:59:31', '2026-03-16 12:59:31'),
('metal', 'Metal', '#94a3b8', NULL, 1, '2026-03-14 12:35:57', '2026-03-14 12:35:57'),
('premium', 'Premium', '#f59e0b', NULL, 1, '2026-03-14 12:35:57', '2026-03-14 12:35:57'),
('transparent', 'Transparent', '#7dd3fc', NULL, 1, '2026-03-14 12:35:57', '2026-03-14 12:35:57');

-- --------------------------------------------------------

--
-- Structure de la table `card_type_price`
--

CREATE TABLE `card_type_price` (
  `id` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `cardTypeId` varchar(50) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `card_type_price`
--

INSERT INTO `card_type_price` (`id`, `productId`, `cardTypeId`, `price`) VALUES
(1, 3, 'classic', 0.00),
(2, 3, 'premium', 10.00),
(3, 3, 'metal', 25.00),
(4, 3, 'transparent', 15.00),
(5, 5, 'classic', 0.00),
(6, 5, 'premium', 10.00),
(7, 5, 'metal', 25.00),
(8, 5, 'transparent', 15.00),
(9, 6, 'classic', 0.00),
(10, 6, 'premium', 10.00),
(11, 6, 'metal', 25.00),
(12, 6, 'transparent', 15.00),
(13, 1, 'classic', 0.00),
(14, 1, 'premium', 12.00);

-- --------------------------------------------------------

--
-- Structure de la table `cart_items`
--

CREATE TABLE `cart_items` (
  `id` int(10) UNSIGNED NOT NULL,
  `userId` int(10) UNSIGNED NOT NULL,
  `companyId` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unitPrice` decimal(10,2) NOT NULL,
  `cardTypeId` varchar(50) DEFAULT NULL,
  `designId` int(10) UNSIGNED DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `packageTierId` int(11) DEFAULT NULL,
  `totalCards` int(11) NOT NULL DEFAULT 0,
  `lineTotal` decimal(10,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `click`
--

CREATE TABLE `click` (
  `id` varchar(191) NOT NULL,
  `affiliateId` varchar(191) NOT NULL,
  `ip` varchar(191) DEFAULT NULL,
  `userAgent` varchar(191) DEFAULT NULL,
  `referer` varchar(191) DEFAULT NULL,
  `cookie` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `companies`
--

CREATE TABLE `companies` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL COMMENT 'Nom du gérant ou contact principal',
  `vatNumber` varchar(50) DEFAULT NULL COMMENT 'Numéro de TVA Intracommunautaire',
  `tradeNumber` varchar(50) DEFAULT NULL COMMENT 'Numéro de Registre du Commerce (SIRET/RC)',
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `type` enum('direct','agency') DEFAULT 'direct',
  `planId` int(11) UNSIGNED DEFAULT NULL,
  `logo` varchar(255) DEFAULT NULL,
  `logoScale` int(11) DEFAULT 100,
  `primaryColor` varchar(7) DEFAULT '#E10600',
  `defaultLanguageId` int(11) UNSIGNED DEFAULT NULL,
  `captchaEnabled` tinyint(1) DEFAULT 0,
  `captchaSiteKey` varchar(255) DEFAULT NULL,
  `captchaSecret` varchar(255) DEFAULT NULL,
  `mapsEnabled` tinyint(1) DEFAULT 0,
  `mapsApiKey` varchar(255) DEFAULT NULL,
  `googleLink` varchar(255) DEFAULT NULL,
  `facebookLink` varchar(255) DEFAULT NULL,
  `yelpLink` varchar(255) DEFAULT NULL,
  `tripadvisorLink` varchar(255) DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `billingAmount` varchar(100) DEFAULT NULL,
  `billingDate` datetime DEFAULT NULL,
  `billingNextDate` datetime DEFAULT NULL,
  `mrr` int(10) NOT NULL DEFAULT 0,
  `apiUsageCount` int(10) NOT NULL DEFAULT 0,
  `status` enum('active','trial','suspended','cancelled') NOT NULL DEFAULT 'active',
  `googlePlaceId` varchar(255) DEFAULT NULL,
  `googleReviewUrl` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `companies`
--

INSERT INTO `companies` (`id`, `name`, `vatNumber`, `tradeNumber`, `email`, `phone`, `country`, `address`, `type`, `planId`, `logo`, `logoScale`, `primaryColor`, `defaultLanguageId`, `captchaEnabled`, `captchaSiteKey`, `captchaSecret`, `mapsEnabled`, `mapsApiKey`, `googleLink`, `facebookLink`, `yelpLink`, `tripadvisorLink`, `createdAt`, `updatedAt`, `billingAmount`, `billingDate`, `billingNextDate`, `mrr`, `apiUsageCount`, `status`, `googlePlaceId`, `googleReviewUrl`) VALUES
(1, 'John Doe', NULL, NULL, 'contact@redvanta.com', '+1 555 000-0000', 'United States', NULL, NULL, NULL, NULL, 100, '#E10600', NULL, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-13 17:53:26', '2026-03-13 17:53:26', NULL, NULL, NULL, 0, 0, 'active', NULL, NULL),
(5, 'Urban Bites NYC', 'US123456789', 'TRD-001', 'contact@urbanbites.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773774514000-64b3edd351783536.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-17 19:08:34', '2026-03-17 19:08:34', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(6, 'Urban NYC', 'US123456789', 'TRD-001', 'contact@test.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773775289560-09ed8f16f86c5e8a.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-17 19:21:30', '2026-03-17 19:21:30', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(7, 'rodrigue NYC', 'US123456789', 'TRD-001', 'contact@rodrigue.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773775894184-2855007b64b37787.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-17 19:31:34', '2026-03-17 19:31:34', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(8, 'aime NYC', 'US123456789', 'TRD-001', 'contact@aime.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773775946857-c0945b63998e5935.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-17 19:32:27', '2026-03-17 19:32:27', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(9, 'yaya NYC', 'US123456789', 'TRD-001', 'contact@yaya.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773776087493-2decaebc13d4f4fd.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-17 19:34:47', '2026-03-17 19:34:47', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(10, 'youyou NYC', 'US123456789', 'TRD-001', 'contact@youyou.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773776594335-87572e522c6efa0c.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-17 19:43:14', '2026-03-17 19:43:14', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(11, 'youpi NYC', 'US123456789', 'TRD-001', 'contact@youpi.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773776870574-abf8f7158815b3d0.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-17 19:47:50', '2026-03-17 19:47:50', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(12, 'yoble NYC', 'US123456789', 'TRD-001', 'contact@yoble.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773777042788-bbeb22a0c3be31bd.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-17 19:50:43', '2026-03-17 19:50:43', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(13, 'youi NYC', 'US123456789', 'TRD-001', 'contact@youi.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773777150992-b9886d52afceb925.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-17 19:52:31', '2026-03-17 19:52:31', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(14, 'hhh NYC', 'US123456789', 'TRD-001', 'contact@hhh.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773777430250-f8414eaf33ebc9d1.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-17 19:57:10', '2026-03-17 19:57:10', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(15, 'yvana NYC', 'US123456789', 'TRD-001', 'contact@yvana.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773837904249-0b710c16d6c03759.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-18 12:45:04', '2026-03-18 12:45:04', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(16, 'vana NYC', 'US123456789', 'TRD-001', 'contact@vana.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773838987127-83d3377bc78fbbdd.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-18 13:03:07', '2026-03-18 13:03:07', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(17, 'vanessa NYC', 'US123456789', 'TRD-001', 'contact@vanessa.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773840523121-083be600f0d9ccb4.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-18 13:28:43', '2026-03-18 13:28:43', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(18, 'niki NYC', 'US123456789', 'TRD-001', 'contact@niki.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773840668373-03f119df6e034612.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-18 13:31:08', '2026-03-18 13:31:08', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(19, 'nono NYC', 'US123456789', 'TRD-001', 'contact@nono.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773841317894-3640d3fe582df5de.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-18 13:41:58', '2026-03-18 13:41:58', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(20, 'brayn NYC', 'US123456789', 'TRD-001', 'contact@brayn.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773841434345-8a93cabb5385c895.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-18 13:43:54', '2026-03-18 13:43:54', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(21, 'uiihoi NYC', 'US123456789', 'TRD-001', 'contact@uiihoi.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773841635345-6080cf0d00c4de39.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-18 13:47:15', '2026-03-18 13:47:15', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(22, 'cassandra NYC', 'US123456789', 'TRD-001', 'contact@cassandra.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773842212971-f833207cca96f9a2.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-18 13:56:53', '2026-03-18 13:56:53', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(23, 'mignon NYC', 'US123456789', 'TRD-001', 'contact@mignon.com', '212-555-0101', 'United States', '123 Broadway, New York, NY 10001', 'direct', 1, '/uploads/logos/1773859285315-2a1fd7d99ba7eb0f.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-18 18:41:25', '2026-03-18 18:41:25', '$129', '2026-03-01 00:00:00', '2026-04-01 00:00:00', 129, 0, 'active', NULL, NULL),
(24, 'Urban Bites NYC', NULL, NULL, 'john@urbanbites.com', '+1-212-555-0101', NULL, '123 Broadway, New York, NY 10001', 'direct', 2, NULL, 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-20 12:13:13', '2026-03-24 17:00:00', '$0', NULL, NULL, 0, 0, 'suspended', NULL, NULL),
(25, 'companytest', 'youi77', '677889', 'admin@test.gmail', '+3367789889U', 'France', NULL, 'direct', 2, '/uploads/logos/1774368888091-9dd412eba5bd6d08.webp', 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-24 16:14:48', '2026-03-24 16:32:44', '$0', '2026-03-24 00:00:00', '2026-04-24 00:00:00', 0, 0, 'active', NULL, NULL),
(26, 'smithbusinessname', NULL, NULL, 'smith@test.com', NULL, NULL, NULL, 'direct', 2, NULL, 100, '#E10600', 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-24 16:57:41', '2026-03-24 16:57:41', '$0', NULL, NULL, 0, 0, 'active', NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `company_settings`
--

CREATE TABLE `company_settings` (
  `id` int(11) UNSIGNED NOT NULL,
  `companyId` int(11) UNSIGNED NOT NULL,
  `timezone` varchar(100) NOT NULL,
  `currency` varchar(100) DEFAULT NULL,
  `notificationEmail` tinyint(1) DEFAULT 0,
  `maxLocations` int(10) NOT NULL DEFAULT 1,
  `maxApiCalls` int(10) NOT NULL DEFAULT 1000,
  `maxSmsCalls` int(10) NOT NULL DEFAULT 100,
  `allowCustomColor` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `company_settings`
--

INSERT INTO `company_settings` (`id`, `companyId`, `timezone`, `currency`, `notificationEmail`, `maxLocations`, `maxApiCalls`, `maxSmsCalls`, `allowCustomColor`) VALUES
(2, 5, 'UTC', 'USD', 1, 1, 5, 600, 0),
(3, 6, 'UTC', 'USD', 1, 1, 5, 600, 0),
(4, 7, 'UTC', 'USD', 1, 1, 5, 600, 0),
(5, 8, 'UTC', 'USD', 1, 1, 5, 600, 0),
(6, 9, 'UTC', 'USD', 1, 1, 5, 600, 0),
(7, 10, 'UTC', 'USD', 1, 1, 5, 600, 0),
(8, 11, 'UTC', 'USD', 1, 1, 5, 600, 0),
(9, 12, 'UTC', 'USD', 1, 1, 5, 600, 0),
(10, 13, 'UTC', 'USD', 1, 1, 5, 600, 0),
(11, 14, 'UTC', 'USD', 1, 1, 5, 600, 0),
(12, 15, 'UTC', 'USD', 1, 1, 5, 600, 0),
(13, 16, 'UTC', 'USD', 1, 1, 5, 600, 0),
(14, 17, 'UTC', 'USD', 1, 1, 5, 600, 0),
(15, 18, 'UTC', 'USD', 1, 1, 5, 600, 0),
(16, 19, 'UTC', 'USD', 1, 1, 5, 600, 0),
(17, 20, 'UTC', 'USD', 1, 1, 5, 600, 0),
(18, 21, 'UTC', 'USD', 1, 1, 5, 600, 0),
(19, 22, 'UTC', 'USD', 1, 1, 5, 600, 0),
(20, 23, 'UTC', 'USD', 1, 1, 5, 600, 0),
(21, 24, 'UTC', 'USD', 1, 1, 1000, 100, 0),
(22, 25, 'UTC', 'USD', 1, 1, 1000, 100, 0),
(23, 26, 'UTC', 'USD', 1, 1, 1000, 100, 0);

-- --------------------------------------------------------

--
-- Structure de la table `conversions`
--

CREATE TABLE `conversions` (
  `id` varchar(191) NOT NULL,
  `orderId` varchar(191) NOT NULL,
  `affiliateId` varchar(191) NOT NULL,
  `amountCents` int(11) NOT NULL,
  `currency` varchar(191) NOT NULL DEFAULT 'EUR',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `customization`
--

CREATE TABLE `customization` (
  `id` varchar(191) NOT NULL,
  `orderId` varchar(191) NOT NULL,
  `frontData` text NOT NULL,
  `backData` text NOT NULL,
  `costCents` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `dashboardstat`
--

CREATE TABLE `dashboardstat` (
  `id` varchar(191) NOT NULL,
  `key` varchar(191) NOT NULL,
  `value` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `design`
--

CREATE TABLE `design` (
  `id` char(36) NOT NULL,
  `title` varchar(191) DEFAULT NULL,
  `user_id` int(11) UNSIGNED DEFAULT NULL,
  `jsonFront` text DEFAULT NULL,
  `jsonBack` text DEFAULT NULL,
  `frontFile` varchar(191) DEFAULT NULL,
  `backFile` varchar(191) DEFAULT NULL,
  `thumbnail` varchar(191) DEFAULT NULL,
  `costCents` int(11) DEFAULT 0,
  `upsellEnabled` tinyint(1) NOT NULL DEFAULT 0,
  `upsellPriceCents` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `designs`
--

CREATE TABLE `designs` (
  `id` int(10) UNSIGNED NOT NULL,
  `userId` int(10) UNSIGNED NOT NULL,
  `companyId` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `status` enum('draft','validated','locked') NOT NULL DEFAULT 'draft',
  `businessName` varchar(255) DEFAULT NULL,
  `slogan` varchar(255) DEFAULT NULL,
  `callToAction` varchar(255) DEFAULT 'Powered by RedVanta',
  `ctaPaddingTop` int(11) DEFAULT 8,
  `googlePlaceId` varchar(255) DEFAULT NULL,
  `googleReviewUrl` varchar(500) DEFAULT NULL,
  `orientation` enum('landscape','portrait') NOT NULL DEFAULT 'landscape',
  `logoUrl` varchar(500) DEFAULT NULL,
  `logoPosition` varchar(30) DEFAULT 'left',
  `logoSize` int(11) DEFAULT 32,
  `colorMode` varchar(20) DEFAULT 'single',
  `bgColor` varchar(20) DEFAULT '#0B0D0F',
  `textColor` varchar(20) DEFAULT '#FFFFFF',
  `accentColor` varchar(20) DEFAULT '#E10600',
  `starColor` varchar(20) DEFAULT '#F59E0B',
  `iconsColor` varchar(20) DEFAULT '#22C55E',
  `templateName` varchar(100) DEFAULT NULL,
  `gradient1` varchar(20) DEFAULT '#0B0D0F',
  `gradient2` varchar(20) DEFAULT '#1A1A1A',
  `accentBand1` varchar(20) DEFAULT '#E10600',
  `accentBand2` varchar(20) DEFAULT '#FF4444',
  `bandPosition` varchar(20) DEFAULT 'bottom',
  `frontBandHeight` int(11) DEFAULT 22,
  `backBandHeight` int(11) DEFAULT 12,
  `businessFont` varchar(100) DEFAULT 'Space Grotesk',
  `businessFontSize` int(11) DEFAULT 16,
  `businessFontWeight` varchar(50) DEFAULT 'Bold',
  `businessFontSpacing` varchar(50) DEFAULT 'Normal',
  `businessLineHeight` varchar(10) DEFAULT '1.4',
  `businessAlign` varchar(20) DEFAULT 'Left',
  `businessTextTransform` varchar(20) DEFAULT 'none',
  `sloganFont` varchar(100) DEFAULT 'Inter',
  `sloganFontSize` int(11) DEFAULT 12,
  `sloganFontWeight` varchar(50) DEFAULT 'Regular',
  `sloganFontSpacing` varchar(50) DEFAULT 'Normal',
  `sloganLineHeight` varchar(10) DEFAULT '1.4',
  `sloganAlign` varchar(20) DEFAULT 'Left',
  `sloganTextTransform` varchar(20) DEFAULT 'none',
  `textShadow` varchar(20) DEFAULT 'None',
  `frontInstruction1` varchar(255) DEFAULT 'Approach the phone to the card',
  `frontInstruction2` varchar(255) DEFAULT 'Tap to leave a review',
  `backInstruction1` varchar(255) DEFAULT NULL,
  `backInstruction2` varchar(255) DEFAULT NULL,
  `instrFont` varchar(100) DEFAULT 'Space Grotesk',
  `instrFontSize` int(11) DEFAULT 10,
  `instrFontWeight` varchar(50) DEFAULT 'Regular',
  `instrFontSpacing` varchar(50) DEFAULT 'Normal',
  `instrLineHeight` varchar(10) DEFAULT '1.4',
  `instrAlign` varchar(20) DEFAULT 'Left',
  `checkStrokeWidth` decimal(3,1) DEFAULT 3.5,
  `instrCheckboxStyle` varchar(20) DEFAULT 'checkmark',
  `qrCodeStyle` varchar(20) DEFAULT 'Left',
  `qrCodeSize` int(11) DEFAULT 60,
  `nfcIconSize` int(11) DEFAULT 16,
  `showNfcIcon` tinyint(1) NOT NULL DEFAULT 1,
  `showGoogleIcon` tinyint(1) NOT NULL DEFAULT 1,
  `googleLogoSize` int(11) DEFAULT 20,
  `cardModel` enum('classic','premium','metal','transparent') NOT NULL DEFAULT 'classic',
  `version` int(11) NOT NULL DEFAULT 1,
  `lastAutoSave` datetime DEFAULT NULL,
  `validatedAt` datetime DEFAULT NULL,
  `elementOffsets` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`elementOffsets`)),
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `design_versions`
--

CREATE TABLE `design_versions` (
  `id` int(10) UNSIGNED NOT NULL,
  `designId` int(10) UNSIGNED NOT NULL,
  `version` int(11) NOT NULL,
  `snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`snapshot`)),
  `savedAt` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `emailqueue`
--

CREATE TABLE `emailqueue` (
  `id` varchar(191) NOT NULL,
  `to` varchar(191) NOT NULL,
  `subject` varchar(191) NOT NULL,
  `html` text NOT NULL,
  `text` text DEFAULT NULL,
  `processed` tinyint(1) NOT NULL DEFAULT 0,
  `attempts` int(11) NOT NULL DEFAULT 0,
  `lastError` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `processedAt` datetime(3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `email_server_config`
--

CREATE TABLE `email_server_config` (
  `id` varchar(191) NOT NULL,
  `name` varchar(150) NOT NULL,
  `value` varchar(100) NOT NULL,
  `sid` varchar(30) NOT NULL,
  `region` varchar(100) DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'Active',
  `isDefault` tinyint(1) NOT NULL DEFAULT 0,
  `config` longtext DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `email_templates`
--

CREATE TABLE `email_templates` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `slug` varchar(150) NOT NULL,
  `category` enum('Onboarding','Review','Billing','Auth','Notification','Marketing','System') DEFAULT 'Notification',
  `active` tinyint(1) DEFAULT 1,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `email_templates`
--

INSERT INTO `email_templates` (`id`, `name`, `slug`, `category`, `active`, `createdAt`, `updatedAt`) VALUES
(1, 'Welcome Email Updated', 'welcome', 'Onboarding', 1, '2026-03-13 14:28:00', '2026-03-13 14:54:25'),
(2, 'Review Request', 'review_request', 'Review', 1, '2026-03-13 14:28:00', '2026-03-13 14:28:00'),
(3, 'Invoice', 'invoice', 'Billing', 1, '2026-03-13 14:28:00', '2026-03-13 14:28:00'),
(4, 'Password Reset', 'password_reset', 'Auth', 1, '2026-03-13 14:28:00', '2026-03-13 14:28:00'),
(5, 'Demande d\'avis client', 'review_request_v1', 'Review', 1, '2026-03-13 14:42:48', '2026-03-13 14:42:48'),
(6, 'Order Confirmation', 'order_confirmation', 'Notification', 1, '2026-03-21 11:44:14', '2026-03-21 11:44:14');

-- --------------------------------------------------------

--
-- Structure de la table `email_template_translations`
--

CREATE TABLE `email_template_translations` (
  `id` int(11) NOT NULL,
  `templateId` int(11) NOT NULL,
  `languageId` int(11) NOT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `body` longtext DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `email_template_translations`
--

INSERT INTO `email_template_translations` (`id`, `templateId`, `languageId`, `subject`, `body`, `createdAt`) VALUES
(1, 1, 1, 'Welcome aboard!', '<p>Welcome {{customer_name}}...</p>', '2026-03-13 14:28:00'),
(2, 1, 2, 'Bienvenue à bord !', '<p>Bienvenue {{customer_name}}...</p>', '2026-03-13 14:28:00'),
(3, 1, 3, '¡Bienvenido!', '<p>Bienvenido {{customer_name}}...</p>', '2026-03-13 14:28:00'),
(4, 1, 4, 'Willkommen bei {{company_name}}!', '<div>Hallo {{customer_name}}, danke, dass Sie {{company_name}} beigetreten sind!</div>', '2026-03-13 14:28:00'),
(5, 2, 1, 'How was your experience?', '<div>Hi {{customer_name}}, we would love your feedback: {{review_link}}</div>', '2026-03-13 14:28:00'),
(6, 2, 2, 'Comment était votre expérience?', '<div>Bonjour {{customer_name}}, nous aimerions avoir votre avis: {{review_link}}</div>', '2026-03-13 14:28:00'),
(7, 2, 3, '¿Cómo fue su experiencia?', '<div>Hola {{customer_name}}, nos encantaría recibir su opinión: {{review_link}}</div>', '2026-03-13 14:28:00'),
(8, 2, 4, 'Wie war Ihre Erfahrung?', '<div>Hallo {{customer_name}}, wir würden gerne Ihr Feedback erhalten: {{review_link}}</div>', '2026-03-13 14:28:00'),
(9, 5, 2, 'Comment s\'est passée votre visite chez {{company_name}} ?', '<div style=\'font-family:sans-serif;\'><h1>Bonjour {{customer_name}}</h1><p>Nous aimerions avoir votre avis sur votre passage le {{date}}.</p><a href=\'{{review_link}}\'>Donner mon avis</a></div>', '2026-03-13 14:42:48'),
(10, 5, 1, 'How was your experience at {{company_name}}?', '<div style=\'font-family:sans-serif;\'><h1>Hi {{customer_name}}</h1><p>We\'d love to hear your thoughts on your visit on {{date}}.</p><a href=\'{{review_link}}\'>Leave a review</a></div>', '2026-03-13 14:42:48');

-- --------------------------------------------------------

--
-- Structure de la table `featureflag`
--

CREATE TABLE `featureflag` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `description` text DEFAULT NULL,
  `scope` varchar(191) DEFAULT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `featureflag`
--

INSERT INTO `featureflag` (`id`, `name`, `description`, `scope`, `enabled`, `createdAt`, `updatedAt`) VALUES
(1, 'new_dashboard_ui', 'Redesigned dashboard interface', 'All', 0, '2026-03-11 14:28:39', '2026-03-11 14:54:03'),
(2, 'advanced_automation_v2', 'Next-gen automation engine', 'Beta Accounts', 0, '2026-03-11 14:28:39', '2026-03-11 14:28:39'),
(3, 'ai_review_response', 'AI-powered review replies', 'Pro + Agency', 1, '2026-03-11 14:28:39', '2026-03-11 14:28:39'),
(4, 'multi_language_support', 'Multi-language review forms', 'All', 0, '2026-03-11 14:28:39', '2026-03-11 14:28:39'),
(5, 'webhook_v2', 'Enhanced webhook delivery system', 'All', 1, '2026-03-11 14:28:39', '2026-03-11 14:28:39'),
(6, 'white_label_custom_domain', 'Custom domain for white-label', 'Agency', 1, '2026-03-11 14:28:39', '2026-03-11 14:28:39');

-- --------------------------------------------------------

--
-- Structure de la table `global_currencies`
--

CREATE TABLE `global_currencies` (
  `id` int(11) NOT NULL,
  `code` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL,
  `symbol` varchar(10) NOT NULL,
  `rate` decimal(12,6) DEFAULT 1.000000,
  `status` enum('Active','Draft','Inactive') DEFAULT 'Active',
  `isDefault` tinyint(1) DEFAULT 0,
  `symbolPosition` enum('left_space','left_no_space','right_space','right_no_space') DEFAULT 'left_no_space',
  `gateway` enum('stripe','paypal','mollie','manual') DEFAULT 'stripe',
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `global_currencies`
--

INSERT INTO `global_currencies` (`id`, `code`, `name`, `symbol`, `rate`, `status`, `isDefault`, `symbolPosition`, `gateway`, `createdAt`, `updatedAt`) VALUES
(1, 'USD', 'US Dollar', '$', 1.000000, 'Active', 1, 'left_no_space', 'stripe', '2026-03-12 14:11:56', '2026-03-12 14:11:56'),
(2, 'EUR', 'Euro', '€', 0.920000, 'Active', 0, 'right_space', 'stripe', '2026-03-12 14:11:56', '2026-03-12 14:11:56'),
(3, 'GBP', 'British Pound', '£', 0.790000, 'Active', 0, 'left_no_space', 'stripe', '2026-03-12 14:11:56', '2026-03-12 14:11:56'),
(4, 'CAD', 'Canadian Dollar', 'CA$', 1.360000, 'Active', 0, 'left_no_space', 'stripe', '2026-03-12 14:11:56', '2026-03-12 14:11:56'),
(5, 'AUD', 'Australian Dollar', 'A$', 1.530000, 'Draft', 0, 'left_no_space', 'stripe', '2026-03-12 14:11:56', '2026-03-12 14:11:56'),
(6, 'JPY', 'Japanese Yen', '¥', 149.500000, 'Inactive', 0, 'left_no_space', 'stripe', '2026-03-12 14:11:56', '2026-03-12 14:11:56');

-- --------------------------------------------------------

--
-- Structure de la table `global_currency_settings`
--

CREATE TABLE `global_currency_settings` (
  `id` int(11) NOT NULL,
  `conversionMethod` enum('manual','online') DEFAULT 'manual',
  `rateProvider` varchar(100) DEFAULT NULL,
  `apiKey` varchar(255) DEFAULT NULL,
  `showSelector` tinyint(1) DEFAULT 1,
  `showBoth` tinyint(1) DEFAULT 0,
  `rounding` int(11) DEFAULT 2,
  `lastRateUpdate` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `global_currency_settings`
--

INSERT INTO `global_currency_settings` (`id`, `conversionMethod`, `rateProvider`, `apiKey`, `showSelector`, `showBoth`, `rounding`, `lastRateUpdate`) VALUES
(1, 'manual', NULL, NULL, 1, 0, 2, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `google_place_cache`
--

CREATE TABLE `google_place_cache` (
  `id` int(10) UNSIGNED NOT NULL,
  `placeId` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `formattedAddress` varchar(500) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `website` varchar(500) DEFAULT NULL,
  `lat` decimal(10,7) DEFAULT NULL,
  `lng` decimal(10,7) DEFAULT NULL,
  `rating` decimal(2,1) DEFAULT NULL,
  `userRatingsTotal` int(11) DEFAULT NULL,
  `reviewUrl` varchar(500) DEFAULT NULL,
  `photoReference` text DEFAULT NULL,
  `photoUrl` varchar(500) DEFAULT NULL,
  `types` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`types`)),
  `cachedAt` datetime NOT NULL DEFAULT current_timestamp(),
  `expiresAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `job_logs`
--

CREATE TABLE `job_logs` (
  `id` char(36) NOT NULL,
  `name` varchar(191) NOT NULL,
  `status` varchar(191) NOT NULL,
  `message` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `languages`
--

CREATE TABLE `languages` (
  `id` int(11) NOT NULL,
  `code` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL,
  `native` varchar(100) NOT NULL,
  `flag` varchar(10) DEFAULT NULL,
  `rtl` tinyint(1) DEFAULT 0,
  `status` enum('Active','Draft','Inactive') DEFAULT 'Draft',
  `isDefault` tinyint(1) DEFAULT 0,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `languages`
--

INSERT INTO `languages` (`id`, `code`, `name`, `native`, `flag`, `rtl`, `status`, `isDefault`, `createdAt`) VALUES
(1, 'en', 'English', 'English', '🇺🇸', 0, 'Active', 1, '2026-03-12 12:38:23'),
(2, 'fr', 'French', 'Français', '🇫🇷', 0, 'Active', 0, '2026-03-12 12:38:23'),
(3, 'es', 'Spanish', 'Español', '🇪🇸', 0, 'Active', 0, '2026-03-12 12:38:23'),
(4, 'de', 'German', 'Deutsch', '🇩🇪', 0, 'Active', 0, '2026-03-12 12:38:23'),
(5, 'ro', 'Romanian', 'Română', '🇷🇴', 0, 'Active', 0, '2026-03-12 12:38:23'),
(6, 'ru', 'Russian', 'Русский', '🇷🇺', 0, 'Draft', 0, '2026-03-12 12:38:23'),
(7, 'ar', 'Arabic', 'العربية', '🇸🇦', 0, 'Draft', 0, '2026-03-12 12:38:23'),
(8, 'zh', 'Chinese', '中文', '🇨🇳', 0, 'Draft', 0, '2026-03-12 12:38:23');

-- --------------------------------------------------------

--
-- Structure de la table `locations`
--

CREATE TABLE `locations` (
  `id` char(36) NOT NULL,
  `ownerId` int(11) UNSIGNED DEFAULT NULL,
  `name` varchar(191) NOT NULL,
  `address` varchar(191) DEFAULT NULL,
  `city` varchar(191) DEFAULT NULL,
  `postal` varchar(191) DEFAULT NULL,
  `country` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `slug` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `locations`
--

INSERT INTO `locations` (`id`, `ownerId`, `name`, `address`, `city`, `postal`, `country`, `phone`, `email`, `slug`, `createdAt`, `updatedAt`) VALUES
('692b556203d10af85d9579e84cf2fcc8', 3, 'Studio Paris', '10 Rue de Paris', 'Paris', NULL, 'FR', '+33122334455', 'contact.paris@demo.local', 'studio-paris', '2026-03-10 13:48:57.903', '2026-03-10 13:48:57.903'),
('7655a94119a35eabfdfed228e5797eae', 3, 'Studio Lyon', '20 Rue de Lyon', 'Lyon', NULL, 'FR', '+33411223344', 'contact.lyon@demo.local', 'studio-lyon', '2026-03-10 13:48:57.913', '2026-03-10 13:48:57.913');

-- --------------------------------------------------------

--
-- Structure de la table `login_activities`
--

CREATE TABLE `login_activities` (
  `id` int(11) NOT NULL,
  `userId` int(10) UNSIGNED DEFAULT NULL,
  `admin_name` varchar(191) DEFAULT NULL,
  `userAgent` varchar(200) DEFAULT NULL,
  `ip` varchar(191) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `login_activities`
--

INSERT INTO `login_activities` (`id`, `userId`, `admin_name`, `userAgent`, `ip`, `status`, `createdAt`) VALUES
(1, 25, 'Urban Bites NYC', 'PostmanRuntime/7.52.0', '::1', 'signup', '2026-03-20 12:13:13'),
(2, 1, 'Super Admin', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '::1', 'success', '2026-03-24 11:16:32'),
(3, 1, 'Super Admin', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '::1', 'success', '2026-03-24 15:23:17'),
(4, 27, 'smithuser', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '::1', 'signup', '2026-03-24 16:57:41'),
(5, 27, 'smithuser', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '::1', 'email_verified', '2026-03-24 17:03:15');

-- --------------------------------------------------------

--
-- Structure de la table `manual_payment_methods`
--

CREATE TABLE `manual_payment_methods` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `instructions` text DEFAULT NULL,
  `verificationRequired` tinyint(1) DEFAULT 1,
  `supportedCurrencies` varchar(50) DEFAULT 'all',
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `manual_payment_methods`
--

INSERT INTO `manual_payment_methods` (`id`, `name`, `instructions`, `verificationRequired`, `supportedCurrencies`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 'Bank Transfer', 'Wire to IBAN: DE89...', 1, 'all', 'Active', '2026-03-12 15:51:16', '2026-03-12 15:51:16'),
(2, 'Check Payment', 'Send check to HQ address', 1, 'all', 'Active', '2026-03-12 15:51:16', '2026-03-12 15:51:16'),
(3, 'Cash on Delivery', 'Pay at delivery', 0, 'all', 'Inactive', '2026-03-12 15:51:16', '2026-03-12 15:51:16');

-- --------------------------------------------------------

--
-- Structure de la table `module`
--

CREATE TABLE `module` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `module`
--

INSERT INTO `module` (`id`, `name`, `createdAt`) VALUES
(1, 'Accounts', '2026-03-10 20:04:55'),
(2, 'Billing', '2026-03-10 20:04:55'),
(3, 'Pricing', '2026-03-10 20:04:55'),
(4, 'Integrations', '2026-03-10 20:04:55'),
(5, 'Events', '2026-03-10 20:04:55'),
(6, 'Security', '2026-03-10 20:04:55'),
(7, 'Analytics', '2026-03-10 20:04:55'),
(8, 'dashboard', '2026-03-17 17:23:01'),
(9, 'locations', '2026-03-17 17:23:01'),
(10, 'reviews', '2026-03-17 17:23:01'),
(11, 'settings', '2026-03-17 17:23:01'),
(12, 'users', '2026-03-17 17:23:01'),
(13, 'products', '2026-03-17 17:23:01');

-- --------------------------------------------------------

--
-- Structure de la table `nfctag`
--

CREATE TABLE `nfctag` (
  `id` varchar(191) NOT NULL,
  `uid` varchar(191) DEFAULT NULL,
  `tagSerial` varchar(191) DEFAULT NULL,
  `qrCodeFile` varchar(191) DEFAULT NULL,
  `payload` text DEFAULT NULL,
  `used` tinyint(1) NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `locationId` varchar(191) DEFAULT NULL,
  `productId` varchar(191) DEFAULT NULL,
  `userId` varchar(191) DEFAULT NULL,
  `designId` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `nfc_cards`
--

CREATE TABLE `nfc_cards` (
  `id` char(36) NOT NULL,
  `locationId` varchar(191) NOT NULL,
  `uid` varchar(191) NOT NULL,
  `title` varchar(191) DEFAULT NULL,
  `url` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `nfc_scans`
--

CREATE TABLE `nfc_scans` (
  `id` char(36) NOT NULL,
  `cardId` varchar(191) NOT NULL,
  `userAgent` varchar(191) DEFAULT NULL,
  `ip` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `notification_logs`
--

CREATE TABLE `notification_logs` (
  `id` char(36) NOT NULL,
  `type` enum('email','sms','whatsapp') NOT NULL,
  `userId` varchar(191) DEFAULT NULL,
  `locationId` varchar(191) DEFAULT NULL,
  `status` varchar(191) NOT NULL,
  `payload` varchar(191) DEFAULT NULL,
  `error` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `order`
--

CREATE TABLE `order` (
  `id` int(10) UNSIGNED NOT NULL,
  `userId` int(10) UNSIGNED NOT NULL,
  `companyId` int(11) NOT NULL,
  `orderNumber` varchar(50) NOT NULL,
  `status` enum('pending','paid','processing','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
  `subtotal` decimal(10,2) NOT NULL,
  `shippingCost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL,
  `shippingFullName` varchar(255) DEFAULT NULL,
  `shippingAddress` varchar(500) DEFAULT NULL,
  `shippingCity` varchar(100) DEFAULT NULL,
  `shippingState` varchar(100) DEFAULT NULL,
  `shippingZip` varchar(20) DEFAULT NULL,
  `shippingCountry` varchar(100) DEFAULT 'United States',
  `shippingMethod` enum('standard','express','international') NOT NULL DEFAULT 'standard',
  `stripePaymentIntentId` varchar(255) DEFAULT NULL,
  `stripeClientSecret` varchar(500) DEFAULT NULL,
  `paidAt` datetime DEFAULT NULL,
  `confirmationEmailSentAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `orderitem`
--

CREATE TABLE `orderitem` (
  `id` varchar(191) NOT NULL,
  `orderId` varchar(191) NOT NULL,
  `productId` varchar(191) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unitCents` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `orders`
--

CREATE TABLE `orders` (
  `id` char(36) NOT NULL,
  `orderNumber` varchar(191) NOT NULL,
  `userId` varchar(191) DEFAULT NULL,
  `locationId` varchar(191) DEFAULT NULL,
  `total` double NOT NULL,
  `currency` varchar(191) NOT NULL DEFAULT 'EUR',
  `status` enum('pending','paid','cancelled','refunded','fulfilled') NOT NULL DEFAULT 'pending',
  `stripeSession` varchar(191) DEFAULT NULL,
  `stripePaymentId` varchar(191) DEFAULT NULL,
  `userEmail` varchar(191) DEFAULT NULL,
  `affiliateId` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(10) UNSIGNED NOT NULL,
  `orderId` int(10) UNSIGNED NOT NULL,
  `productId` int(11) NOT NULL,
  `designId` int(10) UNSIGNED DEFAULT NULL,
  `cardTypeId` varchar(50) DEFAULT NULL,
  `quantity` int(11) NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL,
  `totalPrice` decimal(10,2) NOT NULL,
  `packageTierId` int(11) DEFAULT NULL,
  `totalCards` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `payment_gateways`
--

CREATE TABLE `payment_gateways` (
  `id` int(11) NOT NULL,
  `provider` varchar(50) NOT NULL,
  `apiKey` varchar(255) DEFAULT NULL,
  `secretKey` varchar(255) DEFAULT NULL,
  `webhookSecret` varchar(255) DEFAULT NULL,
  `mode` enum('test','live') DEFAULT 'test',
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `isDefault` tinyint(1) DEFAULT 0,
  `currencies` varchar(50) DEFAULT 'all',
  `fees` varchar(50) DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `payment_gateways`
--

INSERT INTO `payment_gateways` (`id`, `provider`, `apiKey`, `secretKey`, `webhookSecret`, `mode`, `status`, `isDefault`, `currencies`, `fees`, `createdAt`, `updatedAt`) VALUES
(1, 'stripe', NULL, NULL, NULL, 'test', 'Active', 1, '135+', '2.9% + $0.30', '2026-03-12 15:51:16', '2026-03-12 15:51:16'),
(2, 'paypal', NULL, NULL, NULL, 'test', 'Active', 0, '25', '3.49% + $0.49', '2026-03-12 15:51:16', '2026-03-12 15:51:16'),
(3, 'mollie', NULL, NULL, NULL, 'test', 'Active', 0, '15', '1.8% + €0.25', '2026-03-12 15:51:16', '2026-03-12 15:51:16'),
(4, 'square', NULL, NULL, NULL, 'test', 'Inactive', 0, '6', '2.6% + $0.10', '2026-03-12 15:51:16', '2026-03-12 15:51:16'),
(5, 'stripe', 'pk_test_123456', 'sk_test_123456', 'whsec_123456', 'live', 'Active', 0, 'all', NULL, '2026-03-12 15:29:46', '2026-03-12 15:31:50');

-- --------------------------------------------------------

--
-- Structure de la table `payment_logs`
--

CREATE TABLE `payment_logs` (
  `id` int(11) NOT NULL,
  `gateway` varchar(50) DEFAULT NULL,
  `event_type` varchar(100) DEFAULT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `status` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `payment_settings`
--

CREATE TABLE `payment_settings` (
  `id` int(11) NOT NULL,
  `allowMultiple` tinyint(1) DEFAULT 1,
  `autoRetry` tinyint(1) DEFAULT 1,
  `timeout` int(11) DEFAULT 300,
  `autoInvoices` tinyint(1) DEFAULT 1,
  `receiptEmails` tinyint(1) DEFAULT 1,
  `invoicePrefix` varchar(20) DEFAULT 'INV-'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `payment_settings`
--

INSERT INTO `payment_settings` (`id`, `allowMultiple`, `autoRetry`, `timeout`, `autoInvoices`, `receiptEmails`, `invoicePrefix`) VALUES
(1, 1, 1, 300, 1, 1, 'INV-');

-- --------------------------------------------------------

--
-- Structure de la table `payoutrequest`
--

CREATE TABLE `payoutrequest` (
  `id` varchar(191) NOT NULL,
  `affiliateId` varchar(191) NOT NULL,
  `amountCents` int(11) NOT NULL,
  `currency` varchar(191) NOT NULL DEFAULT 'EUR',
  `status` varchar(191) NOT NULL DEFAULT 'pending',
  `stripeTransferId` varchar(191) DEFAULT NULL,
  `stripePayoutId` varchar(191) DEFAULT NULL,
  `note` varchar(191) DEFAULT NULL,
  `requestedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `processedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `permission`
--

CREATE TABLE `permission` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `permission`
--

INSERT INTO `permission` (`id`, `name`, `description`) VALUES
(1, 'View', NULL),
(2, 'Edit', NULL),
(3, 'Delete', NULL),
(4, 'Impersonate', NULL),
(5, 'Refund', NULL),
(6, 'Suspend', NULL),
(7, 'product:create', 'Create new products'),
(8, 'product:read', 'View products'),
(9, 'product:update', 'Edit products'),
(10, 'product:delete', 'Delete products'),
(11, 'card_type:create', 'Create card types'),
(12, 'card_type:read', 'View card types'),
(13, 'card_type:update', 'Edit card types'),
(14, 'card_type:delete', 'Delete card types'),
(15, 'create', NULL),
(16, 'update', NULL),
(17, 'export', NULL);

-- --------------------------------------------------------

--
-- Structure de la table `plansetting`
--

CREATE TABLE `plansetting` (
  `id` int(11) UNSIGNED NOT NULL,
  `name` varchar(191) NOT NULL,
  `price` int(11) NOT NULL,
  `annual` int(11) NOT NULL,
  `apiLimit` varchar(191) NOT NULL,
  `smsLimit` varchar(191) NOT NULL,
  `locationLimit` int(11) NOT NULL,
  `trialDays` int(11) NOT NULL,
  `trialFeatures` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`trialFeatures`)),
  `features` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`features`)),
  `status` varchar(191) NOT NULL DEFAULT 'Active',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `plansetting`
--

INSERT INTO `plansetting` (`id`, `name`, `price`, `annual`, `apiLimit`, `smsLimit`, `locationLimit`, `trialDays`, `trialFeatures`, `features`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 'Starter', 129, 116, '5K', '600', 1, 14, '[\"Review Monitoring\",\"Review Responses\",\"Analytics Dashboard\"]', '[\"Review Monitoring\",\"Review Responses\",\"Analytics Dashboard\",\"Advanced Filtering\"]', 'active', '2026-03-10 15:11:19.691', '2026-03-10 15:12:30.378'),
(2, 'Trial', 0, 0, '1000', '100', 1, 14, '[\"dashboard\",\"locations\",\"reviews\",\"analytics\"]', '[\"1 location\",\"1000 API calls/month\",\"100 SMS/month\",\"Basic analytics\"]', 'Active', '2026-03-19 20:00:03.000', '2026-03-19 20:00:03.000');

-- --------------------------------------------------------

--
-- Structure de la table `platform_settings`
--

CREATE TABLE `platform_settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `platform_name` varchar(150) NOT NULL,
  `default_email_sender` varchar(150) NOT NULL,
  `sms_setting_id` int(10) UNSIGNED DEFAULT NULL,
  `rate_limit` int(11) NOT NULL DEFAULT 60,
  `is_maintenance` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `platform_settings`
--

INSERT INTO `platform_settings` (`id`, `platform_name`, `default_email_sender`, `sms_setting_id`, `rate_limit`, `is_maintenance`, `createdAt`, `updatedAt`) VALUES
(1, 'testplatfrome', 'mfeutgniarodrigue@gmail.com', NULL, 60, 1, '2026-03-24 10:34:45', '2026-03-24 10:34:45');

-- --------------------------------------------------------

--
-- Structure de la table `product`
--

CREATE TABLE `product` (
  `id` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `image` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `product`
--

INSERT INTO `product` (`id`, `price`, `active`, `image`, `createdAt`, `updatedAt`) VALUES
(1, 49.00, 1, NULL, '2026-03-14 12:38:33', '2026-03-16 12:53:20'),
(2, 19.00, 1, NULL, '2026-03-14 12:38:33', '2026-03-14 12:38:33'),
(3, 20.00, 1, NULL, '2026-03-14 12:38:33', '2026-03-14 12:38:33'),
(4, 24.00, 1, NULL, '2026-03-14 12:38:33', '2026-03-14 12:38:33'),
(5, 69.00, 1, NULL, '2026-03-14 12:38:33', '2026-03-14 12:38:33'),
(6, 39.00, 1, '/uploads/products/images/test.webp', '2026-03-16 11:57:41', '2026-03-16 11:57:41');

-- --------------------------------------------------------

--
-- Structure de la table `product_gallery_item`
--

CREATE TABLE `product_gallery_item` (
  `id` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `url` text NOT NULL,
  `type` enum('image','video','youtube') NOT NULL DEFAULT 'image',
  `poster` text DEFAULT NULL,
  `position` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `product_gallery_item`
--

INSERT INTO `product_gallery_item` (`id`, `productId`, `url`, `type`, `poster`, `position`) VALUES
(1, 6, '/uploads/products/gallery/img1.webp', 'image', NULL, 0),
(2, 6, 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', NULL, 1);

-- --------------------------------------------------------

--
-- Structure de la table `product_package_tier`
--

CREATE TABLE `product_package_tier` (
  `id` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `qty` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `product_package_tier`
--

INSERT INTO `product_package_tier` (`id`, `productId`, `qty`, `price`) VALUES
(1, 3, 1, 29.00),
(2, 3, 10, 24.00),
(3, 3, 50, 19.00),
(4, 3, 100, 15.00),
(5, 5, 1, 29.00),
(6, 5, 10, 24.00),
(7, 5, 50, 19.00),
(8, 5, 100, 15.00),
(9, 6, 1, 29.00),
(10, 6, 10, 24.00),
(11, 6, 50, 19.00),
(12, 6, 100, 15.00),
(13, 1, 1, 45.00),
(14, 1, 5, 40.00),
(15, 1, 20, 35.00);

-- --------------------------------------------------------

--
-- Structure de la table `product_translation`
--

CREATE TABLE `product_translation` (
  `id` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `langId` int(11) UNSIGNED DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `seoTitle` varchar(255) DEFAULT NULL,
  `metaDescription` text DEFAULT NULL,
  `metaImage` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `product_translation`
--

INSERT INTO `product_translation` (`id`, `productId`, `langId`, `title`, `slug`, `seoTitle`, `metaDescription`, `metaImage`) VALUES
(2, 2, 1, 'QR Sticker Pack (10x)', 'qr-sticker-pack', 'QR Sticker Pack - REDVANTA', 'Waterproof vinyl stickers with your unique QR code.', NULL),
(3, 3, 1, 'Premium Card Upgrade', 'premium-card-upgrade', 'Premium Card Upgrade - REDVANTA', 'Upgrade to metallic finish and enhanced durability.', NULL),
(4, 4, 1, 'Duplicate Card (Different Color)', 'duplicate-card', 'Duplicate Card - REDVANTA', 'Create a color variant linked to the same location.', NULL),
(5, 5, 1, 'NFC + QR Bundle', 'nfc-qr-bundle', 'NFC + QR Bundle - REDVANTA', 'Smart Review Card + Table Stand + 10 QR Stickers at 20% off.', NULL),
(7, 2, 2, 'Pack Autocollants QR (10x)', 'pack-autocollants-qr', NULL, 'Autocollants vinyle imperméables avec votre QR code.', NULL),
(8, 3, 2, 'Carte Premium', 'carte-premium', NULL, 'Passer à la finition métallique.', NULL),
(9, 4, 2, 'Carte Dupliquée (Couleur Différente)', 'carte-dupliquee', NULL, 'Créez une variante de couleur liée au même emplacement.', NULL),
(10, 5, 2, 'Pack NFC + QR', 'pack-nfc-qr', NULL, 'Carte + Support + 10 autocollants à -20%.', NULL),
(11, 6, 1, 'Table Stand', 'table-stand', 'Table Stand - REDVANTA', 'Elegant acrylic stand to display your card.', '/uploads/products/meta/test.webp'),
(12, 6, 2, 'Support de Table', 'support-table', 'Support de Table - REDVANTA', 'Support acrylique pour afficher votre carte.', NULL),
(13, 1, 1, 'Premium Table Stand v2', 'premium-table-stand', 'Premium Table Stand v2 - REDVANTA', 'Updated description for table stand.', NULL),
(14, 1, 2, 'Support de Table Premium v2', 'support-table-premium', NULL, 'Description mise à jour.', NULL);

-- --------------------------------------------------------

--
-- Structure de la table `refresh_tokens`
--

CREATE TABLE `refresh_tokens` (
  `id` int(10) UNSIGNED NOT NULL,
  `token` varchar(500) NOT NULL,
  `userId` int(10) UNSIGNED NOT NULL,
  `expiresAt` datetime NOT NULL,
  `revoked` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `reviews`
--

CREATE TABLE `reviews` (
  `id` char(36) NOT NULL,
  `locationId` varchar(191) NOT NULL,
  `userId` varchar(191) DEFAULT NULL,
  `userName` varchar(191) DEFAULT NULL,
  `rating` int(11) NOT NULL,
  `comment` varchar(191) DEFAULT NULL,
  `status` enum('pending','alerted','posted','rejected','archived') NOT NULL DEFAULT 'pending',
  `email` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `locationSlug` varchar(191) DEFAULT NULL,
  `contact` varchar(191) DEFAULT NULL,
  `source` varchar(191) DEFAULT NULL,
  `notifiedOwner` tinyint(1) NOT NULL DEFAULT 0,
  `postedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `role`
--

CREATE TABLE `role` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `role`
--

INSERT INTO `role` (`id`, `name`, `createdAt`, `updatedAt`) VALUES
(1, 'Super Admin', '2026-03-10 20:04:54', '2026-03-10 20:04:54'),
(2, 'Finance Admin', '2026-03-10 20:04:54', '2026-03-10 20:04:54'),
(3, 'Support Admin', '2026-03-10 20:04:54', '2026-03-10 20:04:54'),
(4, 'Technical Admin', '2026-03-10 20:04:54', '2026-03-24 12:17:46'),
(5, 'Growth Admin', '2026-03-10 20:04:54', '2026-03-10 20:04:54'),
(6, 'Marketing Admin', '2026-03-11 11:49:02', '2026-03-24 12:16:17'),
(8, 'Finance', '2026-03-11 11:59:47', '2026-03-11 11:59:47'),
(9, 'Admin', '2026-03-11 11:59:47', '2026-03-11 11:59:47');

-- --------------------------------------------------------

--
-- Structure de la table `rolepermission`
--

CREATE TABLE `rolepermission` (
  `id` int(11) NOT NULL,
  `roleId` int(11) NOT NULL,
  `moduleId` int(11) NOT NULL,
  `permissionId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `rolepermission`
--

INSERT INTO `rolepermission` (`id`, `roleId`, `moduleId`, `permissionId`) VALUES
(95, 4, 4, 11),
(93, 4, 4, 12),
(92, 4, 4, 13),
(94, 4, 4, 14),
(96, 4, 4, 15),
(100, 4, 9, 11),
(98, 4, 9, 12),
(97, 4, 9, 13),
(99, 4, 9, 14),
(101, 4, 9, 15),
(70, 6, 1, 11),
(71, 6, 1, 14),
(72, 6, 7, 14),
(17, 8, 1, 1),
(11, 8, 2, 1),
(12, 8, 2, 2),
(13, 8, 2, 5),
(14, 8, 3, 1),
(15, 8, 3, 2),
(16, 8, 7, 1),
(21, 9, 1, 1),
(19, 9, 1, 3),
(18, 9, 1, 15),
(20, 9, 1, 16),
(29, 9, 2, 1),
(27, 9, 2, 3),
(26, 9, 2, 15),
(28, 9, 2, 16),
(49, 9, 3, 1),
(47, 9, 3, 3),
(46, 9, 3, 15),
(48, 9, 3, 16),
(41, 9, 4, 1),
(39, 9, 4, 3),
(38, 9, 4, 15),
(40, 9, 4, 16),
(37, 9, 5, 1),
(35, 9, 5, 3),
(34, 9, 5, 15),
(36, 9, 5, 16),
(61, 9, 6, 1),
(59, 9, 6, 3),
(58, 9, 6, 15),
(60, 9, 6, 16),
(25, 9, 7, 1),
(23, 9, 7, 3),
(22, 9, 7, 15),
(24, 9, 7, 16),
(33, 9, 8, 1),
(31, 9, 8, 3),
(30, 9, 8, 15),
(32, 9, 8, 16),
(45, 9, 9, 1),
(43, 9, 9, 3),
(42, 9, 9, 15),
(44, 9, 9, 16),
(57, 9, 10, 1),
(55, 9, 10, 3),
(54, 9, 10, 15),
(56, 9, 10, 16),
(65, 9, 11, 1),
(63, 9, 11, 3),
(62, 9, 11, 15),
(64, 9, 11, 16),
(69, 9, 12, 1),
(67, 9, 12, 3),
(66, 9, 12, 15),
(68, 9, 12, 16),
(53, 9, 13, 1),
(51, 9, 13, 3),
(50, 9, 13, 15),
(52, 9, 13, 16);

-- --------------------------------------------------------

--
-- Structure de la table `scanlog`
--

CREATE TABLE `scanlog` (
  `id` varchar(191) NOT NULL,
  `nfcTagId` varchar(191) NOT NULL,
  `ip` varchar(191) DEFAULT NULL,
  `agent` varchar(191) DEFAULT NULL,
  `lat` double DEFAULT NULL,
  `lon` double DEFAULT NULL,
  `country` varchar(191) DEFAULT NULL,
  `city` varchar(191) DEFAULT NULL,
  `at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `securitypolicie`
--

CREATE TABLE `securitypolicie` (
  `id` int(11) NOT NULL,
  `enforce2FA` tinyint(1) DEFAULT 0,
  `ipRestriction` varchar(191) DEFAULT NULL,
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `securitypolicie`
--

INSERT INTO `securitypolicie` (`id`, `enforce2FA`, `ipRestriction`, `updatedAt`) VALUES
(1, 1, 'fgnfgn', '2026-03-24 14:00:36');

-- --------------------------------------------------------

--
-- Structure de la table `setting`
--

CREATE TABLE `setting` (
  `id` varchar(191) NOT NULL,
  `key` varchar(191) NOT NULL,
  `value` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `shipping_rates`
--

CREATE TABLE `shipping_rates` (
  `id` int(10) UNSIGNED NOT NULL,
  `method` enum('standard','express','international') NOT NULL,
  `label` varchar(100) NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `shipping_rates`
--

INSERT INTO `shipping_rates` (`id`, `method`, `label`, `description`, `price`, `active`, `createdAt`, `updatedAt`) VALUES
(1, 'standard', 'Standard delivery', '5-7 business days', 9.19, 1, '2026-03-21 11:44:14', '2026-03-21 11:44:14'),
(2, 'express', 'Express delivery', '2-3 business days', 18.39, 1, '2026-03-21 11:44:14', '2026-03-21 11:44:14'),
(3, 'international', 'International', '10-14 business days', 32.19, 1, '2026-03-21 11:44:14', '2026-03-21 11:44:14');

-- --------------------------------------------------------

--
-- Structure de la table `sms_regions`
--

CREATE TABLE `sms_regions` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `sms_regions`
--

INSERT INTO `sms_regions` (`id`, `name`, `createdAt`, `updatedAt`) VALUES
(1, 'Afrique', '2026-03-24 11:54:52', '2026-03-24 11:54:52'),
(2, 'Europe', '2026-03-24 11:54:52', '2026-03-24 11:54:52'),
(3, 'Amérique du Nord', '2026-03-24 11:54:52', '2026-03-24 11:54:52');

-- --------------------------------------------------------

--
-- Structure de la table `sms_settings`
--

CREATE TABLE `sms_settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `supplier_id` int(10) UNSIGNED NOT NULL,
  `region_id` int(10) UNSIGNED NOT NULL,
  `api_key` varchar(255) DEFAULT NULL,
  `auth_token` varchar(255) DEFAULT NULL,
  `phone_number` varchar(50) DEFAULT NULL,
  `set_default` tinyint(1) DEFAULT 0,
  `status` tinyint(1) DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `sms_settings`
--

INSERT INTO `sms_settings` (`id`, `supplier_id`, `region_id`, `api_key`, `auth_token`, `phone_number`, `set_default`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 2, 2, 'test Api', 'kklklk;lk', '67789980', 1, 1, '2026-03-24 10:55:44', '2026-03-24 10:55:44');

-- --------------------------------------------------------

--
-- Structure de la table `sms_suppliers`
--

CREATE TABLE `sms_suppliers` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `sms_suppliers`
--

INSERT INTO `sms_suppliers` (`id`, `name`, `createdAt`, `updatedAt`) VALUES
(1, 'Twilio', '2026-03-24 11:54:37', '2026-03-24 11:54:37'),
(2, 'Infobip', '2026-03-24 11:54:37', '2026-03-24 11:54:37'),
(3, 'Orange SMS API', '2026-03-24 11:54:37', '2026-03-24 11:54:37');

-- --------------------------------------------------------

--
-- Structure de la table `sms_templates`
--

CREATE TABLE `sms_templates` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `slug` varchar(150) NOT NULL,
  `category` enum('Review','Notification','Auth','Marketing','System') DEFAULT 'Notification',
  `active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `sms_templates`
--

INSERT INTO `sms_templates` (`id`, `name`, `slug`, `category`, `active`, `created_at`, `updated_at`) VALUES
(1, 'Review Request', 'review_request', 'Review', 1, '2026-03-12 16:54:26', '2026-03-12 16:54:26'),
(2, 'Follow-up Reminder', 'follow_up', 'Review', 1, '2026-03-12 16:54:26', '2026-03-12 16:54:26'),
(3, 'Appointment Confirmation', 'appt_confirm', 'Notification', 1, '2026-03-12 16:54:26', '2026-03-12 16:54:26'),
(4, 'Account Verification', 'account_verify', 'Auth', 0, '2026-03-12 16:54:26', '2026-03-12 16:54:26');

-- --------------------------------------------------------

--
-- Structure de la table `sms_template_translations`
--

CREATE TABLE `sms_template_translations` (
  `id` int(11) NOT NULL,
  `template_id` int(11) NOT NULL,
  `language` varchar(5) NOT NULL,
  `body` text NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `sms_template_translations`
--

INSERT INTO `sms_template_translations` (`id`, `template_id`, `language`, `body`, `created_at`) VALUES
(1, 1, 'en', 'Hi {{customer_name}}, thank you for visiting {{company_name}}! Leave review: {{review_link}}', '2026-03-12 16:54:26'),
(2, 2, 'en', 'Hi {{customer_name}}, please share your experience with {{company_name}}: {{review_link}}', '2026-03-12 16:54:26'),
(3, 3, 'en', 'Your appointment at {{company_name}} on {{date}} is confirmed', '2026-03-12 16:54:26'),
(4, 4, 'en', 'Your verification code is {code}', '2026-03-12 16:54:26');

-- --------------------------------------------------------

--
-- Structure de la table `stripeproduct`
--

CREATE TABLE `stripeproduct` (
  `id` varchar(191) NOT NULL,
  `stripeId` varchar(191) NOT NULL,
  `localProductId` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `subscriptions`
--

CREATE TABLE `subscriptions` (
  `id` int(11) NOT NULL,
  `companyId` int(11) NOT NULL,
  `planName` enum('Starter','Growth','Pro','Agency') DEFAULT 'Starter',
  `status` enum('active','trialing','past_due','canceled') DEFAULT 'active',
  `amount` decimal(10,2) NOT NULL COMMENT 'Prix payé pour la période',
  `interval` enum('monthly','yearly') DEFAULT 'monthly',
  `nextBilling` datetime NOT NULL COMMENT 'Date du prochain prélèvement',
  `stripeSubscriptionId` varchar(255) DEFAULT NULL COMMENT 'ID de référence Stripe/Paddle',
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `subscriptions`
--

INSERT INTO `subscriptions` (`id`, `companyId`, `planName`, `status`, `amount`, `interval`, `nextBilling`, `stripeSubscriptionId`, `createdAt`, `updatedAt`) VALUES
(1, 1, 'Growth', 'active', 129.00, 'monthly', '2026-04-15 00:00:00', NULL, '2026-03-13 17:53:26', '2026-03-13 17:53:26');

-- --------------------------------------------------------

--
-- Structure de la table `super_admin_settings`
--

CREATE TABLE `super_admin_settings` (
  `id` int(11) NOT NULL,
  `module` varchar(100) NOT NULL,
  `settings` longtext DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `super_admin_settings`
--

INSERT INTO `super_admin_settings` (`id`, `module`, `settings`, `createdAt`, `updatedAt`) VALUES
(1, 'sms_api_settings', '{\"enableFailover\":true,\"failoverProviderId\":\"\",\"retryAttempts\":2,\"maxPerMinute\":100,\"maxPerDay\":4996,\"globalDailyLimit\":100000}', '2026-03-24 11:56:10.244', '2026-03-24 11:56:16.700');

-- --------------------------------------------------------

--
-- Structure de la table `tag`
--

CREATE TABLE `tag` (
  `id` char(36) NOT NULL,
  `name` varchar(191) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `template`
--

CREATE TABLE `template` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `filename` varchar(191) NOT NULL,
  `description` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `token_blacklist`
--

CREATE TABLE `token_blacklist` (
  `id` int(10) UNSIGNED NOT NULL,
  `token` text NOT NULL,
  `expiresAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `translations`
--

CREATE TABLE `translations` (
  `id` int(11) NOT NULL,
  `keyId` int(11) NOT NULL,
  `languageId` int(11) NOT NULL,
  `value` text DEFAULT NULL,
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `translations`
--

INSERT INTO `translations` (`id`, `keyId`, `languageId`, `value`, `updatedAt`) VALUES
(1, 17, 1, 'About', '2026-03-12 12:50:27'),
(2, 17, 2, 'A propos', '2026-03-12 12:50:27'),
(3, 17, 3, 'Acerca', '2026-03-12 12:50:27'),
(4, 1, 2, 'Accueil modifié', '2026-03-12 12:53:43');

-- --------------------------------------------------------

--
-- Structure de la table `translation_keys`
--

CREATE TABLE `translation_keys` (
  `id` int(11) NOT NULL,
  `key` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `translation_keys`
--

INSERT INTO `translation_keys` (`id`, `key`, `description`, `createdAt`) VALUES
(1, 'nav.home', NULL, '2026-03-12 12:39:19'),
(2, 'nav.features', NULL, '2026-03-12 12:39:19'),
(3, 'nav.pricing', NULL, '2026-03-12 12:39:19'),
(4, 'nav.products', NULL, '2026-03-12 12:39:19'),
(5, 'nav.contact', NULL, '2026-03-12 12:39:19'),
(6, 'nav.faq', NULL, '2026-03-12 12:39:19'),
(7, 'nav.dashboard', NULL, '2026-03-12 12:39:19'),
(8, 'nav.settings', NULL, '2026-03-12 12:39:19'),
(9, 'auth.login', NULL, '2026-03-12 12:39:19'),
(10, 'auth.signup', NULL, '2026-03-12 12:39:19'),
(11, 'common.save', NULL, '2026-03-12 12:39:19'),
(12, 'common.cancel', NULL, '2026-03-12 12:39:19'),
(13, 'common.delete', NULL, '2026-03-12 12:39:19'),
(14, 'common.search', NULL, '2026-03-12 12:39:19'),
(15, 'common.export', NULL, '2026-03-12 12:39:19'),
(16, 'common.import', NULL, '2026-03-12 12:39:19'),
(17, 'nav.about', NULL, '2026-03-12 12:50:27');

-- --------------------------------------------------------

--
-- Structure de la table `upsell`
--

CREATE TABLE `upsell` (
  `id` varchar(191) NOT NULL,
  `productId` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL,
  `price` double NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `id` int(11) UNSIGNED NOT NULL,
  `email` varchar(191) NOT NULL,
  `password` varchar(191) NOT NULL,
  `companyId` int(11) DEFAULT NULL,
  `role` enum('user','admin','owner','manager','superadmin') NOT NULL DEFAULT 'user',
  `name` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `isSuperadmin` tinyint(1) NOT NULL DEFAULT 0,
  `isAdmin` tinyint(1) NOT NULL DEFAULT 0,
  `superadminSince` datetime(3) DEFAULT NULL,
  `superadminLastAt` datetime(3) DEFAULT NULL,
  `roleId` int(11) DEFAULT NULL,
  `twoFa` tinyint(1) DEFAULT 0,
  `lastLogin` datetime DEFAULT NULL,
  `welcomeToken` varchar(200) DEFAULT NULL,
  `welcomeTokenExp` datetime DEFAULT NULL,
  `emailVerifiedAt` datetime DEFAULT NULL,
  `emailVerifyToken` varchar(255) DEFAULT NULL,
  `emailVerifyExp` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `companyId`, `role`, `name`, `phone`, `createdAt`, `updatedAt`, `isSuperadmin`, `isAdmin`, `superadminSince`, `superadminLastAt`, `roleId`, `twoFa`, `lastLogin`, `welcomeToken`, `welcomeTokenExp`, `emailVerifiedAt`, `emailVerifyToken`, `emailVerifyExp`) VALUES
(1, 'superadmin@demo.local', '$2a$10$iY9dA2Uq3rmkudxlfOCgk.rNKcXltRv2/gC1fzLt3eSeeVevTt7rq', NULL, 'superadmin', 'Super Admin', '+33100000000', '2026-03-10 13:48:57.764', '2026-03-24 15:23:17.123', 1, 0, '2026-03-10 13:48:57.741', NULL, NULL, 0, '2026-03-24 15:23:17', NULL, NULL, NULL, NULL, NULL),
(2, 'user@demo.local', '$2a$10$VNnGZE/vHdGV1FZEB4qGTOUkB/hax9jYmr1QO8fbMkJJTzN0If8.e', NULL, 'user', 'Normal User', '+33198765432', '2026-03-10 13:48:57.894', '2026-03-10 13:48:57.894', 0, 0, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL),
(3, 'admin@demo.local', '$2a$10$gzdldd4WhyGDAT54nMeqMOWeJNE8Zo0duKQrRRxST4vASdmb9lV2m', NULL, 'admin', 'Admin User', '+33123456789', '2026-03-10 13:48:57.783', '2026-03-10 13:48:57.783', 0, 0, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL),
(4, 'sarah@redvanta.com', '$2a$10$9wuVKt/puoy8PmnphxdJXu8EEsgKUBJbBs42EjnRV6QcORriJbXvq', NULL, 'user', 'Sarah Chen', NULL, '2026-03-11 17:32:01.273', '2026-03-11 17:32:01.273', 0, 0, NULL, NULL, 2, 0, NULL, NULL, NULL, NULL, NULL, NULL),
(5, 'admin@urbanbites.com', '$2a$12$pSox0aVMXzlcHulPZQTGnemGcJhd3MQCjBz.dvBG8NRIG9jR3tmOO', 5, 'user', 'John Smith', NULL, '2026-03-17 19:08:34.367', '2026-03-17 19:08:34.367', 0, 1, NULL, NULL, 9, 0, NULL, '71738ac81438ffd046ff02b513093983e0b870dcd8e147181d8dfbd4b14b0760', '2026-03-24 19:08:34', NULL, NULL, NULL),
(6, 'admin@test.com', '$2a$12$sengoGlJ8jg4EhEsd05lW.ndc5SS58jr8VZcnWRH2f6ydVMctjelu', 6, 'user', 'John Smith', NULL, '2026-03-17 19:21:30.236', '2026-03-17 19:21:30.236', 0, 1, NULL, NULL, 9, 0, NULL, 'd3ca65c21c847ee6ec35a156110634c650db273956956f70873c0ceb61135de1', '2026-03-24 19:21:30', NULL, NULL, NULL),
(7, 'admin@rodrigue.com', '$2a$12$lCw8tasJtPg9RrqifF8ad.TU0P4CQQmONHmu/nY7ktNmSp/qcIa7e', 7, 'user', 'John Smith', NULL, '2026-03-17 19:31:34.625', '2026-03-17 19:31:34.625', 0, 1, NULL, NULL, 9, 0, NULL, 'fd2ed449aa550ceebf358e8169c46db906a11e0b89ead18f54db94b9e2b0d03e', '2026-03-24 19:31:34', NULL, NULL, NULL),
(8, 'admin@aime.com', '$2a$12$PC4bvY8sCH/Nh9Dhd1.g5uKnKvHAYKGwrJUWsaizd6oRzKiIb83Ou', 8, 'user', 'John Smith', NULL, '2026-03-17 19:32:27.331', '2026-03-17 19:32:27.331', 0, 1, NULL, NULL, 9, 0, NULL, 'b738c61f3231349a5d22acaee3eb1a56adf9f522ca1174f8ff134fbbe2b5554b', '2026-03-24 19:32:27', NULL, NULL, NULL),
(9, 'admin@yaya.com', '$2a$12$KigJ9xrhE6MSzTovK8APz.ySUokMd6URHWyU3xMzASsg2IlNz2rW6', 9, 'user', 'John Smith', NULL, '2026-03-17 19:34:47.885', '2026-03-17 19:34:47.885', 0, 1, NULL, NULL, 9, 0, NULL, 'c9f6dcbeb8ef0d600c40b3cad1ca746df9dc8fab2ee10c8f806f9ac720e6acef', '2026-03-24 19:34:47', NULL, NULL, NULL),
(10, 'admin@youyou.com', '$2a$12$XQ3MJG3FSQvxLN.q823nGump1X/yNjipN.ohyaPA3jRoG5rK94IxG', 10, 'user', 'John Smith', NULL, '2026-03-17 19:43:14.775', '2026-03-17 19:43:14.775', 0, 1, NULL, NULL, 9, 0, NULL, '146f3c55b1d97777ce8c775ca07eb51b94f8efcb1ca54c9070455571db88ebf6', '2026-03-24 19:43:14', NULL, NULL, NULL),
(11, 'admin@youpi.com', '$2a$12$p5uEX1AVOD6UeVfl1ipE0.9TxRQYMoXdZzlRl8F49rFfB.fc22hna', 11, 'user', 'John Smith', NULL, '2026-03-17 19:47:50.949', '2026-03-17 19:47:50.949', 0, 1, NULL, NULL, 9, 0, NULL, 'f5eb6ccf37eaeb315221f53d9cf2f8088602b45f87bd982fdab3039cd36c63a3', '2026-03-24 19:47:50', NULL, NULL, NULL),
(12, 'admin@yoble.com', '$2a$12$/.grXNnfFAQCUhUbZ3dUbu19ktzb206dzyJAWWvv3hOEYuTPfGtV6', 12, 'user', 'John Smith', NULL, '2026-03-17 19:50:43.202', '2026-03-17 19:50:43.202', 0, 1, NULL, NULL, 9, 0, NULL, '24148c3f8fc7aedb6ef80a9e64756a0cc73d6b47b94fcd054123b7ac8884a287', '2026-03-24 19:50:43', NULL, NULL, NULL),
(13, 'admin@youi.com', '$2a$12$Be3APCXaZ2T4WIYJ5oKBHu8s.mQOO5XtmgjhoFX3.3yusTJObH93K', 13, 'user', 'John Smith', NULL, '2026-03-17 19:52:31.519', '2026-03-17 19:52:31.519', 0, 1, NULL, NULL, 9, 0, NULL, '76198408f290bbd942f38fbb04de4ca4b5cd2a7a2f6ee0a79fee0a7a479d207f', '2026-03-24 19:52:31', NULL, NULL, NULL),
(14, 'admin@hhh.com', '$2a$12$h8h4LG1L6tfLKo5uLhE5KupDKFvNHKwb29/BS4ngYW1oz5HTOmmkm', 14, 'user', 'John hhh', NULL, '2026-03-17 19:57:10.707', '2026-03-17 19:57:10.707', 0, 1, NULL, NULL, 9, 0, NULL, 'e7f8cb34561bc1925a01e55ba90392443f13c1b2e7908bf3db65d82ef26090c9', '2026-03-24 19:57:10', NULL, NULL, NULL),
(15, 'admin@yvana.com', '$2a$12$DMfSgvN8pwyKewrc9bmYaerlJHrg4cG1ybshfz5EDKB0fMnOqQvma', NULL, 'user', 'John yvana', NULL, '2026-03-18 12:45:04.953', '2026-03-18 12:45:04.953', 0, 1, NULL, NULL, 9, 0, NULL, '62a3f3dd57f7071fd59a1573b7461e5139d17b7181fc20d5411aa474604e5856', '2026-03-25 12:45:04', NULL, NULL, NULL),
(16, 'admin@vana.com', '$2a$12$jJUMKqARpEtJwOrvIkAo4uLDx.0AjeOKkpeTStPfBbE5Zm/OG.3xG', NULL, 'user', 'John vana', NULL, '2026-03-18 13:03:07.748', '2026-03-18 13:03:07.748', 0, 1, NULL, NULL, 9, 0, NULL, 'deff7e9004d313234b69be9a13390bc4a922dc6a406af6906a68e9588f475e9c', '2026-03-25 13:03:07', NULL, NULL, NULL),
(17, 'admin@vanessa.com', '$2a$12$MYABE0mktzsBp.PCOsUJh.lnRzgBC.OpozY4DomRRorK8YZoGe1X.', NULL, 'user', 'John vanessa', NULL, '2026-03-18 13:28:43.686', '2026-03-18 13:28:43.686', 0, 1, NULL, NULL, 9, 0, NULL, 'd86917da91f23d3b5736b4bd38e2bcb83f514f89c23da70bc54667e800a0cec9', '2026-03-25 13:28:43', NULL, NULL, NULL),
(18, 'admin@niki.com', '$2a$12$NThEUAWjiiFlkMUFzUy7eOFow6E34fLsAJfDYZIpSHKCKJJr07iAO', NULL, 'user', 'John niki', NULL, '2026-03-18 13:31:08.938', '2026-03-18 13:31:08.938', 0, 1, NULL, NULL, 9, 0, NULL, 'c6748ebf2192abd3b11873704690208a17878f76110ea3f1893a6ede3cbf5abb', '2026-03-25 13:31:08', NULL, NULL, NULL),
(19, 'admin@nono.com', '$2a$12$5GQ3lfG/3cgKvNtj5Ln.F.d29zAw2Qeh3CCQzsRnMR/4INYLtc75u', NULL, 'user', 'John nono', NULL, '2026-03-18 13:41:58.477', '2026-03-18 13:41:58.477', 0, 1, NULL, NULL, 9, 0, NULL, '81d5029ab50cbd0081119f8bad87956e693c1ec4245796765a5e771abd302d6a', '2026-03-25 13:41:58', NULL, NULL, NULL),
(20, 'admin@brayn.com', '$2a$12$xIBSmVjtU8JMuUE8pIXlj.KIHxUSLK90b3EEdywTsffaHmORMJcyq', NULL, 'user', 'John brayn', NULL, '2026-03-18 13:43:54.939', '2026-03-18 13:43:54.939', 0, 1, NULL, NULL, 9, 0, NULL, '0838c3c350cd84791779b973053243f11c48a8108de5a5e6d9fd828b7515405c', '2026-03-25 13:43:54', NULL, NULL, NULL),
(21, 'admin@uiihoi.com', '$2a$12$9bE4KZctMNLAoqnI5626lO25O/1bkMxebOj3u3HtKKCRvS6cYx9lG', NULL, 'user', 'John uiihoi', NULL, '2026-03-18 13:47:16.012', '2026-03-18 13:47:16.012', 0, 1, NULL, NULL, 9, 0, NULL, '45053da4d385e25369c1b9463ad86774d2cfe06e4fb4fe1cd3b3404eef0c7f35', '2026-03-25 13:47:15', NULL, NULL, NULL),
(22, 'admin@cassandra.com', '$2a$12$x.UfxtgZ3PZLOIxFfTu6henz0lh7G6lYXoL/oKfcCn1wXm5Clrkau', NULL, 'user', 'John cassandra', NULL, '2026-03-18 13:56:53.578', '2026-03-18 13:56:53.578', 0, 1, NULL, NULL, 9, 0, NULL, 'b3fc470ebf9450b29a75bdcfed27ea751dc99ec1d890ad3a36a4d52fef5fc004', '2026-03-25 13:56:53', NULL, NULL, NULL),
(23, 'superadmin@redvanta.com', '$2a$12$REMPLACER_PAR_LE_VRAI_HASH', NULL, 'user', 'Super Admin', NULL, '2026-03-18 16:01:40.000', '2026-03-18 16:01:40.000', 1, 0, '2026-03-18 16:01:40.000', NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL),
(24, 'admin@mignon.com', '$2a$12$s1kHAgM/mIFTUXcxrlQJPeulMRJ0/FTfMiu2p5sw3Bdv2nEx15eRu', NULL, 'user', 'John mignon', NULL, '2026-03-18 18:41:25.715', '2026-03-18 18:41:25.715', 0, 1, NULL, NULL, 9, 0, NULL, '1ac025e9b2659f74b67bf3250bdb6c942ce5e6aa991d851cac999dedd0f8fad2', '2026-03-25 18:41:25', NULL, NULL, NULL),
(25, 'john@urbanbites.com', '$2a$12$J623/Naw5LZKBO.lGYFukuQXjOAkSWpCBPkgkTha8d3w0YiYlKMOC', NULL, 'user', 'Urban Bites NYC', '+1-212-555-0101', '2026-03-20 12:13:13.481', '2026-03-20 12:13:13.481', 0, 1, NULL, NULL, 9, 0, NULL, NULL, NULL, NULL, 'e18dd1f6ac8196f93e984a506e9b00d3772140285bb2418a5a7874be8409caf1', '2026-03-22 12:13:13'),
(26, 'test@test.gmail', '$2a$12$8Np5Bl3SehVTMoiArJKnXOOMlm.i7PfGGDfRTdFKZgtQc7PqYagta', NULL, 'user', 'userTest', NULL, '2026-03-24 16:14:48.557', '2026-03-24 16:14:48.557', 0, 1, NULL, NULL, 9, 0, NULL, '5cabca2e3883fe0baa55b552fb3dc71a5516db632272c376733692b8b8dac7a3', '2026-03-31 16:14:48', NULL, NULL, NULL),
(27, 'smith@test.com', '$2a$12$vcNRUTsGAOmo2AEg76DrJOU5E3U9h5wXlMe.mfZmS6JTy3HZAVA2u', NULL, 'user', 'smithuser', NULL, '2026-03-24 16:57:41.129', '2026-03-24 17:03:15.901', 0, 1, NULL, NULL, 9, 0, NULL, NULL, NULL, '2026-03-24 17:03:15', NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `user_companies`
--

CREATE TABLE `user_companies` (
  `id` int(10) UNSIGNED NOT NULL,
  `userId` int(11) UNSIGNED NOT NULL,
  `companyId` int(11) NOT NULL,
  `roleId` int(11) DEFAULT NULL,
  `isOwner` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `user_companies`
--

INSERT INTO `user_companies` (`id`, `userId`, `companyId`, `roleId`, `isOwner`, `createdAt`, `updatedAt`) VALUES
(1, 5, 5, 9, 1, '2026-03-18 13:15:14', '2026-03-18 13:15:14'),
(2, 6, 6, 9, 1, '2026-03-18 13:15:14', '2026-03-18 13:15:14'),
(3, 7, 7, 9, 1, '2026-03-18 13:15:14', '2026-03-18 13:15:14'),
(4, 8, 8, 9, 1, '2026-03-18 13:15:14', '2026-03-18 13:15:14'),
(5, 9, 9, 9, 1, '2026-03-18 13:15:14', '2026-03-18 13:15:14'),
(6, 10, 10, 9, 1, '2026-03-18 13:15:14', '2026-03-18 13:15:14'),
(7, 11, 11, 9, 1, '2026-03-18 13:15:14', '2026-03-18 13:15:14'),
(8, 12, 12, 9, 1, '2026-03-18 13:15:14', '2026-03-18 13:15:14'),
(9, 13, 13, 9, 1, '2026-03-18 13:15:14', '2026-03-18 13:15:14'),
(10, 14, 14, 9, 1, '2026-03-18 13:15:14', '2026-03-18 13:15:14'),
(16, 15, 15, 9, 1, '2026-03-18 12:45:04', '2026-03-18 12:45:04'),
(17, 16, 16, 9, 1, '2026-03-18 13:03:07', '2026-03-18 13:03:07'),
(18, 17, 17, 9, 1, '2026-03-18 13:28:43', '2026-03-18 13:28:43'),
(19, 18, 18, 9, 1, '2026-03-18 13:31:08', '2026-03-18 13:31:08'),
(20, 19, 19, 9, 1, '2026-03-18 13:41:58', '2026-03-18 13:41:58'),
(21, 20, 20, 9, 1, '2026-03-18 13:43:54', '2026-03-18 13:43:54'),
(22, 21, 21, 9, 1, '2026-03-18 13:47:16', '2026-03-18 13:47:16'),
(23, 22, 22, 9, 1, '2026-03-18 13:56:53', '2026-03-18 13:56:53'),
(24, 24, 23, 9, 1, '2026-03-18 18:41:25', '2026-03-18 18:41:25'),
(25, 25, 24, 9, 1, '2026-03-20 12:13:13', '2026-03-20 12:13:13'),
(26, 26, 25, 9, 1, '2026-03-24 16:14:48', '2026-03-24 16:14:48'),
(27, 27, 26, 9, 1, '2026-03-24 16:57:41', '2026-03-24 16:57:41');

-- --------------------------------------------------------

--
-- Structure de la table `webhooklog`
--

CREATE TABLE `webhooklog` (
  `id` varchar(191) NOT NULL,
  `provider` varchar(191) NOT NULL,
  `payload` text NOT NULL,
  `status` enum('pending','processed','failed') NOT NULL DEFAULT 'pending',
  `error` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `processedAt` datetime(3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `webhooks`
--

CREATE TABLE `webhooks` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `url` varchar(255) NOT NULL,
  `secret` varchar(100) NOT NULL,
  `events` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`events`)),
  `active` tinyint(1) DEFAULT 1,
  `retryEnabled` tinyint(1) DEFAULT 1,
  `maxRetries` int(11) DEFAULT 3,
  `lastTriggered` datetime DEFAULT NULL,
  `successCount` int(11) DEFAULT 0,
  `failureCount` int(11) DEFAULT 0,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `webhooks`
--

INSERT INTO `webhooks` (`id`, `name`, `url`, `secret`, `events`, `active`, `retryEnabled`, `maxRetries`, `lastTriggered`, `successCount`, `failureCount`, `createdAt`, `updatedAt`) VALUES
(1, 'CRM Sync', 'https://crm.example.com/hooks', 'whsec_test123', '[\"account.created\", \"account.updated\"]', 1, 1, 3, NULL, 98, 2, '2026-03-13 17:07:49', '2026-03-13 17:07:49'),
(2, 'Production Slack Bot', 'https://hooks.slack.com/services/...', 'whsec_136261253d9dadef64caeabe85255a61', '[\"account.deleted\",\"subscription.cancelled\"]', 1, 1, 5, NULL, 0, 0, '2026-03-13 16:23:18', '2026-03-13 16:23:18');

-- --------------------------------------------------------

--
-- Structure de la table `_prisma_migrations`
--

CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text DEFAULT NULL,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `applied_steps_count` int(10) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `_prisma_migrations`
--

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
('17903d57-1a97-4139-9048-d04e65e1a76b', '30e6c689fe60eaea53565cbf4f34d201daf147c1b54428e1d99d0f5e27d186bd', '2026-03-10 18:45:58.562', '20260310184558_create_roles_permissions', NULL, NULL, '2026-03-10 18:45:58.522', 1),
('1aca2219-9720-495d-8c5c-7e55c71c51b3', '47035d58d062a9858073fdec395a3482ffe680e7a144efd02b4698b071a2eb68', '2026-03-10 16:56:56.596', '20260310165656_create_addon_settings_table', NULL, NULL, '2026-03-10 16:56:56.563', 1),
('3edb92bb-33d1-42a2-8296-bea67cf6c615', 'c3cf6bbf96f4572211bd1000bd9e1a29308f0b0779f312bd34f553e9a4d85c88', '2026-03-10 13:48:43.412', '20260302120000_add_superadmin_fields_to_users', NULL, NULL, '2026-03-10 13:48:43.391', 1),
('42720641-c9b7-4228-883f-f180313c63c6', '60878edf06bb685e712257d13f6b5c0faef873e24b43ddda501bd3cfb05f85e7', '2026-03-10 13:48:55.331', '20260310134854_create_plan_settings', NULL, NULL, '2026-03-10 13:48:54.869', 1),
('7977c385-7981-4610-b2ef-7cfbd39bab82', 'dd936dd36846adfeb005ceb65b8c936022c68e08aa97a217a1485224df433419', '2026-03-10 13:48:43.347', '20251128212527_', NULL, NULL, '2026-03-10 13:48:42.285', 1),
('8c87fef3-0a61-49cd-b827-e22ddd23f5aa', 'ddc8da732dfaba597db32abf1b58ce9cf087f59ca7036f6e197a826b5b34fcff', '2026-03-10 15:42:00.037', '20260310154159_create_addon_settings', NULL, NULL, '2026-03-10 15:42:00.009', 1),
('91fa58a2-dbb1-4d8b-9c7a-8d8a06d90c04', '77e04103de39fbab5448272962ed73ab2428860968d4ea5001e75ba0e9d4fea4', '2026-03-10 13:48:42.280', '20251128191734_init', NULL, NULL, '2026-03-10 13:48:38.301', 1),
('956e8680-0210-4225-8312-30fcc8523b33', '84caedb35ecd1277fc4742dc4ad13ed1a59844833ff5716347d65e4d5174d410', '2026-03-10 13:48:43.367', '20251128212816_krootal', NULL, NULL, '2026-03-10 13:48:43.352', 1),
('d5e945db-941d-4998-8da0-b5a63375e949', '84caedb35ecd1277fc4742dc4ad13ed1a59844833ff5716347d65e4d5174d410', '2026-03-10 13:48:43.387', '20260222103832_initinit', NULL, NULL, '2026-03-10 13:48:43.372', 1);

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `addonsetting`
--
ALTER TABLE `addonsetting`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `adminusers`
--
ALTER TABLE `adminusers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `roleId` (`roleId`);

--
-- Index pour la table `affiliates`
--
ALTER TABLE `affiliates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `affiliates_refCode_key` (`refCode`),
  ADD UNIQUE KEY `affiliates_userId_key` (`userId`);

--
-- Index pour la table `affiliate_tracking`
--
ALTER TABLE `affiliate_tracking`
  ADD PRIMARY KEY (`id`),
  ADD KEY `affiliate_tracking_orderId_idx` (`orderId`),
  ADD KEY `affiliate_tracking_affiliateId_fkey` (`affiliateId`);

--
-- Index pour la table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `FK_auditlog_admin` (`adminId`);

--
-- Index pour la table `bundle`
--
ALTER TABLE `bundle`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `bundleproduct`
--
ALTER TABLE `bundleproduct`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `BundleProduct_bundleId_productId_key` (`bundleId`,`productId`),
  ADD KEY `BundleProduct_productId_fkey` (`productId`);

--
-- Index pour la table `card_type`
--
ALTER TABLE `card_type`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `card_type_price`
--
ALTER TABLE `card_type_price`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_unique_product_cardtype` (`productId`,`cardTypeId`),
  ADD KEY `fk_ctp_cardtype` (`cardTypeId`);

--
-- Index pour la table `cart_items`
--
ALTER TABLE `cart_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `designId` (`designId`),
  ADD UNIQUE KEY `uq_ci_user_company_product_design` (`userId`,`companyId`,`productId`,`designId`),
  ADD KEY `idx_ci_user_company` (`userId`,`companyId`),
  ADD KEY `idx_ci_product` (`productId`),
  ADD KEY `fk_ci_company` (`companyId`),
  ADD KEY `fk_cart_items_package_tier` (`packageTierId`);

--
-- Index pour la table `click`
--
ALTER TABLE `click`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Click_affiliateId_fkey` (`affiliateId`);

--
-- Index pour la table `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `companies_planId_foreign` (`planId`),
  ADD KEY `companies_defaultLanguageId_foreign` (`defaultLanguageId`);

--
-- Index pour la table `company_settings`
--
ALTER TABLE `company_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `company_settings_company_id_foreign` (`companyId`);

--
-- Index pour la table `conversions`
--
ALTER TABLE `conversions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `conversions_orderId_fkey` (`orderId`),
  ADD KEY `conversions_affiliateId_fkey` (`affiliateId`);

--
-- Index pour la table `customization`
--
ALTER TABLE `customization`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Customization_orderId_key` (`orderId`);

--
-- Index pour la table `dashboardstat`
--
ALTER TABLE `dashboardstat`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `dashboardStat_key_key` (`key`);

--
-- Index pour la table `design`
--
ALTER TABLE `design`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Design_user_id_foreign` (`user_id`) USING BTREE;

--
-- Index pour la table `designs`
--
ALTER TABLE `designs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idxDUserCompany` (`userId`,`companyId`),
  ADD KEY `idxDStatus` (`status`),
  ADD KEY `fkDCompany` (`companyId`),
  ADD KEY `fkDProduct` (`productId`);

--
-- Index pour la table `design_versions`
--
ALTER TABLE `design_versions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idxDvDesign` (`designId`);

--
-- Index pour la table `emailqueue`
--
ALTER TABLE `emailqueue`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `email_server_config`
--
ALTER TABLE `email_server_config`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `email_templates`
--
ALTER TABLE `email_templates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Index pour la table `email_template_translations`
--
ALTER TABLE `email_template_translations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `templateId` (`templateId`,`languageId`),
  ADD KEY `fk_language` (`languageId`);

--
-- Index pour la table `featureflag`
--
ALTER TABLE `featureflag`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `feature_flags_name_unique` (`name`);

--
-- Index pour la table `global_currencies`
--
ALTER TABLE `global_currencies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Index pour la table `global_currency_settings`
--
ALTER TABLE `global_currency_settings`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `google_place_cache`
--
ALTER TABLE `google_place_cache`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `placeId` (`placeId`),
  ADD KEY `idx_placeId` (`placeId`),
  ADD KEY `idx_expiresAt` (`expiresAt`);

--
-- Index pour la table `job_logs`
--
ALTER TABLE `job_logs`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `languages`
--
ALTER TABLE `languages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Index pour la table `locations`
--
ALTER TABLE `locations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `locations_slug_key` (`slug`),
  ADD KEY `locations_ownerId_idx` (`ownerId`);

--
-- Index pour la table `login_activities`
--
ALTER TABLE `login_activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `loginActivity_user_id_foreign` (`userId`) USING BTREE;

--
-- Index pour la table `manual_payment_methods`
--
ALTER TABLE `manual_payment_methods`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `module`
--
ALTER TABLE `module`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Index pour la table `nfctag`
--
ALTER TABLE `nfctag`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `NFCTag_uid_key` (`uid`),
  ADD KEY `NFCTag_locationId_fkey` (`locationId`),
  ADD KEY `NFCTag_productId_fkey` (`productId`),
  ADD KEY `NFCTag_userId_fkey` (`userId`),
  ADD KEY `NFCTag_designId_fkey` (`designId`);

--
-- Index pour la table `nfc_cards`
--
ALTER TABLE `nfc_cards`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nfc_cards_uid_key` (`uid`),
  ADD KEY `nfc_cards_locationId_fkey` (`locationId`);

--
-- Index pour la table `nfc_scans`
--
ALTER TABLE `nfc_scans`
  ADD PRIMARY KEY (`id`),
  ADD KEY `nfc_scans_cardId_fkey` (`cardId`);

--
-- Index pour la table `notification_logs`
--
ALTER TABLE `notification_logs`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `order`
--
ALTER TABLE `order`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `orderNumber` (`orderNumber`),
  ADD UNIQUE KEY `stripePaymentIntentId` (`stripePaymentIntentId`),
  ADD KEY `idxOUserCompany` (`userId`,`companyId`),
  ADD KEY `idxOStatus` (`status`),
  ADD KEY `fkOCompany` (`companyId`);

--
-- Index pour la table `orderitem`
--
ALTER TABLE `orderitem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `OrderItem_productId_fkey` (`productId`),
  ADD KEY `OrderItem_orderId_fkey` (`orderId`);

--
-- Index pour la table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `orders_orderNumber_key` (`orderNumber`),
  ADD KEY `orders_userId_fkey` (`userId`),
  ADD KEY `orders_locationId_fkey` (`locationId`),
  ADD KEY `orders_affiliateId_fkey` (`affiliateId`);

--
-- Index pour la table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `designId` (`designId`),
  ADD KEY `idxOiOrder` (`orderId`),
  ADD KEY `fkOiProduct` (`productId`),
  ADD KEY `fk_order_items_package_tier` (`packageTierId`);

--
-- Index pour la table `payment_gateways`
--
ALTER TABLE `payment_gateways`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `payment_logs`
--
ALTER TABLE `payment_logs`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `payment_settings`
--
ALTER TABLE `payment_settings`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `payoutrequest`
--
ALTER TABLE `payoutrequest`
  ADD PRIMARY KEY (`id`),
  ADD KEY `PayoutRequest_affiliateId_fkey` (`affiliateId`);

--
-- Index pour la table `permission`
--
ALTER TABLE `permission`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Index pour la table `plansetting`
--
ALTER TABLE `plansetting`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `platform_settings`
--
ALTER TABLE `platform_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `platform_settings_sms_setting_id_idx` (`sms_setting_id`);

--
-- Index pour la table `product`
--
ALTER TABLE `product`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_product_active` (`active`);

--
-- Index pour la table `product_gallery_item`
--
ALTER TABLE `product_gallery_item`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_gallery_position` (`productId`,`position`);

--
-- Index pour la table `product_package_tier`
--
ALTER TABLE `product_package_tier`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_unique_product_qty` (`productId`,`qty`);

--
-- Index pour la table `product_translation`
--
ALTER TABLE `product_translation`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_unique_product_lang` (`productId`,`langId`),
  ADD UNIQUE KEY `idx_unique_lang_slug` (`langId`,`slug`),
  ADD KEY `idx_translation_lang` (`langId`),
  ADD KEY `product_translation_langId_foreign` (`langId`) USING BTREE;

--
-- Index pour la table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `idx_rt_user` (`userId`);

--
-- Index pour la table `reviews`
--
ALTER TABLE `reviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reviews_locationId_idx` (`locationId`),
  ADD KEY `reviews_userId_fkey` (`userId`);

--
-- Index pour la table `role`
--
ALTER TABLE `role`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Index pour la table `rolepermission`
--
ALTER TABLE `rolepermission`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_role_module_permission` (`roleId`,`moduleId`,`permissionId`),
  ADD KEY `fk_rolepermission_module` (`moduleId`),
  ADD KEY `fk_rolepermission_permission` (`permissionId`);

--
-- Index pour la table `scanlog`
--
ALTER TABLE `scanlog`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ScanLog_nfcTagId_fkey` (`nfcTagId`);

--
-- Index pour la table `securitypolicie`
--
ALTER TABLE `securitypolicie`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `setting`
--
ALTER TABLE `setting`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Setting_key_key` (`key`);

--
-- Index pour la table `shipping_rates`
--
ALTER TABLE `shipping_rates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `method` (`method`);

--
-- Index pour la table `sms_regions`
--
ALTER TABLE `sms_regions`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `sms_settings`
--
ALTER TABLE `sms_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_sms_region` (`region_id`),
  ADD KEY `fk_sms_supplier` (`supplier_id`);

--
-- Index pour la table `sms_suppliers`
--
ALTER TABLE `sms_suppliers`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `sms_templates`
--
ALTER TABLE `sms_templates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Index pour la table `sms_template_translations`
--
ALTER TABLE `sms_template_translations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_sms_template` (`template_id`);

--
-- Index pour la table `stripeproduct`
--
ALTER TABLE `stripeproduct`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `StripeProduct_stripeId_key` (`stripeId`);

--
-- Index pour la table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `companyId` (`companyId`);

--
-- Index pour la table `super_admin_settings`
--
ALTER TABLE `super_admin_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `super_admin_settings_module_key` (`module`);

--
-- Index pour la table `tag`
--
ALTER TABLE `tag`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Tag_name_key` (`name`);

--
-- Index pour la table `template`
--
ALTER TABLE `template`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `token_blacklist`
--
ALTER TABLE `token_blacklist`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_expires` (`expiresAt`);

--
-- Index pour la table `translations`
--
ALTER TABLE `translations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `keyId` (`keyId`,`languageId`),
  ADD KEY `languageId` (`languageId`);

--
-- Index pour la table `translation_keys`
--
ALTER TABLE `translation_keys`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `key` (`key`);

--
-- Index pour la table `upsell`
--
ALTER TABLE `upsell`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Upsell_productId_fkey` (`productId`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_key` (`email`),
  ADD UNIQUE KEY `emailVerifyToken` (`emailVerifyToken`),
  ADD KEY `users_email_idx` (`email`),
  ADD KEY `users_companyId_foreign` (`companyId`);

--
-- Index pour la table `user_companies`
--
ALTER TABLE `user_companies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_company` (`userId`,`companyId`),
  ADD KEY `idx_company_id` (`companyId`),
  ADD KEY `idx_user_id` (`userId`),
  ADD KEY `fk_uc_role` (`roleId`);

--
-- Index pour la table `webhooklog`
--
ALTER TABLE `webhooklog`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `webhooks`
--
ALTER TABLE `webhooks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `secret` (`secret`);

--
-- Index pour la table `_prisma_migrations`
--
ALTER TABLE `_prisma_migrations`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `addonsetting`
--
ALTER TABLE `addonsetting`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `adminusers`
--
ALTER TABLE `adminusers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `bundle`
--
ALTER TABLE `bundle`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `bundleproduct`
--
ALTER TABLE `bundleproduct`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `card_type_price`
--
ALTER TABLE `card_type_price`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT pour la table `cart_items`
--
ALTER TABLE `cart_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `companies`
--
ALTER TABLE `companies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT pour la table `company_settings`
--
ALTER TABLE `company_settings`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT pour la table `designs`
--
ALTER TABLE `designs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `design_versions`
--
ALTER TABLE `design_versions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `email_templates`
--
ALTER TABLE `email_templates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT pour la table `email_template_translations`
--
ALTER TABLE `email_template_translations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT pour la table `featureflag`
--
ALTER TABLE `featureflag`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT pour la table `global_currencies`
--
ALTER TABLE `global_currencies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT pour la table `global_currency_settings`
--
ALTER TABLE `global_currency_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `google_place_cache`
--
ALTER TABLE `google_place_cache`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `languages`
--
ALTER TABLE `languages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT pour la table `login_activities`
--
ALTER TABLE `login_activities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `manual_payment_methods`
--
ALTER TABLE `manual_payment_methods`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT pour la table `module`
--
ALTER TABLE `module`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT pour la table `order`
--
ALTER TABLE `order`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `payment_gateways`
--
ALTER TABLE `payment_gateways`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `payment_logs`
--
ALTER TABLE `payment_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `payment_settings`
--
ALTER TABLE `payment_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `permission`
--
ALTER TABLE `permission`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT pour la table `plansetting`
--
ALTER TABLE `plansetting`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT pour la table `platform_settings`
--
ALTER TABLE `platform_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `product`
--
ALTER TABLE `product`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT pour la table `product_gallery_item`
--
ALTER TABLE `product_gallery_item`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `product_package_tier`
--
ALTER TABLE `product_package_tier`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT pour la table `product_translation`
--
ALTER TABLE `product_translation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT pour la table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `role`
--
ALTER TABLE `role`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT pour la table `rolepermission`
--
ALTER TABLE `rolepermission`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=102;

--
-- AUTO_INCREMENT pour la table `securitypolicie`
--
ALTER TABLE `securitypolicie`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `shipping_rates`
--
ALTER TABLE `shipping_rates`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT pour la table `sms_regions`
--
ALTER TABLE `sms_regions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT pour la table `sms_settings`
--
ALTER TABLE `sms_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `sms_suppliers`
--
ALTER TABLE `sms_suppliers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT pour la table `sms_templates`
--
ALTER TABLE `sms_templates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `sms_template_translations`
--
ALTER TABLE `sms_template_translations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `subscriptions`
--
ALTER TABLE `subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `super_admin_settings`
--
ALTER TABLE `super_admin_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `token_blacklist`
--
ALTER TABLE `token_blacklist`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `translations`
--
ALTER TABLE `translations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `translation_keys`
--
ALTER TABLE `translation_keys`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT pour la table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT pour la table `user_companies`
--
ALTER TABLE `user_companies`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT pour la table `webhooks`
--
ALTER TABLE `webhooks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `adminusers`
--
ALTER TABLE `adminusers`
  ADD CONSTRAINT `adminusers_ibfk_1` FOREIGN KEY (`roleId`) REFERENCES `role` (`id`);

--
-- Contraintes pour la table `affiliates`
--
ALTER TABLE `affiliates`
  ADD CONSTRAINT `affiliates_userId_key` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `affiliate_tracking`
--
ALTER TABLE `affiliate_tracking`
  ADD CONSTRAINT `affiliate_tracking_affiliateId_fkey` FOREIGN KEY (`affiliateId`) REFERENCES `affiliates` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `affiliate_tracking_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `FK_auditlog_admin` FOREIGN KEY (`adminId`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `bundleproduct`
--
ALTER TABLE `bundleproduct`
  ADD CONSTRAINT `BundleProduct_bundleId_fkey` FOREIGN KEY (`bundleId`) REFERENCES `bundle` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `card_type_price`
--
ALTER TABLE `card_type_price`
  ADD CONSTRAINT `fk_ctp_cardtype` FOREIGN KEY (`cardTypeId`) REFERENCES `card_type` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ctp_product` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `cart_items`
--
ALTER TABLE `cart_items`
  ADD CONSTRAINT `fk_cart_items_package_tier` FOREIGN KEY (`packageTierId`) REFERENCES `product_package_tier` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ci_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ci_design` FOREIGN KEY (`designId`) REFERENCES `designs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ci_product` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ci_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `click`
--
ALTER TABLE `click`
  ADD CONSTRAINT `Click_affiliateId_fkey` FOREIGN KEY (`affiliateId`) REFERENCES `affiliates` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `companies`
--
ALTER TABLE `companies`
  ADD CONSTRAINT `companies_planId_foreign` FOREIGN KEY (`planId`) REFERENCES `plansetting` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `conversions`
--
ALTER TABLE `conversions`
  ADD CONSTRAINT `conversions_affiliateId_fkey` FOREIGN KEY (`affiliateId`) REFERENCES `affiliates` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `conversions_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `customization`
--
ALTER TABLE `customization`
  ADD CONSTRAINT `Customization_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `design`
--
ALTER TABLE `design`
  ADD CONSTRAINT `Design_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `designs`
--
ALTER TABLE `designs`
  ADD CONSTRAINT `fkDCompany` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fkDProduct` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fkDUser` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `design_versions`
--
ALTER TABLE `design_versions`
  ADD CONSTRAINT `fkDvDesign` FOREIGN KEY (`designId`) REFERENCES `designs` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `email_template_translations`
--
ALTER TABLE `email_template_translations`
  ADD CONSTRAINT `fk_language` FOREIGN KEY (`languageId`) REFERENCES `languages` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_template` FOREIGN KEY (`templateId`) REFERENCES `email_templates` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `locations`
--
ALTER TABLE `locations`
  ADD CONSTRAINT `locations_ownerId_idx` FOREIGN KEY (`ownerId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `login_activities`
--
ALTER TABLE `login_activities`
  ADD CONSTRAINT `loginActivity_user_id_foreign` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `nfctag`
--
ALTER TABLE `nfctag`
  ADD CONSTRAINT `NFCTag_designId_fkey` FOREIGN KEY (`designId`) REFERENCES `design` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `NFCTag_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `nfc_cards`
--
ALTER TABLE `nfc_cards`
  ADD CONSTRAINT `nfc_cards_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `nfc_scans`
--
ALTER TABLE `nfc_scans`
  ADD CONSTRAINT `nfc_scans_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `nfc_cards` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `order`
--
ALTER TABLE `order`
  ADD CONSTRAINT `fkOCompany` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fkOUser` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `orderitem`
--
ALTER TABLE `orderitem`
  ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_affiliateId_fkey` FOREIGN KEY (`affiliateId`) REFERENCES `affiliates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `orders_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `fkOiDesign` FOREIGN KEY (`designId`) REFERENCES `designs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fkOiOrder` FOREIGN KEY (`orderId`) REFERENCES `order` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fkOiProduct` FOREIGN KEY (`productId`) REFERENCES `product` (`id`),
  ADD CONSTRAINT `fk_order_items_package_tier` FOREIGN KEY (`packageTierId`) REFERENCES `product_package_tier` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `payoutrequest`
--
ALTER TABLE `payoutrequest`
  ADD CONSTRAINT `PayoutRequest_affiliateId_fkey` FOREIGN KEY (`affiliateId`) REFERENCES `affiliates` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `platform_settings`
--
ALTER TABLE `platform_settings`
  ADD CONSTRAINT `platform_settings_sms_setting_id_fkey` FOREIGN KEY (`sms_setting_id`) REFERENCES `sms_settings` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `product_gallery_item`
--
ALTER TABLE `product_gallery_item`
  ADD CONSTRAINT `fk_gallery_product` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `product_package_tier`
--
ALTER TABLE `product_package_tier`
  ADD CONSTRAINT `fk_tier_product` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `product_translation`
--
ALTER TABLE `product_translation`
  ADD CONSTRAINT `fk_translation_product` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD CONSTRAINT `fk_rt_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `reviews`
--
ALTER TABLE `reviews`
  ADD CONSTRAINT `reviews_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `rolepermission`
--
ALTER TABLE `rolepermission`
  ADD CONSTRAINT `fk_rolepermission_module` FOREIGN KEY (`moduleId`) REFERENCES `module` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rolepermission_permission` FOREIGN KEY (`permissionId`) REFERENCES `permission` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rolepermission_role` FOREIGN KEY (`roleId`) REFERENCES `role` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `scanlog`
--
ALTER TABLE `scanlog`
  ADD CONSTRAINT `ScanLog_nfcTagId_fkey` FOREIGN KEY (`nfcTagId`) REFERENCES `nfctag` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `sms_settings`
--
ALTER TABLE `sms_settings`
  ADD CONSTRAINT `fk_sms_region` FOREIGN KEY (`region_id`) REFERENCES `sms_regions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sms_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `sms_suppliers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `sms_template_translations`
--
ALTER TABLE `sms_template_translations`
  ADD CONSTRAINT `fk_sms_template` FOREIGN KEY (`template_id`) REFERENCES `sms_templates` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD CONSTRAINT `fk_subscription_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `translations`
--
ALTER TABLE `translations`
  ADD CONSTRAINT `translations_ibfk_1` FOREIGN KEY (`keyId`) REFERENCES `translation_keys` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `translations_ibfk_2` FOREIGN KEY (`languageId`) REFERENCES `languages` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_companyId_foreign` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `user_companies`
--
ALTER TABLE `user_companies`
  ADD CONSTRAINT `fk_uc_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_uc_role` FOREIGN KEY (`roleId`) REFERENCES `role` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_uc_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE;

DELIMITER $$
--
-- Évènements
--
CREATE DEFINER=`root`@`localhost` EVENT `purge_expired_tokens` ON SCHEDULE EVERY 1 HOUR STARTS '2026-03-18 17:24:52' ON COMPLETION NOT PRESERVE ENABLE DO DELETE FROM `token_blacklist` WHERE `expires_at` < NOW()$$

CREATE DEFINER=`root`@`localhost` EVENT `suspend_unverified_companies` ON SCHEDULE EVERY 6 HOUR STARTS '2026-03-19 20:01:31' ON COMPLETION NOT PRESERVE ENABLE DO UPDATE `companies` c
    INNER JOIN `user_companies` uc ON uc.companyId = c.id AND uc.isOwner = 1
    INNER JOIN `users` u           ON u.id = uc.userId
    SET c.`status` = 'suspended'
    WHERE c.`status`              = 'active'
      AND u.`emailVerifiedAt`   IS NULL
      AND u.`emailVerifyExp`    IS NOT NULL   -- ← seulement les comptes client signup
      AND u.`createdAt`          < DATE_SUB(NOW(), INTERVAL 48 HOUR)$$

DELIMITER ;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
