import React from 'react';

// Proactively probe for WebGL support using a throwaway canvas, *without* ever
// constructing a THREE.WebGLRenderer. This lets callers avoid mounting
// ForceGraph3D at all in sandboxed/GPU-disabled browsers, sidestepping the
// noisy uncaught WebGLRenderer errors entirely (the error boundary below is
// kept only as a last-resort safety net for other runtime 3D failures).
let _webglSupportCache = null;
export function isWebGLAvailable() {
  if (_webglSupportCache !== null) return _webglSupportCache;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    _webglSupportCache = !!gl;
  } catch (e) {
    _webglSupportCache = false;
  }
  return _webglSupportCache;
}

export function WebGLUnavailableMessage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      width: '100%', height: '100%', gap: '8px', padding: '24px', textAlign: 'center',
      backgroundColor: 'rgb(var(--surface-primary))',
      color: 'rgb(var(--text-muted))',
      fontSize: '14px',
    }}>
      <div style={{ fontWeight: 600, color: 'rgb(var(--text-primary))' }}>
        3D view unavailable
      </div>
      <div>
        Your browser could not create a WebGL context (GPU acceleration may be disabled or unsupported).
      </div>
      <div>
        Try enabling hardware acceleration, using a different browser, or switching to the 2D / Table view.
      </div>
    </div>
  );
}

class WebGLErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[NEBULA] 3D viewer crashed:', error, info);
  }

  componentDidUpdate(prevProps) {
    // Allow retrying (e.g. new search) by resetting error state when graphData changes
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return <WebGLUnavailableMessage />;
    }
    return this.props.children;
  }
}

export default WebGLErrorBoundary;
