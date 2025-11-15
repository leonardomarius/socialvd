export default function HomePage() {
  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Bienvenue sur SocialVD 🚀</h1>
      <p>Le réseau social gaming arrive très bientôt.</p>

      <a
        href="/login"
        style={{
          backgroundColor: "#000",
          color: "#fff",
          padding: "12px 20px",
          borderRadius: "6px",
          textDecoration: "none",
          display: "inline-block",
          marginTop: "20px",
          fontWeight: "bold",
        }}
      >
        Se connecter
      </a>
    </main>
  );
}
