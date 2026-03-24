import React, { useState, useEffect } from 'react';
import GraphView from './components/GraphView';
import ChatPanel from './components/ChatPanel';
import './App.css';

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [highlightedNodes, setHighlightedNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/graph')
      .then(res => res.json())
      .then(data => {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load graph", err);
        setLoading(false);
      });
  }, []);

  const handleHighlight = (nodeIds) => {
    setHighlightedNodes(nodeIds);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon"></div>
          <h1>Dodge AI - Graph Explorer</h1>
        </div>
        <div className="header-status">
          <span className="dot online"></span>
          System Context Online
        </div>
      </header>
      
      <main className="app-content">
        <div className="graph-section">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Constructing Graph...</p>
            </div>
          ) : (
             <GraphView 
               initialNodes={nodes} 
               initialEdges={edges} 
               highlightedNodes={highlightedNodes} 
             />
          )}
        </div>
        <div className="chat-section">
          <ChatPanel onHighlightNodes={handleHighlight} />
        </div>
      </main>
    </div>
  );
}

export default App;
