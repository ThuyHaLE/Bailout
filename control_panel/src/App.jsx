// control_panel/src/App.jsx
import { useState } from "react";
import BailoutDemo from "./BailoutDemo.jsx";

function ErrorBoundary({ children }) {
  const [err, setErr] = useState(null);

  if (err) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      height:"100vh", background:"#0F0F0E", gap:12, fontFamily:"monospace" }}>
      <div style={{ color:"#E05A3A", fontSize:12 }}>Something went wrong</div>
      <pre style={{ fontSize:9, color:"#4A4640", maxWidth:500, textAlign:"center" }}>{err.message}</pre>
      <button onClick={() => setErr(null)}
        style={{ marginTop:8, color:"#22C98A", background:"none", border:"1px solid #22C98A",
          padding:"6px 16px", borderRadius:4, cursor:"pointer", fontFamily:"monospace", fontSize:11 }}>
        Retry
      </button>
    </div>
  );

  return (
    <div onError={e => setErr(e.error)}>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BailoutDemo />
    </ErrorBoundary>
  );
}