import { Component, type ReactNode } from 'react'

// Keep the course usable when WebGL is unavailable or a GPU context is lost.
export default class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}
