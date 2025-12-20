"use client";

import { useState } from "react";

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

type Props = {
  posts: Post[];
  onPostClick: (post: Post) => void;
};

export default function SearchPostsCarousel({ posts, onPostClick }: Props) {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [carouselRef, setCarouselRef] = useState<HTMLDivElement | null>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  const scroll = (direction: "left" | "right") => {
    if (!carouselRef) return;
    const scrollAmount = 320;
    const newScrollLeft =
      direction === "left"
        ? scrollLeft - scrollAmount
        : scrollLeft + scrollAmount;
    carouselRef.scrollTo({ left: newScrollLeft, behavior: "smooth" });
  };

  if (posts.length === 0) {
    return (
      <div className="search-posts-empty">
        <p>No posts found</p>
      </div>
    );
  }

  return (
    <div className="search-posts-section">
      <div className="search-posts-header">
        <h3 className="search-section-title">Posts</h3>
        {posts.length > 3 && (
          <div className="search-posts-controls">
            <button
              className="search-scroll-btn"
              onClick={() => scroll("left")}
              disabled={scrollLeft === 0}
              type="button"
            >
              ←
            </button>
            <button
              className="search-scroll-btn"
              onClick={() => scroll("right")}
              type="button"
            >
              →
            </button>
          </div>
        )}
      </div>
      <div
        className="search-posts-carousel"
        onScroll={handleScroll}
        ref={setCarouselRef}
      >
        {posts.map((post) => (
          <div
            key={post.id}
            className="search-post-card"
            onClick={() => onPostClick(post)}
          >
            {post.media_url && (
              <div className="search-post-media">
                {post.media_type === "image" ? (
                  <img
                    src={post.media_url}
                    alt="Post"
                    className="search-post-image"
                  />
                ) : post.media_type === "video" ? (
                  <video
                    src={post.media_url}
                    className="search-post-video"
                    muted
                    preload="metadata"
                  />
                ) : null}
              </div>
            )}
            <div className="search-post-content">
              <p className="search-post-excerpt">
                {post.content.length > 100
                  ? post.content.substring(0, 100) + "..."
                  : post.content}
              </p>
              <div className="search-post-meta">
                <span className="search-post-author">{post.author_pseudo}</span>
                {post.game_name && (
                  <span className="search-post-game">• {post.game_name}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <style jsx>{`
        .search-posts-section {
          margin-top: 24px;
        }

        .search-posts-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .search-section-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: #ffffff;
          letter-spacing: 0.02em;
        }

        .search-posts-controls {
          display: flex;
          gap: 8px;
        }

        .search-scroll-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          background: rgba(30, 30, 30, 0.8);
          border: 1px solid rgba(100, 100, 100, 0.3);
          color: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 1rem;
        }

        .search-scroll-btn:hover:not(:disabled) {
          background: rgba(40, 40, 40, 0.9);
          border-color: rgba(250, 204, 21, 0.5);
          color: #facc15;
        }

        .search-scroll-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .search-posts-carousel {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          overflow-y: hidden;
          padding-bottom: 8px;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }

        .search-posts-carousel::-webkit-scrollbar {
          height: 6px;
        }

        .search-posts-carousel::-webkit-scrollbar-track {
          background: rgba(30, 30, 30, 0.5);
          border-radius: 3px;
        }

        .search-posts-carousel::-webkit-scrollbar-thumb {
          background: rgba(100, 100, 100, 0.5);
          border-radius: 3px;
        }

        .search-posts-carousel::-webkit-scrollbar-thumb:hover {
          background: rgba(250, 204, 21, 0.5);
        }

        .search-post-card {
          flex: 0 0 300px;
          background: rgba(30, 30, 30, 0.85);
          border: 1px solid rgba(100, 100, 100, 0.2);
          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
        }

        .search-post-card:hover {
          border-color: rgba(250, 204, 21, 0.5);
          transform: translateY(-4px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4),
            0 0 24px rgba(250, 204, 21, 0.1);
        }

        .search-post-media {
          width: 100%;
          height: 200px;
          overflow: hidden;
          background: rgba(20, 20, 20, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .search-post-image,
        .search-post-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .search-post-content {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .search-post-excerpt {
          font-size: 0.85rem;
          color: #ffffff;
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .search-post-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: rgba(180, 180, 180, 0.8);
        }

        .search-post-author {
          font-weight: 500;
          color: #ffffff;
        }

        .search-post-game {
          color: rgba(180, 180, 180, 0.6);
        }

        .search-posts-empty {
          padding: 40px 20px;
          text-align: center;
          color: rgba(180, 180, 180, 0.8);
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}

