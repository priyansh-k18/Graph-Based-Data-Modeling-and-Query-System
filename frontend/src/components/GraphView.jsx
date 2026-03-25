import React, { useMemo, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import './GraphView.css';

// A custom node for beautiful rendering
const CustomNode = ({ data, selected }) => {
  const isHighlighted = data.highlighted;
  let typeColor = '#3b82f6'; // Customer
  let icon = '👤';
  
  if (data.type === 'Order') { typeColor = '#10b981'; icon = '🛒'; }
  else if (data.type === 'Delivery') { typeColor = '#f59e0b'; icon = '🚚'; }
  else if (data.type === 'Invoice') { typeColor = '#8b5cf6'; icon = '📄'; }
  else if (data.type === 'Journal Entry') { typeColor = '#ef4444'; icon = '📔'; }

  return (
    <div className={`custom-node ${selected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`} style={{ borderColor: typeColor }}>
      <div className="node-icon" style={{ backgroundColor: typeColor + '20', color: typeColor }}>{icon}</div>
      <div className="node-content">
        <div className="node-type" style={{ color: typeColor }}>{data.type}</div>
        <div className="node-label">{data.label}</div>
      </div>
      {/* Invisible Handles managed by CSS classes or injected if needed */}
      <div className="react-flow__handle react-flow__handle-top custom-handle" style={{ background: typeColor }}></div>
      <div className="react-flow__handle react-flow__handle-bottom custom-handle" style={{ background: typeColor }}></div>
    </div>
  );
};

const nodeTypes = { customNode: CustomNode };

const generateLayout = (nodes, edges) => {
    // A simple concentric/force-like deterministic layout or Dagre.
    // Since we don't have dagre installed, let's do a simple circle packing or grid based on type
    const levels = {
        'Customer': 0,
        'Order': 1,
        'Delivery': 2,
        'Invoice': 3,
        'Journal Entry': 4
    };

    const typeCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    
    return nodes.map(n => {
        const lvl = levels[n.data.type] || 0;
        const count = typeCounts[lvl]++;
        
        return {
            ...n,
            position: {
                x: lvl * 300,
                y: count * 80
            }
        };
    });
};

const GraphView = ({ initialNodes, initialEdges, highlightedNodes }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (initialNodes.length === 0) return;
    
    // Process layout
    const layoutedNodes = generateLayout(initialNodes, initialEdges);
    
    // Apply highlights
    const processedNodes = layoutedNodes.map(n => ({
      ...n,
      data: { ...n.data, highlighted: highlightedNodes.includes(n.id) }
    }));

    // Process edges
    const processedEdges = initialEdges.map(e => ({
      ...e,
      animated: highlightedNodes.includes(e.source) || highlightedNodes.includes(e.target),
      style: { stroke: highlightedNodes.includes(e.source) || highlightedNodes.includes(e.target) ? '#ec4899' : '#475569', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: highlightedNodes.includes(e.source) ? '#ec4899' : '#475569' }
    }));

    setNodes(processedNodes);
    setEdges(processedEdges);
  }, [initialNodes, initialEdges, highlightedNodes, setNodes, setEdges]);

  return (
    <div className="graph-wrapper">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 50, y: 50, zoom: 0.7 }}
        attributionPosition="bottom-right"
        className="dark-theme-flow"
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls className="graph-controls" />
        <MiniMap 
          nodeColor={n => {
            if (n.data.type === 'Customer') return '#3b82f6';
            if (n.data.type === 'Order') return '#10b981';
            return '#8b5cf6';
          }}
          maskColor="rgba(15, 23, 42, 0.7)"
          className="graph-minimap"
        />
      </ReactFlow>
    </div>
  );
};

export default GraphView;
