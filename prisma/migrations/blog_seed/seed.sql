-- ============================================================
-- Blog — données initiales (seed)
-- Exécuter après blog_initial/migration.sql
-- ============================================================

SET NAMES utf8mb4;

-- ── Catégories ───────────────────────────────────────────────

INSERT IGNORE INTO `blog_categories` (`id`, `slug`, `displayOrder`, `createdAt`, `updatedAt`) VALUES
  ('c-tech',      'technology', 0, NOW(3), NOW(3)),
  ('c-design',    'design',     1, NOW(3), NOW(3)),
  ('c-business',  'business',   2, NOW(3), NOW(3)),
  ('c-lifestyle', 'lifestyle',  3, NOW(3), NOW(3)),
  ('c-travel',    'travel',     4, NOW(3), NOW(3));

INSERT IGNORE INTO `blog_category_translations`
  (`categoryId`, `lang`, `slug`, `name`, `description`, `metaTitle`, `metaDesc`, `createdAt`, `updatedAt`) VALUES
  ('c-tech',      'en', 'technology', 'Technology', 'Latest in tech and engineering.', NULL, NULL, NOW(3), NOW(3)),
  ('c-design',    'en', 'design',     'Design',     'Visual and product design.',      NULL, NULL, NOW(3), NOW(3)),
  ('c-business',  'en', 'business',   'Business',   'Startups and strategy.',          NULL, NULL, NOW(3), NOW(3)),
  ('c-lifestyle', 'en', 'lifestyle',  'Lifestyle',  'Wellness and balance.',           NULL, NULL, NOW(3), NOW(3)),
  ('c-travel',    'en', 'travel',     'Travel',     'Adventures around the world.',    NULL, NULL, NOW(3), NOW(3));

-- ── Tags ─────────────────────────────────────────────────────

INSERT IGNORE INTO `blog_tags` (`id`, `slug`, `createdAt`, `updatedAt`) VALUES
  ('t-react',        'react',        NOW(3), NOW(3)),
  ('t-typescript',   'typescript',   NOW(3), NOW(3)),
  ('t-ui-ux',        'ui-ux',        NOW(3), NOW(3)),
  ('t-productivity', 'productivity', NOW(3), NOW(3)),
  ('t-startups',     'startups',     NOW(3), NOW(3)),
  ('t-remote-work',  'remote-work',  NOW(3), NOW(3)),
  ('t-minimalism',   'minimalism',   NOW(3), NOW(3)),
  ('t-photography',  'photography',  NOW(3), NOW(3)),
  ('t-adventure',    'adventure',    NOW(3), NOW(3)),
  ('t-wellness',     'wellness',     NOW(3), NOW(3)),
  ('t-innovation',   'innovation',   NOW(3), NOW(3)),
  ('t-creativity',   'creativity',   NOW(3), NOW(3));

INSERT IGNORE INTO `blog_tag_translations` (`tagId`, `lang`, `slug`, `name`, `createdAt`, `updatedAt`) VALUES
  ('t-react',        'en', 'react',        'React',        NOW(3), NOW(3)),
  ('t-typescript',   'en', 'typescript',   'TypeScript',   NOW(3), NOW(3)),
  ('t-ui-ux',        'en', 'ui-ux',        'UI/UX',        NOW(3), NOW(3)),
  ('t-productivity', 'en', 'productivity', 'Productivity', NOW(3), NOW(3)),
  ('t-startups',     'en', 'startups',     'Startups',     NOW(3), NOW(3)),
  ('t-remote-work',  'en', 'remote-work',  'Remote Work',  NOW(3), NOW(3)),
  ('t-minimalism',   'en', 'minimalism',   'Minimalism',   NOW(3), NOW(3)),
  ('t-photography',  'en', 'photography',  'Photography',  NOW(3), NOW(3)),
  ('t-adventure',    'en', 'adventure',    'Adventure',    NOW(3), NOW(3)),
  ('t-wellness',     'en', 'wellness',     'Wellness',     NOW(3), NOW(3)),
  ('t-innovation',   'en', 'innovation',   'Innovation',   NOW(3), NOW(3)),
  ('t-creativity',   'en', 'creativity',   'Creativity',   NOW(3), NOW(3));

