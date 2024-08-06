import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor() {
    super();

    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError(error) {
    console.log("getDerivedStateFromError");
    return {
      hasError: true,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.log("componentDidCatch");
    // TODO: logging
  }

  render() {
    if (this.state.hasError) {
      return <h1>404</h1>;
    }

    return this.props.children;
  }
}
