-- ======================================
-- ENABLE TRIGRAM EXTENSION
-- ======================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ======================================
-- TRIGRAM INDEX ON PROFILES.PSEUDO
-- ======================================
CREATE INDEX IF NOT EXISTS idx_profiles_pseudo_trgm 
ON public.profiles 
USING gin (pseudo gin_trgm_ops);

-- ======================================
-- FULL-TEXT SEARCH FOR POSTS
-- ======================================
-- Create a generated column for FTS vector
-- This includes: content, author_pseudo, and game name (via subquery)

-- First, add a computed column for the search vector
-- We'll use a function-based index instead for better performance

-- Create a function to generate the search vector
CREATE OR REPLACE FUNCTION posts_search_vector(p public.posts)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    setweight(to_tsvector('simple', COALESCE(p.content, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(p.author_pseudo, '')), 'B')
$$;


-- Create GIN index on the search vector
CREATE INDEX IF NOT EXISTS idx_posts_search_vector 
ON public.posts 
USING gin (posts_search_vector(posts));

-- ======================================
-- RPC FUNCTION: search_global
-- ======================================
CREATE OR REPLACE FUNCTION public.search_global(
  q text,
  profiles_limit int DEFAULT 6,
  posts_limit int DEFAULT 12
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  profiles_result json;
  posts_result json;
BEGIN
  -- Return empty if query is null or empty
  IF q IS NULL OR trim(q) = '' THEN
    RETURN json_build_object(
      'profiles', '[]'::json,
      'posts', '[]'::json
    );
  END IF;

  -- Search profiles using trigram similarity + prefix match
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'pseudo', p.pseudo,
      'avatar_url', p.avatar_url,
      'bio', p.bio
    ) ORDER BY 
      CASE 
        WHEN lower(p.pseudo) LIKE lower(q || '%') THEN 1
        ELSE 2
      END,
      similarity(p.pseudo, q) DESC
  )
  INTO profiles_result
  FROM public.profiles p
  WHERE 
    p.pseudo IS NOT NULL
    AND (
      similarity(p.pseudo, q) > 0.2
      OR lower(p.pseudo) LIKE lower('%' || q || '%')
    )
  LIMIT profiles_limit;

  -- Search posts using Full-Text Search
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'user_id', p.user_id,
      'author_pseudo', p.author_pseudo,
      'content', p.content,
      'media_url', p.media_url,
      'media_type', p.media_type,
      'created_at', p.created_at,
      'game_id', p.game_id,
      'game_name', g.name,
      'game_slug', g.slug
    ) ORDER BY 
      ts_rank(posts_search_vector(p), websearch_to_tsquery('simple', q)) DESC,
      p.created_at DESC
  )
  INTO posts_result
  FROM public.posts p
  LEFT JOIN public.games g ON g.id = p.game_id
  WHERE 
    posts_search_vector(p) @@ websearch_to_tsquery('simple', q)
  LIMIT posts_limit;

  -- Return combined result
  RETURN json_build_object(
    'profiles', COALESCE(profiles_result, '[]'::json),
    'posts', COALESCE(posts_result, '[]'::json)
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.search_global(text, int, int) TO authenticated;