-- ── Articles ─────────────────────────────────────────────────

INSERT IGNORE INTO `blog_articles`
  (`id`, `slug`, `image`, `author`, `date`, `readTime`, `published`, `publishedAt`, `categoryId`, `createdAt`, `updatedAt`) VALUES
  ('a-1', 'art-of-scalable-react',
   'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80',
   'Sarah Chen',    'Dec 24, 2025', '8 min read',  1, '2025-12-24 12:00:00.000', 'c-tech',      '2025-12-24 12:00:00.000', '2025-12-24 12:00:00.000'),
  ('a-2', 'designing-for-emotion',
   'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80',
   'Marcus Webb',   'Dec 22, 2025', '6 min read',  1, '2025-12-22 12:00:00.000', 'c-design',    '2025-12-22 12:00:00.000', '2025-12-22 12:00:00.000'),
  ('a-3', 'side-project-to-startup',
   'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
   'Alex Rivera',   'Dec 20, 2025', '12 min read', 1, '2025-12-20 12:00:00.000', 'c-business',  '2025-12-20 12:00:00.000', '2025-12-20 12:00:00.000'),
  ('a-4', 'remote-work-revolution',
   'https://images.unsplash.com/photo-1521898284481-a5ec348cb555?w=800&q=80',
   'Emma Thompson', 'Dec 18, 2025', '7 min read',  1, '2025-12-18 12:00:00.000', 'c-business',  '2025-12-18 12:00:00.000', '2025-12-18 12:00:00.000'),
  ('a-5', 'minimalist-digital-life',
   'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80',
   'Jordan Lee',    'Dec 15, 2025', '5 min read',  1, '2025-12-15 12:00:00.000', 'c-lifestyle', '2025-12-15 12:00:00.000', '2025-12-15 12:00:00.000'),
  ('a-6', 'photography-iceland',
   'https://images.unsplash.com/photo-1520769669658-f07657f5a307?w=800&q=80',
   'Nina Patel',    'Dec 12, 2025', '10 min read', 1, '2025-12-12 12:00:00.000', 'c-travel',    '2025-12-12 12:00:00.000', '2025-12-12 12:00:00.000'),
  ('a-7', 'typescript-best-practices',
   'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&q=80',
   'David Kim',     'Dec 10, 2025', '9 min read',  1, '2025-12-10 12:00:00.000', 'c-tech',      '2025-12-10 12:00:00.000', '2025-12-10 12:00:00.000'),
  ('a-8', 'psychology-of-color',
   'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&q=80',
   'Lisa Park',     'Dec 8, 2025',  '6 min read',  1, '2025-12-08 12:00:00.000', 'c-design',    '2025-12-08 12:00:00.000', '2025-12-08 12:00:00.000');

-- ── Traductions des articles ──────────────────────────────────

INSERT IGNORE INTO `blog_article_translations`
  (`articleId`, `lang`, `slug`, `title`, `excerpt`, `content`, `metaTitle`, `metaDescription`, `createdAt`, `updatedAt`) VALUES
