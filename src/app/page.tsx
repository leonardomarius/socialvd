export default function HomePage() {
  return (
    <div style={{ padding: "40px", fontSize: "24px" }}>
      <h1>Bienvenue sur SocialVD 🚀</h1>
      <p>Le réseau social gaming arrive très bientôt !</p>

      <a
        href="/login"
        style={{
          display: "inline-block",
          marginTop: "20px",
          padding: "10px 20px",
          background: "black",
          color: "white",
          borderRadius: "6px",
        }}
      >
        Se connecter
      </a>
    </div>
  );
}
