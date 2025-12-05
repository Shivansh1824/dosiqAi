export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Shield Icon */}
      <div className="relative">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-lg"
        >
          {/* Rounded square background with gradient */}
          <rect
            width="120"
            height="120"
            rx="24"
            fill="url(#gradient)"
          />
          
          {/* Shield shape */}
          <path
            d="M60 25C60 25 45 28 35 35C35 45 33 70 60 90C87 70 85 45 85 35C75 28 60 25 60 25Z"
            fill="white"
            stroke="white"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          
          {/* Medical cross - horizontal bar */}
          <rect
            x="47"
            y="52"
            width="26"
            height="8"
            rx="2"
            fill="url(#gradient)"
          />
          
          {/* Medical cross - vertical bar */}
          <rect
            x="56"
            y="43"
            width="8"
            height="26"
            rx="2"
            fill="url(#gradient)"
          />
          
          <defs>
            <linearGradient
              id="gradient"
              x1="0"
              y1="0"
              x2="120"
              y2="120"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#4A90E2" />
              <stop offset="100%" stopColor="#66BB6A" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      {/* App Name */}
      <div className="flex flex-col">
        <span className="text-[36px] text-gray-800 tracking-tight" style={{ fontWeight: 'bold', lineHeight: '1' }}>
          FamilyCare
        </span>
        <span className="text-[36px] text-gray-800 tracking-tight" style={{ fontWeight: 'bold', lineHeight: '1' }}>
          Health
        </span>
      </div>
    </div>
  );
}