(
  'a-1', 'en', 'art-of-scalable-react',
  'The Art of Building Scalable React Applications',
  'Discover patterns and practices that will help you build maintainable, performant React applications that scale with your team.',
  '<p>Discover patterns and practices that will help you build maintainable, performant React applications that scale with your team.</p><h2>Foundations</h2><p>Structure, state, and seams matter more than any single library.</p>',
  'Scalable React Patterns',
  'Patterns and practices to build maintainable, performant React applications that scale with your team.',
  NOW(3), NOW(3)
),
(
  'a-2', 'en', 'designing-for-emotion',
  'Designing for Emotion: Creating Memorable User Experiences',
  'Learn how emotional design principles can transform ordinary interfaces into experiences users love and remember.',
  '<p>Emotional design turns interfaces into experiences. Here is how to do it well.</p>',
  'Designing for Emotion',
  'How emotional design principles can transform ordinary interfaces into experiences users love and remember.',
  NOW(3), NOW(3)
),
(
  'a-3', 'en', 'side-project-to-startup',
  'From Side Project to Startup: A Founder''s Journey',
  'The untold story of turning a weekend project into a venture-backed company, with all the lessons learned along the way.',
  '<p>The untold story of turning a weekend project into a venture-backed company.</p>',
  'From Side Project to Startup',
  'Turning a weekend project into a venture-backed company — every lesson along the way.',
  NOW(3), NOW(3)
),
(
  'a-4', 'en', 'remote-work-revolution',
  'The Remote Work Revolution: Building Culture Across Time Zones',
  'Strategies for maintaining team cohesion and building authentic relationships when your office spans the globe.',
  '<p>Building real culture across time zones takes intentional rituals.</p>',
  'Remote Work Culture',
  'How to maintain team cohesion and build authentic relationships when your office spans the globe.',
  NOW(3), NOW(3)
),
(
  'a-5', 'en', 'minimalist-digital-life',
  'Finding Balance: A Minimalist Approach to Digital Life',
  'How reducing digital clutter can lead to increased focus, creativity, and overall well-being.',
  '<p>Reducing digital clutter unlocks focus and well-being.</p>',
  'Minimalist Digital Life',
  'Reduce digital clutter and reclaim your focus, creativity, and well-being.',
  NOW(3), NOW(3)
),
(
  'a-6', 'en', 'photography-iceland',
  'Chasing Light: Photography Adventures in Iceland',
  'A visual journey through Iceland''s dramatic landscapes, with tips for capturing the perfect shot.',
  '<p>A visual journey through Iceland with practical shooting tips.</p>',
  'Photography in Iceland',
  'A visual journey through Iceland''s dramatic landscapes, with tips for capturing the perfect shot.',
  NOW(3), NOW(3)
),
(
  'a-7', 'en', 'typescript-best-practices',
  'TypeScript Best Practices for Modern Development',
  'Essential patterns and techniques that will level up your TypeScript code.',
  '<p>Essential patterns and techniques that will level up your TypeScript code.</p>',
  'TypeScript Best Practices',
  'Essential patterns and techniques that will level up your TypeScript code.',
  NOW(3), NOW(3)
),
(
  'a-8', 'en', 'psychology-of-color',
  'The Psychology of Color in Interface Design',
  'Understanding how color choices impact user behavior in your designs.',
  '<p>How color choices shape behaviour and perception inside an interface.</p>',
  'Psychology of Color in UI',
  'How color choices impact user behavior and how to leverage that in your designs.',
  NOW(3), NOW(3)
);

-- ── Pivot articles ↔ tags ────────────────────────────────────

INSERT IGNORE INTO `blog_article_tags` (`articleId`, `tagId`) VALUES
  ('a-1', 't-react'),       ('a-1', 't-typescript'),  ('a-1', 't-innovation'),
  ('a-2', 't-ui-ux'),       ('a-2', 't-creativity'),  ('a-2', 't-innovation'),
  ('a-3', 't-startups'),    ('a-3', 't-productivity'), ('a-3', 't-innovation'),
  ('a-4', 't-remote-work'), ('a-4', 't-productivity'), ('a-4', 't-startups'),
  ('a-5', 't-minimalism'),  ('a-5', 't-wellness'),    ('a-5', 't-productivity'),
  ('a-6', 't-photography'), ('a-6', 't-adventure'),   ('a-6', 't-creativity'),
  ('a-7', 't-typescript'),  ('a-7', 't-react'),       ('a-7', 't-innovation'),
  ('a-8', 't-ui-ux'),       ('a-8', 't-creativity'),  ('a-8', 't-innovation');
