import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <div className="page-eyebrow">404 // NOT FOUND</div>
      <h1 className="page-title">Page Not Found</h1>
      <p className="page-desc">
        The requested map, player profile, or resource could not be located in the CS2KZ database.
      </p>
      <div style={{ display: "flex", gap: "12px" }}>
        <Link className="btn-minimal btn-primary" href="/maps">
          Browse Maps
        </Link>
        <Link className="btn-minimal" href="/">
          Dashboard Home
        </Link>
      </div>
    </>
  );
}
