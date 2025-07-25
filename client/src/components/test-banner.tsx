// Temporary test banner to debug visibility
export function TestBanner() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      backgroundColor: '#2563eb',
      color: 'white',
      padding: '12px',
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: '500'
    }}>
      🔧 TEST BANNER - Si ves esto, el banner funciona!
    </div>
  );
}