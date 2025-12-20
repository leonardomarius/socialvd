"use client";

import { useState, useEffect, useRef } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import SearchOverlay from "./SearchOverlay";
import { supabase } from "@/lib/supabase";

type NavbarSearchProps = {
  myId: string | null;
  pseudo: string;
};

export default function NavbarSearch({ myId, pseudo }: NavbarSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleInputClick = () => {
    setIsOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery("");
  };

  return (
    <>
      <div className="navbar-search-wrapper">
        <div className="navbar-search-input-container">
          <MagnifyingGlassIcon className="navbar-search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search users, posts..."
            value={query}
            onClick={handleInputClick}
            onChange={handleInputChange}
            className="navbar-search-input"
          />
        </div>
      </div>

      {isOpen && (
        <SearchOverlay
          query={query}
          onQueryChange={setQuery}
          onClose={handleClose}
          myId={myId}
          pseudo={pseudo}
        />
      )}

      <style jsx>{`
        .navbar-search-wrapper {
          position: relative;
        }

        .navbar-search-input-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .navbar-search-icon {
          position: absolute;
          left: 10px;
          width: 18px;
          height: 18px;
          color: rgba(180, 180, 180, 0.7);
          pointer-events: none;
        }

        .navbar-search-input {
          width: 240px;
          padding: 8px 12px 8px 36px;
          background: rgba(30, 30, 30, 0.8);
          border: 1px solid rgba(100, 100, 100, 0.3);
          border-radius: 8px;
          color: #ffffff;
          font-size: 0.85rem;
          font-family: "Space Grotesk", sans-serif;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
        }

        .navbar-search-input::placeholder {
          color: rgba(180, 180, 180, 0.6);
        }

        .navbar-search-input:focus {
          width: 280px;
          border-color: rgba(250, 204, 21, 0.5);
          background: rgba(35, 35, 35, 0.9);
          box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.15),
            0 0 16px rgba(250, 204, 21, 0.1);
        }

        @media (max-width: 768px) {
          .navbar-search-input {
            width: 180px;
          }

          .navbar-search-input:focus {
            width: 220px;
          }
        }
      `}</style>
    </>
  );
}

