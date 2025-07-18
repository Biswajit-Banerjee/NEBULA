export default function Logo({ className = "w-16 h-16" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      className={className}
    >
      <defs>
        <filter id="glow1" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient
          id="mainNodesGradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>

        <linearGradient
          id="subNodesGradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
      </defs>

      <circle
        cx="60"
        cy="60"
        r="56"
        fill="none"
        stroke="url(#mainNodesGradient)"
        strokeWidth="2"
        className="outer-circle"
      />

      <g className="connections">
        {/* Connections for the left main node */}
        <line
          x1="35"
          y1="60"
          x2="20"
          y2="40"
          stroke="#F472B6"
          strokeWidth="2"
        />
        <line
          x1="35"
          y1="60"
          x2="15"
          y2="60"
          stroke="#F472B6"
          strokeWidth="2"
        />
        <line
          x1="35"
          y1="60"
          x2="20"
          y2="80"
          stroke="#F472B6"
          strokeWidth="2"
        />

        {/* Connections for the right main node */}
        <line
          x1="85"
          y1="60"
          x2="100"
          y2="40"
          stroke="#F472B6"
          strokeWidth="2"
        />
        <line
          x1="85"
          y1="60"
          x2="105"
          y2="60"
          stroke="#F472B6"
          strokeWidth="2"
        />
        <line
          x1="85"
          y1="60"
          x2="100"
          y2="80"
          stroke="#F472B6"
          strokeWidth="2"
        />

        {/* Connection between main nodes */}
        <line
          x1="35"
          y1="60"
          x2="85"
          y2="60"
          stroke="#4F46E5"
          strokeWidth="1"
          strokeDasharray="6,4"
        />

        {/* Dotted lines from eyes to nose */}
        <line
          x1="35"
          y1="60"
          x2="55"
          y2="85"
          stroke="#4F46E5"
          strokeWidth="1"
          strokeDasharray="2,6"
        />
        <line
          x1="85"
          y1="60"
          x2="65"
          y2="85"
          stroke="#4F46E5"
          strokeWidth="1"
          strokeDasharray="2,6"
        />
      </g>

      <g className="nodes">
        {/* Outer sub-nodes */}
        <circle cx="20" cy="40" r="5" fill="url(#subNodesGradient)" />
        <circle cx="15" cy="60" r="5" fill="url(#subNodesGradient)" />
        <circle cx="20" cy="80" r="5" fill="url(#subNodesGradient)" />
        <circle cx="100" cy="40" r="5" fill="url(#subNodesGradient)" />
        <circle cx="105" cy="60" r="5" fill="url(#subNodesGradient)" />
        <circle cx="100" cy="80" r="5" fill="url(#subNodesGradient)" />

        {/* Main "eye" nodes */}
        <circle
          cx="35"
          cy="60"
          r="10"
          fill="url(#mainNodesGradient)"
          filter="url(#glow1)"
        />
        <circle
          cx="85"
          cy="60"
          r="10"
          fill="url(#mainNodesGradient)"
          filter="url(#glow1)"
        />

        {/* New "nose" node */}
        <ellipse
          cx="60"
          cy="85"
          rx="10"
          ry="7"
          fill="none"
          stroke="url(#subNodesGradient)"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
