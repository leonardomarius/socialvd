"use client";

import Link from "next/link";

type Profile = {
  id: string;
  pseudo: string;
  avatar_url: string | null;
  bio: string | null;
};

type Props = {
  profiles: Profile[];
  onSelect?: () => void;
};

export default function SearchUsersList({ profiles, onSelect }: Props) {
  if (profiles.length === 0) return null;

  return (
    <div className="search-users-section">
      <h3 className="search-section-title">Users</h3>
      <div className="search-users-list">
        {profiles.map((profile) => (
          <Link
            key={profile.id}
            href={`/profile/${profile.id}`}
            onClick={onSelect}
            className="search-user-item"
          >
            <img
              src={
                profile.avatar_url ||
                "https://via.placeholder.com/48/333333/FFFFFF?text=?"
              }
              alt={profile.pseudo}
              className="search-user-avatar"
            />
            <div className="search-user-info">
              <span className="search-user-pseudo">{profile.pseudo}</span>
              {profile.bio && (
                <span className="search-user-bio">{profile.bio}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
      <style jsx>{`
        .search-users-section {
          margin-bottom: 24px;
        }

        .search-section-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 12px;
          letter-spacing: 0.02em;
        }

        .search-users-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .search-user-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 8px;
          background: rgba(30, 30, 30, 0.6);
          border: 1px solid rgba(100, 100, 100, 0.2);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          cursor: pointer;
        }

        .search-user-item:hover {
          background: rgba(40, 40, 40, 0.8);
          border-color: rgba(250, 204, 21, 0.4);
          transform: translateX(4px);
        }

        .search-user-avatar {
          width: 48px;
          height: 48px;
          border-radius: 999px;
          object-fit: cover;
          border: 1px solid rgba(156, 163, 175, 0.2);
          flex-shrink: 0;
        }

        .search-user-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 0;
        }

        .search-user-pseudo {
          font-size: 0.9rem;
          font-weight: 600;
          color: #ffffff;
          letter-spacing: 0.02em;
        }

        .search-user-bio {
          font-size: 0.8rem;
          color: rgba(180, 180, 180, 0.8);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

