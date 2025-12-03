import oficazLogo from '@/assets/oficaz-logo.png';

export function AuthPageLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <img 
        src={oficazLogo} 
        alt="Oficaz" 
        className="h-10 w-auto mb-8 brightness-0 invert"
      />
      <div className="w-10 h-10 relative">
        <svg 
          className="w-10 h-10" 
          viewBox="0 0 50 50"
          style={{ animation: 'spin 0.8s linear infinite' }}
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="3"
          />
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="60, 200"
          />
        </svg>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
