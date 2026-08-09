// Shared Material Symbol helper used across the marketing pages.
export const MI = ({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>
);

// Live demo store (same one linked from the home page).
export const DEMO_BUSINESS_ID = "a9a0d41a-6651-4d59-9e66-a8b15ba068f1";
export const DEMO_CHAT_URL = `/chat/${DEMO_BUSINESS_ID}`;
