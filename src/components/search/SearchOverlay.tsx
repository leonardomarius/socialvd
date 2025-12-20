"use client";

import { useEffect, useState, useRef } from "react";
import SearchUsersList from "./SearchUsersList";
import SearchPostsCarousel from "./SearchPostsCarousel";
import PostModal from "./PostModal";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  pseudo: string;
  avatar_url: string | null;
  bio: string | null;
};

type Post = {
  id: string;
  user_id: string;
  author_pseudo: string | null;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  game_id: string;
  game_name: string | null;
  game_slug: string | null;
};

type SearchOverlayProps = {
  query: string;
  onClose: () => void;
  myId: string | null;
  pseudo: string;
};

export default function SearchOverlay({
  query,
  onClose,
  myId,
  pseudo,
}: SearchOverlayProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Search with debounce
  useEffect(() => {
    if (!query || query.trim().length === 0) {
      setProfiles([]);
      setPosts([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Debounce
    const timeoutId = setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
          {
            signal: abortControllerRef.current?.signal,
          }
        );

        // Always try to parse JSON, even if response is not ok
        // The API should always return valid JSON with empty arrays on error
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          // If JSON parsing fails, use empty results
          console.warn("Failed to parse search response:", parseError);
          data = { profiles: [], posts: [] };
        }

        // Gracefully handle any response status
        // Set results to empty arrays if response was not ok
        if (!response.ok) {
          console.warn("Search response not ok:", response.status, response.statusText);
          setProfiles([]);
          setPosts([]);
        } else {
          // Response is ok, use the data (with fallbacks)
          setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
          setPosts(Array.isArray(data.posts) ? data.posts : []);
        }
      } catch (error: any) {
        // Only log non-abort errors
        if (error.name !== "AbortError") {
          console.error("Search fetch error:", error);
        }
        // Always set empty results on error (graceful degradation)
        setProfiles([]);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query]);

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
  };

  const handlePostClose = () => {
    setSelectedPost(null);
  };

  return (
    <>
      <div className="search-overlay-backdrop" onClick={onClose}>
        <div
          ref={overlayRef}
          className="search-overlay-card"
          onClick={(e) => e.stopPropagation()}
        >
          {loading && (
            <div className="search-loading">
              <p>Searching...</p>
            </div>
          )}

          {!loading && (
            <>
              <SearchUsersList
                profiles={profiles}
                onSelect={onClose}
              />
              <SearchPostsCarousel
                posts={posts}
                onPostClick={handlePostClick}
              />
            </>
          )}
        </div>
      </div>

      {selectedPost && (
        <PostModal
          postId={selectedPost.id}
          initialPost={{
            id: selectedPost.id,
            user_id: selectedPost.user_id,
            author_pseudo: selectedPost.author_pseudo,
            content: selectedPost.content,
            media_url: selectedPost.media_url,
            media_type: selectedPost.media_type,
            created_at: selectedPost.created_at,
            game_id: selectedPost.game_id,
            games: selectedPost.game_slug
              ? {
                  id: selectedPost.game_id,
                  name: selectedPost.game_name || "",
                  slug: selectedPost.game_slug,
                }
              : null,
            avatar_url: null,
            likes_count: 0,
            isLikedByMe: false,
          }}
          onClose={handlePostClose}
          myId={myId}
          pseudo={pseudo}
        />
      )}

      <style jsx>{`
        .search-overlay-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9998;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 80px;
          animation: fadeIn 0.15s ease-out;
        }

        .search-overlay-card {
          width: 75%;
          max-width: 900px;
          max-height: calc(100vh - 120px);
          overflow-y: auto;
          background: rgba(26, 26, 26, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(100, 100, 100, 0.3);
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
          animation: slideDown 0.2s ease-out;
        }

        .search-overlay-card::-webkit-scrollbar {
          width: 8px;
        }

        .search-overlay-card::-webkit-scrollbar-track {
          background: rgba(30, 30, 30, 0.5);
          border-radius: 4px;
        }

        .search-overlay-card::-webkit-scrollbar-thumb {
          background: rgba(100, 100, 100, 0.5);
          border-radius: 4px;
        }

        .search-overlay-card::-webkit-scrollbar-thumb:hover {
          background: rgba(250, 204, 21, 0.5);
        }

        .search-loading {
          padding: 40px;
          text-align: center;
          color: rgba(180, 180, 180, 0.8);
          font-size: 0.9rem;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

