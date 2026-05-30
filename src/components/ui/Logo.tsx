import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

export const Logo = ({ className, size = "md", showText = false }: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 100 100"
        className={cn(sizeClasses[size], "flex-shrink-0")}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Octagon background */}
        <path
          d="M29.3 0h41.4L100 29.3v41.4L70.7 100H29.3L0 70.7V29.3L29.3 0z"
          fill="currentColor"
          className="text-[#1e3a5f] dark:text-[#2d4a6f]"
        />
        {/* Chat bubble cutout */}
        <path
          d="M25 30h40c2.8 0 5 2.2 5 5v25c0 2.8-2.2 5-5 5H55l-10 10v-10H25c-2.8 0-5-2.2-5-5V35c0-2.8 2.2-5 5-5z"
          fill="white"
          className="dark:fill-gray-100"
        />
        {/* Two horizontal lines inside chat bubble */}
        <rect x="28" y="40" width="34" height="4" rx="2" fill="currentColor" className="text-[#1e3a5f] dark:text-[#2d4a6f]" />
        <rect x="28" y="50" width="24" height="4" rx="2" fill="currentColor" className="text-[#1e3a5f] dark:text-[#2d4a6f]" />
      </svg>
      {showText && (
        <span className="font-bold text-xl tracking-tight">OctaDezx</span>
      )}
    </div>
  );
};

export const LogoIcon = ({ className, size = "md" }: Omit<LogoProps, "showText">) => {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn(sizeClasses[size], className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Octagon background */}
      <path
        d="M29.3 0h41.4L100 29.3v41.4L70.7 100H29.3L0 70.7V29.3L29.3 0z"
        fill="currentColor"
        className="text-[#1e3a5f] dark:text-[#2d4a6f]"
      />
      {/* Chat bubble cutout */}
      <path
        d="M25 30h40c2.8 0 5 2.2 5 5v25c0 2.8-2.2 5-5 5H55l-10 10v-10H25c-2.8 0-5-2.2-5-5V35c0-2.8 2.2-5 5-5z"
        fill="white"
        className="dark:fill-gray-100"
      />
      {/* Two horizontal lines inside chat bubble */}
      <rect x="28" y="40" width="34" height="4" rx="2" fill="currentColor" className="text-[#1e3a5f] dark:text-[#2d4a6f]" />
      <rect x="28" y="50" width="24" height="4" rx="2" fill="currentColor" className="text-[#1e3a5f] dark:text-[#2d4a6f]" />
    </svg>
  );
};

export default Logo;
