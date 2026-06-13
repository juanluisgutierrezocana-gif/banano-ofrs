import React from "react";

export default function BananoAnimation() {
  return (
    <div className="flex justify-center items-end px-2 pb-3 select-none pointer-events-none">
      <style>{`
        @keyframes bananaSway {
          0%   { transform: rotate(-1.5deg); }
          50%  { transform: rotate(1.5deg); }
          100% { transform: rotate(-1.5deg); }
        }
        .banana-plant {
          animation: bananaSway 4s ease-in-out infinite;
          transform-origin: bottom center;
          display: block;
        }
      `}</style>
      <img
        src="/banano-icon.png"
        alt="Mata de banano"
        className="banana-plant"
        style={{
          width: "180px",
          height: "auto",
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
}