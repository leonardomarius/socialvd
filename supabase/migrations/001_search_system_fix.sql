-- ======================================
-- FIXED RPC FUNCTION: search_global
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
  trimmed_q text;
  fts_query tsquery;
BEGIN
  -- Return empty if query is null or empty
  trimmed_q := trim(q);
  IF trimmed_q IS NULL OR trimmed_q = '' THEN
    RETURN json_build_object(
      'profiles', '[]'::json,
      'posts', '[]'::json
    );
  END IF;

  -- Normalize query for searching
  trimmed_q := lower(trimmed_q);

  -- Search profiles using ILIKE prefix match + similarity
  -- Priority: prefix matches first, then similarity
  WITH profiles_matched AS (
    SELECT 
      p.id,
      p.pseudo,
      p.avatar_url,
      CASE WHEN lower(p.pseudo) LIKE trimmed_q || '%' THEN 0 ELSE 1 END as prefix_priority,
      similarity(p.pseudo, q) as sim
    FROM public.profiles p
    WHERE 
      p.pseudo IS NOT NULL
      AND (
        -- Prefix match (most important)
        lower(p.pseudo) LIKE trimmed_q || '%'
        -- OR contains match
        OR lower(p.pseudo) LIKE '%' || trimmed_q || '%'
        -- OR similarity (lower threshold for short queries)
        OR similarity(p.pseudo, q) > CASE 
          WHEN length(trimmed_q) <= 2 THEN 0.1
          WHEN length(trimmed_q) <= 4 THEN 0.15
          ELSE 0.2
        END
      )
    ORDER BY 
      prefix_priority,
      sim DESC,
      p.pseudo ASC
    LIMIT profiles_limit
  )
  SELECT json_agg(
    json_build_object(
      'id', id,
      'pseudo', pseudo,
      'avatar_url', avatar_url
    )
  )
  INTO profiles_result
  FROM profiles_matched;

  -- Build FTS query (handle NULL case)
  BEGIN
    fts_query := websearch_to_tsquery('simple', q);
    -- If query results in empty tsquery, set to NULL
    IF fts_query IS NULL OR fts_query = ''::tsquery THEN
      fts_query := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If websearch_to_tsquery fails, try plainto_tsquery as fallback
    BEGIN
      fts_query := plainto_tsquery('simple', q);
      IF fts_query IS NULL OR fts_query = ''::tsquery THEN
        fts_query := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      fts_query := NULL;
    END;
  END;

  -- Search posts using FTS OR ILIKE fallbacks
  WITH posts_matched AS (
    SELECT 
      p.id,
      p.user_id,
      p.author_pseudo,
      p.content,
      p.media_url,
      p.media_type,
      p.created_at,
      p.game_id,
      g.name as game_name,
      g.slug as game_slug,
      CASE 
        WHEN fts_query IS NOT NULL AND posts_search_vector(p) @@ fts_query 
        THEN ts_rank(posts_search_vector(p), fts_query)
        ELSE 0
      END as fts_rank
    FROM public.posts p
    LEFT JOIN public.games g ON g.id = p.game_id
    WHERE 
      -- FTS match (if query is valid)
      (fts_query IS NOT NULL AND posts_search_vector(p) @@ fts_query)
      -- OR ILIKE fallbacks
      OR lower(p.content) LIKE '%' || trimmed_q || '%'
      OR lower(p.author_pseudo) LIKE '%' || trimmed_q || '%'
      OR (g.name IS NOT NULL AND lower(g.name) LIKE '%' || trimmed_q || '%')
    ORDER BY 
      fts_rank DESC,
      p.created_at DESC
    LIMIT posts_limit
  )
  SELECT json_agg(
    json_build_object(
      'id', id,
      'user_id', user_id,
      'author_pseudo', author_pseudo,
      'content', content,
      'media_url', media_url,
      'media_type', media_type,
      'created_at', created_at,
      'game_id', game_id,
      'game_name', game_name,
      'game_slug', game_slug
    )
  )
  INTO posts_result
  FROM posts_matched;

  -- Return combined result
  RETURN json_build_object(
    'profiles', COALESCE(profiles_result, '[]'::json),
    'posts', COALESCE(posts_result, '[]'::json)
  );
END;
$$;
